const prisma = require("../../config/database");
const { requireActiveSocieteId } = require("../../utils/societeScope");
const { listAnomalies } = require("../stock/anomalies.service");
const { getForecast, aggregateMonthlySales } = require("../stock/forecast.service");
const { probeAiService } = require("../stock/aiLocal.fallback");
const { getExpiryWasteRisk, toDashboardCard } = require("../stock/expiryWaste.service");

const DONUT_COLORS = {
  reapprovisionner: "#00f5c4",
  reduire: "#ff6b6b",
  transferer: "#7c6fff",
  surveiller: "#ffd93d",
};

const DONUT_LABELS = {
  reapprovisionner: "Réapprovisionner",
  reduire: "Réduire",
  transferer: "Transférer",
  surveiller: "Surveiller",
};

function mapSeverite(score) {
  if (score >= 70) return "elevee";
  if (score >= 40) return "moyenne";
  return "faible";
}

function mapAnomalyType(raison) {
  const r = String(raison || "").toLowerCase();
  if (r.includes("rupture")) return "rupture";
  if (r.includes("supérieure") || r.includes("superieure") || r.includes("pic")) return "pic_demande";
  if (r.includes("délai") || r.includes("delai")) return "delai";
  return "variation";
}

function getAlertThreshold(article) {
  const raw = article?.seuilAlerte ?? article?.stockMin ?? article?.seuil;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 10;
}

function parseDateBound(value, endOfDay = false) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(d) {
  const x = new Date(d);
  return x.toISOString().slice(0, 10);
}

function lastNDayKeys(n = 7) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

function buildChartFromForecast(fc) {
  const hist = fc?.historique || [];
  const preds = fc?.predictions || [];
  const rows = hist.map((h) => ({
    date: h.mois,
    reel: Number(h.valeur) || 0,
    prevision: null,
    confMin: null,
    confMax: null,
  }));

  if (rows.length) {
    const last = rows[rows.length - 1];
    last.prevision = last.reel;
    last.confMin = Math.round(last.reel * 0.85 * 100) / 100;
    last.confMax = Math.round(last.reel * 1.15 * 100) / 100;
  }

  for (const p of preds) {
    rows.push({
      date: p.mois,
      reel: null,
      prevision: Number(p.valeur) || 0,
      confMin: Number(p.min) || 0,
      confMax: Number(p.max) || 0,
    });
  }

  return rows;
}

function buildFallbackChart(historique) {
  return (historique || []).slice(-12).map((h) => {
    const v = Number(h.quantite ?? h.valeur) || 0;
    return {
      date: h.mois,
      reel: v,
      prevision: Math.round(v * 1.05),
      confMin: Math.round(v * 0.9),
      confMax: Math.round(v * 1.1),
    };
  });
}

async function loadProductForecasts(articles, societeId) {
  const slice = articles.slice(0, 6);
  const settled = await Promise.allSettled(
    slice.map(async (art) => {
      const fc = await getForecast(art.id, societeId);
      const predSum = (fc.predictions || []).reduce((s, p) => s + Number(p.valeur || 0), 0);
      return {
        id: art.id,
        nom: art.libelle,
        code: art.code,
        image_url: art.imageUrl || null,
        prevision4sem: Math.round(predSum),
        tendance: Number(fc.variationPct) || 0,
        confiance: Number(fc.confidence) || 50,
        modele: fc.modele || fc.mode || "holt_winters",
        forecast: fc,
      };
    })
  );

  const produits = [];
  let chartData = [];
  let previsionsOk = 0;
  let confidenceSum = 0;

  for (let i = 0; i < settled.length; i += 1) {
    const art = slice[i];
    const result = settled[i];
    if (result.status === "fulfilled") {
      previsionsOk += 1;
      confidenceSum += result.value.confiance;
      produits.push({
        id: result.value.id,
        nom: result.value.nom,
        code: result.value.code,
        image_url: result.value.image_url,
        prevision4sem: result.value.prevision4sem,
        tendance: result.value.tendance,
        confiance: result.value.confiance,
        modele: result.value.modele,
      });
      if (!chartData.length) chartData = buildChartFromForecast(result.value.forecast);
    } else {
      produits.push({
        id: art.id,
        nom: art.libelle,
        code: art.code,
        image_url: art.imageUrl || null,
        prevision4sem: 0,
        tendance: 0,
        confiance: 45,
        modele: "indisponible",
      });
    }
  }

  if (!chartData.length && slice[0]) {
    try {
      const historique = await aggregateMonthlySales(slice[0].id, societeId);
      chartData = buildFallbackChart(historique);
    } catch {
      chartData = [];
    }
  }

  return {
    produits,
    chartData,
    previsionsOk,
    avgConfidence: produits.length ? Math.round(confidenceSum / Math.max(previsionsOk, 1)) : 0,
  };
}

/** Sparkline réelle : volumes journaliers de mouvements sur 7 jours. */
async function buildMovementSpark(societeId, articleId = null, depotId = null) {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const where = {
    createdAt: { gte: since },
    statut: "VALIDE",
    article: { societeId },
  };
  if (articleId) where.articleId = Number(articleId);
  if (depotId) where.depotId = Number(depotId);

  const rows = await prisma.mouvement.findMany({
    where,
    select: { quantite: true, createdAt: true },
    take: 2000,
  });

  const keys = lastNDayKeys(7);
  const byDay = new Map(keys.map((k) => [k, 0]));
  for (const r of rows) {
    const k = dayKey(r.createdAt);
    if (byDay.has(k)) byDay.set(k, byDay.get(k) + Math.abs(Number(r.quantite) || 0));
  }
  return keys.map((k) => Math.round(byDay.get(k) || 0));
}

function sparkFromSeries(values, fallbackScore = 20) {
  if (values.some((v) => v > 0)) return values;
  const base = Number(fallbackScore) || 20;
  return [
    Math.max(1, base * 0.4),
    Math.max(1, base * 0.55),
    Math.max(1, base * 0.45),
    Math.max(1, base * 0.7),
    Math.max(1, base * 0.6),
    Math.max(1, base * 0.85),
    Math.max(1, base),
  ].map((v) => Math.round(v));
}

