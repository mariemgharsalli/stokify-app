/**
 * Fallbacks locaux (Node) quand le micro-service FastAPI est indisponible.
 * Alignés sur la logique de ai-service/main.py pour garder le même contrat API.
 */

function nextMonthKeys(lastKey, n = 3) {
  if (lastKey && String(lastKey).includes("-")) {
    try {
      let [y, m] = String(lastKey).split("-").slice(0, 2).map(Number);
      const keys = [];
      for (let i = 0; i < n; i += 1) {
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
        keys.push(`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`);
      }
      return keys;
    } catch {
      /* fallthrough */
    }
  }
  return Array.from({ length: n }, (_, i) => `M+${i + 1}`);
}

function weightedAverageForecast(series, moisKeys) {
  const n = series.length;
  let preds;
  let avg = 0;
  if (n === 0) {
    preds = [0, 0, 0];
  } else {
    const weights = series.map((_, i) => i + 1);
    const wsum = weights.reduce((s, w) => s + w, 0);
    avg = series.reduce((s, v, i) => s + v * weights[i], 0) / wsum;
    preds = [avg, avg, avg];
  }
  const predKeys = nextMonthKeys(moisKeys[moisKeys.length - 1], 3);
  const meanPred = preds.reduce((s, v) => s + v, 0) / 3;
  return {
    predictions: preds.map((p, i) => ({
      mois: predKeys[i],
      valeur: Math.round(p * 100) / 100,
      min: null,
      max: null,
      lower: null,
      upper: null,
      p50: Math.round(p * 100) / 100,
    })),
    historique: series.map((v, i) => ({
      mois: moisKeys[i] || `M${i}`,
      valeur: Math.round(v * 100) / 100,
    })),
    tendance: "stable",
    variationPct: 0,
    picSaisonnier: null,
    recommendedStock: Math.round(meanPred * 1.15),
    reorderPoint: Math.round((preds[0] || 0) * 0.4),
    confidence: null,
    confidenceLabel: "insuffisant",
    smape: null,
    mase: null,
    lower: [null, null, null],
    upper: [null, null, null],
    minHistory: 4,
    explication:
      `Historique insuffisant (< 4 mois) : prévision locale (moyenne pondérée) sur ${Math.max(n, 1)} point(s).`,
    modele: "moyenne_ponderee_locale",
    mode: "moyenne_ponderee_historique_court",
  };
}

/** Holt additif simple (double lissage exponentiel). */
function holtForecast(series, horizon = 3) {
  const alpha = 0.4;
  const beta = 0.2;
  const y = series.map(Number);
  const n = y.length;
  let level = y[0];
  let trend = n > 1 ? y[1] - y[0] : 0;
  const fitted = [level];
  for (let t = 1; t < n; t += 1) {
    const lastLevel = level;
    level = alpha * y[t] + (1 - alpha) * (level + trend);
    trend = beta * (level - lastLevel) + (1 - beta) * trend;
    fitted.push(level + trend);
  }
  const preds = [];
  for (let h = 1; h <= horizon; h += 1) {
    preds.push(Math.max(0, level + h * trend));
  }
  const residuals = y.map((v, i) => v - (fitted[i] || v));
  const mean = residuals.reduce((s, v) => s + v, 0) / residuals.length;
  const variance =
    residuals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, residuals.length - 1);
  const std = Math.sqrt(variance) || 0;
  return { preds, std, fitted };
}

