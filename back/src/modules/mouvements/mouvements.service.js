const prisma = require("../../config/database");
const { createAudit } = require("../../utils/auditHelper");
const { getSocieteWhere } = require("../../utils/societeScope");
const { assertArticleActif } = require("../articles/articles.service");
const { checkEmplacementCompatibility } = require("../../utils/emplacementCompatibility");
const { syncAlerteStockAfterQtyChange } = require("../../utils/stockAlertUtils");
const {
  resolveOperableDepot,
  assertDepotOperable,
  assertEmplacementOperable,
  assertInboundCapacity,
} = require("../../utils/warehouseOps");

const MOUVEMENT_TYPES = {
  ENTREE_ACHAT: "ENTREE_ACHAT",
  ENTREE_RETOUR_CLIENT: "ENTREE_RETOUR_CLIENT",
  ENTREE_AJUSTEMENT: "ENTREE_AJUSTEMENT",
  SORTIE_VENTE: "SORTIE_VENTE",
  SORTIE_PERTE: "SORTIE_PERTE",
  SORTIE_CASSE: "SORTIE_CASSE",
  SORTIE_AUTRE: "SORTIE_AUTRE",
  SORTIE_RETOUR_FOURNISSEUR: "SORTIE_RETOUR_FOURNISSEUR",
  RETOUR_FOURNISSEUR: "RETOUR_FOURNISSEUR",
  TRANSFERT: "TRANSFERT",
  TRANSFERT_EMPLACEMENT: "TRANSFERT_EMPLACEMENT",
};

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function resolveDepot(tx, societeId, depotId) {
  const depot = await resolveOperableDepot(tx, societeId, depotId);
  return depot.id;
}

/** Quantité totale en stock pour un article/dépôt (tous emplacements). */
async function sumStockQuantite(tx, articleId, depotId, emplacementId = undefined) {
  const where = { articleId: Number(articleId), depotId: Number(depotId) };
  if (emplacementId !== undefined) {
    where.emplacementId = emplacementId;
  }
  const agg = await tx.stock.aggregate({
    where,
    _sum: { quantite: true },
  });
  return round2(Number(agg._sum.quantite ?? 0));
}

/** Quantité libre = stock physique − déjà réservé (commandes web en attente). */
async function sumStockDisponible(tx, articleId, depotId) {
  const where = { articleId: Number(articleId), depotId: Number(depotId) };
  const rows = await tx.stock.findMany({
    where,
    select: { quantite: true, qteReservee: true },
  });
  let dispo = 0;
  for (const r of rows) {
    dispo += Math.max(0, Number(r.quantite || 0) - Number(r.qteReservee || 0));
  }
  return round2(dispo);
}

/**
 * Réserve une quantité sur le dépôt (incrémente qteReservee).
 * Ne modifie pas quantite physique.
 */
async function reserveStock(tx, { articleId, depotId, quantite }) {
  const aid = Number(articleId);
  const did = Number(depotId);
  const q = round2(Number(quantite));
  if (!(q > 0)) return null;

  const dispo = await sumStockDisponible(tx, aid, did);
  if (dispo + 1e-6 < q) {
    const err = new Error(
      `Stock disponible insuffisant pour réservation (dispo : ${dispo}, demandé : ${q})`
    );
    err.status = 409;
    err.code = "STOCK_INSUFFISANT";
    throw err;
  }

  let row = await tx.stock.findFirst({
    where: { articleId: aid, depotId: did, emplacementId: null },
  });
  if (!row) {
    row = await tx.stock.findFirst({
      where: { articleId: aid, depotId: did, quantite: { gt: 0 } },
      orderBy: { quantite: "desc" },
    });
  }
  if (!row) {
    const err = new Error("Ligne stock introuvable pour réservation");
    err.status = 409;
    err.code = "STOCK_INSUFFISANT";
    throw err;
  }

  return tx.stock.update({
    where: { id: row.id },
    data: { qteReservee: round2(Number(row.qteReservee || 0) + q) },
  });
}

/** Libère une réservation (décrémente qteReservee, plancher 0). */
async function releaseStockReservation(tx, { articleId, depotId, quantite }) {
  const aid = Number(articleId);
  const did = Number(depotId);
  let remaining = round2(Number(quantite));
  if (!(remaining > 0)) return;

  const rows = await tx.stock.findMany({
    where: { articleId: aid, depotId: did, qteReservee: { gt: 0 } },
    orderBy: [{ emplacementId: "asc" }, { id: "asc" }],
  });

  for (const row of rows) {
    if (remaining <= 1e-9) break;
    const reserved = Number(row.qteReservee || 0);
    if (reserved <= 0) continue;
    const take = Math.min(reserved, remaining);
    await tx.stock.update({
      where: { id: row.id },
      data: { qteReservee: round2(reserved - take) },
    });
    remaining = round2(remaining - take);
  }
}