/** Anomalies dérivées des alertes stock (rupture / critique). */
function buildStockLevelAnomalies(alertRows, sparkByArticle) {
  return alertRows.map((s) => {
    const isRupture = s.statut === "RUPTURE";
    const score = isRupture ? 92 : 68;
    const depotLabel = s.depot?.libelle || s.depot?.code || "dépôt";
    const spark = sparkByArticle.get(s.articleId) || sparkFromSeries([], score);
    return {
      id: `stock-${s.articleId}-${s.depotId}`,
      type: "rupture",
      severite: isRupture ? "elevee" : "moyenne",
      titre: isRupture
        ? `Rupture de stock — ${s.article?.libelle || "Article"}`
        : `Stock critique — ${s.article?.libelle || "Article"}`,
      produit: s.article?.libelle || "",
      description: isRupture
        ? `Quantité disponible : 0 unité(s) (seuil alerte : ${s.seuil}). Dépôt : ${depotLabel}.`
        : `Quantité ${s.quantite} en dessous du seuil (${s.seuil}) — ${depotLabel}.`,
      timestamp: new Date().toISOString(),
      sparkline: spark,
      score,
      articleId: s.articleId,
      articleCode: s.article?.code || "",
      imageUrl: s.article?.imageUrl || null,
      depotId: s.depotId,
      depot: depotLabel,
      recommandation: isRupture
        ? "Réapprovisionner en urgence ou transférer depuis un autre dépôt pour rétablir le stock."
        : "Planifier un réapprovisionnement et ajuster le seuil d'alerte si la consommation a changé.",
      source: "stock",
    };
  });
}

function mapPersistedAnomalies(items, sparkByArticle) {
  return (items || []).map((a) => ({
    id: a.id,
    type: mapAnomalyType(a.raison),
    severite: mapSeverite(Number(a.score)),
    titre: String(a.raison || "Anomalie détectée").slice(0, 80),
    produit: a.article?.libelle || "",
    description: a.raison || "Comportement inhabituel détecté par l'IA.",
    timestamp: a.dateDetection,
    sparkline: sparkByArticle.get(a.articleId) || sparkFromSeries([], a.score),
    score: Number(a.score) || 0,
    articleId: a.articleId,
    articleCode: a.article?.code || "",
    imageUrl: a.article?.imageUrl || null,
    depotId: a.depotId,
    depot: a.depot?.libelle || "",
    recommandation:
      "Analyser le mouvement source, valider la quantité observée et ajuster le seuil ou déclencher un réapprovisionnement si nécessaire.",
    source: "mouvement",
  }));
}

/** Détecte surplus/déficit multi-dépôts → recommandations de transfert. */
function buildTransferRecommendations(stockRows, startId) {
  const byArticle = new Map();
  for (const s of stockRows) {
    const aid = s.articleId;
    if (!byArticle.has(aid)) byArticle.set(aid, []);
    byArticle.get(aid).push(s);
  }

  const transfers = [];
  let id = startId;
  for (const [, rows] of byArticle) {
    if (rows.length < 2) continue;
    const enriched = rows.map((s) => {
      const seuil = getAlertThreshold(s.article);
      const quantite = Number(s.quantite) || 0;
      return { ...s, seuil, quantite };
    });

    const deficit = enriched
      .filter((s) => s.quantite <= s.seuil)
      .sort((a, b) => a.quantite - b.quantite)[0];
    const surplus = enriched
      .filter((s) => s.quantite > s.seuil * 3)
      .sort((a, b) => b.quantite - a.quantite)[0];

    if (!deficit || !surplus || deficit.depotId === surplus.depotId) continue;

    const need = Math.max(1, Math.round(deficit.seuil * 1.5 - deficit.quantite));
    const available = Math.max(0, Math.round(surplus.quantite - surplus.seuil * 2));
    const qty = Math.max(1, Math.min(need, available));
    if (qty <= 0) continue;

    transfers.push({
      id: id++,
      type: "transferer",
      titre: "Transfert inter-dépôts recommandé",
      produit: deficit.article?.libelle || "",
      quantite: qty,
      priorite: deficit.quantite <= 0 ? "urgent" : "normal",
      urgence: deficit.quantite <= 0 ? 90 : 65,
      articleId: deficit.articleId,
      depotId: deficit.depotId,
      depotNom: deficit.depot?.libelle || "",
      depotSourceId: surplus.depotId,
      depotSourceNom: surplus.depot?.libelle || "",
      depotCibleId: deficit.depotId,
      depotCibleNom: deficit.depot?.libelle || "",
      rationale: `Surplus détecté à ${surplus.depot?.libelle || "source"} (${surplus.quantite} u.) vs déficit à ${deficit.depot?.libelle || "cible"} (${deficit.quantite} u.).`,
    });
  }
  return transfers;
}

async function loadAppliedKeys(societeId) {
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const logs = await prisma.activityLog.findMany({
    where: {
      societeId,
      module: "ia",
      action: "APPLY_RECOMMENDATION",
      createdAt: { gte: since },
      status: "SUCCESS",
    },
    select: { details: true },
    take: 200,
    orderBy: { createdAt: "desc" },
  });
  const keys = new Set();
  for (const log of logs) {
    const d = log.details || {};
    if (d.fingerprint) keys.add(String(d.fingerprint));
  }
  return keys;
}

function recommendationFingerprint(r) {
  return [
    r.type,
    r.articleId || "",
    r.depotId || "",
    r.depotSourceId || "",
    r.depotCibleId || "",
  ].join(":");
}

