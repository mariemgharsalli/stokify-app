const prisma = require("../../config/database");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

const VENTE_STATUTS_COMPTA = ["CONFIRME", "VALIDE", "LIVRE"];
const ACHAT_STATUTS_COMPTA = ["CONFIRME", "RECU", "RECEPTIONNE", "COMMANDE", "VALIDE"];

const MOIS_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function formatMoisLabel(moisKey) {
  if (!moisKey || typeof moisKey !== "string") return moisKey;
  const parts = moisKey.split("-");
  const m = Number(parts[1]);
  if (m >= 1 && m <= 12) return MOIS_LABELS[m - 1];
  return moisKey;
}

function getPeriodeDates(periode, dateDebut, dateFin) {
  const end = dateFin ? new Date(dateFin) : new Date();
  end.setHours(23, 59, 59, 999);
  let start;
  if (periode === "custom" && dateDebut) {
    start = new Date(dateDebut);
  } else if (periode === "trimestre") {
    start = new Date(end);
    start.setMonth(start.getMonth() - 3);
  } else if (periode === "semestre") {
    start = new Date(end);
    start.setMonth(start.getMonth() - 6);
  } else if (periode === "annee") {
    start = new Date(end.getFullYear(), 0, 1);
  } else {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function encaisseVente(vente) {
  return (vente.reglements || [])
    .filter((r) => r.statut !== "EN_ATTENTE")
    .reduce((s, r) => s + Number(r.montant || 0), 0);
}

function formatImpayeVente(v) {
  const total = Number(v.totalTTC || 0);
  const regle = encaisseVente(v);
  const montantDu = round2(Math.max(0, total - regle));
  if (montantDu < 0.001) return null;
  return {
    id: v.id,
    venteId: v.id,
    reference: v.reference,
    client: v.client ? { id: v.client.id, nom: v.client.nom, code: v.client.code } : null,
    dateLivraison: v.dateLivraison,
    montantDu,
  };
}

function formatImpayeAchat(a) {
  const total = Number(a.totalTTC || 0);
  const regle = Number(a.montantRegle || 0);
  const montantDu = round2(Math.max(0, total - regle));
  if (montantDu < 0.001) return null;
  return {
    id: a.id,
    achatId: a.id,
    reference: a.reference,
    fournisseur: a.fournisseur
      ? { id: a.fournisseur.id, nom: a.fournisseur.nom, code: a.fournisseur.code }
      : null,
    echeance: a.dateLivraisonPrevue,
    montantDu,
  };
}

function startEndDates(dateDebut, dateFin) {
  const end = dateFin ? new Date(dateFin) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = dateDebut
    ? new Date(dateDebut)
    : new Date(end.getFullYear(), end.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

async function getFinancialSummary(user, { dateDebut, dateFin } = {}) {
  const sid = Number(user.societeId);
  const { start, end } = startEndDates(dateDebut, dateFin);

  const ventes = await prisma.vente.findMany({
    where: {
      societeId: sid,
      dateVente: { gte: start, lte: end },
      statut: { not: "ANNULE" },
    },
    include: { reglements: true },
  });

  const achats = await prisma.achat.findMany({
    where: {
      societeId: sid,
      dateCommande: { gte: start, lte: end },
      statut: { not: "ANNULE" },
    },
  });

  const caTTC = ventes.reduce((s, v) => s + Number(v.totalTTC), 0);
  const caHT = ventes.reduce((s, v) => s + Number(v.totalHT), 0);
  const achatsTTC = achats.reduce((s, a) => s + Number(a.totalTTC), 0);
  const achatsHT = achats.reduce((s, a) => s + Number(a.totalHT), 0);

  let encaisseVentes = 0;
  for (const v of ventes) {
    for (const r of v.reglements) {
      if (r.statut !== "EN_ATTENTE") encaisseVentes += Number(r.montant);
    }
  }

  const payeAchats = achats.reduce((s, a) => s + Number(a.montantRegle || 0), 0);

  const margeApprox = round2(caHT - achatsHT);

  return {
    periode: { debut: start, fin: end },
    ventes: {
      count: ventes.length,
      totalHT: round2(caHT),
      totalTTC: round2(caTTC),
      encaisse: round2(encaisseVentes),
      aEncaisser: round2(caTTC - encaisseVentes),
    },
    achats: {
      count: achats.length,
      totalHT: round2(achatsHT),
      totalTTC: round2(achatsTTC),
      paye: round2(payeAchats),
      resteAPayer: round2(achatsTTC - payeAchats),
    },
    indicateurs: {
      margeBruteApproxHT: margeApprox,
    },
  };
}

async function listFacturesVente(user, { dateDebut, dateFin, page = 1, limit = 100 } = {}) {
  const sid = Number(user.societeId);
  const { start, end } = startEndDates(dateDebut, dateFin);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(300, Math.max(1, Number(limit) || 100));
  const skip = (pageNum - 1) * limitNum;

  const where = {
    societeId: sid,
    dateVente: { gte: start, lte: end },
    statut: { not: "ANNULE" },
  };

  const [rows, total] = await Promise.all([
    prisma.vente.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { dateVente: "desc" },
      include: {
        client: { select: { code: true, nom: true } },
        reglements: true,
      },
    }),
    prisma.vente.count({ where }),
  ]);

  const items = rows.map((v) => {
    const encaisse = v.reglements.filter((r) => r.statut !== "EN_ATTENTE").reduce((s, r) => s + Number(r.montant), 0);
    return {
      id: v.id,
      reference: v.reference,
      date: v.dateVente,
      client: v.client,
      totalTTC: v.totalTTC,
      statut: v.statut,
      encaisse: round2(encaisse),
      solde: round2(Number(v.totalTTC) - encaisse),
    };
  });

  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1 };
}

async function listFacturesAchat(user, { dateDebut, dateFin, page = 1, limit = 100 } = {}) {
  const sid = Number(user.societeId);
  const { start, end } = startEndDates(dateDebut, dateFin);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(300, Math.max(1, Number(limit) || 100));
  const skip = (pageNum - 1) * limitNum;

  const where = {
    societeId: sid,
    dateCommande: { gte: start, lte: end },
    statut: { not: "ANNULE" },
  };

  const [rows, total] = await Promise.all([
    prisma.achat.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { dateCommande: "desc" },
      include: { fournisseur: { select: { code: true, nom: true } } },
    }),
    prisma.achat.count({ where }),
  ]);

  const items = rows.map((a) => ({
    id: a.id,
    reference: a.reference,
    date: a.dateCommande,
    fournisseur: a.fournisseur,
    totalTTC: a.totalTTC,
    statut: a.statut,
    statutPaiement: a.statutPaiement,
    montantRegle: a.montantRegle,
    solde: round2(Number(a.totalTTC) - Number(a.montantRegle || 0)),
  }));

  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1 };
}