/** Libère les réservations d'une vente brouillon (lignes × dépôt). */
async function releaseVenteReservations(tx, vente) {
  if (!vente?.depotId || !vente.lignes?.length) return;
  for (const l of vente.lignes) {
    const q = Math.abs(Number(l.quantite) || 0);
    if (q > 0) {
      await releaseStockReservation(tx, {
        articleId: l.articleId,
        depotId: vente.depotId,
        quantite: q,
      });
    }
  }
}

/** Pose les réservations d'une vente brouillon. */
async function reserveVenteLignes(tx, { depotId, lignes }) {
  const did = Number(depotId);
  for (const l of lignes || []) {
    const q = Number(l.quantite) || 0;
    if (q > 0) {
      await reserveStock(tx, { articleId: l.articleId, depotId: did, quantite: q });
    }
  }
}

/** Sortie sans emplacement cible : prélève sur les lignes existantes (emplacement null en priorité). */
async function adjustStockSortieDepot(tx, { articleId, depotId, delta }) {
  const aid = Number(articleId);
  const did = Number(depotId);
  const sortie = Math.abs(Number(delta));

  const rows = await tx.stock.findMany({
    where: { articleId: aid, depotId: did, quantite: { gt: 0 } },
  });

  const total = rows.reduce((s, r) => s + Number(r.quantite), 0);
  if (total + Number(delta) < -1e-9) {
    const err = new Error("Stock insuffisant");
    err.status = 400;
    throw err;
  }
  if (rows.length === 0) {
    const err = new Error("Stock insuffisant (ligne inexistante)");
    err.status = 400;
    throw err;
  }

  const sorted = [...rows].sort((a, b) => {
    if (a.emplacementId == null && b.emplacementId != null) return -1;
    if (b.emplacementId == null && a.emplacementId != null) return 1;
    // FIFO déterministe : la ligne la plus ancienne (dateLastMvt la plus vieille,
    // ou id le plus bas si jamais mouvementée) est consommée en premier
    const da = a.dateLastMvt ? new Date(a.dateLastMvt).getTime() : 0;
    const db = b.dateLastMvt ? new Date(b.dateLastMvt).getTime() : 0;
    if (da !== db) return da - db;
    return a.id - b.id;
  });

  let remaining = sortie;
  let lastUpdated = null;
  for (const row of sorted) {
    if (remaining <= 1e-9) break;
    const q = Number(row.quantite);
    if (q <= 0) continue;
    const take = Math.min(q, remaining);
    lastUpdated = await tx.stock.update({
      where: { id: row.id },
      data: { quantite: round2(q - take), dateLastMvt: new Date() },
    });
    remaining = round2(remaining - take);
  }

  if (remaining > 1e-6) {
    const err = new Error("Stock insuffisant");
    err.status = 400;
    throw err;
  }
  return lastUpdated;
}

async function adjustStock(tx, { societeId, articleId, depotId, emplacementId = null, delta }) {
  const sid = Number(societeId);
  const aid = Number(articleId);
  const did = Number(depotId);
  const qtyDelta = Number(delta);

  const emp = emplacementId == null || emplacementId === "" ? null : Number(emplacementId);

  if (qtyDelta > 0) {
    if (emp) {
      await assertEmplacementOperable(tx, { id: emp, depotId: did, societeId: sid });
      const compat = await checkEmplacementCompatibility(aid, emp, sid);
      if (!compat.ok) {
        const err = new Error(compat.message);
        err.status = 409;
        throw err;
      }
    } else {
      await assertDepotOperable(tx, { id: did, societeId: sid });
    }
    await assertInboundCapacity(tx, {
      societeId: sid,
      articleId: aid,
      depotId: did,
      emplacementId: emp,
      deltaQty: qtyDelta,
    });
  } else {
    await assertDepotOperable(tx, { id: did, societeId: sid });
    if (emp) await assertEmplacementOperable(tx, { id: emp, depotId: did, societeId: sid });
  }

  // Sortie sans emplacement précis : agréger sur tout le dépôt (emplacementId null ou renseigné).
  const art = await tx.article.findFirst({ where: { id: aid, societeId: sid } });
  if (!art) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  const dep = await tx.depot.findFirst({ where: { id: did, societeId: sid } });
  if (!dep) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }

  if (emp == null && Number(delta) < 0) {
    const updated = await adjustStockSortieDepot(tx, { articleId: aid, depotId: did, delta });
    await syncAlerteStockAfterQtyChange(tx, { societeId: sid, articleId: aid, depotId: did });
    return updated;
  }

  if (emp) {
    const em = await tx.emplacement.findFirst({ where: { id: emp, depotId: did } });
    if (!em) {
      const err = new Error("Emplacement introuvable pour ce depot");
      err.status = 404;
      throw err;
    }
  }

  const whereStock = { articleId: aid, depotId: did, emplacementId: emp };
  let row = await tx.stock.findFirst({ where: whereStock });
  if (!row) {
    if (delta < 0) {
      const disponible = await sumStockQuantite(tx, aid, did);
      if (disponible + Number(delta) >= -1e-9 && disponible > 0) {
        const updated = await adjustStockSortieDepot(tx, { articleId: aid, depotId: did, delta });
        await syncAlerteStockAfterQtyChange(tx, { societeId: sid, articleId: aid, depotId: did });
        return updated;
      }
      const err = new Error("Stock insuffisant (ligne inexistante)");
      err.status = 400;
      throw err;
    }
    row = await tx.stock.create({
      data: { articleId: aid, depotId: did, emplacementId: emp, quantite: 0 },
    });
  }
  const next = round2(Number(row.quantite) + Number(delta));
  if (next < -1e-9) {
    const err = new Error("Stock insuffisant");
    err.status = 400;
    throw err;
  }
  const updated = await tx.stock.update({
    where: { id: row.id },
    data: { quantite: next, dateLastMvt: new Date() },
  });
  await syncAlerteStockAfterQtyChange(tx, { societeId: sid, articleId: aid, depotId: did });
  return updated;
}