function attachStudioLocal(result, preds, predKeys, std, seriesLen) {
  const p50 = preds.map((p) => Math.max(0, p));
  const p10 = p50.map((p, i) => Math.max(0, p - 1.28 * std * Math.sqrt(i + 1)));
  const p90 = p50.map((p, i) => p + 1.28 * std * Math.sqrt(i + 1));
  const round2 = (n) => Math.round(n * 100) / 100;
  result.champion = "hw";
  result.comparaison = {
    champion: "hw",
    models: [
      { id: "hw", label: "Holt-Winters", mape: result.quality?.mape ?? null, preds: p50.map(round2), selected: true },
      { id: "nbeats", label: "N-BEATS", mape: null, preds: [null, null, null], selected: false },
      { id: "hybrid", label: "Hybride", mape: null, preds: p50.map(round2), selected: false },
    ],
  };
  result.scenarios = { p10: p10.map(round2), p50: p50.map(round2), p90: p90.map(round2), serviceLevel: 0.9, mois: predKeys };
  result.decomposition = { mois: [], level: [], trend: [], seasonal: [], residual: [], neuralBoost: [] };
  result.hwSpec = { trend: "add", seasonal: null, damped: true, engine: "local" };
  result.neural = { trained: false, windows: 0, peers: 0, epochs: 0, blocks: ["trend", "seasonal", "generic"] };
  result.pipeline = [
    { id: "hw", label: "Holt-Winters", status: "fallback", detail: "Holt local (FastAPI offline)" },
    { id: "nbeats", label: "N-BEATS", status: "skip", detail: "Indisponible en mode local" },
    { id: "hybrid", label: "Hybride", status: "skip", detail: "Indisponible en mode local" },
    { id: "champion", label: "Champion", status: "ok", detail: "Holt local" },
    { id: "quantile", label: "Stock P90", status: "fallback", detail: "Bande σ locale" },
  ];
  result.story = [
    `Jumeau local : Holt additif sur ${seriesLen} mois (ai-service offline).`,
    "Relancez ai-service pour N-BEATS global, hybride et le stock P90.",
  ];
  result.quality = {
    mape: result.mape ?? null,
    smape: result.smape ?? null,
    mase: result.mase ?? null,
    rmse: round2(std),
    maturity: 58,
    windows: 0,
    peers: 0,
    points: seriesLen,
    seasonal: false,
  };
  result.methodology =
    "Mode local (FastAPI offline) : Holt additif. Relancez ai-service pour HW AIC + N-BEATS + P90.";
  result.methodologyLabel = "Holt local";
  return result;
}

/**
 * Prévision locale compatible avec POST /forecast du micro-service.
 */
function localForecast({ articleId, historique = [], horizon = 3 }) {
  const series = [];
  const moisKeys = [];
  for (const h of historique) {
    const q = h.quantite ?? h.valeur ?? 0;
    series.push(Number(q) || 0);
    moisKeys.push(String(h.mois || h.periode || ""));
  }

  if (series.length < 4) {
    const result = weightedAverageForecast(series, moisKeys);
    result.article_id = articleId;
    const preds = (result.predictions || []).map((p) => p.valeur);
    const keys = (result.predictions || []).map((p) => p.mois);
    return attachStudioLocal(result, preds, keys, Math.max(0.15 * (preds[0] || 0), 0.01), series.length);
  }

  const { preds: rawPreds, std } = holtForecast(series, Math.max(1, Math.min(horizon, 12)));
  while (rawPreds.length < 3) rawPreds.push(rawPreds[rawPreds.length - 1] || 0);
  const preds = rawPreds.slice(0, 3).map((p) => Math.max(0, p));
  const predKeys = nextMonthKeys(moisKeys[moisKeys.length - 1], 3);

  const tail = series.slice(-3);
  let variationPct = 0;
  if (tail.length >= 2 && Math.abs(tail[0]) > 1e-9) {
    variationPct = ((tail[tail.length - 1] - tail[0]) / Math.abs(tail[0])) * 100;
  }

  let tendance = "stable";
  if (variationPct > 5) tendance = "hausse";
  else if (variationPct < -5) tendance = "baisse";

  const sigma = std || 0;
  const absResid = series.map((v, i) => Math.abs(v - (i === 0 ? v : series[i - 1])));
  absResid.sort((a, b) => a - b);
  const q80 = absResid.length >= 4 ? absResid[Math.min(absResid.length - 1, Math.ceil(0.8 * absResid.length) - 1)] : null;
  const bands = preds.map((p, i) => {
    if (q80 == null) return { lower: null, upper: null };
    const half = q80 * Math.sqrt(i + 1);
    return { lower: Math.max(0, Math.round((p - half) * 100) / 100), upper: Math.round((p + half) * 100) / 100 };
  });
  const scale = series.length >= 2
    ? series.slice(1).reduce((s, v, i) => s + Math.abs(v - series[i]), 0) / (series.length - 1)
    : null;
  const mae = sigma;
  const mase = scale ? Math.round((mae / scale) * 1000) / 1000 : null;
  const confidenceLabel = mase == null ? "insuffisant" : mase < 0.8 ? "fiable" : mase < 1 ? "moyen" : "faible";

  const result = {
    article_id: articleId,
    predictions: preds.map((p, i) => ({
      mois: predKeys[i],
      valeur: Math.round(p * 100) / 100,
      min: bands[i].lower,
      max: bands[i].upper,
      p10: bands[i].lower,
      p50: Math.round(p * 100) / 100,
      p90: bands[i].upper,
      lower: bands[i].lower,
      upper: bands[i].upper,
    })),
    historique: series.map((v, i) => ({
      mois: moisKeys[i] || `M${i}`,
      valeur: Math.round(v * 100) / 100,
    })),
    tendance,
    variationPct: Math.round(variationPct * 10) / 10,
    picSaisonnier: null,
    recommendedStock: Math.round(preds.reduce((s, p, i) => s + (bands[i].upper ?? p), 0)),
    reorderPoint: Math.round(((bands[0] && bands[0].upper) || preds[0] || 0) * 0.6),
    confidence: null,
    confidenceLabel,
    smape: null,
    mase,
    lower: bands.map((b) => b.lower),
    upper: bands.map((b) => b.upper),
    explication:
      tendance === "hausse"
        ? `Mode local (Holt) : hausse de ${Math.abs(variationPct).toFixed(1)}% sur 3 mois — service FastAPI offline.`
        : tendance === "baisse"
          ? `Mode local (Holt) : baisse de ${Math.abs(variationPct).toFixed(1)}% sur 3 mois — service FastAPI offline.`
          : "Mode local (Holt) : demande stable — service FastAPI offline.",
    modele: "holt_local",
    mode: "local",
  };
  return attachStudioLocal(result, preds, predKeys, sigma, series.length);
}