function depotVenteFilter(depotId) {
  return depotId ? { depotId: Number(depotId) } : {};
}

function depotAchatFilter(depotId) {
  return depotId ? { depotId: Number(depotId) } : {};
}

/** Synthèse comptable enrichie pour les rapports. */
async function getSynthese(user, { dateDebut, dateFin, depotId } = {}) {
  const sid = Number(user.societeId);
  const { start, end } = startEndDates(dateDebut, dateFin);
  const spanMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - spanMs);
  prevStart.setHours(0, 0, 0, 0);

  const venteWhere = {
    societeId: sid,
    dateVente: { gte: start, lte: end },
    statut: { not: "ANNULE" },
    ...depotVenteFilter(depotId),
  };
  const achatWhere = {
    societeId: sid,
    dateCommande: { gte: start, lte: end },
    statut: { not: "ANNULE" },
    ...depotAchatFilter(depotId),
  };
  const venteWherePrev = { ...venteWhere, dateVente: { gte: prevStart, lte: prevEnd } };

  const [ventes, achats, ventesPrevAgg] = await Promise.all([
    prisma.vente.findMany({
      where: venteWhere,
      include: { lignes: { include: { article: { select: { prixAchat: true } } } } },
    }),
    prisma.achat.findMany({ where: achatWhere }),
    prisma.vente.aggregate({
      where: venteWherePrev,
      _sum: { totalHT: true },
    }),
  ]);

  const ventesHT = ventes.reduce((s, v) => s + Number(v.totalHT), 0);
  const ventesTTC = ventes.reduce((s, v) => s + Number(v.totalTTC), 0);
  const achatsHT = achats.reduce((s, a) => s + Number(a.totalHT), 0);
  const achatsTTC = achats.reduce((s, a) => s + Number(a.totalTTC), 0);

  let totalCoutRevient = 0;
  for (const v of ventes) {
    for (const l of v.lignes || []) {
      const pa = Number(l.article?.prixAchat ?? 0);
      totalCoutRevient += Number(l.quantite) * pa;
    }
  }
  const margeGlobale = round2(ventesHT - totalCoutRevient);
  const margeGlobalePct = ventesHT > 0 ? round2((margeGlobale / ventesHT) * 100) : 0;
  const ventesHTPrecedent = Number(ventesPrevAgg._sum.totalHT || 0);
  const variationPct =
    ventesHTPrecedent > 0
      ? round2(((ventesHT - ventesHTPrecedent) / ventesHTPrecedent) * 100)
      : ventesHT > 0
        ? 100
        : 0;

  return {
    periode: { debut: start, fin: end },
    ventesHT: round2(ventesHT),
    ventesTTC: round2(ventesTTC),
    achatsHT: round2(achatsHT),
    achatsTTC: round2(achatsTTC),
    margeGlobale,
    margeGlobalePct,
    evolutionVs: { ventesHTPrecedent: round2(ventesHTPrecedent), variationPct },
  };
}