async function insertMouvement(tx, payload) {
  const {
    reference,
    type,
    articleId,
    depotId,
    depotDestId,
    emplacementId,
    emplacementDestId,
    quantite,
    valeur,
    utilisateurId,
    commentaire,
    lotId,
    lotsDetail,
    statut,
  } = payload;
  return tx.mouvement.create({
    data: {
      reference,
      type,
      articleId: Number(articleId),
      depotId: Number(depotId),
      depotDestId: depotDestId != null ? Number(depotDestId) : null,
      emplacementId: emplacementId != null ? Number(emplacementId) : null,
      emplacementDestId: emplacementDestId != null ? Number(emplacementDestId) : null,
      quantite: Math.abs(Number(quantite)),
      valeur: valeur != null ? round2(valeur) : null,
      utilisateurId: Number(utilisateurId),
      commentaire: commentaire || null,
      lotId: lotId != null ? Number(lotId) : null,
      lotsDetail: lotsDetail != null ? String(lotsDetail) : null,
      statut: statut || "VALIDE",
    },
    include: {
      article: { select: { code: true, libelle: true, unite: true } },
      depot: { select: { code: true, libelle: true } },
      depotDest: { select: { code: true, libelle: true } },
      emplacement: { select: { code: true, libelle: true } },
      emplacementDest: { select: { code: true, libelle: true } },
      lot: { select: { id: true, numero: true } },
    },
  });
}

function genRef(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const ENTREE_TYPES = ["ENTREE_ACHAT", "ENTREE_RETOUR_CLIENT", "ENTREE_AJUSTEMENT"];
const SORTIE_TYPES = [
  "SORTIE_VENTE",
  "SORTIE_PERTE",
  "SORTIE_CASSE",
  "SORTIE_AUTRE",
  "SORTIE_RETOUR_FOURNISSEUR",
];
const TRANSFERT_TYPES = ["TRANSFERT", "TRANSFERT_EMPLACEMENT"];

/**
 * Filtre liste / export mouvements (dateFrom/dateTo alias de from/to).
 * @param {object} opts
 */
function buildMouvementWhere(user, opts) {
  const { societeId: sid } = getSocieteWhere(user);
  const {
    type,
    depotId,
    articleId,
    from,
    to,
    dateFrom,
    dateTo,
    search,
    group,
  } = opts;

  const fromIso = dateFrom || from;
  const toIso = dateTo || to;

  let typeFilter = {};
  if (type) {
    typeFilter = { type: String(type) };
  } else if (group === "ENTREE") {
    typeFilter = { type: { in: ENTREE_TYPES } };
  } else if (group === "SORTIE") {
    typeFilter = { type: { in: SORTIE_TYPES } };
  } else if (group === "TRANSFERT") {
    typeFilter = { type: { in: TRANSFERT_TYPES } };
  }

  const searchTrim = search && String(search).trim();
  const searchFilter = searchTrim
    ? { commentaire: { contains: searchTrim, mode: "insensitive" } }
    : {};

  return {
    article: { societeId: sid },
    ...typeFilter,
    ...(depotId ? { depotId: Number(depotId) } : {}),
    ...(articleId ? { articleId: Number(articleId) } : {}),
    ...(fromIso || toIso
      ? {
          createdAt: {
            ...(fromIso ? { gte: new Date(fromIso) } : {}),
            ...(toIso ? { lte: new Date(toIso) } : {}),
          },
        }
      : {}),
    ...searchFilter,
  };
}

async function listMouvements(
  user,
  { type, depotId, articleId, from, to, dateFrom, dateTo, search, group, page = 1, limit = 25 }
) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;

  const where = buildMouvementWhere(user, {
    type,
    depotId,
    articleId,
    from,
    to,
    dateFrom,
    dateTo,
    search,
    group,
  });

  const [items, total] = await Promise.all([
    prisma.mouvement.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        article: { select: { id: true, code: true, libelle: true, unite: true, imageUrl: true } },
        depot: { select: { code: true, libelle: true } },
        depotDest: { select: { code: true, libelle: true } },
        emplacement: { select: { code: true, libelle: true } },
        emplacementDest: { select: { code: true, libelle: true } },
        lot: { select: { id: true, numero: true } },
        utilisateur: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    }),
    prisma.mouvement.count({ where }),
  ]);

  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