/**
 * Packing local : couches par densité + LIFO destinations (FastAPI offline).
 */
function localLoadOptimization(articles, vehicule) {
  const rows = [];
  for (const a of articles || []) {
    const qty = Math.max(0, Math.floor(Number(a.quantite) || 0));
    if (!qty) continue;
    rows.push({
      articleId: a.articleId,
      code: a.code,
      libelle: a.libelle,
      quantite: qty,
      poidsUnitaire: Number(a.poidsUnitaire) || 0,
      volumeUnitaire: Number(a.volumeUnitaire) || 0,
      destination: a.destination || "—",
      fragile: Boolean(a.fragile),
      dangereux: Boolean(a.dangereuxChimique),
      prixVente: Number(a.prixVente) || 0,
      imageUrl: a.imageUrl || null,
    });
  }

  const capPoids = Number(vehicule.capacitePoids) || 0;
  const capVolume = Number(vehicule.capaciteVolume) || 0;
  const dests = [...new Set(rows.map((r) => r.destination))].sort();
  const destIx = new Map(dests.map((d, i) => [d, i]));

  const densityOf = (r) =>
    r.volumeUnitaire > 1e-9 ? r.poidsUnitaire / r.volumeUnitaire : r.poidsUnitaire;
  const sortedByDens = [...rows].sort((a, b) => densityOf(b) - densityOf(a));
  const layerOf = new Map();
  const nBot = Math.max(1, Math.round(rows.length * 0.34));
  const nMid = Math.max(0, Math.round(rows.length * 0.33));
  sortedByDens.forEach((r, rank) => {
    layerOf.set(r, rank < nBot ? "BOTTOM" : rank < nBot + nMid ? "MID" : "TOP");
  });
  const layerRank = { BOTTOM: 0, MID: 1, TOP: 2 };

  const order = [...rows].sort((a, b) => {
    const lr = layerRank[layerOf.get(a)] - layerRank[layerOf.get(b)];
    if (lr !== 0) return lr;
    const d = (destIx.get(b.destination) || 0) - (destIx.get(a.destination) || 0);
    if (d !== 0) return d;
    return (a.fragile ? 1 : 0) - (b.fragile ? 1 : 0);
  });

  const loaded = [];
  const rejected = [];
  let poidsTotal = 0;
  let volumeTotal = 0;
  for (const item of order) {
    const pw = item.poidsUnitaire;
    const pv = item.volumeUnitaire;
    let can = item.quantite;
    if (pw > 1e-9) can = Math.min(can, Math.floor((capPoids - poidsTotal) / pw + 1e-9));
    if (pv > 1e-9) can = Math.min(can, Math.floor((capVolume - volumeTotal) / pv + 1e-9));
    can = Math.max(0, can);
    if (can > 0) {
      loaded.push({ ...item, quantiteChargee: can, layer: layerOf.get(item) });
      poidsTotal += can * pw;
      volumeTotal += can * pv;
    }
    const leftover = item.quantite - can;
    if (leftover > 0) {
      rejected.push({
        articleId: item.articleId,
        code: item.code,
        libelle: item.libelle,
        quantiteNonChargee: leftover,
        destination: item.destination,
        reason: "Capacité atteinte (mode local)",
      });
    }
  }

  const n = loaded.length;
  const sequenced = loaded.map((row, i) => ({
    articleId: row.articleId,
    code: row.code,
    libelle: row.libelle,
    quantiteChargee: row.quantiteChargee,
    destination: row.destination,
    fragile: row.fragile,
    dangereux: row.dangereux,
    imageUrl: row.imageUrl,
    layer: row.layer,
    layerLabel:
      row.layer === "BOTTOM" ? "Fond (cabine)" : row.layer === "TOP" ? "Haut / porte" : "Milieu",
    loadOrder: i + 1,
    unloadOrder: n - i,
    doorProximity: n > 1 ? Math.round((100 * i) / (n - 1)) : 100,
    poidsUnitaire: row.poidsUnitaire,
    volumeUnitaire: row.volumeUnitaire,
  }));

  const fillW = capPoids ? Math.min(1, poidsTotal / capPoids) : 0;
  const fillV = capVolume ? Math.min(1, volumeTotal / capVolume) : 0;
  const fill = 0.5 * fillW + 0.5 * fillV;
  const switches =
    sequenced.length > 1
      ? sequenced.slice(1).filter((r, i) => r.destination !== sequenced[i].destination).length
      : 0;
  const cohesion = sequenced.length <= 1 ? 1 : Math.max(0, 1 - switches / (sequenced.length - 1));
  const census = { BOTTOM: 0, MID: 0, TOP: 0, n: rows.length };
  for (const r of rows) census[layerOf.get(r)] += 1;
  const weights = sequenced.map((x) => x.quantiteChargee * x.poidsUnitaire);
  const totalW = weights.reduce((s, x) => s + x, 0) || 1;
  const rear = weights.slice(0, Math.max(1, Math.floor(weights.length / 2))).reduce((s, x) => s + x, 0) / totalW;
  const balance = Math.max(0, 1 - Math.abs(0.5 - rear) * 2);
  const maturity = Math.max(55, Math.min(78, Math.round(24 + 16 * fill + 12 * cohesion + 10 * balance + 8)));

  return {
    vehicule: vehicule.nom,
    poidsUtilise: Math.round(poidsTotal * 100) / 100,
    poidsCapacite: capPoids,
    pctPoids: capPoids ? Math.round((poidsTotal / capPoids) * 1000) / 10 : 0,
    volumeUtilise: Math.round(volumeTotal * 1000) / 1000,
    volumeCapacite: capVolume,
    pctVolume: capVolume ? Math.round((volumeTotal / capVolume) * 1000) / 10 : 0,
    articlesCharges: sequenced,
    articlesNonCharges: rejected,
    chargementComplet: rejected.length === 0,
    modele: "percentile_hgb_rank_local",
    hacMode: "percentile_layers",
    policy: "hac_layer",
    policyLabel: "Couches densité (local)",
    predictedPolicy: null,
    policyBoard: [
      { id: "hac_layer", label: "Couches HAC (local)", score: Math.round((0.4 * fill + 0.2 + 0.16 * cohesion) * 1000) / 1000, fill, winner: true, predicted: false, pareto: true },
    ],
    kScan: [],
    dendrogram: [
      { id: "BOTTOM", n: census.BOTTOM },
      { id: "MID", n: census.MID },
      { id: "TOP", n: census.TOP },
    ],
    featureImportance: [],
    utilityRank: [],
    census,
    layers: [
      { id: "BOTTOM", label: "Fond (cabine)", n: census.BOTTOM },
      { id: "MID", label: "Milieu", n: census.MID },
      { id: "TOP", label: "Haut / porte", n: census.TOP },
    ],
    stops: dests
      .map((d, i) => ({
        destination: d,
        stopIndex: i + 1,
        unloadOrder: i + 1,
        quantite: sequenced.filter((x) => x.destination === d).reduce((s, x) => s + x.quantiteChargee, 0),
      }))
      .filter((s) => s.quantite > 0),
    radar: {
      fill: Math.round(fill * 100),
      balance: Math.round(balance * 100),
      cohesion: Math.round(cohesion * 100),
      stability: 72,
    },
    cargoBay: {
      BOTTOM: sequenced.filter((x) => x.layer === "BOTTOM").map((x) => ({
        code: x.code, qty: x.quantiteChargee, destination: x.destination, fragile: x.fragile,
      })),
      MID: sequenced.filter((x) => x.layer === "MID").map((x) => ({
        code: x.code, qty: x.quantiteChargee, destination: x.destination, fragile: x.fragile,
      })),
      TOP: sequenced.filter((x) => x.layer === "TOP").map((x) => ({
        code: x.code, qty: x.quantiteChargee, destination: x.destination, fragile: x.fragile,
      })),
    },
    axle: {
      rearPct: Math.round(rear * 100),
      frontPct: Math.round((1 - rear) * 100),
      balance: Math.round(balance * 100),
    },
    geoMode: "alpha",
    tourKm: null,
    quality: {
      score: Math.round((0.4 * fill + 0.22 + 0.16 * cohesion + 0.12 * 0.72 + 0.08 * balance) * 1000) / 1000,
      fill,
      cohesion,
      stability: 0.72,
      balance,
      silhouette: null,
      maturity,
      sampleSize: census.n,
    },
    pipeline: [
      { id: "hac", label: "Couches HAC", status: "fallback", detail: `${census.n} SKU · percentiles densité (FastAPI offline)` },
      { id: "rank", label: "Utilité HGB", status: "skip", detail: "Indisponible en mode local" },
      { id: "hgb", label: "Sélection HGB", status: "skip", detail: "Indisponible en mode local" },
      { id: "portfolio", label: "Portefeuille", status: "ok", detail: "Politique couches densité" },
      { id: "sequence", label: "Séquence LIFO", status: dests.length ? "ok" : "skip", detail: `${dests.length} destination(s)` },
    ],
    story: [
      `Mode local : ${census.n} SKU en couches densité (${census.BOTTOM} fond · ${census.MID} milieu · ${census.TOP} haut).`,
      `Remplissage ${Math.round(fill * 100)}% · cohésion destinations ${Math.round(cohesion * 100)}%.`,
      rejected.length
        ? `${rejected.reduce((s, r) => s + r.quantiteNonChargee, 0)} unité(s) reportée(s). Relancez ai-service pour le HAC + HGB.`
        : "Chargement complet en local. Relancez ai-service pour le HAC + HGB.",
    ],
    confidence: 58,
    methodology:
      "Mode local (FastAPI offline) : couches par densité + LIFO destinations",
    methodologyLabel: "Couches densité + LIFO (mode local)",
    mode: "local",
  };
}

