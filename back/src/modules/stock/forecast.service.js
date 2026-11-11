const prisma = require("../../config/database");
const { requireActiveSocieteId } = require("../../utils/societeScope");
const {
  localForecast,
  isAiLikelyOffline,
  rememberAiOnline,
} = require("./aiLocal.fallback");
const { aiFetch, AiBusyError, isAiBusy } = require("../../utils/aiClient");

const MONTHS = 36;
const PEER_LIMIT = 14;
const FORECAST_TIMEOUT_MS = 8000;

function monthKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

function buildLastNMonthKeys(n = MONTHS) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

function emptyMonthMap(keys) {
  const map = new Map();
  for (const key of keys) map.set(key, 0);
  return map;
}

function mapToHist(map) {
  return Array.from(map.entries()).map(([mois, quantite]) => ({
    mois,
    quantite: Math.round(quantite * 100) / 100,
  }));
}

/**
 * Agrège LigneVente (Vente statut=CONFIRME) par mois.
 */
async function aggregateMonthlySales(articleId, societeId, months = MONTHS) {
  const bulk = await aggregateMonthlySalesMany([Number(articleId)], societeId, months);
  return bulk.get(Number(articleId)) || mapToHist(emptyMonthMap(buildLastNMonthKeys(months)));
}

async function aggregateMonthlySalesMany(articleIds, societeId, months = MONTHS) {
  const sid = requireActiveSocieteId(societeId);
  const ids = [...new Set((articleIds || []).map(Number).filter((id) => id > 0))];
  const keys = buildLastNMonthKeys(months);
  const result = new Map(ids.map((id) => [id, emptyMonthMap(keys)]));
  if (!ids.length) return result;

  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const lignes = await prisma.ligneVente.findMany({
    where: {
      articleId: { in: ids },
      vente: {
        societeId: sid,
        statut: "CONFIRME",
        dateVente: { gte: since },
      },
    },
    select: {
      articleId: true,
      quantite: true,
      vente: { select: { dateVente: true } },
    },
  });

  for (const l of lignes) {
    const map = result.get(Number(l.articleId));
    if (!map) continue;
    const key = monthKey(l.vente.dateVente);
    if (!map.has(key)) continue;
    map.set(key, (map.get(key) || 0) + Number(l.quantite || 0));
  }

  const hist = new Map();
  for (const [id, map] of result.entries()) hist.set(id, mapToHist(map));
  return hist;
}

async function getCurrentStockQtyMany(articleIds, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const ids = [...new Set((articleIds || []).map(Number).filter((id) => id > 0))];
  const map = new Map(ids.map((id) => [id, 0]));
  if (!ids.length) return map;
  const stocks = await prisma.stock.findMany({
    where: { articleId: { in: ids }, article: { societeId: sid } },
    select: { articleId: true, quantite: true },
  });
  for (const r of stocks) {
    const id = Number(r.articleId);
    map.set(id, (map.get(id) || 0) + Number(r.quantite || 0));
  }
  return map;
}

async function getCurrentStockQty(articleId, societeId) {
  const map = await getCurrentStockQtyMany([articleId], societeId);
  return map.get(Number(articleId)) || 0;
}

async function loadPeerArticles(article, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const aid = Number(article.id);
  const whereFamille = {
    societeId: sid,
    statut: "ACTIF",
    id: { not: aid },
  };
  if (article.familleId) whereFamille.familleId = article.familleId;

  let peers = await prisma.article.findMany({
    where: whereFamille,
    take: PEER_LIMIT,
    select: { id: true, code: true, libelle: true },
    orderBy: { id: "desc" },
  });

  if (peers.length < 4) {
    const extra = await prisma.article.findMany({
      where: {
        societeId: sid,
        statut: "ACTIF",
        id: { notIn: [aid, ...peers.map((p) => p.id)] },
      },
      take: Math.max(0, 8 - peers.length),
      select: { id: true, code: true, libelle: true },
      orderBy: { id: "desc" },
    });
    peers = [...peers, ...extra];
  }
  return peers;
}

/**
 * Appel HTTP partagé vers le micro-service de prévision.
 * Retourne null si le service Python n'est pas joignable — l'appelant décide du repli.
 */
async function postAiForecast(path, payload) {
  if (isAiLikelyOffline()) return null;
  // Saturé : repli local tout de suite, le service reste « en ligne ».
  if (isAiBusy()) return null;
  try {
    const response = await aiFetch(path, {
      method: "POST",
      body: payload,
      timeoutMs: FORECAST_TIMEOUT_MS,
    });
    if (!response.ok) {
      rememberAiOnline(false);
      return null;
    }
    rememberAiOnline(true);
    const data = await response.json();
    return { ...data, mode: data.mode || "ai" };
  } catch (err) {
    if (err instanceof AiBusyError) return null;
    rememberAiOnline(false);
    return null;
  }
}

