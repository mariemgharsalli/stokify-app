const prisma = require("../../config/database");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

function shiftPeriodeYm(periode, delta) {
  const [y, m] = String(periode).split("-").map(Number);
  const d = new Date(y, m - 1 + Number(delta || 0), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Mid-month date used to decide if a unit cost applies to YYYY-MM. */
function periodeMidDate(periodeYm) {
  const [y, m] = String(periodeYm || "").split("-").map(Number);
  if (!y || !m) return new Date();
  return new Date(y, m - 1, 15, 12, 0, 0, 0);
}

function activeCoutFilter(at = new Date()) {
  return {
    periodeDebut: { lte: at },
    OR: [{ periodeFin: null }, { periodeFin: { gte: at } }],
  };
}

function rangesOverlap(startA, endA, startB, endB) {
  const a0 = new Date(startA).getTime();
  const a1 = endA ? new Date(endA).getTime() : Number.POSITIVE_INFINITY;
  const b0 = new Date(startB).getTime();
  const b1 = endB ? new Date(endB).getTime() : Number.POSITIVE_INFINITY;
  return a0 <= b1 && b0 <= a1;
}

function clampTauxPossession(raw, fallback = 2) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(40, Math.max(0, n));
}

async function assertNoCoutOverlap({ societeId, articleId, depotId, periodeDebut, periodeFin, excludeId }) {
  const existing = await prisma.coutStockage.findMany({
    where: {
      societeId: Number(societeId),
      articleId: Number(articleId),
      depotId: Number(depotId),
      ...(excludeId ? { id: { not: Number(excludeId) } } : {}),
    },
    select: { id: true, periodeDebut: true, periodeFin: true },
  });
  const hit = existing.find((row) =>
    rangesOverlap(periodeDebut, periodeFin, row.periodeDebut, row.periodeFin)
  );
  if (hit) {
    const err = new Error("Un coût unitaire existe déjà pour cet article et ce dépôt sur cette période");
    err.status = 409;
    throw err;
  }
}

async function listCoutStockage({ societeId, articleId, depotId, page = 1, limit = 50 }) {
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 50;
  const skip = (pageNum - 1) * limitNum;
  const where = {
    societeId: Number(societeId),
    ...(articleId ? { articleId: Number(articleId) } : {}),
    ...(depotId ? { depotId: Number(depotId) } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.coutStockage.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { periodeDebut: "desc" },
      include: {
        article: { select: { id: true, code: true, libelle: true } },
        depot: { select: { id: true, code: true, libelle: true } },
      },
    }),
    prisma.coutStockage.count({ where }),
  ]);
  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1 };
}

async function getCoutStockage(id, societeId) {
  return prisma.coutStockage.findFirst({
    where: { id: Number(id), societeId: Number(societeId) },
    include: { article: true, depot: true },
  });
}

async function createCoutStockage(data, societeId) {
  const sid = Number(societeId);
  const [art, dep] = await Promise.all([
    prisma.article.findFirst({ where: { id: Number(data.articleId), societeId: sid } }),
    prisma.depot.findFirst({ where: { id: Number(data.depotId), societeId: sid } }),
  ]);
  if (!art) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  if (!dep) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }
  const periodeDebut = new Date(data.periodeDebut);
  const periodeFin = data.periodeFin ? new Date(data.periodeFin) : null;
  await assertNoCoutOverlap({
    societeId: sid,
    articleId: art.id,
    depotId: dep.id,
    periodeDebut,
    periodeFin,
  });
  return prisma.coutStockage.create({
    data: {
      societeId: sid,
      articleId: art.id,
      depotId: dep.id,
      coutUnitaire: Number(data.coutUnitaire),
      devise: data.devise || "TND",
      periodeDebut,
      periodeFin,
      commentaire: data.commentaire || null,
    },
  });
}