let aiOnlineCache = { online: null, at: 0 };

function resolveAiServiceUrl() {
  const raw = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
  return String(raw).replace("://localhost", "://127.0.0.1");
}

function rememberAiOnline(online) {
  aiOnlineCache = { online: Boolean(online), at: Date.now() };
}

function isAiLikelyOffline(maxAgeMs = 20000) {
  return aiOnlineCache.online === false && Date.now() - aiOnlineCache.at < maxAgeMs;
}

async function probeAiService(timeoutMs = 800) {
  const aiUrl = resolveAiServiceUrl();
  const started = Date.now();
  // Import paresseux : aiClient dépend déjà de ce module.
  const { aiFetch, AiBusyError } = require("../../utils/aiClient");
  try {
    const response = await aiFetch("/health", { method: "GET", timeoutMs });
    const online = response.ok || response.status === 200;
    rememberAiOnline(online);
    return {
      online,
      url: aiUrl,
      latencyMs: Date.now() - started,
      probedAt: new Date().toISOString(),
      path: "/health",
    };
  } catch (err) {
    // 429 = service vivant mais saturé. Ne pas le marquer hors ligne.
    if (err instanceof AiBusyError || err?.name === "AiBusyError") {
      rememberAiOnline(true);
      return {
        online: true,
        busy: true,
        url: aiUrl,
        latencyMs: Date.now() - started,
        probedAt: new Date().toISOString(),
        path: "/health",
      };
    }
    rememberAiOnline(false);
    return {
      online: false,
      url: aiUrl,
      latencyMs: Date.now() - started,
      probedAt: new Date().toISOString(),
      path: null,
    };
  }
}

