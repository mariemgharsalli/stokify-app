const prisma = require("../../config/database");
const { requireActiveSocieteId } = require("../../utils/societeScope");
const { aiFetch, AiBusyError, isAiBusy } = require("../../utils/aiClient");

const lastStudioBySociete = new Map();
const SEQ_LEN = 14;

function getAlertThreshold(article) {
  const raw = article?.seuilAlerte ?? article?.stockMin ?? article?.seuil;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 10;
}

function localAnomalyReason(row, score) {
  const q = Number(row.quantite) || 0;
  const moy = Number(row.moyenneHabituelle) || 0;
  const ecart = Number(row.ecartVsMoyenne) || 0;
  if (moy > 0 && q > 0) {
    const ratio = q / moy;
    if (ratio >= 2) return `Quantité ${ratio.toFixed(0)}x supérieure à la moyenne habituelle`;
    if (ratio <= 0.25) return `Quantité anormalement faible (${ratio.toFixed(1)}x la moyenne)`;
  }
  if (Math.abs(ecart) >= 2) {
    return `Écart de ${ecart.toFixed(1)}σ par rapport à la moyenne article/dépôt`;
  }
  if (score >= 80) return "Mouvement atypique détecté (analyse locale)";
  return "Comportement inhabituel par rapport à l'historique 90 jours";
}

function localStudio(n, flagged) {
  return {
    modele: "regles_locales",
    mode: "local",
    persisted: false,
    pipeline: [
      {
        id: "feat",
        label: "Features locales",
        status: "ok",
        detail: `${n} mouvements · ratio + z-score 90j`,
      },
      {
        id: "if",
        label: "IsolationForest",
        status: "fallback",
        detail: "Service FastAPI offline — règles métier",
      },
      {
        id: "ae",
        label: "Autoencodeur DL",
        status: "skip",
        detail: "Indisponible hors micro-service IA",
      },
      {
        id: "sup",
        label: "Calibrateur supervisé",
        status: "skip",
        detail: "Persistance ML inactive (IA offline)",
      },
    ],
    neural: { trained: false, lossCurve: [], architecture: "autoencoder" },
    sequence: { trained: false, lookback: SEQ_LEN, lossCurve: [] },
    supervised: { trained: false, nPos: 0, nNeg: 0 },
    unsupervised: { isolationForest: false, lof: false, autoencoder: false, sequenceAe: false },
    quality: { maturity: 28, n, agreement: 0 },
    cron: { detect: "03:00 & 15:00", retrain: "03:20" },
    story: [
      "Le micro-service IA est offline : détection par règles locales (ratio / σ).",
      `${flagged} signal${flagged > 1 ? "s" : ""} retenu${flagged > 1 ? "s" : ""} sur ${n} mouvements.`,
    ],
  };
}

/** Fallback règles métier si le micro-service IA (port 8000) est arrêté. */
function detectAnomaliesLocal(mouvements) {
  if (!Array.isArray(mouvements) || mouvements.length < 5) {
    return { anomalies: [], mode: "local", studio: localStudio(mouvements?.length || 0, 0) };
  }

  const flagged = [];
  for (const row of mouvements) {
    const q = Number(row.quantite) || 0;
    const moy = Number(row.moyenneHabituelle) || 0;
    const ecart = Number(row.ecartVsMoyenne) || 0;
    let score = 0;

    if (moy > 0 && q > 0) {
      const ratio = q / moy;
      if (ratio >= 2) score = Math.min(100, Math.round(50 + ratio * 15));
      else if (ratio <= 0.25) score = Math.min(100, Math.round(45 + (1 - ratio) * 30));
    }
    if (Math.abs(ecart) >= 2) {
      score = Math.max(score, Math.min(100, Math.round(40 + Math.abs(ecart) * 12)));
    }

    if (score >= 35) {
      flagged.push({
        mouvementId: row.mouvementId,
        articleId: row.articleId,
        depotId: row.depotId,
        quantite: q,
        moyenneHabituelle: moy,
        score,
        raison: localAnomalyReason(row, score),
        date: row.date || row.createdAt,
        modele: "regles_locales",
        votes: { if: score, lof: null, ae: null, seq: null, sup: null },
        agreement: 1,
        statut: score >= 80 ? "ALERTE" : "SURVEILLANCE",
        mlMeta: {
          contributions: { regle: Math.round(score) / 100 },
          rules: [Math.abs(ecart) >= 3.5 ? "ecart_robuste" : "regle_locale"],
          regime: "cold_start",
        },
      });
    }
  }

  flagged.sort((a, b) => b.score - a.score);
  const maxN = Math.max(1, Math.ceil(mouvements.length * 0.1));
  const anomalies = flagged.slice(0, maxN);
  return {
    anomalies,
    mode: "local",
    modele: "regles_locales",
    studio: localStudio(mouvements.length, anomalies.length),
  };
}

function dayKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return x.toISOString().slice(0, 10);
}

function lastNDays(endDate, n) {
  const end = endDate instanceof Date ? new Date(endDate) : new Date(endDate || Date.now());
  const days = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const k = dayKey(d);
    if (k) days.push(k);
  }
  return days;
}

function cacheStudio(societeId, studio) {
  if (studio && societeId != null) lastStudioBySociete.set(Number(societeId), studio);
}

function getCachedStudio(societeId) {
  if (societeId == null) return null;
  return lastStudioBySociete.get(Number(societeId)) || null;
}

async function loadLabels(societeId) {
  const articleFilter = societeId != null ? { societeId: Number(societeId) } : undefined;
  let rows = [];
  try {
    rows = await prisma.anomalieDetectee.findMany({
      where: {
        article: articleFilter,
        OR: [{ feedback: { not: null } }, { statut: { in: ["RESOLU", "CONFIRME"] } }],
      },
      select: { mouvementId: true, feedback: true, statut: true },
      take: 4000,
    });
  } catch {
    rows = await prisma.anomalieDetectee.findMany({
      where: {
        article: articleFilter,
        statut: { in: ["RESOLU", "CONFIRME"] },
      },
      select: { mouvementId: true, statut: true },
      take: 4000,
    });
  }
  return rows
    .map((r) => {
      const fb = String(r.feedback || r.statut || "").toUpperCase();
      let label = null;
      if (fb === "CONFIRME" || fb === "ANOMALIE") label = 1;
      if (fb === "NORMAL" || fb === "RESOLU") label = 0;
      if (label == null) return null;
      return { mouvementId: r.mouvementId, label };
    })
    .filter(Boolean);
}

