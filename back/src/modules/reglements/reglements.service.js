const prisma = require("../../config/database");
const { getSocieteWhere } = require("../../utils/societeScope");

function monthRange(offset = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

const MOIS_FR = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

async function buildChartFlux6Mois(sid) {
  const now = new Date();
  const points = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const [enc, pay] = await Promise.all([
      prisma.reglement.aggregate({
        where: {
          vente: { societeId: sid },
          statut: { in: ["VALIDE", "EN_ATTENTE"] },
          datePayment: { gte: start, lte: end },
        },
        _sum: { montant: true },
      }),
      prisma.reglementAchat.aggregate({
        where: {
          achat: { societeId: sid },
          statut: { in: ["VALIDE", "EN_ATTENTE"] },
          datePayment: { gte: start, lte: end },
        },
        _sum: { montant: true },
      }),
    ]);
    points.push({
      mois: MOIS_FR[d.getMonth()],
      encaisse: Number(enc._sum.montant || 0),
      paye: Number(pay._sum.montant || 0),
    });
  }
  return points;
}

function buildDateFilter(dateDebut, dateFin) {
  if (!dateDebut && !dateFin) return {};
  const filter = {};
  if (dateDebut) filter.gte = new Date(String(dateDebut));
  if (dateFin) {
    const d = new Date(String(dateFin));
    d.setHours(23, 59, 59, 999);
    filter.lte = d;
  }
  return { datePayment: filter };
}

async function assertVenteSociete(venteId, societeId) {
  const v = await prisma.vente.findFirst({
    where: { id: Number(venteId), societeId: Number(societeId) },
  });
  if (!v) {
    const err = new Error("Vente introuvable");
    err.status = 404;
    throw err;
  }
  return v;
}

async function assertAchatSociete(achatId, societeId) {
  const a = await prisma.achat.findFirst({
    where: { id: Number(achatId), societeId: Number(societeId) },
  });
  if (!a) {
    const err = new Error("Achat introuvable");
    err.status = 404;
    throw err;
  }
  return a;
}

/**
 * Recalcule et persiste Vente.statutPaiement / montantRegle,
 * puis synchronise Facture.statut (EMISE | PARTIELLEMENT_PAYEE | PAYEE).
 * Ne touche pas aux factures d'avoir (statut AVOIR).
 */
async function syncVentePaiement(tx, venteId, societeId) {
  const sum = await tx.reglement.aggregate({
    where: { venteId: Number(venteId), statut: { in: ["VALIDE", "EN_ATTENTE"] } },
    _sum: { montant: true },
  });
  const total = Number(sum._sum.montant || 0);
  const vente = await tx.vente.findFirst({
    where: { id: Number(venteId), societeId: Number(societeId) },
  });
  const ttc = Number(vente?.totalTTC || 0);
  let statutPaiement = "NON_REGLE";
  if (total >= ttc - 1e-6) statutPaiement = "REGLE";
  else if (total > 0) statutPaiement = "PARTIEL";

  const maj = await tx.vente.updateMany({
    where: { id: Number(venteId), societeId: Number(societeId) },
    data: { montantRegle: total, statutPaiement },
  });
  if (maj.count !== 1) {
    const err = new Error("Vente introuvable");
    err.status = 404;
    throw err;
  }

  let statutFacture = null;
  const facture = await tx.facture.findFirst({
    where: { venteId: Number(venteId), societeId: Number(societeId) },
  });
  if (facture && String(facture.statut).toUpperCase() !== "AVOIR") {
    const factureTtc = Number(facture.montantTTC || ttc);
    if (total >= factureTtc - 1e-6) statutFacture = "PAYEE";
    else if (total > 0) statutFacture = "PARTIELLEMENT_PAYEE";
    else statutFacture = "EMISE";

    if (facture.statut !== statutFacture) {
      await tx.facture.update({
        where: { id: facture.id },
        data: { statut: statutFacture },
      });
    }
  }

  return { totalRegle: total, statutPaiement, statutFacture };
}

async function syncAchatPaiement(tx, achatId) {
  const sum = await tx.reglementAchat.aggregate({
    where: { achatId: Number(achatId), statut: { in: ["VALIDE", "EN_ATTENTE"] } },
    _sum: { montant: true },
  });
  const total = Number(sum._sum.montant || 0);
  const achat = await tx.achat.findUnique({ where: { id: Number(achatId) } });
  const ttc = Number(achat.totalTTC);
  let statutPaiement = "NON_REGLE";
  if (total >= ttc - 1e-6) statutPaiement = "REGLE";
  else if (total > 0) statutPaiement = "PARTIEL";
  await tx.achat.update({
    where: { id: Number(achatId) },
    data: { montantRegle: total, statutPaiement },
  });
}