function percentileAbc(articles) {
  const sorted = [...articles].sort(
    (a, b) => (Number(b.rotation30) || 0) - (Number(a.rotation30) || 0)
  );
  const n = sorted.length || 1;
  const nA = n >= 5 ? Math.max(1, Math.round(n * 0.2)) : n >= 2 ? 1 : n;
  const nB = n >= 5 ? Math.max(0, Math.round(n * 0.3)) : n >= 3 ? 1 : 0;
  const map = new Map();
  sorted.forEach((a, rank) => {
    const abc = rank < nA ? "A" : rank < nA + nB ? "B" : "C";
    const posterior =
      abc === "A"
        ? { A: 0.7, B: 0.22, C: 0.08 }
        : abc === "B"
          ? { A: 0.18, B: 0.64, C: 0.18 }
          : { A: 0.08, B: 0.22, C: 0.7 };
    map.set(a.articleId, { abc, posterior });
  });
  return map;
}

function posteriorEntropy(posterior) {
  const vals = ["A", "B", "C"].map((k) => Math.max(1e-9, Number(posterior?.[k]) || 0));
  const sum = vals.reduce((s, v) => s + v, 0) || 1;
  const nrm = vals.map((v) => v / sum);
  return -nrm.reduce((s, v) => s + v * Math.log(v), 0) / Math.log(3);
}

