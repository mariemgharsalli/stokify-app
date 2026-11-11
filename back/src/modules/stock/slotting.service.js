const prisma = require("../../config/database");
const { requireActiveSocieteId } = require("../../utils/societeScope");
const { localSlotting } = require("./aiLocal.fallback");
const { aiFetch, AiBusyError, isAiBusy } = require("../../utils/aiClient");
const { emplacementCapaciteUnits } = require("../../utils/warehouseLayout");
const { evaluateCompatibility } = require("../../utils/emplacementCompatibility");

const ZONE = {
  A: { key: "A", label: "Zone picking", short: "Près du quai", idealFor: "A" },
  B: { key: "B", label: "Zone mixte", short: "Milieu dépôt", idealFor: "B" },
  C: { key: "C", label: "Zone réserve", short: "Fond dépôt", idealFor: "C" },
};

function resolveZone(distanceQuai) {
  const d = Number(distanceQuai);
  const dist = Number.isFinite(d) ? Math.max(0, Math.min(100, d)) : 50;
  if (dist <= 33) return ZONE.A;
  if (dist <= 66) return ZONE.B;
  return ZONE.C;
}

function resolveEmplacementCapacity(empl) {
  return emplacementCapaciteUnits(empl);
}

function isCompatible(article, empl, occupants) {
  return evaluateCompatibility({ article, emplacement: empl, occupants }).ok;
}