async function listVenteReglements(venteId, societeId) {
  await assertVenteSociete(venteId, societeId);
  return prisma.reglement.findMany({
    where: { venteId: Number(venteId) },
    orderBy: { datePayment: "desc" },
  });
}

function parseOptionalDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveReference(mode, data) {
  if (data.reference?.trim()) return data.reference.trim();
  if (mode === "CHEQUE") return data.numeroCheque?.trim() || null;
  if (mode === "VIREMENT") return data.referenceVirement?.trim() || null;
  if (mode === "EFFET") return data.referenceEffet?.trim() || null;
  if (mode === "CARTE") return data.referenceTransaction?.trim() || null;
  return null;
}

function validateReglementMode(mode, data) {
  const m = String(mode || "").toUpperCase();
  if (m === "CHEQUE" && !data.numeroCheque?.trim()) {
    const err = new Error("Numéro de chèque requis");
    err.status = 400;
    throw err;
  }
  if (m === "VIREMENT" && !data.referenceVirement?.trim()) {
    const err = new Error("Référence de virement requise");
    err.status = 400;
    throw err;
  }
  if (m === "EFFET") {
    if (!data.referenceEffet?.trim()) {
      const err = new Error("Référence de l'effet requise");
      err.status = 400;
      throw err;
    }
    if (!data.dateEcheance) {
      const err = new Error("Date d'échéance requise pour un effet");
      err.status = 400;
      throw err;
    }
  }
  if (m === "AUTRE" && !data.descriptionAutre?.trim()) {
    const err = new Error('Description requise pour le mode "Autre"');
    err.status = 400;
    throw err;
  }
}

function buildReglementCreateData(data, parentKey, parentId) {
  const mode = String(data.mode || "VIREMENT").toUpperCase();
  validateReglementMode(mode, data);
  const datePayment = data.datePayment || data.dateReglement;
  return {
    [parentKey]: parentId,
    montant: Number(data.montant),
    datePayment: datePayment ? new Date(datePayment) : new Date(),
    reference: resolveReference(mode, data),
    mode,
    statut: data.statut || "VALIDE",
    commentaire: data.commentaire?.trim() || null,
    numeroCheque: mode === "CHEQUE" ? data.numeroCheque?.trim() || null : null,
    banque: data.banque?.trim() || null,
    dateEcheance: parseOptionalDate(data.dateEcheance),
    referenceVirement: mode === "VIREMENT" ? data.referenceVirement?.trim() || null : null,
    dateValeur: parseOptionalDate(data.dateValeur),
    referenceTransaction: mode === "CARTE" ? data.referenceTransaction?.trim() || null : null,
    referenceEffet: mode === "EFFET" ? data.referenceEffet?.trim() || null : null,
    descriptionAutre: mode === "AUTRE" ? data.descriptionAutre?.trim() || null : null,
    pieceJointeUrl: data.pieceJointeUrl?.trim() || null,
  };
}

async function createReglementWithOptionalFields(createFn, baseData) {
  const extendedKeys = [
    "commentaire",
    "numeroCheque",
    "banque",
    "dateEcheance",
    "referenceVirement",
    "dateValeur",
    "referenceTransaction",
    "referenceEffet",
    "descriptionAutre",
    "pieceJointeUrl",
  ];
  try {
    return await createFn(baseData);
  } catch (e) {
    const msg = String(e?.message || "");
    if (!msg.includes("Unknown argument")) throw e;
    const fallback = { ...baseData };
    for (const k of extendedKeys) delete fallback[k];
    return createFn(fallback);
  }
}

async function createVenteReglement(data, societeId) {
  const vente = await assertVenteSociete(data.venteId, societeId);
  // CONFIRME = statut actuel après confirmation ; VALIDE/LIVRE/FACTUREE = legacy
  const STATUTS_REGLABLES = ["CONFIRME", "VALIDE", "LIVRE", "FACTUREE"];
  const statutNorm = String(vente.statut || "").trim().toUpperCase();
  if (!STATUTS_REGLABLES.includes(statutNorm)) {
    const err = new Error("Impossible d'encaisser une vente non encore confirmée");
    err.status = 400;
    throw err;
  }
  const existing = await prisma.reglement.aggregate({
    where: { venteId: vente.id, statut: { in: ["VALIDE", "EN_ATTENTE"] } },
    _sum: { montant: true },
  });
  const totalDejaRegle = Number(existing._sum.montant || 0);
  const reste = Number(vente.totalTTC) - totalDejaRegle;
  const m = Number(data.montant);
  if (m > reste + 0.001) {
    const err = new Error(`Montant trop élevé. Reste à encaisser : ${reste.toFixed(3)} TND`);
    err.status = 400;
    throw err;
  }
  return prisma.$transaction(async (tx) => {
    const payload = buildReglementCreateData(data, "venteId", vente.id);
    const row = await createReglementWithOptionalFields(
      (safeData) => tx.reglement.create({ data: safeData }),
      payload
    );
    await syncVentePaiement(tx, vente.id, societeId);
    return row;
  });
}