function localSlotting(payload) {
  const articles = payload.articles || [];
  const candidates = payload.candidates || [];
  const occupants = payload.occupants || [];
  const cooccurrence = payload.cooccurrence || [];
  const articleId = Number(payload.articleId);
  const target = articles.find((a) => Number(a.articleId) === articleId) || {};
  const rot30 = Number(target.rotation30) || 0;
  const classes = percentileAbc(articles);
  const cls = classes.get(articleId) || { abc: "C", posterior: { A: 0.1, B: 0.2, C: 0.7 } };
  const vmax = Math.max(1, ...articles.map((a) => Number(a.rotation30) || 0));
  const velocityNorm = Math.min(1, rot30 / vmax);

  const aff = new Map();
  for (const row of cooccurrence) {
    const a = Number(row.a);
    const b = Number(row.b);
    const c = Number(row.count) || 0;
    if (a === articleId && b !== articleId) aff.set(b, (aff.get(b) || 0) + c);
    if (b === articleId && a !== articleId) aff.set(a, (aff.get(a) || 0) + c);
  }
  const maxAff = Math.max(0, ...aff.values());
  const neighbors = [...aff.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3)
    .map(([id, count]) => {
      const art = articles.find((x) => Number(x.articleId) === id) || {};
      return {
        articleId: id,
        code: art.code || "",
        libelle: art.libelle || "",
        count,
        imageUrl: art.imageUrl || null,
      };
    });

  const scored = candidates.map((slot) => {
    const dist = Number(slot.distanceQuai);
    const distN = (Number.isFinite(dist) ? dist : 50) / 100;
    const proximity = 1 - Math.abs(distN - (1 - velocityNorm));
    let occ = Number(slot.occupationRatio) || 0;
    if (occ > 1) occ /= 100;
    occ = Math.max(0, Math.min(1, occ));
    const capacity = 1 - occ;
    const zoneKey = slot.zoneKey || "B";
    const p = cls.posterior;
    const zoneFit =
      p.A * (zoneKey === "A" ? 1 : 0.28) +
      p.B * (zoneKey === "B" ? 1 : 0.5) +
      p.C * (zoneKey === "C" ? 1 : 0.28);
    let affinity = 0;
    if (maxAff > 0) {
      let total = 0;
      for (const occu of occupants) {
        const od = Number(occu.distanceQuai);
        if (Math.abs((Number.isFinite(od) ? od : 50) - (Number.isFinite(dist) ? dist : 50)) > 14) {
          continue;
        }
        total += aff.get(Number(occu.articleId)) || 0;
      }
      affinity = Math.min(1, total / maxAff);
    }
    const hasAff = maxAff > 0;
    const score = hasAff
      ? proximity * 0.36 + zoneFit * 0.22 + capacity * 0.22 + affinity * 0.2
      : proximity * 0.46 + zoneFit * 0.27 + capacity * 0.27;
    return {
      emplacementId: Number(slot.emplacementId),
      code: slot.code,
      libelle: slot.libelle,
      distanceQuai: Number.isFinite(dist) ? dist : 50,
      occupationRatio: Math.round(occ * 100),
      zoneKey,
      score: Math.round(Math.max(0, Math.min(1, score)) * 100),
      affinityScore: Math.round(affinity * 100),
      scoreBreakdown: {
        proximity: Math.round(proximity * 100),
        capacity: Math.round(capacity * 100),
        zoneAlignment: Math.round(zoneFit * 100),
        affinity: Math.round(affinity * 100),
      },
      reasons: [
        `Classe ${cls.abc} par percentiles ABC (mode local, FastAPI offline)`,
        zoneKey === cls.abc
          ? `Zone ${zoneKey} alignée avec la classe ${cls.abc}`
          : `Compromis zone ${zoneKey} / classe ${cls.abc}`,
      ],
    };
  });
  scored.sort((a, b) => b.score - a.score || a.distanceQuai - b.distanceQuai);
  const best = scored[0];
  const currentCode = payload.currentEmplacementCode;
  const census = { A: 0, B: 0, C: 0, n: articles.length };
  for (const v of classes.values()) {
    if (census[v.abc] != null) census[v.abc] += 1;
  }
  const hasAff = neighbors.length > 0;
  const entropy = posteriorEntropy(cls.posterior);
  const certainty = Math.max(0, Math.min(1, 1 - entropy));
  const sep =
    articles.length > 0
      ? [...classes.values()].reduce((s, v) => s + Math.max(v.posterior.A, v.posterior.B, v.posterior.C), 0) /
        articles.length
      : 0.64;
  const maturity = Math.max(
    55,
    Math.min(
      78,
      Math.round(24 + 18 * sep + 14 * 0.45 + 5 + (hasAff ? 12 : 4))
    )
  );
  const radar = best
    ? {
        proximity: best.scoreBreakdown.proximity,
        zone: best.scoreBreakdown.zoneAlignment,
        capacity: best.scoreBreakdown.capacity,
        affinity: best.scoreBreakdown.affinity,
      }
    : null;
  const pipeline = [
    {
      id: "gmm",
      label: "Mélange gaussien",
      status: "fallback",
      detail: `${census.n} SKU · percentiles 20/30/50 (FastAPI offline)`,
    },
    {
      id: "hgb",
      label: "Demande HGB",
      status: "skip",
      detail: "Indisponible en mode local",
    },
    {
      id: "affinity",
      label: "Co-picking",
      status: hasAff ? "ok" : "skip",
      detail: hasAff ? `${neighbors.length} voisin(s) fréquent(s)` : "Aucune paire de co-achat",
    },
  ];

  return {
    articleId,
    abcClass: cls.abc,
    rotationLabel: cls.abc === "A" ? "Fort" : cls.abc === "B" ? "Moyen" : "Faible",
    rotationScore: Math.round(rot30),
    velocityNorm: Math.round(velocityNorm * 1000) / 1000,
    idealDistance: Math.round((1 - velocityNorm) * 100),
    posterior: cls.posterior,
    confidence: 58,
    modele: "percentile_affinity_local",
    gmmMode: "percentile_abc",
    gmmBic: null,
    demand: { used: false, predicted90: null, r2: null },
    affinityNeighbors: neighbors,
    scored,
    methodology:
      "Mode local (FastAPI offline) : percentiles ABC 20/30/50 + affinité de co-picking",
    explication: best
      ? `Mode local : classe ${cls.abc} (percentiles). ${
          currentCode ? `Depuis ${currentCode} → ` : ""
        }emplacement ${best.code} (d=${best.distanceQuai}/100). Relancez ai-service pour le GMM + HGB.`
      : `Mode local : classe ${cls.abc}. Aucun emplacement compatible.`,
    currentEmplacementId: payload.currentEmplacementId ?? null,
    mode: "local",
    census,
    quality: {
      separation: Math.round(sep * 1000) / 1000,
      silhouette: null,
      certainty: Math.round(certainty * 1000) / 1000,
      entropy: Math.round(entropy * 1000) / 1000,
      sampleSize: census.n,
      affinityNeighbors: neighbors.length,
      maturity,
    },
    radar,
    pipeline,
    story: [
      `Catalogue : ${census.n} SKU classés en local (${census.A} A · ${census.B} B · ${census.C} C).`,
      `Cet article est classe ${cls.abc} (certitude ${Math.round(certainty * 100)}%).`,
      best
        ? `Cible ${best.code} (d=${best.distanceQuai}/100).`
        : "Aucun emplacement compatible.",
      "Relancez ai-service pour le GMM, le HGB et la silhouette.",
    ],
    weights: hasAff
      ? { proximity: 36, zone: 22, capacity: 22, affinity: 20 }
      : { proximity: 46, zone: 27, capacity: 27, affinity: 0 },
  };
}

