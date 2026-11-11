const prisma = require("../../config/database");
const { getSocieteWhere } = require("../../utils/societeScope");
const { sortLotsFefo } = require("./lots.service");
const { fetchDemandForecasts } = require("../stock/forecast.service");
const { getCurrentCMP } = require("../valuation/valuation.service");

const DAYS_PER_MONTH = 30;
const Z90 = 1.2815515655446004;
const TRIALS = 80;
const QTY_EPS = 0.05;
const CACHE_TTL_MS = 45_000;
const cache = new Map();

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function daysUntilExpiration(dateExpiration, now = new Date()) {
  if (!dateExpiration) return null;
  const exp = new Date(dateExpiration);
  if (Number.isNaN(exp.getTime())) return null;
  return Math.ceil(
    (Date.UTC(exp.getFullYear(), exp.getMonth(), exp.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86400000
  );
}

function niveauFromProbabilite(probabilite) {
  const p = Number(probabilite) || 0;
  if (p > 50) return "élevé";
  if (p >= 20) return "moyen";
  return "faible";
}

function normalizeNiveau(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const s = String(raw).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s === "eleve" || s === "high") return "élevé";
  if (s === "moyen" || s === "medium") return "moyen";
  if (s === "faible" || s === "low") return "faible";
  const err = new Error("niveau invalide (faible, moyen, élevé)");
  err.status = 400;
  throw err;
}

function monthBandSigma(pred) {
  const p50 = Number(pred?.p50 ?? pred?.valeur ?? 0);
  const p90 = Number(pred?.p90 ?? pred?.max);
  if (Number.isFinite(p90) && p90 >= p50) return Math.max(0, (p90 - p50) / Z90);
  return Math.max(0, Math.abs(p50) * 0.15);
}

/**
 * Étale les prévisions mensuelles (Holt-Winters / N-BEATS) en demande journalière.
 * `scale` répartit la demande de l'article sur le dépôt (part des ventes).
 */
function buildDailyDemand(predictions, horizonDays, scale = 1) {
  const horizon = Math.max(0, Math.floor(Number(horizonDays) || 0));
  const factor = Number.isFinite(Number(scale)) ? Math.max(0, Number(scale)) : 1;
  const dailyMean = [];
  const dailyStd = [];
  const months = Array.isArray(predictions) && predictions.length ? predictions : [{ valeur: 0 }];
  let monthIndex = 0;
  while (dailyMean.length < horizon) {
    const pred = months[Math.min(monthIndex, months.length - 1)];
    const total = Math.max(0, Number(pred?.valeur ?? pred?.p50 ?? 0)) * factor;
    const sigma = monthBandSigma(pred) * factor;
    const meanDay = total / DAYS_PER_MONTH;
    const stdDay = sigma / Math.sqrt(DAYS_PER_MONTH);
    const take = Math.min(DAYS_PER_MONTH, horizon - dailyMean.length);
    for (let d = 0; d < take; d += 1) {
      dailyMean.push(meanDay);
      dailyStd.push(stdDay);
    }
    monthIndex += 1;
    if (monthIndex > 36) break;
  }
  return { dailyMean, dailyStd };
}

function buildFlatDemand(mean, std, horizonDays) {
  const n = Math.max(0, Math.floor(Number(horizonDays) || 0));
  const m = Math.max(0, Number(mean) || 0);
  const s = Math.max(0, Number(std) || 0);
  return {
    dailyMean: Array.from({ length: n }, () => m),
    dailyStd: Array.from({ length: n }, () => s),
  };
}

/**
 * Épuise les lots dans l'ordre reçu (FEFO) : chaque jour, la demande
 * touche d'abord le lot qui expire le plus tôt, tant qu'il n'est pas périmé.
 */
function simulateFefo(lots, dailyMean) {
  const left = (lots || []).map((lot) => Math.max(0, Number(lot.qty) || 0));
  const series = Array.isArray(dailyMean) ? dailyMean : [];
  for (let day = 0; day < series.length; day += 1) {
    let demand = Math.max(0, Number(series[day]) || 0);
    if (demand <= 1e-12) continue;
    for (let i = 0; i < lots.length; i += 1) {
      if (day >= (Number(lots[i].jours) || 0)) continue;
      if (left[i] <= 1e-12) continue;
      const take = Math.min(left[i], demand);
      left[i] -= take;
      demand -= take;
      if (demand <= 1e-12) break;
    }
  }
  return left;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashLots(lots) {
  let h = 2166136261;
  for (const lot of lots || []) {
    h ^= Number(lot.id) || 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gaussian(rng) {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * quantiteRisquee = reliquat du scénario moyen (demande prévue jour par jour).
 * probabiliteRisque = part des scénarios, tirés dans la bande de variance, où il reste du stock.
 */
function scoreLotGroup(lots, dailyMean, dailyStd) {
  const ordered = [...(lots || [])];
  const meanLeft = simulateFefo(ordered, dailyMean);
  const stds =
    Array.isArray(dailyStd) && dailyStd.length === (dailyMean || []).length
      ? dailyStd
      : (dailyMean || []).map(() => 0);
  const hasVar = stds.some((s) => s > 1e-9);

  if (!hasVar) {
    return ordered.map((lot, i) => ({
      id: lot.id,
      quantiteRisquee: round2(meanLeft[i]),
      probabiliteRisque: meanLeft[i] > QTY_EPS ? 100 : 0,
    }));
  }

  const rng = mulberry32(hashLots(ordered) || 1);
  const hits = ordered.map(() => 0);
  for (let t = 0; t < TRIALS; t += 1) {
    const series = dailyMean.map((m, d) => Math.max(0, m + stds[d] * gaussian(rng)));
    const left = simulateFefo(ordered, series);
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] > QTY_EPS) hits[i] += 1;
    }
  }
  return ordered.map((lot, i) => ({
    id: lot.id,
    quantiteRisquee: round2(meanLeft[i]),
    probabiliteRisque: Math.max(0, Math.min(100, Math.round((hits[i] / TRIALS) * 100))),
  }));
}

function buildAction(niveau, lot, target) {
  if (niveau === "élevé") {
    return {
      type: "promotion",
      label: "Proposer une promotion pour vendre ce lot avant la date",
      to: "/ventes/new",
    };
  }
  if (niveau === "moyen" && target) {
    return {
      type: "transfert",
      label: `Transférer vers ${target.libelle}, où ce produit part plus vite`,
      to: `/mouvements?articleId=${lot.articleId}&depotId=${lot.depotId}`,
      depotCibleId: target.id,
      depotCibleLibelle: target.libelle,
      rotationCible: target.rotation30,
    };
  }
  return null;
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function loadSalesVelocity(societeId, articleIds) {
  const since = new Date(Date.now() - DAYS_PER_MONTH * 86400000);
  const lignes = await prisma.ligneVente.findMany({
    where: {
      articleId: { in: articleIds },
      vente: { societeId, statut: "CONFIRME", dateVente: { gte: since } },
    },
    select: {
      articleId: true,
      quantite: true,
      vente: { select: { dateVente: true, depotId: true } },
    },
  });

  const now = Date.now();
  const byArticle = new Map();
  const buckets = new Map();
  for (const ligne of lignes) {
    const aid = Number(ligne.articleId);
    const qty = Number(ligne.quantite) || 0;
    const did = Number(ligne.vente?.depotId);
    if (!aid || !(qty > 0)) continue;
    byArticle.set(aid, (byArticle.get(aid) || 0) + qty);
    if (!did) continue;
    const age = Math.floor((now - new Date(ligne.vente.dateVente).getTime()) / 86400000);
    if (age < 0 || age > DAYS_PER_MONTH - 1) continue;
    const key = `${aid}:${did}`;
    if (!buckets.has(key)) buckets.set(key, Array.from({ length: DAYS_PER_MONTH }, () => 0));
    buckets.get(key)[age] += qty;
  }

  const pairStats = new Map();
  for (const [key, arr] of buckets) {
    const sum = arr.reduce((s, v) => s + v, 0);
    const mean = sum / DAYS_PER_MONTH;
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, DAYS_PER_MONTH - 1);
    pairStats.set(key, { sum, mean, std: Math.sqrt(Math.max(0, variance)) });
  }
  return { byArticle, pairStats };
}

function demandForDepot({ articleId, depotId, horizon, forecast, velocity, stockShare }) {
  const forecastItem = forecast?.get(articleId);
  if (forecastItem) {
    const totalSales = velocity.byArticle.get(articleId) || 0;
    const pair = velocity.pairStats.get(`${articleId}:${depotId}`);
    const scale = totalSales > 0 ? (pair?.sum || 0) / totalSales : stockShare.get(`${articleId}:${depotId}`) ?? 1;
    return { ...buildDailyDemand(forecastItem.predictions, horizon, scale), source: "ai" };
  }
  const pair = velocity.pairStats.get(`${articleId}:${depotId}`);
  return { ...buildFlatDemand(pair?.mean || 0, pair?.std || 0, horizon), source: "fallback" };
}

function bestTransferDepot(articleId, currentDepotId, rotation, depotsById) {
  let best = null;
  for (const [key, count] of rotation) {
    const [aid, did] = key.split(":").map(Number);
    if (aid !== articleId || did === Number(currentDepotId)) continue;
    if (!best || count > best.count) best = { depotId: did, count };
  }
  const current = rotation.get(`${articleId}:${currentDepotId}`) || 0;
  if (!best || best.count <= current) return null;
  const depot = depotsById.get(best.depotId);
  if (!depot) return null;
  return { ...depot, rotation30: best.count };
}

async function listPeremptionRisk(user, { days = 30, depotId, niveau } = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  const n = Math.min(366, Math.max(1, Number(days) || 30));
  const did = depotId != null && String(depotId).trim() !== "" ? Number(depotId) : null;
  const niveauFilter = normalizeNiveau(niveau);
  const cacheKey = `${sid}|${n}|${did || ""}|${niveauFilter || ""}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const now = new Date();
  const until = new Date(now);
  until.setUTCDate(until.getUTCDate() + n);

  const windowWhere = {
    article: { societeId: sid },
    quantiteRestante: { gt: 0 },
    statut: "ACTIF",
    dateExpiration: { not: null, gte: now, lte: until },
  };

  const [lots, stockGroups, depots] = await Promise.all([
    prisma.lot.findMany({
      where: {
        ...windowWhere,
        ...(did ? { depotId: did } : {}),
      },
      orderBy: [{ dateExpiration: "asc" }, { dateFabrication: "asc" }, { id: "asc" }],
      include: {
        article: { select: { id: true, code: true, libelle: true } },
        depot: { select: { id: true, code: true, libelle: true } },
      },
    }),
    prisma.lot.groupBy({
      by: ["articleId", "depotId"],
      where: windowWhere,
      _sum: { quantiteRestante: true },
    }),
    prisma.depot.findMany({
      where: { societeId: sid, statut: "ACTIF" },
      select: { id: true, code: true, libelle: true },
    }),
  ]);

  if (!lots.length) {
    const empty = {
      days: n,
      depotId: did,
      niveau: niveauFilter,
      source: "ai",
      valeurEnJeu: 0,
      lotsEleves: 0,
      total: 0,
      items: [],
    };
    cache.set(cacheKey, { at: Date.now(), value: empty });
    return empty;
  }

  const articleIds = [...new Set(lots.map((l) => l.articleId))];
  const since30 = new Date(Date.now() - DAYS_PER_MONTH * 86400000);

  const [forecastPack, velocity, rotations] = await Promise.all([
    fetchDemandForecasts(articleIds, sid),
    loadSalesVelocity(sid, articleIds),
    articleIds.length
      ? prisma.mouvement.groupBy({
          by: ["articleId", "depotId"],
          where: {
            articleId: { in: articleIds },
            article: { societeId: sid },
            createdAt: { gte: since30 },
            statut: "VALIDE",
          },
          _count: { id: true },
        })
      : [],
  ]);

  const stockShare = new Map();
  const qtyByArticle = new Map();
  for (const row of stockGroups) {
    const q = Number(row._sum?.quantiteRestante) || 0;
    qtyByArticle.set(row.articleId, (qtyByArticle.get(row.articleId) || 0) + q);
  }
  for (const row of stockGroups) {
    const total = qtyByArticle.get(row.articleId) || 0;
    const q = Number(row._sum?.quantiteRestante) || 0;
    stockShare.set(`${row.articleId}:${row.depotId}`, total > 0 ? q / total : 0);
  }

  const rotation = new Map(rotations.map((row) => [`${row.articleId}:${row.depotId}`, row._count.id]));
  const depotsById = new Map(depots.map((d) => [d.id, d]));

  const groups = new Map();
  for (const lot of lots) {
    const key = `${lot.articleId}:${lot.depotId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(lot);
  }

  const cmpPairs = [...groups.keys()].map((key) => {
    const [articleId, depotIdKey] = key.split(":").map(Number);
    return { articleId, depotId: depotIdKey };
  });
  const cmpValues = await mapPool(cmpPairs, 12, async (pair) => {
    const cmp = await getCurrentCMP(sid, pair.articleId, pair.depotId);
    return [`${pair.articleId}:${pair.depotId}`, Number(cmp) || 0];
  });
  const cmpByPair = new Map(cmpValues);

  const items = [];
  let usedAi = false;
  let usedFallback = false;

  for (const [key, groupLots] of groups) {
    const [articleId, depotKey] = key.split(":").map(Number);
    const ordered = sortLotsFefo(groupLots);
    const scoredLots = ordered.map((lot) => ({
      id: lot.id,
      qty: Number(lot.quantiteRestante) || 0,
      jours: Math.max(0, daysUntilExpiration(lot.dateExpiration, now) ?? 0),
    }));
    const horizon = scoredLots.reduce((max, lot) => Math.max(max, lot.jours), 0);
    const demand = demandForDepot({
      articleId,
      depotId: depotKey,
      horizon,
      forecast: forecastPack.byArticle,
      velocity,
      stockShare,
    });
    if (demand.source === "ai") usedAi = true;
    else usedFallback = true;

    const scores = scoreLotGroup(scoredLots, demand.dailyMean, demand.dailyStd);
    const byId = new Map(scores.map((row) => [row.id, row]));
    const coutUnitaire = round2(cmpByPair.get(key) || 0);
    const target = bestTransferDepot(articleId, depotKey, rotation, depotsById);

    for (const lot of ordered) {
      const score = byId.get(lot.id);
      const quantiteRisquee = score?.quantiteRisquee ?? 0;
      const probabiliteRisque = score?.probabiliteRisque ?? 0;
      if (quantiteRisquee <= QTY_EPS) continue;
      const niveauLot = niveauFromProbabilite(probabiliteRisque);
      const valeurRisquee = round2(quantiteRisquee * coutUnitaire);
      items.push({
        lotId: lot.id,
        numero: lot.numero,
        articleId: lot.articleId,
        articleCode: lot.article?.code || "",
        articleLibelle: lot.article?.libelle || "",
        depotId: lot.depotId,
        depotCode: lot.depot?.code || "",
        depotLibelle: lot.depot?.libelle || "",
        dateExpiration: lot.dateExpiration,
        joursRestants: daysUntilExpiration(lot.dateExpiration, now),
        quantiteRestante: round2(lot.quantiteRestante),
        quantiteRisquee,
        probabiliteRisque,
        coutUnitaire,
        valeurRisquee,
        niveau: niveauLot,
        source: demand.source,
        action: buildAction(niveauLot, lot, target),
      });
    }
  }

  items.sort((a, b) => b.valeurRisquee - a.valeurRisquee || b.probabiliteRisque - a.probabiliteRisque);

  const eleves = items.filter((row) => row.niveau === "élevé");
  const source = usedAi && usedFallback ? "mixte" : usedAi ? "ai" : "fallback";
  const visible = niveauFilter ? items.filter((row) => row.niveau === niveauFilter) : items;

  const value = {
    days: n,
    depotId: did,
    niveau: niveauFilter,
    source,
    valeurEnJeu: round2(eleves.reduce((s, row) => s + row.valeurRisquee, 0)),
    lotsEleves: eleves.length,
    total: visible.length,
    items: visible,
  };
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

module.exports = {
  listPeremptionRisk,
  daysUntilExpiration,
  niveauFromProbabilite,
  buildDailyDemand,
  buildFlatDemand,
  simulateFefo,
  scoreLotGroup,
};