const EXPORT_INCLUDE = {
  article: { select: { id: true, code: true, libelle: true, unite: true, imageUrl: true } },
  depot: { select: { code: true, libelle: true } },
  depotDest: { select: { code: true, libelle: true } },
  emplacement: { select: { code: true, libelle: true } },
  emplacementDest: { select: { code: true, libelle: true } },
  lot: { select: { id: true, numero: true } },
  utilisateur: { select: { id: true, nom: true, prenom: true, email: true } },
};

/**
 * Export CSV/PDF : toutes les lignes correspondant aux filtres (plafonné).
 */
async function exportMouvements(user, query) {
  const where = buildMouvementWhere(user, query);
  const take = Math.min(10000, Math.max(1, Number(query.limitExport) || 10000));
  return prisma.mouvement.findMany({
    where,
    take,
    orderBy: { createdAt: "desc" },
    include: EXPORT_INCLUDE,
  });
}

function montantPourSeuil(quantite, coutUnitaire, valeurCorps) {
  const calcule = round2(Number(quantite) * Number(coutUnitaire || 0));
  if (valeurCorps === undefined || valeurCorps === null || valeurCorps === "") return calcule;
  const envoye = Number(valeurCorps);
  if (!Number.isFinite(envoye)) return calcule;
  return Math.max(calcule, round2(envoye));
}

async function coutUnitairePourSeuil(tx, societeId, articleId, depotId) {
  const valuationService = require("../valuation/valuation.service");
  let cout = 0;
  try {
    cout = Number(
      await valuationService.getCoutUnitaireCourant(tx, {
        societeId,
        articleId,
        depotId,
      })
    );
  } catch {
    cout = 0;
  }
  if (cout > 0) return round2(cout);
  const art = await tx.article.findFirst({
    where: { id: Number(articleId), societeId: Number(societeId) },
    select: { prixAchat: true },
  });
  return round2(Number(art?.prixAchat || 0));
}

async function evaluerSeuilValidation(tx, societeId, { articleId, depotId, quantite, valeur }) {
  const cout = await coutUnitairePourSeuil(tx, societeId, articleId, depotId);
  const montant = montantPourSeuil(quantite, cout, valeur);
  const societe = await tx.societe.findFirst({
    where: { id: Number(societeId) },
    select: { seuilValidationMouvement: true },
  });
  const brut = societe?.seuilValidationMouvement;
  if (brut == null || !(Number(brut) > 0)) {
    return { depasse: false, montant, seuil: brut == null ? 0 : Number(brut) };
  }
  const seuil = Number(brut);
  return { depasse: montant > seuil, montant, seuil };
}

const ROLES_VALIDATION_MOUVEMENT = new Set(["RESPONSABLE", "ADMIN", "SUPER_ADMIN"]);

function refuserRoleValidation(user) {
  if (ROLES_VALIDATION_MOUVEMENT.has(user?.role)) return;
  const err = new Error("Action non autorisée");
  err.status = 403;
  throw err;
}

async function appliquerEntreeStock(tx, { societeId, articleId, depotId, emplacementId, quantite }) {
  await adjustStock(tx, {
    societeId,
    articleId,
    depotId,
    emplacementId,
    delta: Number(quantite),
  });
  const lotsService = require("../lots/lots.service");
  const valuationService = require("../valuation/valuation.service");
  await lotsService.ensureStockCoveredByLots(tx, { articleId, depotId });
  await valuationService.ensureStockCoveredByCouches(tx, { societeId, articleId, depotId });
}

async function appliquerSortieStock(tx, { societeId, articleId, depotId, emplacementId, quantite }) {
  await adjustStock(tx, {
    societeId,
    articleId,
    depotId,
    emplacementId,
    delta: -Number(quantite),
  });
}