function buildLocalPortfolio(items) {
  const p10 = [0, 0, 0];
  const p50 = [0, 0, 0];
  const p90 = [0, 0, 0];
  let mois = [];
  const heatmap = [];
  const ranking = [];
  const champions = {};
  let stockTotal = 0;
  for (const r of items) {
    const preds = r.predictions || [];
    if (preds.length && !mois.length) mois = preds.slice(0, 3).map((p) => p.mois);
    for (let i = 0; i < 3; i += 1) {
      const row = preds[i] || {};
      p10[i] += Number(row.p10 ?? row.min ?? 0);
      p50[i] += Number(row.p50 ?? row.valeur ?? 0);
      p90[i] += Number(row.p90 ?? row.max ?? 0);
    }
    const models = Object.fromEntries((r.comparaison?.models || []).map((m) => [m.id, m]));
    heatmap.push({
      articleId: r.article_id || r.articleId,
      code: r.articleCode || "",
      libelle: r.articleLibelle || "",
      champion: r.champion || "hw",
      hw: models.hw?.mape ?? null,
      nbeats: models.nbeats?.mape ?? null,
      hybrid: models.hybrid?.mape ?? null,
    });
    const ch = String(r.champion || "hw");
    champions[ch] = (champions[ch] || 0) + 1;
    const stock = Number(r.stockActuel || 0);
    stockTotal += stock;
    const reco = Number(r.recommendedStock || 0);
    const gap = reco - stock;
    ranking.push({
      articleId: r.article_id || r.articleId,
      code: r.articleCode || "",
      libelle: r.articleLibelle || "",
      stockActuel: Math.round(stock * 100) / 100,
      p90: Math.round(reco * 100) / 100,
      gap: Math.round(gap * 100) / 100,
      risk: gap >= 8 ? "rupture" : gap <= -8 ? "surplus" : "ok",
      champion: ch,
      confidence: r.confidence,
    });
  }
  ranking.sort((a, b) => b.gap - a.gap);
  const totalP90 = p90.reduce((s, v) => s + v, 0);
  const top = ranking[0];
  const share = top && totalP90 > 0 ? Math.round((1000 * top.p90) / totalP90) / 10 : 0;
  const ruptureN = ranking.filter((x) => x.risk === "rupture").length;
  return {
    n: items.length,
    mois,
    p10: p10.map((v) => Math.round(v * 100) / 100),
    p50: p50.map((v) => Math.round(v * 100) / 100),
    p90: p90.map((v) => Math.round(v * 100) / 100),
    totalP50: Math.round(p50.reduce((s, v) => s + v, 0) * 100) / 100,
    totalP90: Math.round(totalP90 * 100) / 100,
    stockActuel: Math.round(stockTotal * 100) / 100,
    gapP90: Math.round((totalP90 - stockTotal) * 100) / 100,
    serviceLevel: 0.9,
    concentration: { topCode: top?.code || null, sharePct: share },
    champions,
    heatmap,
    ranking,
    reconciled: false,
    neural: { trained: false, cached: false, windows: 0 },
    pipeline: [
      { id: "pool", label: "Catalogue", status: "ok", detail: `${items.length} SKU en local` },
      { id: "nbeats", label: "N-BEATS global", status: "skip", detail: "FastAPI offline" },
      { id: "hw", label: "HW local", status: "fallback", detail: "Holt par article" },
      { id: "reconcile", label: "Hiérarchie", status: "skip", detail: "Indisponible en local" },
      { id: "portfolio", label: "Portefeuille P90", status: "ok", detail: `${ruptureN} rupture(s)` },
    ],
    story: [
      `Jumeau local : ${items.length} Holt isolés (ai-service offline).`,
      "Relancez ai-service pour un N-BEATS global et la réconciliation famille/catalogue.",
    ],
    methodologyLabel: "Holt local (batch)",
  };
}