function pctDelta(current, previous) {
  if (!Number.isFinite(previous) || previous === 0) {
    if (!current) return 0;
    return 100;
  }
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function clampScore(n, min = 0, max = 100) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function pulseBand(score) {
  if (score >= 80) return { key: "stable", label: "STABLE", tone: "accent" };
  if (score >= 55) return { key: "attention", label: "ATTENTION", tone: "yellow" };
  return { key: "critique", label: "CRITIQUE", tone: "red" };
}

function buildDepotHeat(alertRows, depots) {
  const byDepot = new Map();
  for (const d of depots || []) {
    byDepot.set(d.id, {
      depotId: d.id,
      depot: d.libelle || d.code || `Dépôt ${d.id}`,
      rupture: 0,
      critique: 0,
      positions: 0,
    });
  }
  for (const s of alertRows || []) {
    const id = s.depotId;
    const row = byDepot.get(id) || {
      depotId: id,
      depot: s.depot?.libelle || s.depot?.code || `Dépôt ${id}`,
      rupture: 0,
      critique: 0,
      positions: 0,
    };
    row.positions += 1;
    if (s.statut === "RUPTURE") row.rupture += 1;
    else if (s.statut === "CRITIQUE") row.critique += 1;
    byDepot.set(id, row);
  }
  return [...byDepot.values()]
    .map((r) => ({
      ...r,
      score: clampScore(r.rupture * 28 + r.critique * 12),
    }))
    .sort((a, b) => b.score - a.score || String(a.depot).localeCompare(String(b.depot)))
    .slice(0, 8);
}

function buildTimeline(logs, detections) {
  const items = [];
  for (const log of logs || []) {
    const effects = Array.isArray(log.details?.effects) ? log.details.effects.join(" · ") : "";
    items.push({
      id: `log-${log.id}`,
      at: log.createdAt,
      kind: "decision",
      label: log.entityLabel || "Décision IA",
      detail: effects || log.details?.type || log.action,
    });
  }
  for (const a of detections || []) {
    items.push({
      id: `det-${a.id}`,
      at: a.dateDetection,
      kind: "detection",
      label: a.article?.code || "Anomalie",
      detail: String(a.raison || "Signal ML").slice(0, 96),
      score: Number(a.score) || 0,
    });
  }
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items.slice(0, 8);
}

/**
 * Cockpit décisionnel — score composite, stack de modèles, heat dépôts, briefing.
 */
function buildCommandCenter(ctx) {
  const {
    aiProbe = { online: false },
    ruptureCount = 0,
    critiqueCount = 0,
    highScoreAnomalies = 0,
    anomalies = [],
    aiAnomalies = [],
    stockAnomalies = [],
    avgConfidence = 0,
    produits = [],
    articlesTotal = 0,
    depots = [],
    stockPositions = 0,
    urgentCount = 0,
    openRecos = 0,
    decisionsCount = 0,
    transferCount = 0,
    insights = [],
    alertRows = [],
    timeline = [],
    groqConfigured = false,
    expiryKpis = null,
  } = ctx;

  const expiryCritique = Number(expiryKpis?.lotsCritique || 0);
  const expiryPerdus = Number(expiryKpis?.lotsPerdus || 0);
  const expiryRisque = Number(expiryKpis?.lotsARisque || 0);

  const factors = [
    {
      key: "service",
      label: "Inférence",
      score: aiProbe.online ? 96 : 48,
      weight: 0.16,
      hint: aiProbe.online
        ? `${aiProbe.latencyMs ?? "—"} ms · FastAPI`
        : "Fallback Node actif",
    },
    {
      key: "stock",
      label: "Couverture stock",
      score: clampScore(100 - ruptureCount * 14 - critiqueCount * 5, 8, 100),
      weight: 0.24,
      hint: `${ruptureCount} rupture · ${critiqueCount} critique`,
    },
    {
      key: "anomalies",
      label: "Signaux ML",
      score: clampScore(
        100 - highScoreAnomalies * 9 - Math.max(0, anomalies.length - 2) * 3,
        12,
        100
      ),
      weight: 0.18,
      hint: `${anomalies.length} ouvert(s) · ${highScoreAnomalies} ≥ 70`,
    },
    {
      key: "forecast",
      label: "Prévision",
      score: clampScore(avgConfidence || (aiProbe.online ? 62 : 45), 10, 100),
      weight: 0.16,
      hint: `${produits.length}/${articlesTotal || produits.length} SKU modélisés`,
    },
    {
      key: "expiry",
      label: "Péremption",
      score: clampScore(100 - expiryCritique * 14 - expiryPerdus * 10, 12, 100),
      weight: 0.12,
      hint: `${expiryRisque} lot(s) · ${Math.round(Number(expiryKpis?.valeurPredite) || 0)} TND`,
    },
    {
      key: "execution",
      label: "Exécution",
      score: clampScore(100 - urgentCount * 12 - Math.max(0, openRecos - 2) * 4, 15, 100),
      weight: 0.14,
      hint: `${decisionsCount} appliquée(s) / 14j`,
    },
  ];

  const score = clampScore(factors.reduce((s, f) => s + f.score * f.weight, 0));
  const band = pulseBand(score);
  const topInsight = insights[0] || null;

  const nextAction = topInsight?.cta
    ? {
        label: topInsight.cta.label || "Ouvrir le module",
        tab: topInsight.cta.tab || "optimisation",
        why: topInsight.description || topInsight.titre,
      }
    : urgentCount > 0
      ? {
          label: "Traiter les urgences",
          tab: "optimisation",
          why: `${urgentCount} recommandation(s) urgente(s) encore ouvertes.`,
        }
      : {
          label: "Explorer les insights",
          tab: "insights",
          why: "Aucun signal critique — poursuivez la veille prévisionnelle.",
        };

  const runtime = aiProbe.online ? "deep" : "resilience";
  const modeledPct = articlesTotal
    ? clampScore((produits.length / articlesTotal) * 100)
    : produits.length
      ? 100
      : 0;

  const stack = [
    {
      id: "forecast",
      label: "Forecast",
      model: "N-BEATS + Holt-Winters",
      status: aiProbe.online ? "live" : "fallback",
      metric: `${avgConfidence || 0}% conf.`,
      tab: "prevision",
    },
    {
      id: "anomalies",
      label: "Anomalies",
      model: "IF + LOF + autoencodeur",
      status: aiProbe.online ? "live" : "fallback",
      metric: `${anomalies.length} signal(s)`,
      tab: "anomalies",
    },
    {
      id: "optimisation",
      label: "Décision",
      model: "Règles + ledger",
      status: "live",
      metric: `${openRecos} ouverte(s)`,
      tab: "optimisation",
    },
    {
      id: "load",
      label: "Chargement",
      model: "HAC + HGB Pareto",
      status: aiProbe.online ? "live" : "fallback",
      metric: "3D LIFO",
      tab: "chargement",
    },
    {
      id: "expiry",
      label: "Péremption",
      model: "Runway DLC v1.1",
      status: aiProbe.online ? "live" : "fallback",
      metric: `${expiryRisque} lot(s)`,
      tab: "peremption",
    },
    {
      id: "slotting",
      label: "Slotting",
      model: "GMM 3 classes",
      status: aiProbe.online ? "live" : "fallback",
      metric: "ABC quai",
      tab: "emplacement",
    },
    {
      id: "llm",
      label: "LLM",
      model: groqConfigured ? "Groq · Stella" : "Non configuré",
      status: groqConfigured ? "live" : "offline",
      metric: groqConfigured ? "chat" : "—",
      tab: "insights",
    },
  ];

  return {
    pulse: {
      score,
      band: band.key,
      label: band.label,
      tone: band.tone,
      factors,
    },
    runtime,
    runtimeLabel:
      runtime === "deep"
        ? "Deep learning · FastAPI"
        : "Résilience locale · moteurs Node",
    latencyMs: aiProbe.latencyMs ?? null,
    coverage: {
      articlesModeled: produits.length,
      articlesTotal: articlesTotal || produits.length,
      modeledPct,
      depots: (depots || []).length,
      stockPositions,
      mlAnomalies: (aiAnomalies || []).length,
      stockAlerts: (stockAnomalies || []).length,
      recosOpen: openRecos,
      recosApplied: decisionsCount,
      transfers: transferCount,
      expiryAtRisk: expiryRisque,
      expiryValue: Math.round(Number(expiryKpis?.valeurPredite) || 0),
    },
    stack,
    briefing: {
      headline: topInsight?.titre || (score >= 80 ? "Réseau sous contrôle" : "Veille opérationnelle"),
      severity: topInsight?.type || (score >= 80 ? "tendance" : "risque"),
      summary:
        topInsight?.description ||
        "Les modèles tournent. Aucun insight prioritaire n'a été généré sur la fenêtre.",
      impact: topInsight?.impact || null,
      nextAction,
    },
    heat: buildDepotHeat(alertRows, depots),
    timeline,
  };
}

/**
 * Moteur d'insights — règles métier + métriques calculées.
 * Chaque insight est actionnable (cta → onglet Module IA).
 */
function buildInsightEngine(ctx) {
  const {
    anomalies = [],
    aiAnomalies = [],
    stockAnomalies = [],
    urgentCount = 0,
    transferCount = 0,
    ruptureCount = 0,
    critiqueCount = 0,
    reduceCount = 0,
    highScoreAnomalies = 0,
    forecastTotal = 0,
    produits = [],
    avgTrend = 0,
    avgConfidence = 0,
    lowConfidenceProducts = [],
    aiProbe = { online: false },
    decisionsCount = 0,
    openRecos = 0,
    expiryKpis = null,
    expiryTop = [],
  } = ctx;

  const insights = [];
  let seq = 1;

  const push = (item) => {
    insights.push({
      id: item.id || seq++,
      type: item.type,
      titre: item.titre,
      description: item.description,
      impact: item.impact,
      impactValue: item.impactValue ?? null,
      impactDirection: item.impactDirection || "neutral",
      importance: Math.max(1, Math.min(100, Math.round(item.importance || 50))),
      confidence: Math.max(0, Math.min(100, Math.round(item.confidence ?? 70))),
      detail: item.detail || "",
      evidence: item.evidence || [],
      methodology: item.methodology || "",
      cta: item.cta || null,
      priority: item.priority || (item.importance >= 80 ? "haute" : item.importance >= 55 ? "moyenne" : "basse"),
      tags: item.tags || [],
    });
  };

  const serviceRiskPct = forecastTotal
    ? Math.min(40, Math.round(((ruptureCount * 2 + critiqueCount) / forecastTotal) * 100))
    : Math.min(18, 5 + anomalies.length * 2);

  if (ruptureCount > 0) {
    push({
      type: "risque",
      titre: `${ruptureCount} rupture(s) active(s)`,
      description:
        "Des articles sont à quantité nulle. Le taux de service chute tant que le réapprovisionnement ou un transfert n'est pas déclenché.",
      impact: `-${serviceRiskPct}% taux de service`,
      impactValue: -serviceRiskPct,
      impactDirection: "down",
      importance: Math.min(98, 78 + ruptureCount * 4),
      confidence: 92,
      evidence: [
        `${ruptureCount} article(s) en rupture`,
        `${critiqueCount} niveau(x) critique(s)`,
        `${urgentCount} recommandation(s) urgente(s)`,
      ],
      methodology: "Règle stock : quantité ≤ 0 → rupture. Impact = min(40, round((2×ruptures + critiques) / catalogue × 100)).",
      detail: "Priorisez les SKU à forte rotation ou liés à des commandes clients en attente.",
      cta: { label: "Voir l'optimisation", tab: "optimisation" },
      tags: ["rupture", "service"],
    });
  }

  const expiryCritique = Number(expiryKpis?.lotsCritique || 0);
  const expiryPerdus = Number(expiryKpis?.lotsPerdus || 0);
  const expiryValeur = Math.round(Number(expiryKpis?.valeurPredite) || 0);
  const expiryQte = Math.round(Number(expiryKpis?.qtePredite) || 0);
  const expiryRecup = Math.round(Number(expiryKpis?.valeurRecuperable) || 0);
  const topLot = expiryTop[0];
  if (expiryCritique > 0 || expiryPerdus > 0 || expiryValeur > 0) {
    push({
      type: "risque",
      titre:
        expiryPerdus > 0
          ? `${expiryPerdus} lot(s) déjà hors DLC`
          : `${expiryCritique || expiryKpis?.lotsARisque || 0} lot(s) sur le runway DLC`,
      description: topLot
        ? `${topLot.articleLibelle || topLot.articleCode || topLot.numero} : ~${Math.round(topLot.qtePrediteDlc || 0)} u. prévues invendues (${Math.round(topLot.valeurPredite || 0)} TND). Complète FEFO.`
        : "La vitesse de vente article ne couvre pas le restant avant la DLC. FEFO ordonne les sorties ; ce score estime ce qui restera.",
      impact: expiryRecup > 0 ? `${expiryRecup} TND encore récupérables` : expiryValeur > 0 ? `${expiryValeur} TND à risque` : `${expiryQte} u. prévues à la DLC`,
      impactValue: expiryRecup || expiryValeur || expiryQte,
      impactDirection: "down",
      importance: Math.min(96, 70 + expiryCritique * 6 + expiryPerdus * 8),
      confidence: 74,
      evidence: [
        `${expiryKpis?.lotsSuivis || 0} lot(s) avec DLC et stock`,
        `${expiryCritique} critique(s) · ${expiryPerdus} déjà périmé(s) · ${expiryKpis?.lotsSansFefo || 0} hors FEFO`,
        `Formule : restant − vitesse × jours DLC`,
      ],
      methodology:
        "Heuristique v1.1 persistée (.pkl). q_pred = max(0, q − v×j). Horizon 21 j + playbook. Pas d'entraînement supervisé : historique labellisé insuffisant.",
      detail: "Aucune écriture stock. Actions : picking FEFO, promo, retour fournisseur — côté magasinier.",
      cta: { label: "Ouvrir Péremption", tab: "peremption" },
      tags: ["dlc", "waste", "fefo"],
    });
  }

  if (highScoreAnomalies > 0 || anomalies.length >= 3) {
    push({
      type: "risque",
      titre: `${anomalies.length} anomalie(s) détectée(s)`,
      description:
        "Ensemble IF + LOF + autoencodeur DL et alertes stock. Les scores ≥ 70 méritent une validation terrain (confirmer / marquer normal).",
      impact: `-${Math.min(18, 4 + highScoreAnomalies * 3)}% fiabilité flux`,
      impactValue: -Math.min(18, 4 + highScoreAnomalies * 3),
      impactDirection: "down",
      importance: Math.min(94, 48 + anomalies.length * 6 + highScoreAnomalies * 3),
      confidence: aiProbe.online ? 88 : 72,
      evidence: [
        `${aiAnomalies.length} anomalie(s) mouvements (ML)`,
        `${stockAnomalies.length} alerte(s) niveau stock`,
        `${highScoreAnomalies} score(s) ≥ 70`,
      ],
      methodology: "Ensemble IsolationForest + LOF + autoencodeur profond + calibrateur supervisé persisté. Cron 03:00/15:00, retrain 03:20. Mode local si FastAPI offline.",
      detail: "Comparez la quantité observée à la moyenne 90 jours et vérifiez le mouvement source.",
      cta: { label: "Analyser les anomalies", tab: "anomalies" },
      tags: ["ml", "mouvements"],
    });
  }

  if (transferCount > 0) {
    const gain = Math.min(22, 6 + transferCount * 4);
    push({
      type: "opportunite",
      titre: `${transferCount} transfert(s) inter-dépôts`,
      description:
        "Un dépôt a du surplus pendant qu'un autre est en déficit : rééquilibrez sans achat externe.",
      impact: `+${gain}% efficacité`,
      impactValue: gain,
      impactDirection: "up",
      importance: Math.min(91, 58 + transferCount * 7),
      confidence: 84,
      evidence: [
        `${transferCount} corridor(s) surplus → déficit`,
        "Règle : surplus > 3×seuil et stock cible ≤ seuil",
      ],
      methodology: "Matching multi-dépôts par article : qty = min(besoin cible, disponible source).",
      detail: "Appliquer enregistre le plan dans le ledger ; l'exécution magasinier reste manuelle.",
      cta: { label: "Planifier les transferts", tab: "optimisation" },
      tags: ["transfert", "réseau"],
    });
  }

  if (urgentCount > 0 && ruptureCount === 0) {
    const gain = Math.min(20, 8 + urgentCount * 3);
    push({
      type: "opportunite",
      titre: `${urgentCount} action(s) urgente(s)`,
      description:
        "Niveaux critiques détectés. Un réapprovisionnement ciblé limite le risque de rupture.",
      impact: `+${gain}% efficacité`,
      impactValue: gain,
      impactDirection: "up",
      importance: Math.min(90, 68 + urgentCount * 4),
      confidence: 86,
      evidence: [`${critiqueCount} stock(s) critique(s)`, `${openRecos} recommandation(s) ouvertes`],
      methodology: "Priorité urgent si rupture, sinon critique (quantité ≤ seuil alerte).",
      cta: { label: "Traiter les urgences", tab: "optimisation" },
      tags: ["réappro", "urgence"],
    });
  }

  if (reduceCount > 0) {
    const saving = Math.min(16, 4 + reduceCount * 3);
    push({
      type: "opportunite",
      titre: `${reduceCount} surstock(s) à alléger`,
      description:
        "Des dépôts détiennent plus de 3× le seuil. Réduire limite l'immobilisation et le risque d'obsolescence.",
      impact: `-${saving}% coût immobilisé`,
      impactValue: -saving,
      impactDirection: "down",
      importance: Math.min(78, 45 + reduceCount * 5),
      confidence: 80,
      evidence: [`${reduceCount} position(s) > 3×seuil`],
      methodology: "Surstock = quantité > 3 × seuilAlerte (ou stockMin).",
      cta: { label: "Voir les surstocks", tab: "optimisation" },
      tags: ["surstock"],
    });
  }

  if (produits.length > 0) {
    const trendImpact =
      avgTrend >= 0
        ? Math.min(15, Math.max(1, Math.round(Math.abs(avgTrend) / 2)))
        : Math.min(12, Math.max(1, Math.round(Math.abs(avgTrend) / 3)));
    push({
      type: "tendance",
      titre: avgTrend >= 0 ? "Demande en progression" : "Demande en recul",
      description:
        `Tendance moyenne ${avgTrend > 0 ? "+" : ""}${avgTrend}% sur ${produits.length} produit(s) analysés · confiance modèle ${avgConfidence}%.`,
      impact:
        avgTrend >= 0 ? `+${trendImpact}% efficacité` : `-${trendImpact}% coût surstock`,
      impactValue: avgTrend >= 0 ? trendImpact : -trendImpact,
      impactDirection: avgTrend >= 0 ? "up" : "down",
      importance: Math.min(86, 52 + Math.abs(avgTrend)),
      confidence: avgConfidence || 60,
      evidence: [
        `Confiance moyenne ${avgConfidence}%`,
        `Modèles : ${[...new Set(produits.map((p) => p.modele).filter(Boolean))].join(", ") || "hybrid_nbeats_hw"}`,
        aiProbe.online ? "Service FastAPI online" : "Fallback Holt local actif",
      ],
      methodology: "Holt-Winters AIC + N-BEATS global + hybride résiduel, ventes CONFIRME agrégées (36 mois), stock P90.",
      detail: "Ajustez le stock recommandé et le point de commande selon la tendance.",
      cta: { label: "Ouvrir les prévisions", tab: "prevision" },
      tags: ["forecast", "tendance"],
    });
  } else {
    push({
      type: "tendance",
      titre: "Historique insuffisant pour prévoir",
      description:
        "Ajoutez des articles actifs et des ventes confirmées pour activer Holt-Winters + N-BEATS.",
      impact: "0% couverture prévisionnelle",
      impactValue: 0,
      impactDirection: "neutral",
      importance: 40,
      confidence: 30,
      evidence: ["Aucun produit analysé sur la période"],
      methodology: "Minimum 4 points mensuels pour Holt ; sinon moyenne pondérée.",
      cta: { label: "Configurer la prévision", tab: "prevision" },
      tags: ["data"],
    });
  }

  if (lowConfidenceProducts.length >= 2) {
    push({
      type: "risque",
      titre: `${lowConfidenceProducts.length} prévision(s) peu fiables`,
      description:
        "La confiance MAPE/backtest est sous 55% : évitez les décisions d'achat agressives sur ces SKU.",
      impact: "Fiabilité modèle limitée",
      impactValue: null,
      impactDirection: "neutral",
      importance: Math.min(82, 50 + lowConfidenceProducts.length * 6),
      confidence: Math.round(
        lowConfidenceProducts.reduce((s, p) => s + (p.confiance || 0), 0) /
          lowConfidenceProducts.length
      ),
      evidence: lowConfidenceProducts.slice(0, 3).map(
        (p) => `${p.nom || p.code} · ${p.confiance}%`
      ),
      methodology: "Confiance = 100 − MAPE holdout (~20% derniers points) ou score Holt local.",
      cta: { label: "Contrôler les modèles", tab: "prevision" },
      tags: ["confiance", "qualité"],
    });
  }

  if (decisionsCount > 0 && openRecos > 0) {
    push({
      type: "opportunite",
      titre: `Ledger actif · ${decisionsCount} décision(s) / 14j`,
      description:
        `${openRecos} recommandation(s) restent ouvertes. Continuez le cycle appliquer → exécuter → mesurer.`,
      impact: `${decisionsCount} action(s) tracées`,
      impactValue: decisionsCount,
      impactDirection: "up",
      importance: 55,
      confidence: 95,
      evidence: [`${decisionsCount} APPLY_RECOMMENDATION journalisé(s)`, `${openRecos} encore ouvertes`],
      methodology: "Persistance ActivityLog module=ia, fenêtre glissante 14 jours.",
      cta: { label: "Reprendre l'optimisation", tab: "optimisation" },
      tags: ["ledger", "gouvernance"],
    });
  }

  if (!aiProbe.online) {
    push({
      type: "tendance",
      titre: "Mode résilience locale",
      description:
        "Le micro-service FastAPI est offline. Forecast, anomalies et load opt basculent sur les moteurs Node locaux.",
      impact: "Continuité de service",
      impactValue: null,
      impactDirection: "neutral",
      importance: 62,
      confidence: 100,
      evidence: ["probe /health échouée", "Fallbacks Node actifs"],
      methodology: "aiLocal.fallback.js : Holt, règles anomalies, greedy load.",
      detail: "Redémarrez ai-service (port 8000) pour IsolationForest, autoencodeur DL, Holt-Winters AIC et N-BEATS.",
      cta: { label: "Vue d'ensemble", tab: "overview" },
      tags: ["ops", "fallback"],
    });
  }

  insights.sort((a, b) => b.importance - a.importance || b.confidence - a.confidence);
  return insights.slice(0, 8);
}

async function getDashboard(societeId, options = {}) {
  const sid = requireActiveSocieteId(societeId);
  const dateFrom = parseDateBound(options.dateFrom, false);
  const dateTo = parseDateBound(options.dateTo, true);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groqConfigured = Boolean(process.env.GROQ_API_KEY?.trim());
  const aiProbePromise = probeAiService(800);

  const [
    anomaliesResult,
    articles,
    stockRows,
    depots,
    forecastTotal,
    appliedKeys,
    anomalyWeekAgo,
    anomalyNowCount,
    recentDecisions,
    recentDetections,
    expiryRaw,
  ] =
    await Promise.all([
      listAnomalies(sid, { statut: "NON_RESOLU", skipStudio: true }),
      prisma.article.findMany({
        where: { societeId: sid, actif: true },
        select: { id: true, code: true, libelle: true, imageUrl: true, seuilAlerte: true, stockMin: true },
        orderBy: { id: "desc" },
        take: 12,
      }),
      prisma.stock.findMany({
        where: { article: { societeId: sid } },
        include: {
          article: {
            select: {
              id: true,
              code: true,
              libelle: true,
              imageUrl: true,
              seuilAlerte: true,
              stockMin: true,
            },
          },
          depot: { select: { id: true, code: true, libelle: true } },
        },
      }),
      prisma.depot.findMany({
        where: { societeId: sid },
        select: { id: true, code: true, libelle: true },
      }),
      prisma.article.count({ where: { societeId: sid, actif: true } }),
      loadAppliedKeys(sid),
      prisma.anomalieDetectee.count({
        where: {
          article: { societeId: sid },
          statut: "NON_RESOLU",
          dateDetection: { lt: weekAgo },
        },
      }),
      prisma.anomalieDetectee.count({
        where: { article: { societeId: sid }, statut: "NON_RESOLU" },
      }),
      prisma.activityLog.findMany({
        where: { societeId: sid, module: "ia" },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          action: true,
          entityLabel: true,
          details: true,
          createdAt: true,
        },
      }),
      prisma.anomalieDetectee.findMany({
        where: { article: { societeId: sid } },
        orderBy: { dateDetection: "desc" },
        take: 6,
        select: {
          id: true,
          raison: true,
          score: true,
          dateDetection: true,
          article: { select: { code: true, libelle: true } },
        },
      }),
      getExpiryWasteRisk(sid, { preferLocal: true }).catch(() => null),
    ]);

  const aiProbe = await aiProbePromise;

  const { produits, chartData, previsionsOk, avgConfidence } = await loadProductForecasts(articles, sid);

  const alertRows = stockRows
    .map((s) => {
      const seuil = getAlertThreshold(s.article);
      const quantite = Number(s.quantite) || 0;
      let statut = "OK";
      if (quantite <= 0) statut = "RUPTURE";
      else if (quantite <= seuil) statut = "CRITIQUE";
      return { ...s, quantite, seuil, statut };
    })
    .filter((s) => s.statut !== "OK");

  const articleIdsForSpark = [
    ...new Set([
      ...alertRows.map((s) => s.articleId),
      ...(anomaliesResult.items || []).map((a) => a.articleId),
    ]),
  ].slice(0, 12);

  const sparkEntries = await Promise.all(
    articleIdsForSpark.map(async (aid) => [aid, await buildMovementSpark(sid, aid)])
  );
  const sparkByArticle = new Map(sparkEntries);

  // listAnomalies mélange stock + mouvements : on garde les mouvements ML ici,
  // les alertes niveau stock sont reconstruites avec sparklines réelles.
  const movementItems = (anomaliesResult.items || []).filter(
    (a) => a.source !== "stock" && !String(a.id).startsWith("stock-")
  );
  let aiAnomalies = mapPersistedAnomalies(movementItems, sparkByArticle);
  let stockAnomalies = buildStockLevelAnomalies(alertRows, sparkByArticle);

  if (dateFrom || dateTo) {
    const inRange = (ts) => {
      const t = new Date(ts).getTime();
      if (dateFrom && t < dateFrom.getTime()) return false;
      if (dateTo && t > dateTo.getTime()) return false;
      return true;
    };
    aiAnomalies = aiAnomalies.filter((a) => inRange(a.timestamp));
    stockAnomalies = stockAnomalies.filter((a) => inRange(a.timestamp));
  }

  let anomalies = [...stockAnomalies, ...aiAnomalies].sort(
    (a, b) => (b.score || 0) - (a.score || 0)
  );

  // Garantit imageUrl même si une branche de mapping l'a omis
  const anomalyArticleIds = [
    ...new Set(anomalies.map((a) => a.articleId).filter(Boolean)),
  ];
  if (anomalyArticleIds.length) {
    const articleImages = await prisma.article.findMany({
      where: { societeId: sid, id: { in: anomalyArticleIds.map(Number) } },
      select: { id: true, imageUrl: true, code: true, libelle: true },
    });
    const imgById = new Map(articleImages.map((a) => [a.id, a]));
    anomalies = anomalies.map((a) => {
      const art = imgById.get(Number(a.articleId));
      if (!art) return a;
      return {
        ...a,
        imageUrl: a.imageUrl || art.imageUrl || null,
        articleCode: a.articleCode || art.code || "",
        produit: a.produit || art.libelle || "",
      };
    });
  }

  let nextId = 1;
  const baseRecos = alertRows.slice(0, 24).map((s) => {
    let type = "surveiller";
    if (s.statut === "RUPTURE" || s.statut === "CRITIQUE") type = "reapprovisionner";
    else if (s.quantite > s.seuil * 3) type = "reduire";

    const priorite = s.statut === "RUPTURE" ? "urgent" : s.statut === "CRITIQUE" ? "normal" : "faible";
    const urgence = s.statut === "RUPTURE" ? 95 : s.statut === "CRITIQUE" ? 72 : 38;
    const quantite = Math.max(1, Math.round(s.seuil * 1.5 - s.quantite));

    return {
      id: nextId++,
      type,
      titre:
        type === "reapprovisionner"
          ? "Réapprovisionnement recommandé"
          : type === "reduire"
            ? "Réduire le surstock"
            : "Surveillance continue",
      produit: s.article?.libelle || "",
      quantite,
      priorite,
      urgence,
      articleId: s.articleId,
      depotId: s.depotId,
      depotNom: s.depot?.libelle || "",
      rationale:
        type === "reapprovisionner"
          ? `Stock ${s.quantite} ≤ seuil ${s.seuil} — besoin estimé ${quantite} u.`
          : type === "reduire"
            ? `Surstock ${s.quantite} (> 3× seuil ${s.seuil}).`
            : `Niveau proche du seuil (${s.quantite}/${s.seuil}).`,
    };
  });

  const transferRecos = buildTransferRecommendations(stockRows, nextId);
  let recommandations = [...transferRecos, ...baseRecos].map((r) => {
    const fingerprint = recommendationFingerprint(r);
    return {
      ...r,
      fingerprint,
      applied: appliedKeys.has(fingerprint),
    };
  });

  // Masquer les déjà appliquées en bas, mais les garder visibles
  recommandations = recommandations.sort((a, b) => Number(a.applied) - Number(b.applied));

  const donutCounts = { reapprovisionner: 0, reduire: 0, transferer: 0, surveiller: 0 };
  for (const r of recommandations.filter((x) => !x.applied)) {
    if (donutCounts[r.type] != null) donutCounts[r.type] += 1;
  }

  const donut = Object.entries(donutCounts)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      name: DONUT_LABELS[key],
      key,
      value,
      color: DONUT_COLORS[key],
    }));

  const urgentCount = recommandations.filter((r) => r.priorite === "urgent" && !r.applied).length;
  const transferCount = recommandations.filter((r) => r.type === "transferer" && !r.applied).length;
  const ruptureCount = alertRows.filter((s) => s.statut === "RUPTURE").length;
  const critiqueCount = alertRows.filter((s) => s.statut === "CRITIQUE").length;
  const reduceCount = recommandations.filter((r) => r.type === "reduire" && !r.applied).length;
  const highScoreAnomalies = anomalies.filter((a) => (a.score || 0) >= 70).length;
  const lowConfidenceProducts = produits.filter((p) => (p.confiance || 0) < 55);

  const avgTrend =
    produits.length > 0
      ? Math.round((produits.reduce((s, p) => s + p.tendance, 0) / produits.length) * 10) / 10
      : 0;

  const openRecosCount = recommandations.filter((r) => !r.applied).length;

  const expiryWaste = toDashboardCard(expiryRaw || {});
  const expiryKpis = expiryWaste.kpis;

  const insights = buildInsightEngine({
    anomalies,
    aiAnomalies,
    stockAnomalies,
    urgentCount,
    transferCount,
    ruptureCount,
    critiqueCount,
    reduceCount,
    highScoreAnomalies,
    forecastTotal,
    produits,
    avgTrend,
    avgConfidence,
    lowConfidenceProducts,
    aiProbe,
    decisionsCount: appliedKeys.size,
    openRecos: openRecosCount,
    expiryKpis,
    expiryTop: expiryWaste.top || [],
  });

  const commandCenter = buildCommandCenter({
    aiProbe,
    ruptureCount,
    critiqueCount,
    highScoreAnomalies,
    anomalies,
    aiAnomalies,
    stockAnomalies,
    avgConfidence,
    produits,
    articlesTotal: forecastTotal,
    depots,
    stockPositions: stockRows.length,
    urgentCount,
    openRecos: openRecosCount,
    decisionsCount: appliedKeys.size,
    transferCount,
    insights,
    alertRows,
    timeline: buildTimeline(recentDecisions, recentDetections),
    groqConfigured,
    expiryKpis,
  });

  const resolvedMonth = anomaliesResult.kpis?.resoluesCeMois || 0;
  const sparkPrevisions = produits.map((p) => p.confiance).concat([avgConfidence || 0]).slice(-7);
  while (sparkPrevisions.length < 7) sparkPrevisions.unshift(sparkPrevisions[0] || 0);

  const globalSpark = await buildMovementSpark(sid);
  const sparkAnomalies = sparkFromSeries(
    globalSpark.map((v, i) => Math.round(v * (0.05 + (i / 20)))),
    anomalies.length
  );
  // Remplace par série réelle si on a des détections datées
  const anomalySparkKeys = lastNDayKeys(7);
  const anomalyByDay = new Map(anomalySparkKeys.map((k) => [k, 0]));
  for (const a of aiAnomalies) {
    const k = dayKey(a.timestamp);
    if (anomalyByDay.has(k)) anomalyByDay.set(k, anomalyByDay.get(k) + 1);
  }
  const realAnomalySpark = anomalySparkKeys.map((k) => anomalyByDay.get(k) || 0);
  const sparkAnomaliesFinal = realAnomalySpark.some((v) => v > 0)
    ? realAnomalySpark
    : sparkAnomalies.map((_, i) => (i === 6 ? anomalies.length : Math.max(0, anomalies.length - (6 - i))));

  const openRecos = openRecosCount;
  const sparkRecos = lastNDayKeys(7).map((_, i) =>
    Math.max(0, Math.round(openRecos * ((i + 1) / 7)))
  );

  return {
    kpis: {
      previsions: previsionsOk || produits.length,
      anomalies: anomalies.length,
      recommandations: openRecos,
      previsionsDelta: pctDelta(previsionsOk || produits.length, Math.max(1, articles.length)),
      anomaliesDelta: pctDelta(anomalyNowCount, anomalyWeekAgo),
      recommandationsDelta: pctDelta(openRecos, Math.max(1, openRecos + appliedKeys.size)),
      sparkPrevisions: sparkPrevisions.map((v) => Math.round(v)),
      sparkAnomalies: sparkAnomaliesFinal,
      sparkRecommandations: sparkRecos,
      confianceMoyenne: avgConfidence,
      decisionsAppliquees: appliedKeys.size,
    },
    prevision: { data: chartData, produits },
    anomalies,
    optimisation: { donut, recommandations, depots },
    insights,
    expiryWaste,
    commandCenter,
    meta: {
      articlesTotal: forecastTotal,
      updatedAt: new Date().toISOString(),
      dateFrom: options.dateFrom || null,
      dateTo: options.dateTo || null,
      aiServiceOnline: aiProbe.online,
      aiServiceUrl: aiProbe.url,
      aiLatencyMs: aiProbe.latencyMs ?? null,
      groqConfigured,
      resolvedMonth,
      transferCount,
      decisionsAppliquees: appliedKeys.size,
      confianceMoyenne: avgConfidence,
      runtime: commandCenter.runtime,
      pulseScore: commandCenter.pulse.score,
      pulseBand: commandCenter.pulse.band,
      expiryAtRisk: expiryKpis.lotsARisque,
      expiryValue: expiryKpis.valeurPredite,
    },
  };
}