async function appliquerTransfertStock(tx, { societeId, articleId, depotOrigineId, depotDestId, quantite }) {
  const q = Number(quantite);
  await module.exports.adjustStock(tx, { societeId, articleId, depotId: depotOrigineId, emplacementId: null, delta: -q });
  await module.exports.adjustStock(tx, { societeId, articleId, depotId: depotDestId, emplacementId: null, delta: q });
  const lotsService = require("../lots/lots.service");
  return lotsService.transferLotsBetweenDepots(tx, {
    articleId,
    depotOrigineId,
    depotDestId,
    quantite: q,
  });
}

async function appliquerTransfertEmplacementStock(
  tx,
  { societeId, articleId, depotOrigineId, emplacementOrigineId, depotDestId, emplacementDestId, quantite }
) {
  const q = Number(quantite);
  await module.exports.adjustStock(tx, {
    societeId,
    articleId,
    depotId: depotOrigineId,
    emplacementId: emplacementOrigineId,
    delta: -q,
  });
  await module.exports.adjustStock(tx, {
    societeId,
    articleId,
    depotId: depotDestId,
    emplacementId: emplacementDestId,
    delta: q,
  });
  if (Number(depotOrigineId) === Number(depotDestId)) return { lotsTransferred: [] };
  const lotsService = require("../lots/lots.service");
  return lotsService.transferLotsBetweenDepots(tx, {
    articleId,
    depotOrigineId,
    depotDestId,
    quantite: q,
  });
}

async function noterMouvementEnAttente(user, mvt, montant, seuil) {
  await createAudit({
    userId: user.id,
    societeId: Number(user.societeId),
    action: "CREATE",
    entite: "Mouvement",
    entiteId: mvt.id,
    module: "mouvements",
    description: `Mouvement ${mvt.reference} mis en attente de validation (${montant} DT > seuil ${seuil} DT)`,
    nouvelleValeur: "EN_ATTENTE_VALIDATION",
  });
}

async function createEntree(user, body) {
  const { articleId, depotId, emplacementId, quantite, type, commentaire, valeur } = body;
  const q = Number(quantite);
  if (!Number(articleId) || q <= 0) {
    const err = new Error("articleId et quantite > 0 requis");
    err.status = 400;
    throw err;
  }
  const mtype = type && MOUVEMENT_TYPES[type] ? type : "ENTREE_AJUSTEMENT";

  await assertArticleActif(articleId, user.societeId);

  return prisma.$transaction(async (tx) => {
    const depId = await resolveDepot(tx, user.societeId, depotId);
    if (mtype === MOUVEMENT_TYPES.ENTREE_AJUSTEMENT) {
      const decision = await evaluerSeuilValidation(tx, user.societeId, {
        articleId,
        depotId: depId,
        quantite: q,
        valeur,
      });
      if (decision.depasse) {
        const mvt = await insertMouvement(tx, {
          reference: genRef(`MVT-${mtype}`),
          type: mtype,
          articleId,
          depotId: depId,
          emplacementId,
          quantite: q,
          valeur: decision.montant,
          utilisateurId: user.id,
          commentaire,
          statut: "EN_ATTENTE_VALIDATION",
        });
        await noterMouvementEnAttente(user, mvt, decision.montant, decision.seuil);
        return mvt;
      }
    }
    await appliquerEntreeStock(tx, {
      societeId: user.societeId,
      articleId,
      depotId: depId,
      emplacementId,
      quantite: q,
    });
    return insertMouvement(tx, {
      reference: genRef(`MVT-${mtype}`),
      type: mtype,
      articleId,
      depotId: depId,
      quantite: q,
      valeur,
      utilisateurId: user.id,
      commentaire,
    });
  });
}

async function createSortie(user, body) {
  const { articleId, depotId, emplacementId, quantite, type, commentaire, valeur } = body;
  const q = Number(quantite);
  if (!Number(articleId) || q <= 0) {
    const err = new Error("articleId et quantite > 0 requis");
    err.status = 400;
    throw err;
  }
  const mtype =
    type && [MOUVEMENT_TYPES.SORTIE_PERTE, MOUVEMENT_TYPES.SORTIE_CASSE, MOUVEMENT_TYPES.SORTIE_AUTRE].includes(type)
      ? type
      : MOUVEMENT_TYPES.SORTIE_AUTRE;

  await assertArticleActif(articleId, user.societeId);

  return prisma.$transaction(async (tx) => {
    const depId = await resolveDepot(tx, user.societeId, depotId);
    const decision = await evaluerSeuilValidation(tx, user.societeId, {
      articleId,
      depotId: depId,
      quantite: q,
      valeur,
    });
    if (decision.depasse) {
      const mvt = await insertMouvement(tx, {
        reference: genRef(`MVT-${mtype}`),
        type: mtype,
        articleId,
        depotId: depId,
        emplacementId,
        quantite: q,
        valeur: decision.montant,
        utilisateurId: user.id,
        commentaire,
        statut: "EN_ATTENTE_VALIDATION",
      });
      await noterMouvementEnAttente(user, mvt, decision.montant, decision.seuil);
      return mvt;
    }
    await appliquerSortieStock(tx, {
      societeId: user.societeId,
      articleId,
      depotId: depId,
      emplacementId,
      quantite: q,
    });
    return insertMouvement(tx, {
      reference: genRef(`MVT-${mtype}`),
      type: mtype,
      articleId,
      depotId: depId,
      quantite: q,
      valeur,
      utilisateurId: user.id,
      commentaire,
    });
  });
}

