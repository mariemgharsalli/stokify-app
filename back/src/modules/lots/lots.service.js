const prisma = require("../../config/database");
const mouvementsService = require("../mouvements/mouvements.service");
const { sumStockQuantite } = mouvementsService;
const { getSocieteWhere, requireActiveSocieteId } = require("../../utils/societeScope");
const { auditFromReq } = require("../../utils/auditHelper");
const { normalizeCode, createWithAutoCode, resolveAutoCode } = require("../../utils/codeUtils");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function assertArticleSociete(articleId, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const art = await prisma.article.findFirst({
    where: { id: Number(articleId), societeId: sid },
  });
  if (!art) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  return art;
}

async function assertDepotSociete(depotId, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const d = await prisma.depot.findFirst({
    where: { id: Number(depotId), societeId: sid },
  });
  if (!d) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }
  return d;
}

function formatDateYmd(d = new Date()) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Génère un numéro de lot unique : LOT-{CODE_ARTICLE}-{YYYYMMDD}-{seq 3 chiffres}
 * @param {number} bump — incrément additionnel en cas de retry collision
 */
async function generateNumeroLot(articleId, societeId, bump = 0, db = prisma) {
  const art = await assertArticleSociete(articleId, societeId);
  const code = String(art.code || "ART")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .toUpperCase() || "ART";
  const dateStr = formatDateYmd();
  const prefix = `LOT-${code}-${dateStr}-`;
  const client = db || prisma;
  const existing = await client.lot.count({
    where: {
      articleId: Number(articleId),
      numero: { startsWith: prefix },
    },
  });
  const seq = existing + 1 + Number(bump || 0);
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

async function listLots({ user, articleId, statut, depotId, page = 1, limit = 25 }) {
  const { societeId: sid } = getSocieteWhere(user);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;
  const where = {
    article: { societeId: sid },
    ...(articleId ? { articleId: Number(articleId) } : {}),
    ...(statut ? { statut: String(statut) } : {}),
    ...(depotId != null && String(depotId).trim() !== "" ? { depotId: Number(depotId) } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.lot.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: [{ dateFabrication: "asc" }, { id: "asc" }],
      include: {
        article: { select: { id: true, code: true, libelle: true, imageUrl: true } },
        depot: { select: { id: true, code: true, libelle: true } },
      },
    }),
    prisma.lot.count({ where }),
  ]);
  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

function addDaysUtc(d, days) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + Number(days));
  return x;
}

/**
 * Lots avec DLC dans les N prochains jours (pas encore périmés), avec stock restant.
 */
async function listLotsExpiringSoon(user, { days = 30, depotId, limit = 200 } = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  const n = Math.min(366, Math.max(1, Number(days) || 30));
  const now = new Date();
  const until = addDaysUtc(now, n);
  const take = Math.min(500, Math.max(1, Number(limit) || 200));

  const where = {
    article: { societeId: sid },
    quantiteRestante: { gt: 0 },
    statut: "ACTIF",
    dateExpiration: { not: null, gte: now, lte: until },
    ...(depotId != null && String(depotId).trim() !== "" ? { depotId: Number(depotId) } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.lot.findMany({
      where,
      take,
      orderBy: [{ dateExpiration: "asc" }, { id: "asc" }],
      include: {
        article: { select: { id: true, code: true, libelle: true } },
        depot: { select: { id: true, code: true, libelle: true } },
      },
    }),
    prisma.lot.count({ where }),
  ]);

  return { items, total, days: n };
}

/**
 * Lots expirant bientôt — export (plafonné).
 */