async function getEvolutionMensuelle(user, { mois = 12, depotId } = {}) {
  const sid = Number(user.societeId);
  const n = Math.min(24, Math.max(1, Number(mois) || 12));
  const now = new Date();
  const rows = [];

  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const moisKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const [vAgg, aAgg, nbVentes, nbAchats, ventesLignes] = await Promise.all([
      prisma.vente.aggregate({
        where: {
          societeId: sid,
          statut: { notIn: ["ANNULE", "BROUILLON"] },
          dateVente: { gte: mStart, lte: mEnd },
          ...depotVenteFilter(depotId),
        },
        _sum: { totalHT: true, totalTTC: true },
      }),
      prisma.achat.aggregate({
        where: {
          societeId: sid,
          statut: { not: "ANNULE" },
          dateCommande: { gte: mStart, lte: mEnd },
          ...depotAchatFilter(depotId),
        },
        _sum: { totalHT: true },
      }),
      prisma.vente.count({
        where: {
          societeId: sid,
          statut: { notIn: ["ANNULE", "BROUILLON"] },
          dateVente: { gte: mStart, lte: mEnd },
          ...depotVenteFilter(depotId),
        },
      }),
      prisma.achat.count({
        where: {
          societeId: sid,
          statut: { not: "ANNULE" },
          dateCommande: { gte: mStart, lte: mEnd },
          ...depotAchatFilter(depotId),
        },
      }),
      prisma.ligneVente.findMany({
        where: {
          vente: {
            societeId: sid,
            statut: { notIn: ["ANNULE", "BROUILLON"] },
            dateVente: { gte: mStart, lte: mEnd },
            ...depotVenteFilter(depotId),
          },
        },
        include: { article: { select: { prixAchat: true } }, vente: { select: { totalHT: true } } },
      }),
    ]);

    const ventesHT = Number(vAgg._sum.totalHT || 0);
    const achatsHT = Number(aAgg._sum.totalHT || 0);
    let cout = 0;
    for (const l of ventesLignes) {
      cout += Number(l.quantite) * Number(l.article?.prixAchat ?? 0);
    }
    const marge = round2(ventesHT - cout);

    rows.push({
      mois: moisKey,
      ventesHT: round2(ventesHT),
      ventesTTC: round2(Number(vAgg._sum.totalTTC || 0)),
      achatsHT: round2(achatsHT),
      marge,
      nbVentes,
      nbAchats,
    });
  }
  return rows;
}