/**
 * Applique une recommandation IA : effet métier + ledger ActivityLog.
 */
async function applyRecommendation(societeId, userId, payload = {}) {
  const sid = requireActiveSocieteId(societeId);
  const type = String(payload.type || "");
  const articleId = Number(payload.articleId);
  const depotId = payload.depotId != null ? Number(payload.depotId) : null;
  const quantite = Math.max(1, Math.round(Number(payload.quantite) || 1));
  const fingerprint =
    payload.fingerprint ||
    recommendationFingerprint({
      type,
      articleId,
      depotId,
      depotSourceId: payload.depotSourceId,
      depotCibleId: payload.depotCibleId,
    });

  if (!["reapprovisionner", "reduire", "transferer", "surveiller"].includes(type)) {
    const err = new Error("Type de recommandation invalide");
    err.status = 400;
    throw err;
  }
  if (!articleId) {
    const err = new Error("articleId requis");
    err.status = 400;
    throw err;
  }

  const article = await prisma.article.findFirst({
    where: { id: articleId, societeId: sid },
    select: { id: true, code: true, libelle: true, seuilAlerte: true, stockMin: true },
  });
  if (!article) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }

  const effects = [];
  let entityLabel = `${article.code} — ${type}`;

  if (type === "reapprovisionner") {
    const current = getAlertThreshold(article);
    const nextSeuil = Math.max(current, quantite);
    if (nextSeuil !== Number(article.seuilAlerte)) {
      await prisma.article.update({
        where: { id: article.id },
        data: { seuilAlerte: nextSeuil },
      });
      effects.push(`seuilAlerte ${current} → ${nextSeuil}`);
    } else {
      effects.push(`seuilAlerte maintenu à ${current} · plan réappro ${quantite} u. enregistré`);
    }
  } else if (type === "reduire") {
    const current = getAlertThreshold(article);
    const nextSeuil = Math.max(1, Math.round(current * 0.85));
    await prisma.article.update({
      where: { id: article.id },
      data: { seuilAlerte: nextSeuil },
    });
    effects.push(`seuilAlerte abaissé ${current} → ${nextSeuil} (anti-surstock)`);
  } else if (type === "transferer") {
    const sourceId = Number(payload.depotSourceId);
    const cibleId = Number(payload.depotCibleId || depotId);
    if (!sourceId || !cibleId) {
      const err = new Error("depotSourceId et depotCibleId requis pour un transfert");
      err.status = 400;
      throw err;
    }
    const [src, dst] = await Promise.all([
      prisma.depot.findFirst({ where: { id: sourceId, societeId: sid }, select: { id: true, libelle: true } }),
      prisma.depot.findFirst({ where: { id: cibleId, societeId: sid }, select: { id: true, libelle: true } }),
    ]);
    if (!src || !dst) {
      const err = new Error("Dépôt source ou cible introuvable");
      err.status = 404;
      throw err;
    }
    entityLabel = `${article.code} ${src.libelle} → ${dst.libelle}`;
    effects.push(
      `Plan de transfert ${quantite} u. de « ${src.libelle} » vers « ${dst.libelle} » (exécution magasinier requise)`
    );
  } else if (type === "surveiller") {
    effects.push("Article placé en surveillance IA (14 jours)");
  }

  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) {
    const err = new Error("Utilisateur requis pour appliquer une recommandation");
    err.status = 401;
    throw err;
  }

  const log = await prisma.activityLog.create({
    data: {
      userId: uid,
      action: "APPLY_RECOMMENDATION",
      module: "ia",
      entity: "RecommendationIA",
      entityId: articleId,
      entityLabel,
      details: {
        fingerprint,
        type,
        articleId,
        depotId,
        depotSourceId: payload.depotSourceId || null,
        depotCibleId: payload.depotCibleId || depotId || null,
        quantite,
        effects,
        produit: article.libelle,
      },
      societeId: sid,
      status: "SUCCESS",
    },
  });

  return {
    ok: true,
    fingerprint,
    effects,
    decisionId: log.id,
    message: effects.join(" · "),
  };
}