function buildCooccurrence(lignes) {
  const byVente = new Map();
  for (const l of lignes || []) {
    if (!byVente.has(l.venteId)) byVente.set(l.venteId, new Set());
    byVente.get(l.venteId).add(Number(l.articleId));
  }
  const counts = new Map();
  for (const ids of byVente.values()) {
    const arr = [...ids];
    if (arr.length < 2 || arr.length > 12) continue;
    for (let i = 0; i < arr.length; i += 1) {
      for (let j = i + 1; j < arr.length; j += 1) {
        const a = Math.min(arr[i], arr[j]);
        const b = Math.max(arr[i], arr[j]);
        const key = `${a}:${b}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 500)
    .map(([key, count]) => {
      const [a, b] = key.split(":").map(Number);
      return { a, b, count };
    });
}

function estimatePickGainSec(fromDistance, toDistance, abcClass) {
  const delta = Number(fromDistance) - Number(toDistance);
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  const weight = abcClass === "A" ? 0.9 : abcClass === "B" ? 0.55 : 0.3;
  return Math.round(delta * weight);
}

async function loadSlottingContext(societeId, depotId) {
  const sid = requireActiveSocieteId(societeId);
  const did = Number(depotId);
  const since30 = new Date(Date.now() - 30 * 86400000);
  const since90 = new Date(Date.now() - 90 * 86400000);

  const [articles, emplacements, depot, g30, g90, lastMoves, stocks, lignes] = await Promise.all([
    prisma.article.findMany({
      where: { societeId: sid, actif: true },
      select: {
        id: true,
        code: true,
        libelle: true,
        volume: true,
        poids: true,
        prixVente: true,
        fragile: true,
        dangereuxChimique: true,
        imageUrl: true,
      },
      take: 400,
    }),
    prisma.emplacement.findMany({
      where: { depotId: did, statut: { not: "INACTIF" } },
    }),
    prisma.depot.findFirst({
      where: { id: did, societeId: sid },
      select: { id: true, capacite: true, libelle: true },
    }),
    prisma.mouvement.groupBy({
      by: ["articleId"],
      where: {
        article: { societeId: sid },
        createdAt: { gte: since30 },
        statut: "VALIDE",
      },
      _count: { id: true },
      _sum: { quantite: true },
    }),
    prisma.mouvement.groupBy({
      by: ["articleId"],
      where: {
        article: { societeId: sid },
        createdAt: { gte: since90 },
        statut: "VALIDE",
      },
      _count: { id: true },
    }),
    prisma.mouvement.groupBy({
      by: ["articleId"],
      where: { article: { societeId: sid }, statut: "VALIDE" },
      _max: { createdAt: true },
    }),
    prisma.stock.findMany({
      where: { depotId: did, quantite: { gt: 0 } },
      include: {
        article: {
          select: { id: true, code: true, libelle: true, dangereuxChimique: true },
        },
        emplacement: {
          select: { id: true, code: true, libelle: true, distanceQuai: true },
        },
      },
    }),
    prisma.ligneVente.findMany({
      where: {
        vente: { societeId: sid, statut: "CONFIRME", dateVente: { gte: since90 } },
      },
      select: { venteId: true, articleId: true },
      take: 8000,
    }),
  ]);

  const rot30 = new Map(g30.map((g) => [g.articleId, g._count.id]));
  const rot90 = new Map(g90.map((g) => [g.articleId, g._count.id]));
  const lastMap = new Map(lastMoves.map((g) => [g.articleId, g._max.createdAt]));
  const now = Date.now();

  const articleFeats = articles.map((a) => {
    const last = lastMap.get(a.id);
    return {
      articleId: a.id,
      code: a.code,
      libelle: a.libelle,
      rotation30: rot30.get(a.id) || 0,
      rotation90: rot90.get(a.id) || 0,
      volume: Number(a.volume) || 0,
      poids: Number(a.poids) || 0,
      prixVente: Number(a.prixVente) || 0,
      fragile: Boolean(a.fragile),
      daysSinceLastMove: last ? Math.max(0, Math.round((now - new Date(last).getTime()) / 86400000)) : 90,
      imageUrl: a.imageUrl || null,
    };
  });

  const occupancyByEmpl = new Map();
  const occupantsByEmpl = new Map();
  for (const s of stocks) {
    if (!s.emplacementId) continue;
    occupancyByEmpl.set(s.emplacementId, (occupancyByEmpl.get(s.emplacementId) || 0) + Number(s.quantite || 0));
    if (!occupantsByEmpl.has(s.emplacementId)) occupantsByEmpl.set(s.emplacementId, []);
    occupantsByEmpl.get(s.emplacementId).push({
      articleId: s.articleId,
      dangereuxChimique: Boolean(s.article?.dangereuxChimique),
      libelle: s.article?.libelle,
      distanceQuai: s.emplacement?.distanceQuai,
    });
  }

  const depotCapacite = depot?.capacite ?? null;
  const emplacementCount = emplacements.length || 1;
  const candidatesAll = emplacements.map((e) => {
    const occQty = occupancyByEmpl.get(e.id) || 0;
    const cap = resolveEmplacementCapacity(e);
    const ratio = cap > 0 ? Math.min(1, occQty / cap) : 0;
    const zone = resolveZone(e.distanceQuai);
    return {
      emplacementId: e.id,
      code: e.code,
      libelle: e.libelle,
      distanceQuai: Number.isFinite(Number(e.distanceQuai)) ? Number(e.distanceQuai) : 50,
      occupationRatio: Math.round(ratio * 1000) / 1000,
      zoneKey: zone.key,
      isFull: ratio >= 1,
      zone,
      raw: e,
    };
  });

  const occupants = stocks
    .filter((s) => s.emplacementId)
    .map((s) => ({
      articleId: s.articleId,
      emplacementId: s.emplacementId,
      distanceQuai: s.emplacement?.distanceQuai ?? 50,
      code: s.article?.code,
      libelle: s.article?.libelle,
    }));

  return {
    sid,
    did,
    articles,
    articleFeats,
    emplacements,
    candidatesAll,
    occupancyByEmpl,
    occupantsByEmpl,
    occupants,
    stocks,
    cooccurrence: buildCooccurrence(lignes),
    depotCapacite,
    depotLibelle: depot?.libelle || null,
    emplacementCount,
    rot30,
  };
}

async function callSlottingAi(path, body) {
  if (isAiBusy()) return null;
  try {
    const response = await aiFetch(path, {
      body,
      timeoutMs: 12000,
    });
    if (response.ok) {
      const data = await response.json();
      return { ...data, mode: data.mode || "ai" };
    }
  } catch (err) {
    // 429 : l'appelant bascule en mode local sans couper la sonde IA.
    if (err instanceof AiBusyError) return null;
  }
  return null;
}

function decorateScored(row, abcClass, currentDistance) {
  const zone = ZONE[row.zoneKey] || resolveZone(row.distanceQuai);
  const from = Number(currentDistance);
  const to = Number(row.distanceQuai);
  const deltaDistance =
    Number.isFinite(from) && Number.isFinite(to) ? Math.round(from - to) : null;
  return {
    ...row,
    zone: { key: zone.key, label: zone.label, short: zone.short },
    estimatedPickGainSec: estimatePickGainSec(currentDistance, row.distanceQuai, abcClass),
    deltaDistance,
  };
}

async function suggestEmplacements(articleId, depotId, societeId) {
  const ctx = await loadSlottingContext(societeId, depotId);
  const aid = Number(articleId);
  const article = ctx.articles.find((a) => a.id === aid);
  if (!article) {
    const e = new Error("Article introuvable");
    e.status = 404;
    throw e;
  }

  const stockLine = ctx.stocks
    .filter((s) => s.articleId === aid && s.emplacementId)
    .sort((a, b) => Number(b.quantite) - Number(a.quantite))[0];

  const candidates = ctx.candidatesAll.filter((c) => {
    if (c.isFull && c.emplacementId !== stockLine?.emplacementId) return false;
    return isCompatible(article, c.raw, ctx.occupantsByEmpl.get(c.emplacementId) || []);
  });

  const payload = {
    articleId: aid,
    articles: ctx.articleFeats,
    candidates: candidates.map(({ raw, isFull, zone, ...rest }) => rest),
    occupants: ctx.occupants,
    cooccurrence: ctx.cooccurrence,
    currentEmplacementId: stockLine?.emplacementId ?? null,
    currentEmplacementCode: stockLine?.emplacement?.code ?? null,
  };

  const ai = (await callSlottingAi("/slotting", payload)) || localSlotting(payload);
  const abcClass = ai.abcClass || "C";
  const currentDistance = stockLine?.emplacement?.distanceQuai;
  const scored = (ai.scored || []).map((s) => decorateScored(s, abcClass, currentDistance));
  const top3 = scored.slice(0, 3);

  const currentMatch = stockLine?.emplacementId
    ? scored.find((s) => s.emplacementId === stockLine.emplacementId)
    : null;
  const currentZone = stockLine?.emplacement
    ? resolveZone(stockLine.emplacement.distanceQuai)
    : null;
  const best = top3[0] || null;
  const potentialGain = best ? Math.max(0, (best.score || 0) - (currentMatch?.score ?? 0)) : 0;
  const pickGain = best ? estimatePickGainSec(currentDistance, best.distanceQuai, abcClass) : 0;
  const isOptimal =
    Boolean(best) &&
    stockLine?.emplacementId != null &&
    best.emplacementId === stockLine.emplacementId;

  return {
    articleId: article.id,
    articleCode: article.code,
    articleLibelle: article.libelle,
    rotationScore: ai.rotationScore ?? ctx.rot30.get(aid) ?? 0,
    rotationLabel: ai.rotationLabel || "Faible",
    abcClass,
    idealDistance: ai.idealDistance ?? 50,
    methodology: ai.methodology,
    fallbackReason: ai.fallbackReason || null,
    modele: ai.modele,
    mode: ai.mode || "ai",
    confidence: ai.confidence ?? 60,
    posterior: ai.posterior || null,
    gmmBic: ai.gmmBic ?? null,
    demand: ai.demand || null,
    affinityNeighbors: ai.affinityNeighbors || [],
    census: ai.census || null,
    quality: ai.quality || null,
    pipeline: ai.pipeline || [],
    story: [
      ...(ai.story || []),
      pickGain > 0 ? `Gain de parcours estimé : −${pickGain} s par picking.` : null,
    ].filter(Boolean),
    weights: ai.weights || null,
    radar: ai.radar || null,
    articleImageUrl: article.imageUrl || null,
    depotLibelle: ctx.depotLibelle,
    sampleSize: ctx.articleFeats.length,
    cooccurrencePairs: ctx.cooccurrence.length,
    currentEmplacementId: stockLine?.emplacementId ?? null,
    currentEmplacementCode: stockLine?.emplacement?.code ?? null,
    currentEmplacementLibelle: stockLine?.emplacement?.libelle ?? null,
    currentEmplacementDistance: stockLine?.emplacement?.distanceQuai ?? null,
    currentScore: currentMatch?.score ?? null,
    currentZone: currentZone
      ? { key: currentZone.key, label: currentZone.label, short: currentZone.short }
      : null,
    isOptimal,
    potentialScoreGain: potentialGain,
    estimatedPickGainSec: pickGain,
    suggestions: top3,
    allEmplacements: ctx.candidatesAll.map((c) => {
      const match = scored.find((s) => s.emplacementId === c.emplacementId);
      const rankIdx = top3.findIndex((t) => t.emplacementId === c.emplacementId);
      return {
        emplacementId: c.emplacementId,
        code: c.code,
        libelle: c.libelle,
        distanceQuai: c.distanceQuai,
        occupationRatio: Math.round(c.occupationRatio * 100),
        isFull: c.isFull,
        isSuggested: rankIdx >= 0,
        suggestRank: rankIdx >= 0 ? rankIdx + 1 : null,
        score: match?.score ?? null,
        zone: { key: c.zone.key, label: c.zone.label, short: c.zone.short },
      };
    }),
    explication: ai.explication,
  };
}

async function auditEmplacements(depotId, societeId) {
  const ctx = await loadSlottingContext(societeId, depotId);

  const currents = [];
  const eligible = [];
  const seen = new Set();
  for (const line of ctx.stocks) {
    if (!line.emplacementId || seen.has(line.articleId)) continue;
    seen.add(line.articleId);
    const article = ctx.articles.find((a) => a.id === line.articleId) || line.article;
    if (!article) continue;
    const allowed = ctx.candidatesAll
      .filter((c) => {
        if (c.isFull && c.emplacementId !== line.emplacementId) return false;
        return isCompatible(article, c.raw, ctx.occupantsByEmpl.get(c.emplacementId) || []);
      })
      .map((c) => c.emplacementId);
    currents.push({
      articleId: line.articleId,
      emplacementId: line.emplacementId,
      code: line.emplacement?.code,
      distanceQuai: line.emplacement?.distanceQuai,
      stockLineId: line.id,
      articleCode: article.code || line.article?.code,
      articleLibelle: article.libelle || line.article?.libelle,
    });
    eligible.push({ articleId: line.articleId, emplacementIds: allowed });
  }

  const payload = {
    articles: ctx.articleFeats,
    candidates: ctx.candidatesAll.map(({ raw, isFull, zone, ...rest }) => rest),
    occupants: ctx.occupants,
    cooccurrence: ctx.cooccurrence,
    currents: currents.map((c) => ({
      articleId: c.articleId,
      emplacementId: c.emplacementId,
      code: c.code,
    })),
    eligible,
  };

  let ai = await callSlottingAi("/slotting/audit", payload);
  if (!ai) {
    const items = [];
    let lastLocal = null;
    for (const cur of currents) {
      const allowed = new Set(
        (eligible.find((e) => e.articleId === cur.articleId) || {}).emplacementIds || []
      );
      const local = localSlotting({
        articleId: cur.articleId,
        articles: ctx.articleFeats,
        candidates: ctx.candidatesAll
          .filter((c) => allowed.has(c.emplacementId))
          .map(({ raw, isFull, zone, ...rest }) => rest),
        occupants: ctx.occupants,
        cooccurrence: ctx.cooccurrence,
        currentEmplacementId: cur.emplacementId,
        currentEmplacementCode: cur.code,
      });
      lastLocal = local;
      const scored = local.scored || [];
      const best = scored[0];
      if (!best) continue;
      const top3 = new Set(scored.slice(0, 3).map((s) => s.emplacementId));
      if (top3.has(cur.emplacementId)) continue;
      const currentMatch = scored.find((s) => s.emplacementId === cur.emplacementId);
      const currentScore = currentMatch?.score ?? 0;
      const currentZoneKey = resolveZone(cur.distanceQuai).key;
      const recZoneKey = best.zoneKey || resolveZone(best.distanceQuai).key;
      items.push({
        articleId: cur.articleId,
        abcClass: local.abcClass,
        rotationLabel: local.rotationLabel,
        rotationScore: local.rotationScore,
        posterior: local.posterior,
        currentEmplacementId: cur.emplacementId,
        recommendedEmplacementId: best.emplacementId,
        currentScore,
        recommendedScore: best.score,
        scoreGain: best.score - currentScore,
        currentDistance: cur.distanceQuai,
        recommendedDistance: best.distanceQuai,
        currentZoneKey,
        recommendedZoneKey: recZoneKey,
        mismatch: currentZoneKey === recZoneKey ? null : `${currentZoneKey}→${recZoneKey}`,
        confidence: local.confidence,
        reasons: best.reasons || [],
        scoreBreakdown: best.scoreBreakdown || null,
        currentBreakdown: currentMatch?.scoreBreakdown || null,
        radar: best.scoreBreakdown
          ? {
              proximity: best.scoreBreakdown.proximity,
              zone: best.scoreBreakdown.zoneAlignment,
              capacity: best.scoreBreakdown.capacity,
              affinity: best.scoreBreakdown.affinity,
            }
          : null,
        demand: local.demand || { used: false },
        affinityNeighbors: (local.affinityNeighbors || []).slice(0, 2),
      });
    }
    items.sort((a, b) => b.scoreGain - a.scoreGain);
    ai = {
      modele: "percentile_affinity_local",
      methodology:
        "Mode local (FastAPI offline) : percentiles ABC 20/30/50 + affinité de co-picking",
      items,
      mode: "local",
      census: lastLocal?.census || null,
      pipeline: lastLocal?.pipeline || [],
      quality: lastLocal?.quality || null,
      weights: lastLocal?.weights || null,
      gmmBic: null,
      gmmMode: "percentile_abc",
    };
  }

  const byId = new Map(currents.map((c) => [c.articleId, c]));
  const candById = new Map(ctx.candidatesAll.map((c) => [c.emplacementId, c]));

  const items = (ai.items || []).map((row) => {
    const cur = byId.get(row.articleId);
    const rec = candById.get(row.recommendedEmplacementId);
    const currentZone = resolveZone(cur?.distanceQuai ?? row.currentDistance);
    const recZone = ZONE[row.recommendedZoneKey] || resolveZone(row.recommendedDistance);
    const currentZoneKey = row.currentZoneKey || currentZone.key;
    const recZoneKey = recZone.key;
    return {
      stockLineId: cur?.stockLineId,
      articleId: row.articleId,
      articleCode: cur?.articleCode,
      articleLibelle: cur?.articleLibelle,
      rotationLabel: row.rotationLabel,
      rotationScore: row.rotationScore,
      abcClass: row.abcClass,
      posterior: row.posterior || null,
      currentEmplacementId: row.currentEmplacementId,
      currentEmplacementCode: cur?.code,
      currentEmplacementDistance: cur?.distanceQuai ?? row.currentDistance,
      currentZone: { key: currentZone.key, label: currentZone.label },
      recommendedEmplacementId: row.recommendedEmplacementId,
      recommendedEmplacementCode: rec?.code,
      recommendedDistance: row.recommendedDistance,
      recommendedZone: { key: recZone.key, label: recZone.label },
      currentScore: row.currentScore,
      recommendedScore: row.recommendedScore,
      scoreGain: row.scoreGain,
      estimatedPickGainSec: estimatePickGainSec(
        cur?.distanceQuai ?? row.currentDistance,
        row.recommendedDistance,
        row.abcClass
      ),
      confidence: row.confidence,
      mismatch: row.mismatch || (currentZoneKey === recZoneKey ? null : `${currentZoneKey}→${recZoneKey}`),
      reasons: row.reasons || [],
      scoreBreakdown: row.scoreBreakdown || null,
      currentBreakdown: row.currentBreakdown || null,
      radar: row.radar || null,
      demand: row.demand || null,
      affinityNeighbors: row.affinityNeighbors || [],
    };
  });

  let underutilizedCount = 0;
  for (const empl of ctx.emplacements) {
    const occ = ctx.occupancyByEmpl.get(empl.id) || 0;
    const cap = empl.capaciteSlots;
    if (cap == null) continue;
    if (occ / cap < 0.2) underutilizedCount += 1;
  }

  const avgGain =
    items.length > 0
      ? Math.round(items.reduce((s, m) => s + m.scoreGain, 0) / items.length)
      : 0;

  const byMismatch = {};
  let towardsDock = 0;
  let towardsReserve = 0;
  for (const m of items) {
    if (m.mismatch) byMismatch[m.mismatch] = (byMismatch[m.mismatch] || 0) + 1;
    const from = Number(m.currentEmplacementDistance);
    const to = Number(m.recommendedDistance);
    if (Number.isFinite(from) && Number.isFinite(to)) {
      if (to < from) towardsDock += 1;
      else if (to > from) towardsReserve += 1;
    }
  }

  return {
    depotId: Number(depotId),
    depotLibelle: ctx.depotLibelle,
    methodology: ai.methodology,
    fallbackReason: ai.fallbackReason || null,
    modele: ai.modele,
    mode: ai.mode || "ai",
    census: ai.census || null,
    quality: ai.quality || null,
    pipeline: ai.pipeline || [],
    weights: ai.weights || null,
    gmmBic: ai.gmmBic ?? null,
    gmmMode: ai.gmmMode || null,
    rules: ai.rules || [],
    zoneFlows: ai.zoneFlows || { byMismatch, towardsDock, towardsReserve },
    placedCount: currents.length,
    items,
    stats: {
      misalignedCount: items.length,
      avgPotentialGain: avgGain,
      underutilizedEmplacements: underutilizedCount,
      classACount: items.filter((m) => m.abcClass === "A").length,
      totalPickGainSec: items.reduce((s, m) => s + (m.estimatedPickGainSec || 0), 0),
      placedCount: currents.length,
      towardsDock,
      towardsReserve,
    },
  };
}

module.exports = {
  suggestEmplacements,
  auditEmplacements,
  resolveZone,
  estimatePickGainSec,
};