async function getTopArticles(user, { dateDebut, dateFin, depotId, limit = 10 } = {}) {
  const sid = Number(user.societeId);
  const { start, end } = startEndDates(dateDebut, dateFin);
  const lim = Math.min(50, Math.max(1, Number(limit) || 10));

  const lignes = await prisma.ligneVente.findMany({
    where: {
      vente: {
        societeId: sid,
        statut: { notIn: ["ANNULE", "BROUILLON"] },
        dateVente: { gte: start, lte: end },
        ...depotVenteFilter(depotId),
      },
    },
    include: {
      article: { select: { id: true, code: true, libelle: true, prixAchat: true, imageUrl: true } },
      vente: { select: { totalHT: true } },
    },
  });

  const caTotal = lignes.reduce((s, l) => s + Number(l.totalHT), 0);
  const map = new Map();
  for (const l of lignes) {
    const aid = l.articleId;
    const cur = map.get(aid) || {
      articleId: aid,
      libelle: l.article?.libelle || "",
      imageUrl: l.article?.imageUrl || null,
      prixAchat: l.article?.prixAchat ?? null,
      qteVendue: 0,
      chiffreAffairesHT: 0,
      cout: 0,
    };
    cur.qteVendue += Number(l.quantite);
    cur.chiffreAffairesHT += Number(l.totalHT);
    cur.cout += Number(l.quantite) * Number(l.article?.prixAchat ?? 0);
    map.set(aid, cur);
  }

  const stocks = await prisma.stock.groupBy({
    by: ["articleId"],
    where: { article: { societeId: sid } },
    _sum: { quantite: true },
  });
  const stockByArticle = new Map(stocks.map((s) => [s.articleId, Number(s._sum.quantite || 0)]));

  return [...map.values()]
    .map((x) => ({
      articleId: x.articleId,
      libelle: x.libelle,
      imageUrl: x.imageUrl || null,
      prixAchat: x.prixAchat ?? null,
      qteVendue: round2(x.qteVendue),
      chiffreAffairesHT: round2(x.chiffreAffairesHT),
      partDuCA: caTotal > 0 ? round2((x.chiffreAffairesHT / caTotal) * 100) : 0,
      marge: round2(x.chiffreAffairesHT - x.cout),
      stockActuel: round2(stockByArticle.get(x.articleId) || 0),
    }))
    .sort((a, b) => b.chiffreAffairesHT - a.chiffreAffairesHT)
    .slice(0, lim);
}

async function getTopClients(user, { dateDebut, dateFin, limit = 10 } = {}) {
  const sid = Number(user.societeId);
  const { start, end } = startEndDates(dateDebut, dateFin);
  const lim = Math.min(50, Math.max(1, Number(limit) || 10));

  const ventes = await prisma.vente.findMany({
    where: {
      societeId: sid,
      statut: { notIn: ["ANNULE", "BROUILLON"] },
      dateVente: { gte: start, lte: end },
    },
    include: { client: { select: { id: true, nom: true } }, reglements: true },
  });

  const map = new Map();
  for (const v of ventes) {
    const cid = v.clientId;
    const cur = map.get(cid) || {
      clientId: cid,
      nom: v.client?.nom || "",
      totalHT: 0,
      totalTTC: 0,
      nbVentes: 0,
      regle: 0,
    };
    cur.totalHT += Number(v.totalHT);
    cur.totalTTC += Number(v.totalTTC);
    cur.nbVentes += 1;
    const enc = (v.reglements || [])
      .filter((r) => r.statut !== "EN_ATTENTE")
      .reduce((s, r) => s + Number(r.montant), 0);
    if (enc + 1e-6 >= Number(v.totalTTC)) cur.regle += 1;
    map.set(cid, cur);
  }

  return [...map.values()]
    .map((x) => ({
      clientId: x.clientId,
      nom: x.nom,
      totalHT: round2(x.totalHT),
      totalTTC: round2(x.totalTTC),
      nbVentes: x.nbVentes,
      tauxPaiement: x.nbVentes > 0 ? Math.round((x.regle / x.nbVentes) * 100) : 0,
    }))
    .sort((a, b) => b.totalHT - a.totalHT)
    .slice(0, lim);
}