async function deleteVenteReglement(id, societeId) {
  const row = await prisma.reglement.findFirst({
    where: { id: Number(id), vente: { societeId: Number(societeId) } },
  });
  if (!row) {
    const err = new Error("Reglement introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.$transaction(async (tx) => {
    await tx.reglement.delete({ where: { id: row.id } });
    await syncVentePaiement(tx, row.venteId, societeId);
  });
}

async function listAchatReglements(achatId, societeId) {
  await assertAchatSociete(achatId, societeId);
  return prisma.reglementAchat.findMany({
    where: { achatId: Number(achatId) },
    orderBy: { datePayment: "desc" },
  });
}

async function createAchatReglement(data, societeId) {
  const achat = await assertAchatSociete(data.achatId, societeId);
  // CONFIRME = statut actuel ; RECU/RECEPTIONNE/COMMANDE = legacy
  const STATUTS_REGLABLES_ACHAT = ["CONFIRME", "RECU", "RECEPTIONNE", "COMMANDE"];
  const statutNorm = String(achat.statut || "").trim().toUpperCase();
  if (!STATUTS_REGLABLES_ACHAT.includes(statutNorm)) {
    const err = new Error("Impossible de régler un achat non encore confirmé / réceptionné");
    err.status = 400;
    throw err;
  }
  const existing = await prisma.reglementAchat.aggregate({
    where: { achatId: achat.id, statut: { in: ["VALIDE", "EN_ATTENTE"] } },
    _sum: { montant: true },
  });
  const totalDejaRegle = Number(existing._sum.montant || 0);
  const reste = Number(achat.totalTTC) - totalDejaRegle;
  const m = Number(data.montant);
  if (m > reste + 0.001) {
    const err = new Error(`Montant trop élevé. Reste à régler : ${reste.toFixed(3)} TND`);
    err.status = 400;
    throw err;
  }
  return prisma.$transaction(async (tx) => {
    const payload = buildReglementCreateData(data, "achatId", achat.id);
    const row = await createReglementWithOptionalFields(
      (safeData) => tx.reglementAchat.create({ data: safeData }),
      payload
    );
    await syncAchatPaiement(tx, achat.id);
    return row;
  });
}

async function deleteAchatReglement(id, societeId) {
  const row = await prisma.reglementAchat.findFirst({
    where: { id: Number(id), achat: { societeId: Number(societeId) } },
  });
  if (!row) {
    const err = new Error("Reglement introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.$transaction(async (tx) => {
    await tx.reglementAchat.delete({ where: { id: row.id } });
    await syncAchatPaiement(tx, row.achatId);
  });
}

async function listAllVenteReglements(user, filters = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  if (!sid) return [];
  const search = filters.search ? String(filters.search).trim() : "";
  const where = {
    vente: { societeId: sid },
    ...(filters.mode ? { mode: String(filters.mode) } : {}),
    ...buildDateFilter(filters.dateDebut, filters.dateFin),
    ...(search
      ? {
          OR: [
            { vente: { reference: { contains: search } } },
            { vente: { client: { nom: { contains: search } } } },
            { reference: { contains: search } },
            { numeroCheque: { contains: search } },
            { referenceVirement: { contains: search } },
          ],
        }
      : {}),
  };
  return prisma.reglement.findMany({
    where,
    orderBy: { datePayment: "desc" },
    take: Math.min(500, Number(filters.limit) || 200),
    include: {
      vente: {
        select: {
          id: true,
          reference: true,
          totalTTC: true,
          statut: true,
          montantRegle: true,
          statutPaiement: true,
          client: { select: { id: true, nom: true, code: true } },
        },
      },
    },
  });
}