async function createTransfert(user, body) {
  const { articleId, depotOrigineId, depotDestId, quantite, commentaire, valeur } = body;
  const q = Number(quantite);
  if (!Number(articleId) || !Number(depotOrigineId) || !Number(depotDestId) || q <= 0) {
    const err = new Error("articleId, depotOrigineId, depotDestId et quantite > 0 requis");
    err.status = 400;
    throw err;
  }
  if (Number(depotOrigineId) === Number(depotDestId)) {
    const err = new Error("Depots source et destination doivent differer");
    err.status = 400;
    throw err;
  }

  await assertArticleActif(articleId, user.societeId);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM Stock WHERE articleId = ${Number(articleId)} AND depotId = ${Number(depotOrigineId)} FOR UPDATE`;

    const sid = Number(user.societeId);
    const [d1, d2] = await Promise.all([
      assertDepotOperable(tx, { id: depotOrigineId, societeId: sid }),
      assertDepotOperable(tx, { id: depotDestId, societeId: sid }),
    ]);
    const decision = await evaluerSeuilValidation(tx, sid, {
      articleId,
      depotId: d1.id,
      quantite: q,
      valeur,
    });
    if (decision.depasse) {
      const mvt = await insertMouvement(tx, {
        reference: genRef("MVT-TRANSFERT"),
        type: MOUVEMENT_TYPES.TRANSFERT,
        articleId,
        depotId: d1.id,
        depotDestId: d2.id,
        quantite: q,
        valeur: decision.montant,
        utilisateurId: user.id,
        commentaire,
        statut: "EN_ATTENTE_VALIDATION",
      });
      await noterMouvementEnAttente(user, mvt, decision.montant, decision.seuil);
      return mvt;
    }
    const { strategy, lotsTransferred } = await appliquerTransfertStock(tx, {
      societeId: sid,
      articleId,
      depotOrigineId: d1.id,
      depotDestId: d2.id,
      quantite: q,
    });

    const mvt = await insertMouvement(tx, {
      reference: genRef("MVT-TRANSFERT"),
      type: MOUVEMENT_TYPES.TRANSFERT,
      articleId,
      depotId: d1.id,
      depotDestId: d2.id,
      quantite: q,
      utilisateurId: user.id,
      commentaire: `${commentaire || ""} — ${strategy} (${lotsTransferred.length} lot(s))`.trim(),
      lotId: lotsTransferred[0]?.lotId || null,
      lotsDetail: lotsTransferred.length ? JSON.stringify(lotsTransferred) : null,
    });
    return { ...mvt, lotsTransferred };
  });
}

/**
 * Transfert de stock entre deux emplacements — même dépôt ou dépôts différents.
 */
async function createTransfertEmplacement(user, body) {
  const { articleId, depotOrigineId, emplacementOrigineId, depotDestId, emplacementDestId, quantite, commentaire, valeur } = body;
  const q = Number(quantite);

  if (!Number(articleId) || !Number(depotOrigineId) || !Number(emplacementOrigineId) || !Number(depotDestId) || !Number(emplacementDestId) || q <= 0) {
    const err = new Error("articleId, emplacementOrigineId, emplacementDestId et quantite > 0 requis");
    err.status = 400;
    throw err;
  }
  if (Number(emplacementOrigineId) === Number(emplacementDestId)) {
    const err = new Error("Les emplacements source et destination doivent différer");
    err.status = 400;
    throw err;
  }

  await assertArticleActif(articleId, user.societeId);

  const compat = await checkEmplacementCompatibility(articleId, emplacementDestId, user.societeId);
  if (!compat.ok) {
    const err = new Error(compat.message);
    err.status = 409;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM Stock WHERE articleId = ${Number(articleId)} AND depotId = ${Number(depotOrigineId)} FOR UPDATE`;

    const sid = Number(user.societeId);

    const [d1, d2, e1, e2] = await Promise.all([
      assertDepotOperable(tx, { id: depotOrigineId, societeId: sid }),
      assertDepotOperable(tx, { id: depotDestId, societeId: sid }),
      assertEmplacementOperable(tx, {
        id: emplacementOrigineId,
        depotId: depotOrigineId,
        societeId: sid,
      }),
      assertEmplacementOperable(tx, {
        id: emplacementDestId,
        depotId: depotDestId,
        societeId: sid,
      }),
    ]);

    const dispo = await sumStockQuantite(tx, articleId, d1.id, e1.id);
    if (dispo < q) {
      const err = new Error(`Stock insuffisant à l'emplacement ${e1.code} (disponible: ${dispo})`);
      err.status = 409;
      throw err;
    }

    const decision = await evaluerSeuilValidation(tx, sid, {
      articleId,
      depotId: d1.id,
      quantite: q,
      valeur,
    });
    if (decision.depasse) {
      const mvt = await insertMouvement(tx, {
        reference: genRef("MVT-EMPL"),
        type: MOUVEMENT_TYPES.TRANSFERT_EMPLACEMENT,
        articleId,
        depotId: d1.id,
        depotDestId: d2.id,
        emplacementId: e1.id,
        emplacementDestId: e2.id,
        quantite: q,
        valeur: decision.montant,
        utilisateurId: user.id,
        commentaire,
        statut: "EN_ATTENTE_VALIDATION",
      });
      await noterMouvementEnAttente(user, mvt, decision.montant, decision.seuil);
      return mvt;
    }

    const { lotsTransferred } = await appliquerTransfertEmplacementStock(tx, {
      societeId: sid,
      articleId,
      depotOrigineId: d1.id,
      emplacementOrigineId: e1.id,
      depotDestId: d2.id,
      emplacementDestId: e2.id,
      quantite: q,
    });

    const mvt = await insertMouvement(tx, {
      reference: genRef("MVT-EMPL"),
      type: MOUVEMENT_TYPES.TRANSFERT_EMPLACEMENT,
      articleId,
      depotId: d1.id,
      depotDestId: d2.id,
      emplacementId: e1.id,
      emplacementDestId: e2.id,
      quantite: q,
      utilisateurId: user.id,
      commentaire,
      lotId: lotsTransferred[0]?.lotId || null,
      lotsDetail: lotsTransferred.length ? JSON.stringify(lotsTransferred) : null,
    });
    return { ...mvt, lotsTransferred };
  });
}