async function updateCoutStockage(id, data, societeId) {
  const ex = await getCoutStockage(id, societeId);
  if (!ex) {
    const err = new Error("Enregistrement introuvable");
    err.status = 404;
    throw err;
  }
  const periodeDebut = data.periodeDebut != null ? new Date(data.periodeDebut) : ex.periodeDebut;
  const periodeFin =
    data.periodeFin !== undefined ? (data.periodeFin ? new Date(data.periodeFin) : null) : ex.periodeFin;
  await assertNoCoutOverlap({
    societeId,
    articleId: ex.articleId,
    depotId: ex.depotId,
    periodeDebut,
    periodeFin,
    excludeId: ex.id,
  });
  return prisma.coutStockage.update({
    where: { id: ex.id },
    data: {
      ...(data.coutUnitaire != null ? { coutUnitaire: Number(data.coutUnitaire) } : {}),
      ...(data.devise !== undefined ? { devise: data.devise || "TND" } : {}),
      periodeDebut,
      periodeFin,
      ...(data.commentaire !== undefined ? { commentaire: data.commentaire || null } : {}),
    },
  });
}

async function deleteCoutStockage(id, societeId) {
  const ex = await getCoutStockage(id, societeId);
  if (!ex) {
    const err = new Error("Enregistrement introuvable");
    err.status = 404;
    throw err;
  }
  await prisma.coutStockage.delete({ where: { id: ex.id } });
}

/** Dernière ligne de coût encore active à la date `at` (défaut: maintenant). */
async function getLatestCout(societeId, articleId, depotId, at = new Date()) {
  return prisma.coutStockage.findFirst({
    where: {
      societeId: Number(societeId),
      articleId: Number(articleId),
      depotId: Number(depotId),
      ...activeCoutFilter(at),
    },
    orderBy: { periodeDebut: "desc" },
  });
}

function sumCouts(c) {
  return (
    Number(c.coutLoyer || 0) +
    Number(c.coutPersonnel || 0) +
    Number(c.coutEnergie || 0) +
    Number(c.coutManutention || 0) +
    Number(c.autresFrais || 0)
  );
}

async function saveCoutDepotMensuel(societeId, depotId, periode, couts) {
  const sid = Number(societeId);
  const dep = await prisma.depot.findFirst({ where: { id: Number(depotId), societeId: sid } });
  if (!dep) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }
  const per = String(periode).trim();
  if (!/^\d{4}-\d{2}$/.test(per)) {
    const err = new Error("periode invalide (format YYYY-MM)");
    err.status = 400;
    throw err;
  }
  const total = Math.round(sumCouts(couts) * 1000) / 1000;
  return prisma.coutDepotMensuel.upsert({
    where: { depotId_periode: { depotId: dep.id, periode: per } },
    create: {
      societeId: sid,
      depotId: dep.id,
      periode: per,
      coutLoyer: Number(couts.coutLoyer || 0),
      coutPersonnel: Number(couts.coutPersonnel || 0),
      coutEnergie: Number(couts.coutEnergie || 0),
      coutManutention: Number(couts.coutManutention || 0),
      autresFrais: Number(couts.autresFrais || 0),
      total,
      commentaire: couts.commentaire || null,
    },
    update: {
      coutLoyer: Number(couts.coutLoyer || 0),
      coutPersonnel: Number(couts.coutPersonnel || 0),
      coutEnergie: Number(couts.coutEnergie || 0),
      coutManutention: Number(couts.coutManutention || 0),
      autresFrais: Number(couts.autresFrais || 0),
      total,
      commentaire: couts.commentaire || null,
    },
    include: { depot: { select: { id: true, code: true, libelle: true } } },
  });
}

async function listCoutDepotMensuel(societeId, { depotId, periode } = {}) {
  return prisma.coutDepotMensuel.findMany({
    where: {
      societeId: Number(societeId),
      ...(depotId ? { depotId: Number(depotId) } : {}),
      ...(periode ? { periode: String(periode) } : {}),
    },
    orderBy: { periode: "desc" },
    include: { depot: { select: { id: true, code: true, libelle: true } } },
  });
}

async function getCoutEntries(depotId, periode, societeId) {
  const where = {
    societeId: Number(societeId),
    ...(depotId ? { depotId: Number(depotId) } : {}),
    ...(periode ? { periode: String(periode) } : {}),
  };
  return prisma.coutEntry.findMany({
    where,
    include: { utilisateur: { select: { nom: true, prenom: true } } },
    orderBy: { createdAt: "asc" },
  });
}