async function buildMouvementPayload(societeId) {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const articleWhere = societeId != null ? { societeId: Number(societeId) } : {};

  const [mouvements30, mouvements90, labels] = await Promise.all([
    prisma.mouvement.findMany({
      where: {
        createdAt: { gte: since30 },
        statut: "VALIDE",
        article: articleWhere,
      },
      select: {
        id: true,
        articleId: true,
        depotId: true,
        quantite: true,
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    prisma.mouvement.findMany({
      where: {
        createdAt: { gte: since90 },
        statut: "VALIDE",
        article: articleWhere,
      },
      select: { articleId: true, depotId: true, quantite: true, createdAt: true },
      take: 10000,
    }),
    loadLabels(societeId),
  ]);

  const stats = new Map();
  const daily = new Map();
  for (const m of mouvements90) {
    const key = `${m.articleId}:${m.depotId}`;
    if (!stats.has(key)) stats.set(key, { qty: [], days: new Set() });
    const s = stats.get(key);
    const q = Number(m.quantite) || 0;
    s.qty.push(q);
    s.days.add(m.createdAt.toISOString().slice(0, 10));
    const dk = dayKey(m.createdAt);
    if (!daily.has(key)) daily.set(key, new Map());
    const dm = daily.get(key);
    dm.set(dk, (dm.get(dk) || 0) + q);
  }

  const payload = mouvements30.map((m) => {
    const key = `${m.articleId}:${m.depotId}`;
    const s = stats.get(key) || { qty: [0], days: new Set() };
    const mean = s.qty.reduce((a, b) => a + b, 0) / (s.qty.length || 1);
    const variance =
      s.qty.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, s.qty.length - 1);
    const std = Math.sqrt(variance) || 1;
    const q = Number(m.quantite) || 0;
    const freq = s.days.size / 90;
    const ecartVsMoyenne = (q - mean) / std;
    const days = lastNDays(m.createdAt, SEQ_LEN);
    const dm = daily.get(key) || new Map();
    const window = days.map((d) => Number(dm.get(d) || 0));
    return {
      mouvementId: m.id,
      articleId: m.articleId,
      depotId: m.depotId,
      quantite: q,
      type: m.type,
      moyenneHabituelle: Math.round(mean * 100) / 100,
      frequence: Math.round(freq * 1000) / 1000,
      ecartVsMoyenne: Math.round(ecartVsMoyenne * 100) / 100,
      date: m.createdAt.toISOString(),
      createdAt: m.createdAt.toISOString(),
      window,
    };
  });

  return { payload, labels, empty: !mouvements30.length };
}

async function callAnomaliesAi(mouvements, { societeId, labels, retrain = false } = {}) {
  // Occupé : règles locales, sans marquer le micro-service hors ligne.
  if (isAiBusy()) return detectAnomaliesLocal(mouvements);
  try {
    const response = await aiFetch("/anomalies", {
      body: {
        mouvements,
        labels: labels || [],
        societeId: societeId != null ? Number(societeId) : null,
        retrain: Boolean(retrain),
      },
      timeoutMs: 25000,
    });
    if (response.ok) {
      const data = await response.json();
      return {
        anomalies: Array.isArray(data.anomalies) ? data.anomalies : [],
        mode: data.mode || "ai",
        modele: data.modele || null,
        studio: data.studio || null,
        persisted: Boolean(data.persisted),
      };
    }
  } catch (err) {
    if (err instanceof AiBusyError) return detectAnomaliesLocal(mouvements);
  }
  return detectAnomaliesLocal(mouvements);
}

async function fetchMlStatus(societeId) {
  if (isAiBusy()) return null;
  try {
    const sid = societeId != null ? `?societeId=${Number(societeId)}` : "";
    const response = await aiFetch(`/anomalies/status${sid}`, {
      method: "GET",
      timeoutMs: 800,
    });
    if (response.ok) return response.json();
  } catch (err) {
    // 429 : service vivant mais saturé — ne pas le traiter comme injoignable.
    if (err instanceof AiBusyError) return null;
  }
  return null;
}

async function listStockAnomalies(societeId) {
  const sid = requireActiveSocieteId(societeId);
  const stocks = await prisma.stock.findMany({
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
  });

  const items = [];
  for (const s of stocks) {
    const seuil = getAlertThreshold(s.article);
    const q = Number(s.quantite) || 0;
    if (q > seuil) continue;
    const isRupture = q <= 0;
    items.push({
      id: `stock-${s.articleId}-${s.depotId}`,
      source: "stock",
      statut: "NON_RESOLU",
      score: isRupture ? 92 : 68,
      raison: isRupture
        ? `Rupture de stock — quantité 0 (seuil alerte : ${seuil})`
        : `Stock critique — ${q} unité(s) restante(s) (seuil : ${seuil})`,
      quantiteObservee: q,
      moyenneHabituelle: seuil,
      dateDetection: new Date().toISOString(),
      article: s.article,
      depot: s.depot,
      mouvement: null,
      mouvementId: null,
      modele: "regle_stock",
      mlMeta: null,
      feedback: null,
    });
  }
  return items.sort((a, b) => b.score - a.score);
}

/**
 * Agrège les mouvements des 30 derniers jours, calcule stats 90j,
 * appelle l'IA (ensemble + DL persisté) et persiste les anomalies.
 */
async function detectAndPersistAnomalies(societeId = null, { retrain = false } = {}) {
  const { payload, labels, empty } = await buildMouvementPayload(societeId);
  if (empty) {
    const studio = localStudio(0, 0);
    cacheStudio(societeId, studio);
    return { detected: 0, persisted: 0, studio, mode: "empty" };
  }

  const ai = await callAnomaliesAi(payload, { societeId, labels, retrain });
  const anomalies = Array.isArray(ai.anomalies) ? ai.anomalies : [];
  if (ai.studio) cacheStudio(societeId, ai.studio);

  let persisted = 0;
  for (const a of anomalies) {
    const mouvementId = Number(a.mouvementId || a.id);
    const articleId = Number(a.articleId);
    const depotId = Number(a.depotId);
    if (!mouvementId || !articleId || !depotId) continue;
    if (String(a.statut || "ALERTE").toUpperCase() === "SURVEILLANCE") continue;

    const existing = await prisma.anomalieDetectee.findFirst({
      where: {
        mouvementId,
        statut: { in: ["NON_RESOLU", "CONFIRME"] },
      },
      select: { id: true },
    });
    if (existing) continue;

    const mlMeta = {
      ...(a.mlMeta || {}),
      votes: a.votes || null,
      agreement: a.agreement ?? null,
      reconstruction: a.reconstruction ?? null,
      sequenceRecon: a.sequenceRecon ?? null,
      detectors: a.detectors || [],
      modele: a.modele || ai.modele || null,
      regime: a.mlMeta?.regime || a.regime || null,
    };

    const base = {
      articleId,
      depotId,
      mouvementId,
      score: Number(a.score) || 0,
      raison: String(a.raison || "Anomalie détectée").slice(0, 180),
      quantiteObservee: a.quantite != null ? Number(a.quantite) : null,
      moyenneHabituelle: a.moyenneHabituelle != null ? Number(a.moyenneHabituelle) : null,
      statut: "NON_RESOLU",
    };
    try {
      await prisma.anomalieDetectee.create({
        data: {
          ...base,
          modele: String(a.modele || ai.modele || "hybrid_dl").slice(0, 180),
          mlMeta,
        },
      });
    } catch {
      await prisma.anomalieDetectee.create({ data: base });
    }
    persisted += 1;
  }

  return {
    detected: anomalies.length,
    persisted,
    mode: ai.mode || "ai",
    modele: ai.modele || null,
    studio: ai.studio || getCachedStudio(societeId),
    persistedModel: Boolean(ai.persisted),
  };
}

async function trainAnomalyModels(societeId = null) {
  const { payload, labels, empty } = await buildMouvementPayload(societeId);
  if (empty || payload.length < 8) {
    return { ok: false, reason: "historique insuffisant", labels: labels.length };
  }
  if (isAiBusy()) return { ok: false, reason: "IA occupée", mode: "local" };
  try {
    const response = await aiFetch("/anomalies/train", {
      body: {
        mouvements: payload,
        labels,
        societeId: societeId != null ? Number(societeId) : null,
      },
      timeoutMs: 60000,
    });
    if (!response.ok) {
      return { ok: false, reason: `IA HTTP ${response.status}` };
    }
    const data = await response.json();
    if (data?.status) {
      cacheStudio(societeId, {
        ...(getCachedStudio(societeId) || {}),
        supervised: data.supervised || data.status?.supervised,
        neural: {
          trained: Boolean(data.aeMeta?.trained),
          epochs: data.aeMeta?.epochs || 0,
          lossCurve: data.aeMeta?.lossCurve || [],
          architecture: "autoencoder",
        },
        persisted: true,
      });
    }
    return data;
  } catch (e) {
    if (e instanceof AiBusyError) return { ok: false, reason: "IA occupée", mode: "local" };
    return { ok: false, reason: e?.message || "train unreachable" };
  }
}

function maybeRetrain(societeId) {
  loadLabels(societeId)
    .then((labels) => {
      if (labels.length < 8) return null;
      return trainAnomalyModels(societeId);
    })
    .catch(() => {});
}

async function listAnomalies(societeId, { statut = "NON_RESOLU", skipStudio = false } = {}) {
  const sid = requireActiveSocieteId(societeId);
  const where = {
    article: { societeId: sid },
  };
  if (statut && statut !== "TOUS") {
    if (statut === "NON_RESOLU") {
      where.statut = { in: ["NON_RESOLU", "CONFIRME"] };
    } else {
      where.statut = String(statut);
    }
  }

  const rows = await prisma.anomalieDetectee.findMany({
    where,
    include: {
      article: { select: { id: true, code: true, libelle: true, imageUrl: true } },
      depot: { select: { id: true, code: true, libelle: true } },
      mouvement: {
        select: {
          id: true,
          reference: true,
          type: true,
          quantite: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ score: "desc" }, { dateDetection: "desc" }],
    take: 200,
  });

  const stockItems = statut === "RESOLU" ? [] : await listStockAnomalies(sid);
  const movementItems = rows.map((r) => ({ ...r, source: "mouvement" }));
  const items = [...stockItems, ...movementItems].sort(
    (a, b) => Number(b.score || 0) - Number(a.score || 0)
  );

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [dbActives, resolvedThisMonth, confirmedCount, labeled] = await Promise.all([
    prisma.anomalieDetectee.count({
      where: {
        article: { societeId: sid },
        statut: { in: ["NON_RESOLU", "CONFIRME"] },
      },
    }),
    prisma.anomalieDetectee.count({
      where: {
        article: { societeId: sid },
        statut: "RESOLU",
        dateResolution: { gte: monthStart },
      },
    }),
    prisma.anomalieDetectee.count({
      where: { article: { societeId: sid }, statut: "CONFIRME" },
    }),
    prisma.anomalieDetectee.count({
      where: {
        article: { societeId: sid },
        statut: { in: ["RESOLU", "CONFIRME"] },
      },
    }),
  ]);

  const unresolvedItems = items.filter(
    (r) => r.statut === "NON_RESOLU" || r.statut === "CONFIRME"
  );
  const actives = unresolvedItems.length;
  const avgScore =
    unresolvedItems.reduce((s, r) => s + Number(r.score || 0), 0) /
    Math.max(1, unresolvedItems.length);

  let studio = getCachedStudio(sid);
  if (!skipStudio && !studio) {
    const status = await fetchMlStatus(sid);
    if (status) {
      studio = {
        modele: status.supervised?.trained
          ? "hybrid_if_lof_ae_seq_supervised"
          : "unsupervised_if_lof_ae",
        mode: status.persisted ? "ai" : "cold",
        persisted: Boolean(status.persisted),
        fittedAt: status.fittedAt,
        pipeline: [
          {
            id: "if",
            label: "IsolationForest",
            status: status.unsupervised?.isolationForest ? "ok" : "skip",
            detail: status.unsupervised?.isolationForest ? "modèle persisté" : "pas encore entraîné",
          },
          {
            id: "ae",
            label: "Autoencodeur DL",
            status: status.unsupervised?.autoencoder ? "ok" : "skip",
            detail: status.unsupervised?.aeMeta?.trained
              ? `${status.unsupervised.aeMeta.epochs || 0} époques`
              : "en attente d'un run",
          },
          {
            id: "sup",
            label: "Calibrateur supervisé",
            status: status.supervised?.trained ? "ok" : "skip",
            detail: status.supervised?.trained
              ? `${status.supervised.nPos} / ${status.supervised.nNeg} labels`
              : "feedback métier insuffisant",
          },
        ],
        neural: {
          trained: Boolean(status.unsupervised?.aeMeta?.trained),
          epochs: status.unsupervised?.aeMeta?.epochs || 0,
          lossCurve: status.unsupervised?.aeMeta?.lossCurve || [],
          architecture: "autoencoder",
        },
        sequence: {
          trained: Boolean(status.unsupervised?.seqMeta?.trained),
          lookback: SEQ_LEN,
          lossCurve: status.unsupervised?.seqMeta?.lossCurve || [],
        },
        supervised: status.supervised,
        unsupervised: status.unsupervised,
        quality: { maturity: status.supervised?.trained ? 72 : 48, n: status.nTrain || 0 },
        cron: status.cron || { detect: "03:00 & 15:00", retrain: "03:20" },
      };
      cacheStudio(sid, studio);
    }
  }

  return {
    items,
    studio,
    kpis: {
      actives,
      graviteMoyenne: Math.round(avgScore * 10) / 10,
      resoluesCeMois: resolvedThisMonth,
      stockActives: stockItems.length,
      mouvementActives: dbActives,
      confirmees: confirmedCount,
      labelsSupervises: labeled,
    },
  };
}

async function resolveAnomalie(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const row = await prisma.anomalieDetectee.findFirst({
    where: { id: Number(id), article: { societeId: sid } },
  });
  if (!row) {
    const err = new Error("Anomalie introuvable");
    err.status = 404;
    throw err;
  }
  try {
    const updated = await prisma.anomalieDetectee.update({
      where: { id: row.id },
      data: { statut: "RESOLU", feedback: "NORMAL", dateResolution: new Date() },
    });
    maybeRetrain(sid);
    return updated;
  } catch {
    return prisma.anomalieDetectee.update({
      where: { id: row.id },
      data: { statut: "RESOLU", dateResolution: new Date() },
    });
  }
}

async function confirmAnomalie(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const row = await prisma.anomalieDetectee.findFirst({
    where: { id: Number(id), article: { societeId: sid } },
  });
  if (!row) {
    const err = new Error("Anomalie introuvable");
    err.status = 404;
    throw err;
  }
  try {
    const updated = await prisma.anomalieDetectee.update({
      where: { id: row.id },
      data: { statut: "CONFIRME", feedback: "CONFIRME" },
    });
    maybeRetrain(sid);
    return updated;
  } catch {
    const updated = await prisma.anomalieDetectee.update({
      where: { id: row.id },
      data: { statut: "CONFIRME" },
    });
    return updated;
  }
}

async function getAnomalyMlStatus(societeId) {
  const sid = requireActiveSocieteId(societeId);
  const status = await fetchMlStatus(sid);
  return {
    studio: getCachedStudio(sid),
    status,
    cron: {
      detect: "0 3,15 * * *",
      retrain: "20 3 * * *",
      detectLabel: "03:00 et 15:00",
      retrainLabel: "03:20",
    },
  };
}

module.exports = {
  detectAnomaliesLocal,
  detectAndPersistAnomalies,
  trainAnomalyModels,
  listAnomalies,
  resolveAnomalie,
  confirmAnomalie,
  getAnomalyMlStatus,
};