async function chargerMouvementATrancher(tx, id, societeId) {
  const mid = Number(id);
  const sid = Number(societeId);
  const pending = await tx.mouvement.findFirst({
    where: { id: mid, statut: "EN_ATTENTE_VALIDATION", article: { societeId: sid } },
  });
  if (pending) return pending;

  const existant = await tx.mouvement.findFirst({
    where: { id: mid },
    include: { article: { select: { societeId: true } } },
  });
  if (!existant || Number(existant.article?.societeId) !== sid) {
    const err = new Error("Mouvement introuvable");
    err.status = 404;
    throw err;
  }
  const err = new Error("Mouvement déjà traité");
  err.status = 409;
  throw err;
}

async function assertStockPourValidation(tx, mvt) {
  if (mvt.type === MOUVEMENT_TYPES.ENTREE_AJUSTEMENT) return;
  const q = Number(mvt.quantite);
  const dispo =
    mvt.type === MOUVEMENT_TYPES.TRANSFERT_EMPLACEMENT || mvt.emplacementId != null
      ? await sumStockQuantite(tx, mvt.articleId, mvt.depotId, mvt.emplacementId)
      : await sumStockQuantite(tx, mvt.articleId, mvt.depotId);
  if (dispo + 1e-9 < q) {
    const err = new Error("Stock insuffisant");
    err.status = 400;
    throw err;
  }
}

async function reclamerStatut(tx, id, data) {
  const maj = await tx.mouvement.updateMany({
    where: { id: Number(id), statut: "EN_ATTENTE_VALIDATION" },
    data,
  });
  if (maj.count !== 1) {
    const err = new Error("Mouvement déjà traité");
    err.status = 409;
    throw err;
  }
}

async function ecrireLotsValides(tx, mouvementId, resultat) {
  const lotsTransferred = resultat?.lotsTransferred || [];
  await tx.mouvement.update({
    where: { id: Number(mouvementId) },
    data: {
      lotId: lotsTransferred[0]?.lotId || null,
      lotsDetail: lotsTransferred.length ? JSON.stringify(lotsTransferred) : null,
    },
  });
}