function localForecastFromPayload(payload) {
  return localForecast({
    articleId: Number(payload.article_id),
    historique: payload.historique,
    horizon: payload.horizon || 3,
    peers: payload.peers,
  });
}

async function callForecastAi(payload) {
  const data = await postAiForecast("/forecast", payload);
  if (data) return data;
  return localForecastFromPayload(payload);
}

async function callForecastBatchAi(payload) {
  const { localForecastBatch } = require("./aiLocal.fallback");
  const data = await postAiForecast("/forecast/batch", payload);
  if (data && Array.isArray(data.items) && data.items.length && data.mode !== "local") {
    return { ...data, mode: data.mode || "ai" };
  }
  return localForecastBatch(payload);
}

async function getForecast(articleId, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const aid = Number(articleId);
  if (!aid) {
    const err = new Error("articleId requis");
    err.status = 400;
    throw err;
  }

  const article = await prisma.article.findFirst({
    where: { id: aid, societeId: sid },
    select: {
      id: true,
      code: true,
      libelle: true,
      imageUrl: true,
      prixAchat: true,
      familleId: true,
      prixVente: true,
      stockMin: true,
      seuilAlerte: true,
    },
  });
  if (!article) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }

  const peers = await loadPeerArticles(article, sid);
  const histMap = await aggregateMonthlySalesMany(
    [aid, ...peers.map((p) => p.id)],
    sid,
    MONTHS
  );
  const historique = histMap.get(aid) || [];
  const peerPayload = peers.map((p) => ({
    articleId: p.id,
    code: p.code,
    historique: histMap.get(p.id) || [],
  }));

  const stockActuel = await getCurrentStockQty(aid, sid);

  const ai = await callForecastAi({
    article_id: aid,
    articleCode: article.code,
    articleLibelle: article.libelle,
    historique,
    horizon: 3,
    peers: peerPayload,
    features: {
      prixVente: Number(article.prixVente) || 0,
      stockMin: Number(article.stockMin) || 0,
      seuilAlerte: Number(article.seuilAlerte) || 0,
      familleId: article.familleId,
      stockActuel,
      code: article.code,
      libelle: article.libelle,
    },
  });

  return {
    articleId: article.id,
    articleCode: article.code,
    articleLibelle: article.libelle,
    stockActuel: Math.round(stockActuel * 100) / 100,
    ...ai,
    imageUrl: article.imageUrl || null,
    prixAchat: article.prixAchat ?? null,
    recommendedStock: Number(ai.recommendedStock ?? 0),
    reorderPoint: Number(ai.reorderPoint ?? 0),
    confidence: ai.confidence == null ? null : Number(ai.confidence),
    confidenceLabel: ai.confidenceLabel || null,
    smape: ai.smape == null ? null : Number(ai.smape),
    mase: ai.mase == null ? null : Number(ai.mase),
    lower: ai.lower || null,
    upper: ai.upper || null,
  };
}