async function getTopFournisseurs(user, { dateDebut, dateFin, limit = 10 } = {}) {
  const sid = Number(user.societeId);
  const { start, end } = startEndDates(dateDebut, dateFin);
  const lim = Math.min(50, Math.max(1, Number(limit) || 10));

  const achats = await prisma.achat.findMany({
    where: {
      societeId: sid,
      statut: { not: "ANNULE" },
      dateCommande: { gte: start, lte: end },
    },
    include: { fournisseur: { select: { id: true, nom: true } } },
  });

  const map = new Map();
  for (const a of achats) {
    const fid = a.fournisseurId;
    const cur = map.get(fid) || {
      fournisseurId: fid,
      nom: a.fournisseur?.nom || "",
      totalTTC: 0,
      nbAchats: 0,
      delais: [],
    };
    cur.totalTTC += Number(a.totalTTC);
    cur.nbAchats += 1;
    if (a.dateLivraisonPrevue && a.dateReception) {
      const j = Math.round(
        (new Date(a.dateReception).getTime() - new Date(a.dateLivraisonPrevue).getTime()) /
          (86400000)
      );
      cur.delais.push(j);
    }
    map.set(fid, cur);
  }

  return [...map.values()]
    .map((x) => ({
      fournisseurId: x.fournisseurId,
      nom: x.nom,
      totalTTC: round2(x.totalTTC),
      nbAchats: x.nbAchats,
      delaiMoyenJours:
        x.delais.length > 0 ? Math.round(x.delais.reduce((s, d) => s + d, 0) / x.delais.length) : null,
    }))
    .sort((a, b) => b.totalTTC - a.totalTTC)
    .slice(0, lim);
}

async function getStockParDepot(user) {
  const sid = Number(user.societeId);
  const valuationService = require("../valuation/valuation.service");

  const depots = await prisma.depot.findMany({
    where: { societeId: sid },
    select: { id: true, libelle: true, capacite: true },
  });

  const rows = [];
  let totalGlobal = 0;

  for (const d of depots) {
    const stocks = await prisma.stock.findMany({
      where: { depotId: d.id, quantite: { gt: 0 } },
      include: { article: { select: { id: true, prixAchat: true } } },
    });
    let valeurCMP = 0;
    let valeurFIFO = 0;
    let quantite = 0;
    for (const s of stocks) {
      const q = Number(s.quantite);
      quantite += q;
      const cmp = await valuationService.getCurrentCMP(sid, s.articleId, d.id);
      valeurCMP += q * cmp;
      const couche = await prisma.couchesFifo.findFirst({
        where: {
          articleId: s.articleId,
          depotId: d.id,
          quantiteRestante: { gt: 0 },
        },
        orderBy: { orderIndex: "asc" },
      });
      const prixFifo = couche ? Number(couche.prixUnitaire) : Number(s.article?.prixAchat ?? 0);
      valeurFIFO += q * prixFifo;
    }
    valeurCMP = round2(valeurCMP);
    valeurFIFO = round2(valeurFIFO);
    quantite = round2(quantite);
    totalGlobal += valeurCMP;
    rows.push({
      depotId: d.id,
      libelle: d.libelle,
      nbArticles: stocks.length,
      quantite,
      valeurCMP,
      valeurFIFO,
      capaciteUtilisee: d.capacite ? round2((stocks.length / Number(d.capacite)) * 100) : null,
    });
  }

  return rows.map((r) => ({
    ...r,
    pctDuTotal: totalGlobal > 0 ? round2((r.valeurCMP / totalGlobal) * 100) : 0,
  }));
}

/**
 * Tableau de bord comptabilité (KPIs, graphiques, impayés, tops).
 */