async function rejouerEffetMouvement(tx, mvt, societeId) {
  const commun = {
    societeId,
    articleId: mvt.articleId,
    quantite: mvt.quantite,
  };
  if (mvt.type === MOUVEMENT_TYPES.ENTREE_AJUSTEMENT) {
    await appliquerEntreeStock(tx, {
      ...commun,
      depotId: mvt.depotId,
      emplacementId: mvt.emplacementId,
    });
    return null;
  }
  if (
    mvt.type === MOUVEMENT_TYPES.SORTIE_PERTE ||
    mvt.type === MOUVEMENT_TYPES.SORTIE_CASSE ||
    mvt.type === MOUVEMENT_TYPES.SORTIE_AUTRE
  ) {
    await appliquerSortieStock(tx, {
      ...commun,
      depotId: mvt.depotId,
      emplacementId: mvt.emplacementId,
    });
    return null;
  }
  if (mvt.type === MOUVEMENT_TYPES.TRANSFERT) {
    return appliquerTransfertStock(tx, {
      ...commun,
      depotOrigineId: mvt.depotId,
      depotDestId: mvt.depotDestId,
    });
  }
  if (mvt.type === MOUVEMENT_TYPES.TRANSFERT_EMPLACEMENT) {
    return appliquerTransfertEmplacementStock(tx, {
      ...commun,
      depotOrigineId: mvt.depotId,
      emplacementOrigineId: mvt.emplacementId,
      depotDestId: mvt.depotDestId,
      emplacementDestId: mvt.emplacementDestId,
    });
  }
  const err = new Error("Type de mouvement non validable");
  err.status = 400;
  throw err;
}

function auteurBloque(user, mvt) {
  return (
    Number(mvt.utilisateurId) === Number(user.id) &&
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN"
  );
}

async function tracerDecision(user, mvt, statut, propre) {
  await createAudit({
    userId: user.id,
    societeId: Number(user.societeId),
    action: statut === "VALIDE" ? "VALIDATE" : "REJECT",
    entite: "Mouvement",
    entiteId: mvt.id,
    module: "mouvements",
    description: propre
      ? `Validation de son propre mouvement ${mvt.reference}`
      : `${statut === "VALIDE" ? "Validation" : "Rejet"} du mouvement ${mvt.reference}`,
    ancienneValeur: "EN_ATTENTE_VALIDATION",
    nouvelleValeur: statut,
  });
}

async function validerMouvement(user, id) {
  refuserRoleValidation(user);
  return prisma.$transaction(async (tx) => {
    const mvt = await chargerMouvementATrancher(tx, id, user.societeId);
    if (auteurBloque(user, mvt)) {
      const err = new Error("Vous ne pouvez pas valider votre propre mouvement");
      err.status = 403;
      throw err;
    }
    await assertStockPourValidation(tx, mvt);
    await reclamerStatut(tx, mvt.id, { statut: "VALIDE" });
    const resultat = await rejouerEffetMouvement(tx, mvt, user.societeId);
    if (resultat) await ecrireLotsValides(tx, mvt.id, resultat);
    const propre = Number(mvt.utilisateurId) === Number(user.id);
    await tracerDecision(user, mvt, "VALIDE", propre);
    return {
      ...mvt,
      statut: "VALIDE",
      lotsTransferred: resultat?.lotsTransferred || [],
    };
  });
}

function commentaireApresRejet(ancien, motif) {
  const base = ancien == null ? "" : String(ancien).trim();
  if (!base) return `Rejet : ${motif}`;
  return `${base} | Rejet : ${motif}`;
}

async function rejeterMouvement(user, id, body = {}) {
  refuserRoleValidation(user);
  const motif =
    body.commentaire != null && String(body.commentaire).trim() !== ""
      ? String(body.commentaire).trim()
      : undefined;
  return prisma.$transaction(async (tx) => {
    const mvt = await chargerMouvementATrancher(tx, id, user.societeId);
    const commentaire = motif ? commentaireApresRejet(mvt.commentaire, motif) : undefined;
    await reclamerStatut(tx, mvt.id, {
      statut: "REJETE",
      ...(commentaire ? { commentaire } : {}),
    });
    await tracerDecision(user, mvt, "REJETE", false);
    return { ...mvt, statut: "REJETE", commentaire: commentaire || mvt.commentaire };
  });
}

module.exports = {
  MOUVEMENT_TYPES,
  listMouvements,
  createEntree,
  createSortie,
  createTransfert,
  createTransfertEmplacement,
  validerMouvement,
  rejeterMouvement,
  adjustStock,
  sumStockQuantite,
  sumStockDisponible,
  reserveStock,
  releaseStockReservation,
  releaseVenteReservations,
  reserveVenteLignes,
  insertMouvement,
  resolveDepot,
  genRef,
  exportMouvements,
};