async function getAiHealth(societeId) {
  const sid = societeId != null ? Number(societeId) : null;
  const ai = await probeAiService();
  const groq = Boolean(process.env.GROQ_API_KEY?.trim());

  let anomaliesOpen = null;
  let decisions14j = null;
  if (sid) {
    [anomaliesOpen, decisions14j] = await Promise.all([
      prisma.anomalieDetectee.count({
        where: { article: { societeId: sid }, statut: "NON_RESOLU" },
      }),
      prisma.activityLog.count({
        where: {
          societeId: sid,
          module: "ia",
          action: "APPLY_RECOMMENDATION",
          createdAt: { gte: new Date(Date.now() - 14 * 86400000) },
        },
      }),
    ]);
  }

  const scoreParts = [
    ai.online ? 34 : 18,
    groq ? 33 : 10,
    33, // fallbacks locaux toujours présents
  ];
  const readiness = Math.min(100, scoreParts.reduce((s, v) => s + v, 0));

  return {
    readiness,
    runtime: ai.online ? "deep" : "resilience",
    aiService: ai,
    groqConfigured: groq,
    fallbacks: {
      forecast: true,
      anomalies: true,
      loadOptimization: true,
      slotting: true,
      expiryWaste: true,
    },
    societe: sid
      ? { id: sid, anomaliesOpen, decisions14j }
      : null,
    stack: [
      { id: "forecast", live: Boolean(ai.online), fallback: true },
      { id: "anomalies", live: Boolean(ai.online), fallback: true },
      { id: "load", live: Boolean(ai.online), fallback: true },
      { id: "slotting", live: Boolean(ai.online), fallback: true },
      { id: "expiry", live: Boolean(ai.online), fallback: true },
      { id: "llm", live: groq, fallback: true },
    ],
    capabilities: [
      "forecast_hybrid_nbeats_hw_batch",
      "anomaly_ensemble_if_lof_ae_supervised",
      "load_greedy_fragile",
      "gmm_slotting",
      "expiry_waste_heuristic",
      "chat_stoki",
      "chat_stella",
      "decision_ledger",
      "transfer_suggestions",
      "command_center_pulse",
    ],
  };
}

module.exports = { getDashboard, applyRecommendation, getAiHealth, buildCommandCenter };