function localForecastBatch(payload) {
  const items = [];
  for (const it of payload.items || []) {
    const stock = Number(it.stockActuel || 0);
    const row = localForecast({
      articleId: it.article_id || it.articleId,
      historique: it.historique || [],
      horizon: payload.horizon || 3,
    });
    row.articleCode = it.code || it.articleCode;
    row.articleLibelle = it.libelle || it.articleLibelle;
    row.familleId = it.familleId;
    row.stockActuel = stock;
    items.push(row);
  }
  return {
    items,
    portfolio: buildLocalPortfolio(items),
    reconciled: false,
    modele: "holt_local_batch",
    mode: "local",
  };
}

function localExpiryWaste(lots = []) {
  const EPS = 1e-6;
  const items = (lots || []).map((lot) => {
    const q = Math.max(0, Number(lot.quantite_restante ?? lot.quantite_restante_asof) || 0);
    const v = Math.max(
      0,
      lot.ventes_30j != null
        ? Number(lot.ventes_30j) / 30
        : Number(lot.vitesse_moyenne_journaliere) || 0
    );
    const j = Math.max(0, Number(lot.jours_restants ?? lot.jours_restants_avant_expiration) || 0);
    const prix = Math.max(0, Number(lot.prix_unitaire) || 0);
    const qPred = Math.max(0, q - v * j);
    const proba = Math.min(1, qPred / Math.max(q, EPS));
    const valeur = Math.round(qPred * prix * 100) / 100;
    const qte = Math.round(qPred * 100) / 100;
    return {
      lot_id: lot.lot_id || lot.lotId || null,
      qte_predite_dlc: qte,
      proba_waste: Math.round(proba * 10000) / 10000,
      valeur_predite: valeur,
      y_hat_waste: qPred > EPS ? 1 : 0,
      cover_days: v > EPS ? Math.round((q / v) * 100) / 100 : null,
      qte_p10: qte,
      qte_p50: qte,
      qte_p90: qte,
      valeur_p90: valeur,
      drivers: [],
      mode_lot: "heuristic",
    };
  });
  return {
    kind: "heuristic_expiry_waste",
    version: "2.0.0",
    mode: "local",
    model: {
      mode: "heuristic",
      trainedAt: null,
      data: { synthetic: 0, real: 0, realDataSufficient: false },
      metrics: {},
    },
    items,
  };
}

module.exports = {
  localForecast,
  localForecastBatch,
  localLoadOptimization,
  localSlotting,
  localExpiryWaste,
  probeAiService,
  resolveAiServiceUrl,
  rememberAiOnline,
  isAiLikelyOffline,
};