async function getForecastMulti(articleIds, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const ids = [...new Set((Array.isArray(articleIds) ? articleIds : []).map(Number).filter((id) => id > 0))];
  if (!ids.length) {
    const err = new Error("articleIds requis");
    err.status = 400;
    throw err;
  }
  if (ids.length > 8) {
    const err = new Error("Maximum 8 articles en comparaison");
    err.status = 400;
    throw err;
  }

  const articles = await prisma.article.findMany({
    where: { id: { in: ids }, societeId: sid },
    select: {
      id: true,
      code: true,
      libelle: true,
      familleId: true,
      prixVente: true,
      stockMin: true,
      seuilAlerte: true,
    },
  });
  const byId = new Map(articles.map((a) => [a.id, a]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  if (!ordered.length) {
    const err = new Error("Articles introuvables");
    err.status = 404;
    throw err;
  }

  const peerLists = await Promise.all(ordered.map((a) => loadPeerArticles(a, sid)));
  const peerIds = [...new Set(peerLists.flat().map((p) => p.id).filter((id) => !ids.includes(id)))];
  const histMap = await aggregateMonthlySalesMany([...ids, ...peerIds], sid, MONTHS);
  const stockMap = await getCurrentStockQtyMany(ids, sid);

  const itemsPayload = ordered.map((a) => ({
    article_id: a.id,
    articleId: a.id,
    code: a.code,
    libelle: a.libelle,
    historique: histMap.get(a.id) || [],
    familleId: a.familleId,
    stockActuel: Math.round((stockMap.get(a.id) || 0) * 100) / 100,
    features: {
      prixVente: Number(a.prixVente) || 0,
      stockMin: Number(a.stockMin) || 0,
      seuilAlerte: Number(a.seuilAlerte) || 0,
      familleId: a.familleId,
    },
  }));
  const peerPayload = peerIds.slice(0, 16).map((id) => {
    const sample = peerLists.flat().find((p) => p.id === id);
    return {
      articleId: id,
      code: sample?.code || "",
      historique: histMap.get(id) || [],
    };
  });

  const batch = await callForecastBatchAi({
    items: itemsPayload,
    peers: peerPayload,
    horizon: 3,
  });

  const items = (batch.items || []).map((ai) => {
    const aid = Number(ai.article_id || ai.articleId);
    const article = byId.get(aid) || {};
    const stockActuel = Math.round((stockMap.get(aid) || Number(ai.stockActuel) || 0) * 100) / 100;
    return {
      articleId: aid,
      articleCode: article.code || ai.articleCode,
      articleLibelle: article.libelle || ai.articleLibelle,
      stockActuel,
      ...ai,
      articleId: aid,
      recommendedStock: Number(ai.recommendedStock ?? 0),
      reorderPoint: Number(ai.reorderPoint ?? 0),
      confidence: ai.confidence == null ? null : Number(ai.confidence),
      confidenceLabel: ai.confidenceLabel || null,
      smape: ai.smape == null ? null : Number(ai.smape),
      mase: ai.mase == null ? null : Number(ai.mase),
      lower: ai.lower || null,
      upper: ai.upper || null,
      stockActuel,
    };
  });

  return {
    items,
    portfolio: batch.portfolio || null,
    reconciled: Boolean(batch.reconciled),
    modele: batch.modele || "hybrid_nbeats_hw_batch",
    mode: batch.mode || "ai",
  };
}

/**
 * Prévisions de demande pour une liste d'articles, via POST /forecast/batch.
 * Les articles sans réponse exploitable sont absents de la map : l'appelant
 * bascule alors sur la vitesse de vente historique.
 */
async function fetchDemandForecasts(articleIds, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const ids = [...new Set((articleIds || []).map(Number).filter((id) => id > 0))];
  const byArticle = new Map();
  if (!ids.length) return { byArticle, source: "ai" };

  const articles = await prisma.article.findMany({
    where: { id: { in: ids }, societeId: sid },
    select: {
      id: true,
      code: true,
      libelle: true,
      familleId: true,
      prixVente: true,
      stockMin: true,
      seuilAlerte: true,
    },
  });
  if (!articles.length) return { byArticle, source: "fallback" };

  const histMap = await aggregateMonthlySalesMany(
    articles.map((a) => a.id),
    sid,
    MONTHS
  );
  const stockMap = await getCurrentStockQtyMany(
    articles.map((a) => a.id),
    sid
  );

  const CHUNK = 8;
  let usedAi = false;
  let missed = false;

  for (let i = 0; i < articles.length; i += CHUNK) {
    const chunk = articles.slice(i, i + CHUNK);
    if (isAiLikelyOffline()) {
      missed = true;
      break;
    }
    const data = await postAiForecast("/forecast/batch", {
      horizon: 3,
      peers: [],
      items: chunk.map((a) => ({
        article_id: a.id,
        articleId: a.id,
        code: a.code,
        libelle: a.libelle,
        historique: histMap.get(a.id) || [],
        familleId: a.familleId,
        stockActuel: Math.round((stockMap.get(a.id) || 0) * 100) / 100,
        features: {
          prixVente: Number(a.prixVente) || 0,
          stockMin: Number(a.stockMin) || 0,
          seuilAlerte: Number(a.seuilAlerte) || 0,
          familleId: a.familleId,
          stockActuel: stockMap.get(a.id) || 0,
          code: a.code,
          libelle: a.libelle,
        },
      })),
    });
    if (!data || data.mode === "local" || !Array.isArray(data.items) || !data.items.length) {
      missed = true;
      break;
    }
    const got = new Set();
    for (const item of data.items) {
      const aid = Number(item.article_id || item.articleId);
      const preds = Array.isArray(item.predictions) ? item.predictions : [];
      if (!aid || item.mode === "error" || !preds.length) continue;
      byArticle.set(aid, item);
      got.add(aid);
      usedAi = true;
    }
    if (chunk.some((a) => !got.has(a.id))) missed = true;
  }

  const source = usedAi && missed ? "mixte" : usedAi ? "ai" : "fallback";
  return { byArticle, source };
}

module.exports = {
  getForecast,
  getForecastMulti,
  aggregateMonthlySales,
  fetchDemandForecasts,
};