async function listAllAchatReglements(user, filters = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  if (!sid) return [];
  const search = filters.search ? String(filters.search).trim() : "";
  const where = {
    achat: { societeId: sid },
    ...(filters.mode ? { mode: String(filters.mode) } : {}),
    ...buildDateFilter(filters.dateDebut, filters.dateFin),
    ...(search
      ? {
          OR: [
            { achat: { reference: { contains: search } } },
            { achat: { fournisseur: { nom: { contains: search } } } },
            { reference: { contains: search } },
            { numeroCheque: { contains: search } },
            { referenceVirement: { contains: search } },
          ],
        }
      : {}),
  };
  return prisma.reglementAchat.findMany({
    where,
    orderBy: { datePayment: "desc" },
    take: Math.min(500, Number(filters.limit) || 200),
    include: {
      achat: {
        select: {
          id: true,
          reference: true,
          totalTTC: true,
          statut: true,
          statutPaiement: true,
          fournisseur: { select: { id: true, nom: true, code: true } },
        },
      },
    },
  });
}

async function getStatsReglements(user) {
  const { societeId: sid } = getSocieteWhere(user);
  if (!sid) {
    return {
      encaisseeMois: 0,
      payeFournisseurs: 0,
      clientsEnRetard: 0,
      totalAEncaisser: 0,
      nbReglementsVentes: 0,
      nbReglementsAchats: 0,
      tendanceEncaisse: 0,
      chartData: [],
    };
  }
  const { start, end } = monthRange();
  const prev = monthRange(-1);

  const [encVente, payAchat, encVentePrev, ventesOuvertes, nbVentes, nbAchats, chartData] = await Promise.all([
    prisma.reglement.aggregate({
      where: {
        vente: { societeId: sid },
        statut: { in: ["VALIDE", "EN_ATTENTE"] },
        datePayment: { gte: start, lte: end },
      },
      _sum: { montant: true },
    }),
    prisma.reglementAchat.aggregate({
      where: {
        achat: { societeId: sid },
        statut: { in: ["VALIDE", "EN_ATTENTE"] },
        datePayment: { gte: start, lte: end },
      },
      _sum: { montant: true },
    }),
    prisma.reglement.aggregate({
      where: {
        vente: { societeId: sid },
        statut: { in: ["VALIDE", "EN_ATTENTE"] },
        datePayment: { gte: prev.start, lte: prev.end },
      },
      _sum: { montant: true },
    }),
    prisma.vente.findMany({
      where: {
        societeId: sid,
        statut: { in: ["CONFIRME", "VALIDE", "LIVRE", "FACTUREE"] },
      },
      select: {
        id: true,
        totalTTC: true,
        dateVente: true,
        reglements: { where: { statut: { in: ["VALIDE", "EN_ATTENTE"] } }, select: { montant: true } },
      },
    }),
    prisma.reglement.count({
      where: { vente: { societeId: sid }, statut: { in: ["VALIDE", "EN_ATTENTE"] } },
    }),
    prisma.reglementAchat.count({
      where: { achat: { societeId: sid }, statut: { in: ["VALIDE", "EN_ATTENTE"] } },
    }),
    buildChartFlux6Mois(sid),
  ]);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let totalAEncaisser = 0;
  let clientsEnRetard = 0;

  for (const v of ventesOuvertes) {
    const regle = v.reglements.reduce((s, r) => s + Number(r.montant || 0), 0);
    const reste = Math.max(0, Number(v.totalTTC) - regle);
    if (reste > 0.001) {
      totalAEncaisser += reste;
      if (new Date(v.dateVente) < thirtyDaysAgo) clientsEnRetard += 1;
    }
  }

  const encaisseeMois = Number(encVente._sum.montant || 0);
  const encPrev = Number(encVentePrev._sum.montant || 0);
  const tendanceEncaisse =
    encPrev > 0 ? Math.round(((encaisseeMois - encPrev) / encPrev) * 100) : encaisseeMois > 0 ? 100 : 0;

  return {
    encaisseeMois,
    payeFournisseurs: Number(payAchat._sum.montant || 0),
    clientsEnRetard,
    totalAEncaisser: Math.round(totalAEncaisser * 1000) / 1000,
    nbReglementsVentes: nbVentes,
    nbReglementsAchats: nbAchats,
    tendanceEncaisse,
    chartData,
  };
}

module.exports = {
  listVenteReglements,
  createVenteReglement,
  deleteVenteReglement,
  listAchatReglements,
  createAchatReglement,
  deleteAchatReglement,
  listAllVenteReglements,
  listAllAchatReglements,
  getStatsReglements,
  syncVentePaiement,
  syncAchatPaiement,
};