async function createCoutEntry({ nom, description, montant, categorie, periode, depotId, societeId, createdBy, dupliquerMois }) {
  if (!nom?.trim()) {
    const err = new Error("Le nom du coût est requis");
    err.status = 400;
    throw err;
  }
  if (Number(montant) <= 0) {
    const err = new Error("Le montant doit être positif");
    err.status = 400;
    throw err;
  }
  const sid = Number(societeId);
  const dep = await prisma.depot.findFirst({ where: { id: Number(depotId), societeId: sid } });
  if (!dep) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }
  const per = String(periode).trim();
  if (!/^\d{4}-\d{2}$/.test(per)) {
    const err = new Error("periode invalide (format YYYY-MM)");
    err.status = 400;
    throw err;
  }
  const validCategories = ["STOCKAGE", "LOGISTIQUE", "MANUTENTION", "AUTRE"];
  const cat = categorie && validCategories.includes(categorie) ? categorie : null;

  const created = await prisma.coutEntry.create({
    data: {
      nom: nom.trim(),
      description: description?.trim() || null,
      montant: Number(montant),
      categorie: cat,
      periode: per,
      depotId: dep.id,
      societeId: sid,
      createdBy: createdBy ? Number(createdBy) : null,
    },
    include: { utilisateur: { select: { nom: true, prenom: true } } },
  });

  const copies = Math.min(12, Math.max(0, Number(dupliquerMois) || 0));
  if (copies > 0) {
    const extras = [];
    for (let i = 1; i <= copies; i += 1) {
      extras.push({
        nom: created.nom,
        description: created.description,
        montant: created.montant,
        categorie: created.categorie,
        periode: shiftPeriodeYm(per, i),
        depotId: dep.id,
        societeId: sid,
        createdBy: created.createdBy,
      });
    }
    await prisma.coutEntry.createMany({ data: extras });
  }

  return created;
}

async function updateCoutEntry(id, { nom, description, montant, categorie }, societeId) {
  const entry = await prisma.coutEntry.findFirst({
    where: { id: Number(id), societeId: Number(societeId) },
  });
  if (!entry) {
    const err = new Error("Entrée introuvable");
    err.status = 404;
    throw err;
  }
  if (!nom?.trim()) {
    const err = new Error("Le nom du coût est requis");
    err.status = 400;
    throw err;
  }
  if (Number(montant) <= 0) {
    const err = new Error("Le montant doit être positif");
    err.status = 400;
    throw err;
  }
  const validCategories = ["STOCKAGE", "LOGISTIQUE", "MANUTENTION", "AUTRE"];
  const cat = categorie === undefined
    ? undefined
    : categorie && validCategories.includes(categorie)
      ? categorie
      : null;

  return prisma.coutEntry.update({
    where: { id: Number(id) },
    data: {
      nom: nom.trim(),
      description: description?.trim() || null,
      montant: Number(montant),
      ...(cat !== undefined ? { categorie: cat } : {}),
    },
    include: { utilisateur: { select: { nom: true, prenom: true } } },
  });
}

async function getCoutEntriesGroupedByCategorie(depotId, periode, societeId) {
  const groups = await prisma.coutEntry.groupBy({
    by: ["categorie"],
    _sum: { montant: true },
    where: {
      depotId: Number(depotId),
      periode: String(periode),
      societeId: Number(societeId),
    },
  });

  const merged = {};
  for (const g of groups) {
    const cat = g.categorie || "AUTRE";
    merged[cat] = (merged[cat] || 0) + Number(g._sum.montant || 0);
  }

  return Object.entries(merged).map(([categorie, total]) => ({ categorie, total }));
}