async function exportLotsExpiring(user, { days = 30, depotId } = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  const n = Math.min(366, Math.max(1, Number(days) || 30));
  const now = new Date();
  const until = addDaysUtc(now, n);
  const where = {
    article: { societeId: sid },
    quantiteRestante: { gt: 0 },
    statut: "ACTIF",
    dateExpiration: { not: null, gte: now, lte: until },
    ...(depotId != null && String(depotId).trim() !== "" ? { depotId: Number(depotId) } : {}),
  };
  return prisma.lot.findMany({
    where,
    take: 10000,
    orderBy: [{ dateExpiration: "asc" }, { id: "asc" }],
    include: {
      article: { select: { id: true, code: true, libelle: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
  });
}

/**
 * Mouvements liés au lot (scope société, tri date décroissante).
 */
async function getHistoriqueLot(user, lotId) {
  const { societeId: sid } = getSocieteWhere(user);
  const lot = await prisma.lot.findFirst({
    where: { id: Number(lotId), article: { societeId: sid } },
  });
  if (!lot) {
    const err = new Error("Lot introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.mouvement.findMany({
    where: {
      lotId: lot.id,
      article: { societeId: sid },
    },
    orderBy: { createdAt: "desc" },
    include: {
      article: { select: { id: true, code: true, libelle: true } },
      depot: { select: { id: true, code: true, libelle: true } },
      depotDest: { select: { id: true, code: true, libelle: true } },
      utilisateur: { select: { nom: true, prenom: true, email: true } },
    },
  });
}

/**
 * Mouvements liés au lot (rappel produit / traçabilité).
 */
async function getLotTraceabilite(user, lotId) {
  const { societeId: sid } = getSocieteWhere(user);
  const lot = await prisma.lot.findFirst({
    where: { id: Number(lotId), article: { societeId: sid } },
    include: {
      article: { select: { id: true, code: true, libelle: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
  });
  if (!lot) {
    const err = new Error("Lot introuvable");
    err.status = 404;
    throw err;
  }
  const mouvements = await prisma.mouvement.findMany({
    where: { lotId: lot.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      depot: { select: { id: true, code: true, libelle: true } },
      depotDest: { select: { id: true, code: true, libelle: true } },
      utilisateur: { select: { id: true, nom: true, prenom: true, email: true } },
    },
  });
  return { lot, mouvements };
}

async function getLot(id, societeId) {
  return prisma.lot.findFirst({
    where: { id: Number(id), article: { societeId: Number(societeId) } },
    include: {
      article: { select: { id: true, code: true, libelle: true, imageUrl: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
  });
}

async function createLot(data, societeId) {
  await assertArticleSociete(data.articleId, societeId);
  await assertDepotSociete(data.depotId, societeId);

  const lotInclude = {
    article: { select: { code: true, libelle: true } },
    depot: { select: { id: true, code: true, libelle: true } },
  };

  const persistLot = async ({ numero }) =>
    prisma.lot.create({
      data: {
        numero: normalizeCode(numero),
        articleId: Number(data.articleId),
        depotId: Number(data.depotId),
        dateFabrication: data.dateFabrication ? new Date(data.dateFabrication) : null,
        dateExpiration: data.dateExpiration ? new Date(data.dateExpiration) : null,
        quantiteInitiale: Number(data.quantiteInitiale),
        quantiteRestante: Number(data.quantiteRestante ?? data.quantiteInitiale),
        statut: data.statut || "ACTIF",
      },
      include: lotInclude,
    });

  const generateFn = () => generateNumeroLot(data.articleId, societeId);
  const { isAuto, code: resolvedNumero } = await resolveAutoCode(
    societeId,
    data.numero,
    generateFn
  );

  if (isAuto) {
    return createWithAutoCode(
      societeId,
      { numero: resolvedNumero || undefined },
      generateFn,
      persistLot,
      3,
      "numero"
    );
  }

  return persistLot({ numero: resolvedNumero });
}

async function updateLot(id, data, societeId) {
  const ex = await getLot(id, societeId);
  if (!ex) {
    const err = new Error("Lot introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.lot.update({
    where: { id: ex.id },
    data: {
      ...(data.dateFabrication !== undefined
        ? { dateFabrication: data.dateFabrication ? new Date(data.dateFabrication) : null }
        : {}),
      ...(data.dateExpiration !== undefined
        ? { dateExpiration: data.dateExpiration ? new Date(data.dateExpiration) : null }
        : {}),
      ...(data.statut != null ? { statut: String(data.statut) } : {}),
    },
  });
}

/**
 * Désactive un lot (statut DESACTIVE) au lieu d'une suppression physique.
 * L'historique (mouvements, inventaires, n° série, couches FIFO) reste consultable.
 */
async function deactivateLot(id, societeId) {
  const ex = await prisma.lot.findFirst({
    where: { id: Number(id), article: { societeId: Number(societeId) } },
  });
  if (!ex) {
    const err = new Error("Lot introuvable");
    err.status = 404;
    throw err;
  }

  if (String(ex.statut || "").toUpperCase() === "DESACTIVE") {
    return getLot(ex.id, societeId);
  }

  return prisma.lot.update({
    where: { id: ex.id },
    data: { statut: "DESACTIVE" },
    include: {
      article: { select: { id: true, code: true, libelle: true, imageUrl: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
  });
}

/**
 * Suppression physique refusée si le lot a des relations ;
 * sinon désactivation (jamais de DELETE en base pour conserver la traçabilité).
 */
async function deleteLot(id, societeId) {
  const ex = await prisma.lot.findFirst({
    where: { id: Number(id), article: { societeId: Number(societeId) } },
    include: {
      _count: {
        select: {
          mouvements: true,
          lignesInventaire: true,
          numerosSerie: true,
          couchesFifo: true,
        },
      },
    },
  });
  if (!ex) {
    const err = new Error("Lot introuvable");
    err.status = 404;
    throw err;
  }
  const hasRelations =
    ex._count.mouvements > 0 ||
    ex._count.lignesInventaire > 0 ||
    ex._count.numerosSerie > 0 ||
    ex._count.couchesFifo > 0;
  if (hasRelations) {
    const err = new Error(
      "Impossible de supprimer physiquement : lot lié à des mouvements, inventaires, numéros de série ou couches FIFO. Utilisez la désactivation."
    );
    err.status = 409;
    throw err;
  }
  return deactivateLot(id, societeId);
}

/**
 * Ordonne les lots pour FIFO / FEFO / STANDARD.
 */
function compareLotFefo(a, b) {
  const time = (value) => {
    if (!value) return Number.POSITIVE_INFINITY;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
  };
  const exp = time(a?.dateExpiration) - time(b?.dateExpiration);
  if (exp !== 0) return exp;
  const fab = time(a?.dateFabrication) - time(b?.dateFabrication);
  if (fab !== 0) return fab;
  return (Number(a?.id) || 0) - (Number(b?.id) || 0);
}

function sortLotsFefo(lots) {
  return [...(lots || [])].sort(compareLotFefo);
}

function lotOrderBy(strategie) {
  const s = String(strategie || "FIFO").toUpperCase();
  if (s === "FEFO") {
    // Le lot qui expire le plus tôt sort en premier (même ordre que compareLotFefo)
    return [
      { dateExpiration: "asc" },
      { dateFabrication: "asc" },
      { id: "asc" },
    ];
  }
  if (s === "STANDARD") {
    // Pas de règle liée aux dates : ordre d'entrée en système (id croissant)
    return [{ id: "asc" }];
  }
  // FIFO (par défaut) : le lot fabriqué le plus tôt sort en premier
  return [{ dateFabrication: "asc" }, { id: "asc" }];
}

function lotWhereAvailable(articleId, depotId) {
  return {
    articleId: Number(articleId),
    depotId: Number(depotId),
    quantiteRestante: { gt: 0 },
    statut: { in: ["ACTIF", "EXPIRE"] },
  };
}

/**
 * Consomme des lots dans une transaction Prisma (vente, sortie manuelle, etc.).
 * Met à jour Lot.quantiteRestante — jamais ignoré, quel que soit FIFO/FEFO/STANDARD.
 */
async function consumeLotsInTransaction(tx, { articleId, depotId, societeId, quantite, strategie }) {
  const article = await tx.article.findFirst({
    where: { id: Number(articleId), societeId: Number(societeId) },
  });
  if (!article) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }

  const strategy = String(strategie || article.strategieSortie || "FIFO").toUpperCase();
  const did = Number(depotId);
  const q = Number(quantite);
  if (!(q > 0)) {
    const err = new Error("quantite > 0 requise");
    err.status = 400;
    throw err;
  }

  const lotsSql = await tx.lot.findMany({
    where: lotWhereAvailable(articleId, did),
    orderBy: lotOrderBy(strategy),
  });
  const lots = strategy === "FEFO" ? sortLotsFefo(lotsSql) : lotsSql;

  const disponible = lots.reduce((sum, lot) => sum + Number(lot.quantiteRestante), 0);
  const manquantAvant = round2(q - disponible);
  if (manquantAvant > 1e-6) {
    const err = new Error(
      `Stock insuffisant pour "${article.libelle}" — ${manquantAvant} unité(s) manquante(s) dans les lots disponibles.`
    );
    err.status = 409;
    err.code = "STOCK_INSUFFISANT";
    err.details = { articleId, libelle: article.libelle, demande: q, manquant: manquantAvant };
    throw err;
  }

  let remaining = q;
  const lotsConsumed = [];

  for (const lot of lots) {
    if (remaining <= 1e-9) break;
    const rest = Number(lot.quantiteRestante);
    const taken = round2(Math.min(rest, remaining));
    if (taken <= 1e-9) continue;

    const newQ = round2(rest - taken);
    await tx.lot.update({
      where: { id: lot.id },
      data: {
        quantiteRestante: newQ,
        statut: newQ <= 1e-9 ? "EPUISE" : lot.statut,
      },
    });

    lotsConsumed.push({
      lotId: lot.id,
      lotNumero: lot.numero,
      quantite: taken,
      dateExpiration: lot.dateExpiration,
    });
    remaining = round2(remaining - taken);
  }

  if (remaining > 1e-6) {
    const err = new Error(
      `Stock insuffisant pour "${article.libelle}" — ${remaining} unité(s) manquante(s) dans les lots disponibles.`
    );
    err.status = 409;
    err.code = "STOCK_INSUFFISANT";
    err.details = { articleId, libelle: article.libelle, demande: q, manquant: remaining };
    throw err;
  }

  return { strategy, lotsConsumed };
}

/**
 * Transfère du stock d'un dépôt vers un autre en déplaçant réellement les lots
 * (traçabilité FEFO/rappel produit préservée). Consomme les lots d'origine selon
 * la stratégie de l'article, et recrée/incrémente les lots correspondants au
 * dépôt de destination avec les mêmes numero/dateFabrication/dateExpiration.
 * Retourne le détail des lots déplacés pour traçabilité du mouvement.
 */
async function transferLotsBetweenDepots(tx, { articleId, depotOrigineId, depotDestId, quantite, strategie }) {
  const article = await tx.article.findFirst({ where: { id: Number(articleId) } });
  if (!article) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  const strategy = String(strategie || article.strategieSortie || "FIFO").toUpperCase();
  const q = Number(quantite);

  const lotsSql = await tx.lot.findMany({
    where: lotWhereAvailable(articleId, depotOrigineId),
    orderBy: lotOrderBy(strategy),
  });
  const lots = strategy === "FEFO" ? sortLotsFefo(lotsSql) : lotsSql;

  let remaining = q;
  const lotsTransferred = [];

  for (const lot of lots) {
    if (remaining <= 1e-9) break;
    const rest = Number(lot.quantiteRestante);
    const taken = Math.min(rest, remaining);
    if (taken <= 1e-9) continue;

    // Décrémenter le lot d'origine
    const newQ = Math.round((rest - taken) * 100) / 100;
    await tx.lot.update({
      where: { id: lot.id },
      data: { quantiteRestante: newQ, statut: newQ <= 1e-9 ? "EPUISE" : lot.statut },
    });

    // Recréer/incrémenter le lot correspondant au dépôt de destination
    const existingDest = await tx.lot.findFirst({
      where: { articleId: Number(articleId), numero: lot.numero, depotId: Number(depotDestId) },
    });
    let destLot;
    if (existingDest) {
      destLot = await tx.lot.update({
        where: { id: existingDest.id },
        data: {
          quantiteRestante: Math.round((Number(existingDest.quantiteRestante) + taken) * 100) / 100,
          quantiteInitiale: Math.round((Number(existingDest.quantiteInitiale) + taken) * 100) / 100,
          statut: "ACTIF",
        },
      });
    } else {
      destLot = await tx.lot.create({
        data: {
          numero: lot.numero,
          articleId: Number(articleId),
          depotId: Number(depotDestId),
          dateFabrication: lot.dateFabrication,
          dateExpiration: lot.dateExpiration,
          quantiteInitiale: taken,
          quantiteRestante: taken,
          statut: "ACTIF",
        },
      });
    }

    lotsTransferred.push({
      lotId: lot.id,
      lotNumero: lot.numero,
      destLotId: destLot.id,
      quantite: taken,
      dateExpiration: lot.dateExpiration,
    });
    remaining = Math.round((remaining - taken) * 100) / 100;
  }

  if (remaining > 1e-6) {
    const err = new Error(
      `Stock lot insuffisant à transférer — ${remaining} unité(s) sans lot d'origine identifiable`
    );
    err.status = 409;
    throw err;
  }

  return { strategy, lotsTransferred };
}

async function sumLotQuantiteRestante(txOrPrisma, articleId, depotId) {
  const client = txOrPrisma;
  const agg = await client.lot.aggregate({
    where: lotWhereAvailable(articleId, depotId),
    _sum: { quantiteRestante: true },
  });
  return Number(agg._sum.quantiteRestante || 0);
}

function legacyLotNumero(articleId, depotId) {
  return `STOCK-LEGACY-${Number(articleId)}-${Number(depotId)}`;
}

/**
 * Aligne Σ(lots) sur le stock réel : crée ou complète un lot « legacy » si du stock
 * existe sans couverture lot (saisie manuelle, réception sans lot, etc.).
 */
async function ensureStockCoveredByLots(tx, { articleId, depotId }) {
  const aid = Number(articleId);
  const did = Number(depotId);
  const stockQty = await sumStockQuantite(tx, aid, did);
  const lotQty = await sumLotQuantiteRestante(tx, aid, did);
  const gap = round2(stockQty - lotQty);
  if (gap <= 1e-6) return null;

  const numero = legacyLotNumero(aid, did);
  const existing = await tx.lot.findFirst({
    where: { articleId: aid, depotId: did, numero },
  });

  if (existing) {
    return tx.lot.update({
      where: { id: existing.id },
      data: {
        quantiteRestante: round2(Number(existing.quantiteRestante) + gap),
        quantiteInitiale: round2(Number(existing.quantiteInitiale) + gap),
        statut: "ACTIF",
      },
    });
  }

  return tx.lot.create({
    data: {
      numero,
      articleId: aid,
      depotId: did,
      dateFabrication: new Date(),
      quantiteInitiale: gap,
      quantiteRestante: gap,
      statut: "ACTIF",
    },
  });
}

/** Associe chaque ligne achat au lot créé (numéro se termine par `-{ligneId}`). */
function attachLotsToLignes(achat) {
  if (!achat?.lignes?.length) return achat;
  const lots = achat.lots || [];
  const byLigneId = new Map();
  const usedLotIds = new Set();

  for (const lot of lots) {
    const match = String(lot.numero).match(/-(\d+)$/);
    if (match) {
      byLigneId.set(Number(match[1]), lot);
      usedLotIds.add(lot.id);
    }
  }

  const unusedByArticle = new Map();
  for (const lot of lots) {
    if (usedLotIds.has(lot.id)) continue;
    if (!unusedByArticle.has(lot.articleId)) {
      unusedByArticle.set(lot.articleId, []);
    }
    unusedByArticle.get(lot.articleId).push(lot);
  }

  return {
    ...achat,
    lignes: achat.lignes.map((l) => ({
      ...l,
      lot:
        byLigneId.get(l.id) ??
        (unusedByArticle.get(l.articleId)?.shift() ?? null),
    })),
  };
}

/**
 * @param {number} resolvedDepotId — déjà résolu comme pour les mouvements (cf. mouvementsService.resolveDepot)
 */
async function pickAllocation(societeId, articleId, quantite, strategie, resolvedDepotId) {
  await assertArticleSociete(articleId, societeId);
  const q = Number(quantite);
  if (q <= 0) {
    const err = new Error("quantite > 0 requise");
    err.status = 400;
    throw err;
  }
  const did = Number(resolvedDepotId);
  if (!Number.isFinite(did)) {
    const err = new Error("depot invalide ou manquant pour le prelevement sur lots");
    err.status = 400;
    throw err;
  }
  await assertDepotSociete(did, societeId);
  const strategy = String(strategie || "FIFO").toUpperCase();
  const lotsSql = await prisma.lot.findMany({
    where: lotWhereAvailable(articleId, did),
    orderBy: lotOrderBy(strategy),
  });
  const lots = strategy === "FEFO" ? sortLotsFefo(lotsSql) : lotsSql;
  const allocation = [];
  let left = q;
  for (const lot of lots) {
    if (left <= 1e-9) break;
    const rest = Number(lot.quantiteRestante);
    const take = round2(Math.min(left, rest));
    if (take > 0) {
      allocation.push({ lotId: lot.id, numero: lot.numero, quantite: take });
      left = round2(left - take);
    }
  }
  if (left > 1e-6) {
    const err = new Error(`Stock lot insuffisant (manque ${left} unite(s))`);
    err.status = 400;
    throw err;
  }
  return { strategie: strategy, allocation, quantiteTotale: q };
}

async function previewPickAllocation(user, { articleId, quantite, strategie, depotId }) {
  const sid = Number(user.societeId);
  const depResolved = await mouvementsService.resolveDepot(prisma, sid, depotId);
  const base = await pickAllocation(sid, articleId, quantite, strategie, depResolved);
  const lotIds = base.allocation.map((a) => a.lotId);
  if (!lotIds.length) return { ...base, lignes: [] };
  const lots = await prisma.lot.findMany({
    where: { id: { in: lotIds } },
    include: { depot: { select: { id: true, code: true, libelle: true } } },
  });
  const byId = new Map(lots.map((l) => [l.id, l]));
  const lignes = base.allocation.map((row, index) => {
    const lot = byId.get(row.lotId);
    return {
      ...row,
      ordre: index + 1,
      dateExpiration: lot?.dateExpiration ?? null,
      dateFabrication: lot?.dateFabrication ?? null,
      depotCode: lot?.depot?.code ?? null,
      fefoHighlight: index === 0 && String(strategie || "FIFO").toUpperCase() === "FEFO",
    };
  });
  return { ...base, lignes };
}

/**
 * Sortie de stock ventilée sur plusieurs lots (FIFO/FEFO) + mouvements liés.
 */
async function executeSortieLots(user, body) {
  const {
    articleId,
    depotId,
    emplacementId,
    quantite,
    strategie,
    type,
    commentaire,
    valeur,
  } = body;
  const sid = Number(user.societeId);
  const resolvedDepot = await mouvementsService.resolveDepot(prisma, sid, depotId);
  const { allocation } = await pickAllocation(sid, articleId, quantite, strategie, resolvedDepot);
  const mtype =
    type && ["SORTIE_PERTE", "SORTIE_CASSE", "SORTIE_AUTRE", "SORTIE_VENTE"].includes(type)
      ? type
      : "SORTIE_AUTRE";

  const depId = resolvedDepot;

  return prisma.$transaction(async (tx) => {
    const results = [];
    for (const row of allocation) {
      const lot = await tx.lot.findFirst({
        where: { id: row.lotId, articleId: Number(articleId), depotId: depId },
      });
      if (!lot || Number(lot.quantiteRestante) < row.quantite - 1e-9) {
        const err = new Error("Lot inconsistant");
        err.status = 409;
        throw err;
      }
      await tx.lot.update({
        where: { id: lot.id },
        data: {
          quantiteRestante: round2(Number(lot.quantiteRestante) - row.quantite),
          statut: round2(Number(lot.quantiteRestante) - row.quantite) < 1e-9 ? "EPUISE" : lot.statut,
        },
      });
      await mouvementsService.adjustStock(tx, {
        societeId: sid,
        articleId,
        depotId: depId,
        emplacementId,
        delta: -row.quantite,
      });
      const mvt = await mouvementsService.insertMouvement(tx, {
        reference: mouvementsService.genRef(`MVT-${mtype}-LOT`),
        type: mtype,
        articleId,
        depotId: depId,
        quantite: row.quantite,
        valeur: valeur != null ? round2(valeur * (row.quantite / Number(quantite))) : null,
        utilisateurId: user.id,
        commentaire: commentaire ? `${commentaire} [lot ${lot.numero}]` : `lot ${lot.numero}`,
        lotId: lot.id,
      });
      results.push(mvt);
    }
    return { mouvements: results, allocation };
  });
}

function daysUntil(dateExpiration) {
  if (!dateExpiration) return null;
  const exp = new Date(dateExpiration);
  const now = new Date();
  if (Number.isNaN(exp.getTime())) return null;
  return Math.ceil(
    (Date.UTC(exp.getFullYear(), exp.getMonth(), exp.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86400000
  );
}

async function listRappels(user) {
  const { societeId: sid } = getSocieteWhere(user);
  const now = new Date();
  const in30 = addDaysUtc(now, 30);
  const in7 = addDaysUtc(now, 7);

  const items = await prisma.lot.findMany({
    where: {
      article: { societeId: sid },
      quantiteRestante: { gt: 0 },
      OR: [
        { statutRappel: { not: null } },
        { dateExpiration: { lte: in30, gte: now } },
      ],
    },
    include: {
      article: { select: { id: true, code: true, libelle: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
    orderBy: [{ dateExpiration: "asc" }, { id: "desc" }],
  });

  const lotsRappelActifs = items.filter(
    (l) => l.statutRappel && !["CLOS", "RETIRE"].includes(l.statutRappel)
  ).length;

  let clientsANotifier = 0;
  const articleIds = [...new Set(items.filter((l) => l.statutRappel === "EN_ATTENTE").map((l) => l.articleId))];
  if (articleIds.length) {
    const ventes = await prisma.ligneVente.findMany({
      where: { articleId: { in: articleIds }, vente: { societeId: sid, statut: { not: "ANNULE" } } },
      select: { vente: { select: { clientId: true } } },
    });
    clientsANotifier = new Set(ventes.map((v) => v.vente.clientId)).size;
  }

  const expiring7 = items.filter((l) => {
    const d = daysUntil(l.dateExpiration);
    return d != null && d >= 0 && d <= 7 && !l.statutRappel;
  }).length;

  const conformes = items.filter((l) => !l.statutRappel && (!l.dateExpiration || daysUntil(l.dateExpiration) > 30)).length;

  const timeline = await prisma.audit.findMany({
    where: {
      OR: [{ module: "Lots" }, { entite: "Lot" }],
      action: { contains: "RAPPEL" },
      utilisateur: { societeId: sid },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { utilisateur: { select: { nom: true, prenom: true } } },
  });

  return {
    items: items.map((l) => ({ ...l, joursRestants: daysUntil(l.dateExpiration) })),
    kpis: {
      lotsRappelActifs,
      clientsANotifier,
      expiring7,
      conformes,
    },
    timeline,
  };
}

async function declencherRappel(id, user, req) {
  const { societeId: sid } = getSocieteWhere(user);
  const lot = await prisma.lot.findFirst({
    where: { id: Number(id), article: { societeId: sid } },
    include: { article: { select: { libelle: true } } },
  });
  if (!lot) {
    const err = new Error("Lot introuvable");
    err.status = 404;
    throw err;
  }
  const updated = await prisma.lot.update({
    where: { id: lot.id },
    data: { statutRappel: "EN_ATTENTE", dateRappel: new Date() },
    include: {
      article: { select: { id: true, code: true, libelle: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
  });
  if (req) {
    await auditFromReq(req, {
      action: "RAPPEL_DECLENCHE",
      entite: "Lot",
      entiteId: lot.id,
      module: "Lots",
      description: `Rappel déclenché pour lot ${lot.numero} (${lot.article?.libelle})`,
    });
  }
  return updated;
}

async function notifierClientsLot(id, user, req) {
  const { societeId: sid } = getSocieteWhere(user);
  const lot = await prisma.lot.findFirst({
    where: { id: Number(id), article: { societeId: sid } },
    include: { article: true },
  });
  if (!lot) {
    const err = new Error("Lot introuvable");
    err.status = 404;
    throw err;
  }

  // Croisement lot précis (mouvements SORTIE_VENTE + lotsConsumed) — pas articleId seul
  const traces = await getLotClientsTraceabilite(user, lot.id);

  // Un même client peut apparaître sur plusieurs ventes : dédupliquer avant notif
  const byClient = new Map();
  for (const t of traces) {
    const key =
      (t.clientEmail && String(t.clientEmail).toLowerCase()) ||
      `${t.clientNom || ""}|${t.clientTelephone || ""}`;
    if (!byClient.has(key)) {
      byClient.set(key, {
        client: {
          nom: t.clientNom,
          email: t.clientEmail,
          telephone: t.clientTelephone,
        },
        ventes: [],
        quantiteTotale: 0,
      });
    }
    const row = byClient.get(key);
    row.ventes.push({
      reference: t.referenceVente,
      date: t.dateVente,
      quantite: t.quantite,
    });
    row.quantiteTotale += Number(t.quantite) || 0;
  }

  await prisma.lot.update({
    where: { id: lot.id },
    data: { statutRappel: "NOTIFIE" },
  });

  if (req) {
    await auditFromReq(req, {
      action: "RAPPEL_NOTIFIE",
      entite: "Lot",
      entiteId: lot.id,
      module: "Lots",
      description: `Clients notifiés pour lot ${lot.numero} (${byClient.size} client(s))`,
    });
  }

  return { lot: { id: lot.id, numero: lot.numero }, clients: [...byClient.values()] };
}

async function updateStatutRappel(id, statut, user, req) {
  const { societeId: sid } = getSocieteWhere(user);
  const lot = await prisma.lot.findFirst({
    where: { id: Number(id), article: { societeId: sid } },
    include: { article: { select: { libelle: true } } },
  });
  if (!lot) {
    const err = new Error("Lot introuvable");
    err.status = 404;
    throw err;
  }

  const st = String(statut).toUpperCase();
  if (!["RETIRE", "CLOS", "NOTIFIE", "EN_ATTENTE"].includes(st)) {
    const err = new Error("Statut rappel invalide");
    err.status = 400;
    throw err;
  }

  if (st === "RETIRE" && Number(lot.quantiteRestante) > 0) {
    await prisma.$transaction(async (tx) => {
      const qte = Number(lot.quantiteRestante);
      await tx.lot.update({
        where: { id: lot.id },
        data: { quantiteRestante: 0, statut: "EPUISE", statutRappel: "RETIRE" },
      });
      await mouvementsService.adjustStock(tx, {
        societeId: sid,
        articleId: lot.articleId,
        depotId: lot.depotId,
        emplacementId: null,
        delta: -qte,
      });
      await mouvementsService.insertMouvement(tx, {
        reference: mouvementsService.genRef("MVT-SORTIE-AJUST"),
        type: "SORTIE_AJUSTEMENT",
        articleId: lot.articleId,
        depotId: lot.depotId,
        quantite: qte,
        utilisateurId: user.id,
        commentaire: `Retrait stock rappel lot ${lot.numero}`,
        lotId: lot.id,
      });
    });
  } else {
    await prisma.lot.update({
      where: { id: lot.id },
      data: { statutRappel: st },
    });
  }

  if (req) {
    await auditFromReq(req, {
      action: `RAPPEL_${st}`,
      entite: "Lot",
      entiteId: lot.id,
      module: "Lots",
      description: `Statut rappel ${st} pour lot ${lot.numero}`,
    });
  }

  return prisma.lot.findFirst({
    where: { id: lot.id },
    include: {
      article: { select: { id: true, code: true, libelle: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
  });
}

/**
 * Clients ayant reçu ce lot (via mouvements SORTIE_VENTE et lotsConsumed).
 */
async function getLotClientsTraceabilite(user, lotId) {
  const { societeId: sid } = getSocieteWhere(user);
  const lot = await prisma.lot.findFirst({
    where: { id: Number(lotId), article: { societeId: sid } },
    select: { id: true, articleId: true, numero: true },
  });
  if (!lot) {
    const err = new Error("Lot introuvable");
    err.status = 404;
    throw err;
  }

  const byVenteId = new Map();

  const mvts = await prisma.mouvement.findMany({
    where: {
      lotId: lot.id,
      type: "SORTIE_VENTE",
      article: { societeId: sid },
    },
    orderBy: { createdAt: "desc" },
  });

  for (const m of mvts) {
    const refMatch = m.commentaire?.match(/Vente\s+(\S+)/i);
    const ref = refMatch?.[1] || m.reference || "";
    if (!ref) continue;
    const vente = await prisma.vente.findFirst({
      where: { reference: ref, societeId: sid },
      include: { client: { select: { id: true, nom: true, email: true, telephone: true } } },
    });
    if (!vente?.client) continue;
    byVenteId.set(vente.id, {
      clientNom: vente.client.nom,
      clientEmail: vente.client.email,
      clientTelephone: vente.client.telephone,
      referenceVente: vente.reference,
      dateVente: vente.dateVente,
      quantite: Number(m.quantite),
    });
  }

  const lignes = await prisma.ligneVente.findMany({
    where: {
      articleId: lot.articleId,
      vente: { societeId: sid, statut: { notIn: ["ANNULE", "BROUILLON"] } },
      lotsConsumed: { not: null },
    },
    include: {
      vente: {
        select: {
          id: true,
          reference: true,
          dateVente: true,
          client: { select: { id: true, nom: true, email: true, telephone: true } },
        },
      },
    },
  });

  for (const l of lignes) {
    if (!l.lotsConsumed || byVenteId.has(l.vente.id)) continue;
    let consumed;
    try {
      consumed = JSON.parse(l.lotsConsumed);
    } catch {
      continue;
    }
    if (!Array.isArray(consumed)) continue;
    const entry = consumed.find((c) => Number(c.lotId) === lot.id);
    if (!entry || !l.vente?.client) continue;
    byVenteId.set(l.vente.id, {
      clientNom: l.vente.client.nom,
      clientEmail: l.vente.client.email,
      clientTelephone: l.vente.client.telephone,
      referenceVente: l.vente.reference,
      dateVente: l.vente.dateVente,
      quantite: Number(entry.quantite ?? l.quantite),
    });
  }

  return [...byVenteId.values()].sort(
    (a, b) => new Date(b.dateVente).getTime() - new Date(a.dateVente).getTime()
  );
}

async function previewNumeroLot(user, articleId) {
  const { societeId: sid } = getSocieteWhere(user);
  const numero = await generateNumeroLot(articleId, sid);
  return { numero, articleId: Number(articleId) };
}

/**
 * Avertissements non bloquants avant désactivation (stock restant, docs brouillon).
 */
async function getDeactivateWarnings(user, lotId) {
  const { societeId: sid } = getSocieteWhere(user);
  const lot = await prisma.lot.findFirst({
    where: { id: Number(lotId), article: { societeId: sid } },
    select: {
      id: true,
      numero: true,
      quantiteRestante: true,
      achatId: true,
    },
  });
  if (!lot) {
    const err = new Error("Lot introuvable");
    err.status = 404;
    throw err;
  }

  const draftDocuments = [];

  if (lot.achatId) {
    const achat = await prisma.achat.findFirst({
      where: { id: lot.achatId, societeId: sid, statut: "BROUILLON" },
      select: { id: true, reference: true },
    });
    if (achat) {
      draftDocuments.push({ type: "ACHAT", id: achat.id, reference: achat.reference });
    }
  }

  const lotIdNum = Number(lot.id);
  const draftVenteLignes = await prisma.ligneVente.findMany({
    where: {
      vente: { societeId: sid, statut: "BROUILLON" },
      OR: [
        { lotsConsumed: { contains: `"lotId":${lotIdNum}` } },
        { lotsConsumed: { contains: `"lotId": ${lotIdNum}` } },
      ],
    },
    select: {
      vente: { select: { id: true, reference: true } },
    },
    take: 10,
  });
  const seenVentes = new Set();
  for (const row of draftVenteLignes) {
    const v = row.vente;
    if (!v || seenVentes.has(v.id)) continue;
    seenVentes.add(v.id);
    draftDocuments.push({ type: "VENTE", id: v.id, reference: v.reference });
  }

  return {
    lotId: lot.id,
    numero: lot.numero,
    quantiteRestante: Number(lot.quantiteRestante) || 0,
    hasStockRestant: Number(lot.quantiteRestante) > 0,
    hasDraftDocuments: draftDocuments.length > 0,
    draftDocuments,
  };
}

module.exports = {
  listLots,
  listLotsExpiringSoon,
  exportLotsExpiring,
  getHistoriqueLot,
  getLotTraceabilite,
  getLotClientsTraceabilite,
  previewNumeroLot,
  generateNumeroLot,
  getLot,
  createLot,
  updateLot,
  deactivateLot,
  deleteLot,
  getDeactivateWarnings,
  pickAllocation,
  previewPickAllocation,
  executeSortieLots,
  consumeLotsInTransaction,
  transferLotsBetweenDepots,
  sumLotQuantiteRestante,
  ensureStockCoveredByLots,
  attachLotsToLignes,
  legacyLotNumero,
  lotOrderBy,
  compareLotFefo,
  sortLotsFefo,
  lotWhereAvailable,
  listRappels,
  declencherRappel,
  notifierClientsLot,
  updateStatutRappel,
};