async function getSyntheseComptable(user, { periode = "mois", dateDebut, dateFin } = {}) {
  const sid = Number(user.societeId);
  const { start, end } = getPeriodeDates(periode, dateDebut, dateFin);

  const ventePeriodeWhere = {
    societeId: sid,
    statut: { in: VENTE_STATUTS_COMPTA },
    dateVente: { gte: start, lte: end },
  };
  const achatPeriodeWhere = {
    societeId: sid,
    statut: { in: ACHAT_STATUTS_COMPTA },
    dateCommande: { gte: start, lte: end },
  };

  const [
    ventesPeriode,
    achatsPeriode,
    ventesImpayeesRows,
    achatsImpayesRows,
    reglementsVentesPeriode,
    reglementsAchatsPeriode,
    evolution6,
    topClientsRaw,
    topFournisseursRaw,
  ] = await Promise.all([
    prisma.vente.findMany({
      where: ventePeriodeWhere,
      include: { lignes: { include: { article: { select: { prixAchat: true } } } } },
    }),
    prisma.achat.findMany({ where: achatPeriodeWhere }),
    prisma.vente.findMany({
      where: {
        societeId: sid,
        statut: { in: VENTE_STATUTS_COMPTA },
      },
      include: { client: { select: { id: true, nom: true, code: true } }, reglements: true },
      orderBy: { dateVente: "asc" },
    }),
    prisma.achat.findMany({
      where: {
        societeId: sid,
        statut: { in: ACHAT_STATUTS_COMPTA },
      },
      include: { fournisseur: { select: { id: true, nom: true, code: true } } },
      orderBy: { dateCommande: "asc" },
    }),
    prisma.reglement.aggregate({
      where: {
        statut: { not: "EN_ATTENTE" },
        datePayment: { gte: start, lte: end },
        vente: { societeId: sid },
      },
      _sum: { montant: true },
    }),
    prisma.reglementAchat.aggregate({
      where: {
        statut: { not: "EN_ATTENTE" },
        datePayment: { gte: start, lte: end },
        achat: { societeId: sid },
      },
      _sum: { montant: true },
    }),
    getEvolutionMensuelle(user, { mois: 6 }),
    getTopClients(user, { dateDebut: start, dateFin: end, limit: 5 }),
    getTopFournisseurs(user, { dateDebut: start, dateFin: end, limit: 5 }),
  ]);

  const ventesMois = round2(ventesPeriode.reduce((s, v) => s + Number(v.totalTTC || 0), 0));
  const achatsMois = round2(achatsPeriode.reduce((s, a) => s + Number(a.totalTTC || 0), 0));
  const solde = round2(ventesMois - achatsMois);

  let coutRevient = 0;
  let ventesHT = 0;
  for (const v of ventesPeriode) {
    ventesHT += Number(v.totalHT || 0);
    for (const l of v.lignes || []) {
      coutRevient += Number(l.quantite) * Number(l.article?.prixAchat ?? 0);
    }
  }
  const margePct = ventesHT > 0 ? round2(((ventesHT - coutRevient) / ventesHT) * 100) : 0;

  const encaisse = round2(Number(reglementsVentesPeriode._sum.montant || 0));
  const paye = round2(Number(reglementsAchatsPeriode._sum.montant || 0));

  const impayesVentes = ventesImpayeesRows.map(formatImpayeVente).filter(Boolean);
  const impayesAchats = achatsImpayesRows.map(formatImpayeAchat).filter(Boolean);

  const impayesClients = round2(impayesVentes.reduce((s, i) => s + i.montantDu, 0));
  const dettesFournisseurs = round2(impayesAchats.reduce((s, i) => s + i.montantDu, 0));

  const tauxRecouvrement =
    ventesMois > 0 ? round2((encaisse / ventesMois) * 100) : encaisse > 0 ? 100 : 0;

  const chartData = (evolution6 || []).map((row) => {
    const achats = Number(row.achatsHT || 0);
    const ventes = Number(row.ventesTTC || 0);
    return {
      mois: formatMoisLabel(row.mois),
      achats: round2(achats),
      ventes: round2(ventes),
      solde: round2(ventes - achats),
    };
  });

  const topClients = (topClientsRaw || []).map((c) => ({
    id: c.clientId,
    nom: c.nom,
    ca: c.totalTTC,
  }));

  const topFournisseurs = (topFournisseursRaw || []).map((f) => ({
    id: f.fournisseurId,
    nom: f.nom,
    total: f.totalTTC,
  }));

  return {
    periode: { debut: start, fin: end, type: periode },
    achatsMois,
    ventesMois,
    solde,
    margePct,
    encaisse,
    paye,
    impayesClients,
    dettesFournisseurs,
    tauxRecouvrement,
    impayesVentes,
    impayesAchats,
    topClients,
    topFournisseurs,
    chartData,
  };
}

module.exports = {
  getFinancialSummary,
  listFacturesVente,
  listFacturesAchat,
  getSynthese,
  getSyntheseComptable,
  getEvolutionMensuelle,
  getTopArticles,
  getTopClients,
  getTopFournisseurs,
  getStockParDepot,
};