async function deleteCoutEntry(id, societeId) {
  const entry = await prisma.coutEntry.findFirst({
    where: { id: Number(id), societeId: Number(societeId) },
  });
  if (!entry) {
    const err = new Error("Entrée introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.coutEntry.delete({ where: { id: Number(id) } });
}

async function getTotalCoutEntries(depotId, periode, societeId) {
  const entries = await getCoutEntries(depotId, periode, societeId);
  const total = entries.reduce((s, e) => s + Number(e.montant), 0);
  return { total, count: entries.length, entries };
}

async function getDepotCoutTotal(societeId, depotId, periode) {
  const entries = await prisma.coutEntry.findMany({
    where: {
      societeId: Number(societeId),
      depotId: Number(depotId),
      periode: String(periode),
    },
  });
  return entries.reduce((s, e) => s + Number(e.montant), 0);
}

async function loadSocieteCoutParams(sid) {
  const id = Number(sid);
  try {
    return await prisma.societe.findUnique({
      where: { id },
      select: { deadStockSeuil: true, tauxPossessionAnnuel: true },
    });
  } catch {
    const soc = await prisma.societe.findUnique({
      where: { id },
      select: { deadStockSeuil: true },
    });
    return { deadStockSeuil: soc?.deadStockSeuil ?? 50000, tauxPossessionAnnuel: 2 };
  }
}

async function loadCmpMap(societeId, depotId) {
  const hist = await prisma.historiqueCMP.findMany({
    where: {
      article: { societeId: Number(societeId) },
      ...(depotId ? { depotId: Number(depotId) } : {}),
    },
    orderBy: { dateCalcul: "desc" },
    select: { articleId: true, depotId: true, nouveauCMP: true },
  });
  const map = new Map();
  for (const h of hist) {
    const key = `${h.articleId}-${h.depotId}`;
    if (!map.has(key)) map.set(key, Number(h.nouveauCMP) || 0);
  }
  return map;
}

async function getDeadStock(societeId, { depotId, joursSeuilSansMouvement = 90, tauxPossession } = {}) {
  const sid = Number(societeId);
  const soc = await loadSocieteCoutParams(sid);
  const seuilMontant = soc?.deadStockSeuil ?? 50000;
  const tauxPossessionAnnuel = clampTauxPossession(tauxPossession ?? soc?.tauxPossessionAnnuel ?? 2);
  const seuil = Math.max(1, Number(joursSeuilSansMouvement) || 90);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - seuil);

  const [stocks, cmpMap] = await Promise.all([
    prisma.stock.findMany({
      where: {
        quantite: { gt: 0 },
        depot: { societeId: sid, ...(depotId ? { id: Number(depotId) } : {}) },
      },
      include: {
        article: {
          select: {
            id: true,
            code: true,
            libelle: true,
            prixAchat: true,
            famille: { select: { id: true, nom: true, code: true } },
          },
        },
        depot: { select: { id: true, code: true, libelle: true } },
      },
    }),
    loadCmpMap(sid, depotId),
  ]);

  const rows = [];
  const now = Date.now();
  for (const s of stocks) {
    const last = s.dateLastMvt ? new Date(s.dateLastMvt) : null;
    const immobile = !last || last < cutoff;
    if (!immobile) continue;
    const joursImmobilise = last
      ? Math.floor((now - last.getTime()) / 86400000)
      : seuil + 1;
    const qte = Number(s.quantite);
    const cmp = cmpMap.get(`${s.articleId}-${s.depotId}`);
    const prixAchat = Number(s.article.prixAchat || 0);
    const prix = cmp != null && cmp > 0 ? cmp : prixAchat;
    const valeurSource = cmp != null && cmp > 0 ? "cmp" : "prixAchat";
    const valeurBloquee = round3(qte * prix);
    const coutMensuel = round3((valeurBloquee * tauxPossessionAnnuel) / 100 / 12);
    rows.push({
      articleId: s.articleId,
      depotId: s.depotId,
      article: s.article,
      depot: s.depot,
      quantite: qte,
      valeurBloquee,
      coutMensuel,
      valeurSource,
      joursImmobilise,
      dateLastMvt: s.dateLastMvt,
    });
  }

  rows.sort((a, b) => b.joursImmobilise - a.joursImmobilise);
  const totalValeurBloquee = round3(rows.reduce((sum, r) => sum + r.valeurBloquee, 0));
  const coutMensuelDormant = round3(rows.reduce((sum, r) => sum + Number(r.coutMensuel || 0), 0));
  return {
    joursSeuil: seuil,
    seuilAlerteMontant: seuilMontant,
    alerteMontantEleve: totalValeurBloquee > seuilMontant,
    totalValeurBloquee,
    coutMensuelDormant,
    tauxPossessionAnnuel,
    items: rows,
  };
}

function parsePeriodeRange(periode) {
  const [y, m] = String(periode).split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

async function getTauxRotation(societeId, { depotId, periode } = {}) {
  const sid = Number(societeId);
  if (!periode || !/^\d{4}-\d{2}$/.test(String(periode))) {
    const err = new Error("periode requise (YYYY-MM)");
    err.status = 400;
    throw err;
  }
  const { start, end } = parsePeriodeRange(periode);
  const did = depotId ? Number(depotId) : null;

  const stocks = await prisma.stock.findMany({
    where: {
      depot: { societeId: sid, ...(did ? { id: did } : {}) },
    },
    include: { article: { select: { id: true, code: true, libelle: true } } },
  });

  const byArticle = new Map();
  for (const s of stocks) {
    const key = `${s.articleId}-${s.depotId}`;
    if (!byArticle.has(key)) {
      byArticle.set(key, {
        articleId: s.articleId,
        depotId: s.depotId,
        article: s.article,
        stockFin: 0,
      });
    }
    byArticle.get(key).stockFin += Number(s.quantite);
  }

  const sorties = await prisma.mouvement.groupBy({
    by: ["articleId", "depotId"],
    where: {
      createdAt: { gte: start, lte: end },
      type: { startsWith: "SORTIE" },
      statut: "VALIDE",
      article: { societeId: sid },
      ...(did ? { depotId: did } : {}),
    },
    _sum: { quantite: true },
  });

  const sortieMap = new Map(sorties.map((r) => [`${r.articleId}-${r.depotId}`, Number(r._sum.quantite || 0)]));

  const items = [];
  for (const row of byArticle.values()) {
    const key = `${row.articleId}-${row.depotId}`;
    const qteSorties = sortieMap.get(key) || 0;
    const stockMoyen = row.stockFin > 0 ? row.stockFin : 0;
    const rotation = stockMoyen > 0 ? Math.round((qteSorties / stockMoyen) * 1000) / 1000 : 0;
    items.push({
      articleId: row.articleId,
      depotId: row.depotId,
      article: row.article,
      qteSorties,
      stockMoyen,
      rotation,
    });
  }

  items.sort((a, b) => a.rotation - b.rotation);
  return { periode, items };
}

/**
 * Rentabilité article : marge brute, coût stockage mensuel, marge nette.
 * @param {number} articleId
 * @param {number} depotId
 * @param {number} societeId
 */
async function calculateArticleProfitability(articleId, depotId, societeId) {
  const sid = Number(societeId);
  const aid = Number(articleId);
  const did = Number(depotId);
  const art = await prisma.article.findFirst({
    where: { id: aid, societeId: sid },
    select: { id: true, code: true, libelle: true, prixAchat: true, prixVente: true, poids: true },
  });
  if (!art) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  const dep = await prisma.depot.findFirst({ where: { id: did, societeId: sid } });
  if (!dep) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }
  const prixVente = Number(art.prixVente || 0);
  const valuationService = require("../valuation/valuation.service");
  const coutReel = await valuationService.getCurrentCMP(sid, aid, did);
  const prixAchat = coutReel != null && coutReel > 0 ? coutReel : Number(art.prixAchat || 0);
  const coutSource = coutReel != null && coutReel > 0 ? "valorisation" : "prixAchatBrut";
  const grossMargin = Math.round((prixVente - prixAchat) * 1000) / 1000;

  const now = new Date();
  const periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const depotTotal = await getDepotCoutTotal(sid, did, periode);

  // Répartition pondérée par poids × quantité (proxy du volume physique occupé).
  // On récupère TOUTES les lignes de stock du dépôt (avec et sans emplacement)
  // pour que le total ET la quantité de CET article soient calculés sur la même
  // base — sinon un article suivi uniquement par emplacement se retrouverait
  // avec qte=0 et 0% de part alors qu'il a bien du stock réel.
  const stocksDepotRows = await prisma.stock.findMany({
    where: { depotId: did, quantite: { gt: 0 } },
    include: { article: { select: { poids: true } } },
  });
  const poidsTotalDepot = stocksDepotRows.reduce(
    (s, r) => s + Number(r.article?.poids || 0) * Number(r.quantite || 0),
    0
  );
  const qte = stocksDepotRows
    .filter((r) => r.articleId === aid)
    .reduce((s, r) => s + Number(r.quantite || 0), 0);
  const poidsCetArticle = Number(art.poids || 0) * qte;

  const unitCout = await getLatestCout(sid, aid, did);
  let storageCostTotal;
  let storageCostSource;
  if (unitCout) {
    storageCostTotal = Number(unitCout.coutUnitaire) * qte;
    storageCostSource = "coutDedicace";
  } else if (poidsTotalDepot > 0) {
    storageCostTotal = (poidsCetArticle / poidsTotalDepot) * depotTotal;
    storageCostSource = "poidsReel";
  } else {
    const stocksDepot = stocksDepotRows.length;
    storageCostTotal = stocksDepot > 0 ? depotTotal / stocksDepot : 0;
    storageCostSource = "repartitionEgale";
  }
  const storageCostTotalR = round3(storageCostTotal);
  const storageCostUnitaire = qte > 0 ? round3(storageCostTotalR / qte) : 0;
  const netMarginUnitaire = round3(grossMargin - storageCostUnitaire);
  const netMarginTotal = round3(netMarginUnitaire * qte);
  const profitabilityRatio =
    prixAchat > 0 ? Math.round((netMarginUnitaire / prixAchat) * 10000) / 10000 : 0;

  return {
    article: art,
    depot: { id: dep.id, code: dep.code, libelle: dep.libelle },
    quantiteStock: qte,
    basis: "unitaire",
    prixVente,
    prixAchat,
    grossMargin,
    storageCost: storageCostUnitaire,
    storageCostUnitaire,
    storageCostTotal: storageCostTotalR,
    netMargin: netMarginUnitaire,
    netMarginUnitaire,
    netMarginTotal,
    profitabilityRatio,
    periodeRef: periode,
    coutSource,
    storageCostSource,
  };
}

/** Périodes coutStockage qui intersectent [dateDebut, dateFin]. */
function coutStockageInRangeWhere(societeId, depotId, dateDebut, dateFin) {
  return {
    societeId: Number(societeId),
    ...(depotId ? { depotId: Number(depotId) } : {}),
    periodeDebut: { lte: dateFin },
    OR: [{ periodeFin: null }, { periodeFin: { gte: dateDebut } }],
  };
}

/**
 * Total coûts stockage sur période : Σ (coutUnitaire × stock moyen proxy = qté courante).
 */
async function calcTotalPeriode({ societeId, depotId, dateDebut, dateFin }) {
  const sid = Number(societeId);
  const d0 = new Date(dateDebut);
  const d1 = new Date(dateFin);
  if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime())) {
    const err = new Error("dateDebut et dateFin requises (ISO)");
    err.status = 400;
    throw err;
  }
  if (d0 > d1) {
    const err = new Error("dateDebut doit preceder dateFin");
    err.status = 400;
    throw err;
  }

  const records = await prisma.coutStockage.findMany({
    where: coutStockageInRangeWhere(sid, depotId, d0, d1),
    include: {
      article: { select: { id: true, code: true, libelle: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
    orderBy: { periodeDebut: "desc" },
  });

  const items = [];
  let grandTotal = 0;
  let devise = "TND";

  for (const r of records) {
    const agg = await prisma.stock.aggregate({
      where: { articleId: r.articleId, depotId: r.depotId },
      _sum: { quantite: true },
    });
    const avgStock = Math.round(Number(agg._sum.quantite || 0) * 1000) / 1000;

    const totalCout = round2(Number(r.coutUnitaire) * avgStock);
    grandTotal += totalCout;
    devise = r.devise || devise;
    items.push({
      article: r.article,
      depot: r.depot,
      coutUnitaire: Number(r.coutUnitaire),
      avgStock,
      totalCout,
      devise: r.devise || "TND",
      periode: { debut: r.periodeDebut, fin: r.periodeFin },
    });
  }

  return { items, grandTotal: round2(grandTotal), devise };
}

function roundPct(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * KPI rentabilité par article (ventes vs CMP vs coût stockage).
 */
async function getKpiRentabiliteArticle({ societeId, depotId, articleId }) {
  const sid = Number(societeId);
  const valuationSvc = require("../valuation/valuation.service");

  const stocks = await prisma.stock.findMany({
    where: {
      depot: { societeId: sid },
      quantite: { gt: 0 },
      ...(depotId ? { depotId: Number(depotId) } : {}),
      ...(articleId ? { articleId: Number(articleId) } : {}),
    },
    include: {
      article: { select: { id: true, code: true, libelle: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
  });

  const out = [];
  for (const s of stocks) {
    const lignes = await prisma.ligneVente.findMany({
      where: { articleId: s.articleId, article: { societeId: sid } },
      select: { prixUnit: true, quantite: true, vente: { select: { statut: true } } },
    });
    const ok = lignes.filter((l) => l.vente?.statut && l.vente.statut !== "BROUILLON");
    let sumPxQ = 0;
    let sumQ = 0;
    for (const l of ok) {
      const q = Number(l.quantite) || 0;
      sumPxQ += Number(l.prixUnit) * q;
      sumQ += q;
    }
    const prixVenteMoyen = sumQ > 0 ? round2(sumPxQ / sumQ) : 0;
    const cmp = await valuationSvc.getCurrentCMP(sid, s.articleId, s.depotId);
    const cs = await getLatestCout(sid, s.articleId, s.depotId);
    const coutStockageMoyen = cs ? round2(Number(cs.coutUnitaire)) : 0;
    const margeNette = round2(prixVenteMoyen - (cmp || 0) - coutStockageMoyen);
    const tauxMarge = prixVenteMoyen > 0 ? roundPct((margeNette / prixVenteMoyen) * 100) : 0;

    out.push({
      article: s.article,
      depot: s.depot,
      prixVenteMoyen,
      cmp,
      coutStockage: coutStockageMoyen,
      margeNette,
      tauxMarge,
    });
  }

  const avgTauxMarge = out.length ? roundPct(out.reduce((s, r) => s + r.tauxMarge, 0) / out.length) : 0;
  const totalMargeNette = round2(out.reduce((s, r) => s + Number(r.margeNette || 0), 0));
  const positives = out.filter((r) => r.margeNette >= 0).length;
  return {
    items: out,
    kpis: {
      articles: out.length,
      avgTauxMarge,
      totalMargeNette,
      positives,
      negatives: out.length - positives,
    },
  };
}

function manualAppliesToMonth(manual, periodeYm) {
  if (!manual?.periodeDebut || !periodeYm) return false;
  const [y, m] = String(periodeYm).split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
  const start = new Date(manual.periodeDebut);
  const end = manual.periodeFin ? new Date(manual.periodeFin) : null;
  if (start > monthEnd) return false;
  if (end && end < monthStart) return false;
  return true;
}

/**
 * Imputation dépôt → article pour un mois, avec historique 6 mois au stock actuel.
 */
async function getImputation(societeId, { depotId, periode, months = 6 } = {}) {
  if (!depotId || !periode || !/^\d{4}-\d{2}$/.test(String(periode))) {
    const err = new Error("depotId et periode (YYYY-MM) requis");
    err.status = 400;
    throw err;
  }
  const sid = Number(societeId);
  const did = Number(depotId);
  const per = String(periode);
  const monthCount = Math.min(12, Math.max(1, Number(months) || 6));
  const at = periodeMidDate(per);

  const historyPeriods = Array.from({ length: monthCount }, (_, i) =>
    shiftPeriodeYm(per, i - (monthCount - 1))
  );

  const [stocks, entries, manuals, history] = await Promise.all([
    prisma.stock.findMany({
      where: { depotId: did, quantite: { gt: 0 }, depot: { societeId: sid } },
      include: {
        article: {
          select: { id: true, code: true, libelle: true, imageUrl: true, unite: true },
        },
      },
    }),
    getCoutEntries(did, per, sid),
    prisma.coutStockage.findMany({
      where: { societeId: sid, depotId: did, ...activeCoutFilter(at) },
      orderBy: { periodeDebut: "desc" },
    }),
    Promise.all(
      historyPeriods.map(async (p) => ({
        periode: p,
        total: await getDepotCoutTotal(sid, did, p),
      }))
    ),
  ]);

  const byArticle = new Map();
  for (const row of stocks) {
    const aid = row.articleId;
    if (!byArticle.has(aid)) {
      byArticle.set(aid, { articleId: aid, article: row.article, quantite: 0 });
    }
    byArticle.get(aid).quantite += Number(row.quantite) || 0;
  }
  const aggregated = Array.from(byArticle.values()).filter((r) => r.quantite > 0);
  const totalQty = aggregated.reduce((s, r) => s + r.quantite, 0);
  const totalDepotCost = Number(history.find((h) => h.periode === per)?.total || 0);

  const manualByArticle = new Map();
  for (const c of manuals) {
    if (!manualByArticle.has(c.articleId)) manualByArticle.set(c.articleId, c);
  }

  const items = aggregated
    .map((row) => {
      const pctStock = totalQty > 0 ? (row.quantite / totalQty) * 100 : 0;
      const manual = manualByArticle.get(row.articleId);
      let coutUnitaire = 0;
      let coutImpute = 0;
      let costSource = "none";
      if (manual != null && Number.isFinite(Number(manual.coutUnitaire))) {
        coutUnitaire = Number(manual.coutUnitaire);
        coutImpute = round3(coutUnitaire * row.quantite);
        costSource = "manual";
      } else if (totalDepotCost > 0 && totalQty > 0) {
        coutImpute = round3((totalDepotCost * pctStock) / 100);
        coutUnitaire = row.quantite > 0 ? round3(coutImpute / row.quantite) : 0;
        costSource = "calculated";
      }
      const sparkline = history.map((h) => {
        if (manual && manualAppliesToMonth(manual, h.periode)) {
          return Number(manual.coutUnitaire) || 0;
        }
        if (row.quantite > 0 && h.total > 0 && totalQty > 0) {
          return round3(((h.total * pctStock) / 100) / row.quantite);
        }
        return 0;
      });
      return {
        articleId: row.articleId,
        article: row.article,
        quantite: row.quantite,
        unite: row.article?.unite || "UN",
        pctStock: round2(pctStock),
        coutImpute,
        coutUnitaire,
        costSource,
        sparkline,
        commentaire: manual?.commentaire || "",
        manualId: manual?.id || null,
        devise: manual?.devise || "TND",
      };
    })
    .sort((a, b) => b.coutImpute - a.coutImpute);

  return {
    periode: per,
    depotId: did,
    totalDepotCost: round3(totalDepotCost),
    hasDepotCosts: totalDepotCost > 0,
    entriesCount: entries.length,
    articlesCount: items.length,
    periodesActives: history.filter((h) => h.total > 0).length,
    sparklineBasis: "stock_actuel",
    history,
    items,
  };
}

async function updateParametres(societeId, { tauxPossessionAnnuel } = {}) {
  const sid = Number(societeId);
  if (tauxPossessionAnnuel == null) {
    const err = new Error("Aucun paramètre à mettre à jour");
    err.status = 400;
    throw err;
  }
  const value = clampTauxPossession(tauxPossessionAnnuel);
  try {
    await prisma.$executeRaw`UPDATE Societe SET tauxPossessionAnnuel = ${value} WHERE id = ${sid}`;
  } catch (e) {
    try {
      await prisma.societe.update({
        where: { id: sid },
        data: { tauxPossessionAnnuel: value },
      });
    } catch {
      const err = new Error("Impossible d'enregistrer le taux — appliquez la migration tauxPossessionAnnuel");
      err.status = 503;
      throw err;
    }
  }
  return getParametres(sid);
}

async function getParametres(societeId) {
  const soc = await loadSocieteCoutParams(societeId);
  return {
    tauxPossessionAnnuel: clampTauxPossession(soc?.tauxPossessionAnnuel ?? 2),
    deadStockSeuil: soc?.deadStockSeuil ?? 50000,
  };
}

module.exports = {
  listCoutStockage,
  getCoutStockage,
  createCoutStockage,
  updateCoutStockage,
  deleteCoutStockage,
  getLatestCout,
  saveCoutDepotMensuel,
  listCoutDepotMensuel,
  getCoutEntries,
  getCoutEntriesGroupedByCategorie,
  createCoutEntry,
  updateCoutEntry,
  deleteCoutEntry,
  getTotalCoutEntries,
  getDepotCoutTotal,
  getDeadStock,
  getTauxRotation,
  calculateArticleProfitability,
  calcTotalPeriode,
  getKpiRentabiliteArticle,
  getImputation,
  getParametres,
  updateParametres,
};
