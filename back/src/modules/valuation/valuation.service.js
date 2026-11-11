const prisma = require("../../config/database");
const coutStockageSvc = require("../coutStockage/coutStockage.service");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function getStockQty(tx, articleId, depotId) {
  const client = tx || prisma;
  const row = await client.stock.findFirst({
    where: { articleId: Number(articleId), depotId: Number(depotId), emplacementId: null },
  });
  return row ? Number(row.quantite) : 0;
}

/** Achats pris en compte pour le dernier prix (hors brouillon / annulé). */
const ACHAT_STATUTS_VALORISATION = { notIn: ["BROUILLON", "ANNULE"] };

function achatDateEffective(achat) {
  return achat?.dateReception || achat?.dateCommande || null;
}

function ligneAchatWhere(societeId, articleId, depotId) {
  const sid = Number(societeId);
  const aid = Number(articleId);
  const did = depotId != null && depotId !== "" ? Number(depotId) : null;
  return {
    articleId: aid,
    achat: {
      societeId: sid,
      statut: ACHAT_STATUTS_VALORISATION,
      ...(did ? { depotId: did } : {}),
    },
  };
}

/**
 * Dernier prix d'achat réel (LigneAchat la plus récente), repli sur article.prixAchat.
 * @returns {{ valeurUnit: number, dateAchat: Date|null, achatReference: string|null }}
 */
async function getDernierPrixAchat(societeId, articleId, depotId) {
  const sid = Number(societeId);
  const aid = Number(articleId);

  const ligne = await prisma.ligneAchat.findFirst({
    where: ligneAchatWhere(sid, aid, depotId),
    include: {
      achat: { select: { reference: true, dateCommande: true, dateReception: true } },
    },
    orderBy: [{ achat: { dateReception: "desc" } }, { achat: { dateCommande: "desc" } }],
  });

  if (ligne) {
    return {
      valeurUnit: round2(ligne.prixUnit),
      dateAchat: achatDateEffective(ligne.achat),
      achatReference: ligne.achat.reference,
    };
  }

  const art = await prisma.article.findFirst({
    where: { id: aid, societeId: sid },
    select: { prixAchat: true },
  });
  if (!art) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }

  return {
    valeurUnit: round2(art.prixAchat ?? 0),
    dateAchat: null,
    achatReference: null,
  };
}

/**
 * Historique des N derniers prix d'achat (pour graphique d'évolution).
 */
async function getDernierPrixAchatHistory(societeId, articleId, depotId, limit = 10) {
  const sid = Number(societeId);
  const aid = Number(articleId);

  const art = await prisma.article.findFirst({
    where: { id: aid, societeId: sid },
    select: { id: true },
  });
  if (!art) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }

  const lignes = await prisma.ligneAchat.findMany({
    where: ligneAchatWhere(sid, aid, depotId),
    include: {
      achat: { select: { reference: true, dateCommande: true, dateReception: true } },
    },
    orderBy: [{ achat: { dateReception: "desc" } }, { achat: { dateCommande: "desc" } }],
    take: Math.min(100, Math.max(1, Number(limit) || 10)),
  });

  return lignes.map((l) => ({
    prixUnit: round2(l.prixUnit),
    dateAchat: achatDateEffective(l.achat),
    achatReference: l.achat.reference,
    quantite: round2(l.quantite),
  }));
}

async function getCurrentCMP(societeId, articleId, depotId, tx) {
  const client = tx || prisma;
  const sid = Number(societeId);
  const aid = Number(articleId);
  const did = Number(depotId);

  const last = await client.historiqueCMP.findFirst({
    where: {
      articleId: aid,
      depotId: did,
      article: { societeId: sid },
    },
    orderBy: { dateCalcul: "desc" },
  });
  if (last) return round2(last.nouveauCMP);

  const art = await client.article.findFirst({
    where: { id: aid, societeId: sid },
    select: { prixAchat: true },
  });
  return round2(art?.prixAchat ?? 0);
}

/**
 * Coût unitaire courant d'un article à un dépôt, selon la méthode de valorisation.
 * Réutilise getCurrentCMP / couches FIFO-LIFO / dernier prix d'achat (pas le prixAchat brut).
 * @param {object|null} tx - client Prisma transactionnel (ou null → prisma)
 * @param {{ societeId: number, articleId: number, depotId: number, methode?: string }} params
 * @returns {Promise<number>}
 */
async function getCoutUnitaireCourant(tx, { societeId, articleId, depotId, methode } = {}) {
  const client = tx || prisma;
  const sid = Number(societeId);
  const aid = Number(articleId);
  const did = Number(depotId);

  const art = await client.article.findFirst({
    where: { id: aid, societeId: sid },
    select: { prixAchat: true, strategieSortie: true },
  });
  if (!art) return 0;

  const paht = round2(Number(art.prixAchat ?? 0));

  let m = String(methode || "").toUpperCase().trim();
  if (!m) {
    const snap = await client.valorisation.findFirst({
      where: { articleId: aid },
      orderBy: { date: "desc" },
      select: { methode: true },
    });
    if (snap?.methode) {
      m = String(snap.methode).toUpperCase();
    } else {
      const strat = String(art.strategieSortie || "FIFO").toUpperCase();
      if (strat === "LIFO") m = "LIFO";
      else if (strat === "DERNIER_PRIX" || strat === "DERNIER_PRIX_ACHAT") m = "DERNIER_PRIX_ACHAT";
      else if (strat === "FEFO" || strat === "FIFO" || strat === "STANDARD") m = "FIFO";
      else m = "CMP";
    }
  }

  if (m === "CMP") {
    return getCurrentCMP(sid, aid, did, tx);
  }

  if (m === "FIFO" || m === "FEFO") {
    const first = await client.couchesFifo.findFirst({
      where: { articleId: aid, depotId: did, quantiteRestante: { gt: 0 } },
      orderBy: { orderIndex: "asc" },
    });
    return first ? round2(Number(first.prixUnitaire)) : paht;
  }

  if (m === "LIFO") {
    const stockRow = await client.stock.findFirst({
      where: { articleId: aid, depotId: did },
      select: { quantite: true },
    });
    const qte = stockRow ? Number(stockRow.quantite) : 0;
    if (qte > 0) {
      try {
        const lifo = await calculateLIFO(sid, aid, did, qte);
        if (lifo.unit_cost) return round2(lifo.unit_cost);
      } catch {
        /* fallback couche la plus récente */
      }
    }
    const last = await client.couchesFifo.findFirst({
      where: { articleId: aid, depotId: did, quantiteRestante: { gt: 0 } },
      orderBy: { orderIndex: "desc" },
    });
    return last ? round2(Number(last.prixUnitaire)) : paht;
  }

  if (m === "DERNIER_PRIX_ACHAT" || m === "DERNIER_PRIX") {
    const dp = await getDernierPrixAchat(sid, aid, did);
    return round2(dp.valeurUnit);
  }

  if (m === "PAHT") return paht;

  return getCurrentCMP(sid, aid, did, tx);
}

async function nextFifoOrderIndex(tx, articleId, depotId) {
  const agg = await tx.couchesFifo.aggregate({
    where: { articleId: Number(articleId), depotId: Number(depotId) },
    _max: { orderIndex: true },
  });
  return (agg._max.orderIndex ?? 0) + 1;
}

async function sumCouchesRestantes(tx, articleId, depotId) {
  const agg = await tx.couchesFifo.aggregate({
    where: { articleId: Number(articleId), depotId: Number(depotId) },
    _sum: { quantiteRestante: true },
  });
  return round2(Number(agg._sum.quantiteRestante || 0));
}

/**
 * Si Stock physique > Σ couches FIFO restantes, crée une couche "legacy"
 * pour combler l'écart (inventaire / entrée manuelle) — sans recalculer le CMP
 * (le stock est déjà comptabilisé).
 */
async function ensureStockCoveredByCouches(tx, { societeId, articleId, depotId }) {
  const sid = Number(societeId);
  const aid = Number(articleId);
  const did = Number(depotId);
  const { sumStockQuantite } = require("../mouvements/mouvements.service");

  const stockQty = await sumStockQuantite(tx, aid, did);
  const coucheQty = await sumCouchesRestantes(tx, aid, did);
  const gap = round2(stockQty - coucheQty);
  if (gap <= 1e-6) return null;

  let prix = 0;
  try {
    prix = await getCurrentCMP(sid, aid, did, tx);
  } catch {
    prix = 0;
  }
  if (!(prix > 0)) {
    const art = await tx.article.findFirst({
      where: { id: aid, societeId: sid },
      select: { prixAchat: true },
    });
    prix = round2(art?.prixAchat ?? 0);
  }

  const orderIndex = await nextFifoOrderIndex(tx, aid, did);
  return tx.couchesFifo.create({
    data: {
      articleId: aid,
      depotId: did,
      lotId: null,
      quantiteInitiale: gap,
      quantiteRestante: gap,
      prixUnitaire: prix,
      orderIndex,
      achatId: null,
    },
  });
}

/**
 * Entrée stock — à appeler dans une transaction Prisma existante.
 */
async function onEntreeStock(tx, { societeId, articleId, depotId, quantite, prixUnitaire, achatId, lotId }) {
  const sid = Number(societeId);
  const aid = Number(articleId);
  const did = Number(depotId);
  const qte = Number(quantite);
  if (qte < 0) {
    const err = new Error("Quantité d'entrée négative refusée");
    err.status = 400;
    throw err;
  }
  const prix = round2(prixUnitaire);

  const stockAvant = await getStockQty(tx, aid, did);
  const oldCMP = await getCurrentCMP(sid, aid, did, tx);
  const denom = stockAvant + qte;
  const nouveauCMP = denom > 0 ? round2((stockAvant * oldCMP + qte * prix) / denom) : prix;

  await tx.historiqueCMP.create({
    data: {
      articleId: aid,
      depotId: did,
      ancienCMP: oldCMP,
      nouveauCMP,
      quantiteEntree: qte,
      prixEntree: prix,
    },
  });

  const orderIndex = await nextFifoOrderIndex(tx, aid, did);
  await tx.couchesFifo.create({
    data: {
      articleId: aid,
      depotId: did,
      lotId: lotId ? Number(lotId) : null,
      quantiteInitiale: qte,
      quantiteRestante: qte,
      prixUnitaire: prix,
      orderIndex,
      achatId: achatId ? Number(achatId) : null,
    },
  });

  const existingVal = await tx.valorisation.findFirst({
    where: { articleId: aid, methode: "CMP" },
    orderBy: { date: "desc" },
  });
  if (existingVal) {
    await tx.valorisation.update({
      where: { id: existingVal.id },
      data: { valeurUnit: nouveauCMP, date: new Date() },
    });
  } else {
    await tx.valorisation.create({
      data: { articleId: aid, methode: "CMP", valeurUnit: nouveauCMP },
    });
  }

  return { ancienCMP: oldCMP, nouveauCMP };
}

/**
 * Lignes { lotId, quantite } exploitables. Un tableau vide, absent, ou sans
 * quantité (ex. n° de série) laisse le chemin orderIndex inchangé.
 */
function lotLinesFromConsumed(lotsConsumed) {
  if (!Array.isArray(lotsConsumed) || lotsConsumed.length === 0) return [];
  const lines = [];
  for (const row of lotsConsumed) {
    const lotId = Number(row?.lotId);
    const quantite = Number(row?.quantite);
    if (!Number.isFinite(lotId) || lotId <= 0) continue;
    if (!Number.isFinite(quantite) || quantite <= 0) continue;
    lines.push({ lotId, quantite: round2(quantite) });
  }
  return lines;
}

function insufficientCouchesError() {
  const err = new Error("Couches FIFO insuffisantes pour la sortie");
  err.status = 400;
  return err;
}

async function decrementCouches(tx, couches, quantite, coutsDetail) {
  let restant = Number(quantite);
  let coutTotal = 0;

  for (const couche of couches) {
    if (restant <= 0) break;
    const dispo = Number(couche.quantiteRestante);
    const prise = round2(Math.min(restant, dispo));
    const nextRest = round2(dispo - prise);
    await tx.couchesFifo.update({
      where: { id: couche.id },
      data: { quantiteRestante: nextRest },
    });
    const part = round2(prise * Number(couche.prixUnitaire));
    coutTotal += part;
    coutsDetail.push({
      coucheId: couche.id,
      orderIndex: couche.orderIndex,
      qteConsommee: prise,
      prix: Number(couche.prixUnitaire),
      montant: part,
    });
    restant = round2(restant - prise);
  }

  return { restant, coutTotal };
}

/**
 * Consomme les couches de valorisation.
 * Sans lotsConsumed : FIFO/LIFO strict par orderIndex (articles non tracés par lot).
 * Avec lotsConsumed : chaque lot physiquement sorti est valorisé sur ses propres
 * couches (lotId), puis, si la couche du lot est trop courte, sur la plus ancienne
 * couche du même article/dépôt — sans bloquer la sortie.
 */
async function consumeCouches(tx, articleId, depotId, quantite, order, lotsConsumed) {
  const orderBy = order === "LIFO" ? { orderIndex: "desc" } : { orderIndex: "asc" };
  const aid = Number(articleId);
  const did = Number(depotId);
  const coutsDetail = [];
  const lotLines = lotLinesFromConsumed(lotsConsumed);

  if (lotLines.length === 0) {
    const couches = await tx.couchesFifo.findMany({
      where: {
        articleId: aid,
        depotId: did,
        quantiteRestante: { gt: 0 },
      },
      orderBy,
    });
    const { restant, coutTotal } = await decrementCouches(tx, couches, quantite, coutsDetail);
    if (restant > 1e-6) throw insufficientCouchesError();
    return { coutTotal: round2(coutTotal), coutsDetail };
  }

  let restant = Number(quantite);
  let coutTotal = 0;

  for (const line of lotLines) {
    if (restant <= 1e-6) break;
    const cible = round2(Math.min(line.quantite, restant));
    const couchesLot = await tx.couchesFifo.findMany({
      where: {
        articleId: aid,
        depotId: did,
        lotId: line.lotId,
        quantiteRestante: { gt: 0 },
      },
      orderBy,
    });
    const surLot = await decrementCouches(tx, couchesLot, cible, coutsDetail);
    coutTotal += surLot.coutTotal;
    restant = round2(restant - round2(cible - surLot.restant));

    if (surLot.restant > 1e-6) {
      console.warn(
        `[valuation] Couche FIFO liée au lot ${line.lotId} insuffisante (article ${aid}, dépôt ${did}) : ${surLot.restant} unité(s) manquante(s). Complément sur la couche la plus ancienne (orderIndex) — la sortie n'est pas bloquée.`
      );
      const fallback = await tx.couchesFifo.findMany({
        where: {
          articleId: aid,
          depotId: did,
          quantiteRestante: { gt: 0 },
        },
        orderBy: { orderIndex: "asc" },
      });
      const surFallback = await decrementCouches(tx, fallback, surLot.restant, coutsDetail);
      coutTotal += surFallback.coutTotal;
      restant = round2(restant - round2(surLot.restant - surFallback.restant));
    }
  }

  // lotsConsumed ne couvre pas toute la quantité sortie : le reliquat suit orderIndex.
  if (restant > 1e-6) {
    const couches = await tx.couchesFifo.findMany({
      where: {
        articleId: aid,
        depotId: did,
        quantiteRestante: { gt: 0 },
      },
      orderBy,
    });
    const reste = await decrementCouches(tx, couches, restant, coutsDetail);
    coutTotal += reste.coutTotal;
    restant = reste.restant;
  }

  if (restant > 1e-6) throw insufficientCouchesError();
  return { coutTotal: round2(coutTotal), coutsDetail };
}

/**
 * Valorisation LIFO : consomme les couches les plus récentes en premier.
 * @returns {{ totalValue: number, unit_cost: number, batches_consumed: object[] }}
 */
async function calculateLIFO(societeId, articleId, depotId, quantity = null) {
  const sid = Number(societeId);
  const aid = Number(articleId);
  const did = Number(depotId);
  const art = await prisma.article.findFirst({ where: { id: aid, societeId: sid } });
  if (!art) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }

  const couches = await prisma.couchesFifo.findMany({
    where: { articleId: aid, depotId: did, quantiteRestante: { gt: 0 } },
    orderBy: { orderIndex: "desc" },
  });

  let restant =
    quantity != null
      ? Number(quantity)
      : couches.reduce((s, c) => s + Number(c.quantiteRestante), 0);

  const batches_consumed = [];
  let totalValue = 0;

  for (const couche of couches) {
    if (restant <= 1e-9) break;
    const dispo = Number(couche.quantiteRestante);
    const prise = round2(Math.min(restant, dispo));
    const montant = round2(prise * Number(couche.prixUnitaire));
    totalValue += montant;
    batches_consumed.push({
      coucheId: couche.id,
      orderIndex: couche.orderIndex,
      qteConsommee: prise,
      prix: Number(couche.prixUnitaire),
      montant,
    });
    restant = round2(restant - prise);
  }

  const qteDemandee = quantity != null ? Number(quantity) : batches_consumed.reduce((s, b) => s + b.qteConsommee, 0);
  const unit_cost = qteDemandee > 0 ? round2(totalValue / qteDemandee) : 0;

  return { totalValue: round2(totalValue), unit_cost, batches_consumed, quantite: qteDemandee };
}

/**
 * Sortie stock — méthode FIFO | LIFO | CMP
 */
async function onSortieStock(tx, { societeId, articleId, depotId, quantite, methode = "FIFO", lotsConsumed } = {}) {
  if (Number(quantite) < 0) {
    const err = new Error("Quantité de sortie négative refusée");
    err.status = 400;
    throw err;
  }
  const m = String(methode || "FIFO").toUpperCase();
  if (m === "CMP") {
    const cmp = await getCurrentCMP(societeId, articleId, depotId, tx);
    const qte = Number(quantite);
    return {
      coutTotal: round2(qte * cmp),
      coutsDetail: [{ methode: "CMP", qteConsommee: qte, prix: cmp, montant: round2(qte * cmp) }],
    };
  }
  const order = m === "LIFO" ? "LIFO" : "FIFO";
  return consumeCouches(tx, articleId, depotId, quantite, order, lotsConsumed);
}

async function stockValuation({ societeId, depotId, methodePrix = "PAHT", page = 1, limit = 25 }) {
  const sid = Number(societeId);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum =
    Number(limit) >= 5000
      ? Math.min(50000, Math.max(1, Number(limit) || 50000))
      : Math.min(100, Math.max(1, Number(limit) || 25));
  const stocks = await prisma.stock.findMany({
    where: {
      depot: { societeId: sid },
      quantite: { gt: 0 },
      ...(depotId ? { depotId: Number(depotId) } : {}),
    },
    include: {
      article: { select: { id: true, code: true, libelle: true, prixAchat: true, prixVente: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
  });

  const lignes = [];
  let total = 0;
  const methode = String(methodePrix || "PAHT").toUpperCase();

  for (const s of stocks) {
    let unit = Number(s.article.prixAchat);
    if (methode === "PVHT") unit = Number(s.article.prixVente);
    if (methode === "CMP") unit = await getCurrentCMP(sid, s.articleId, s.depotId);
    if (methode === "COUT_STOCKAGE") {
      const cs = await coutStockageSvc.getLatestCout(sid, s.articleId, s.depotId);
      unit = cs ? Number(cs.coutUnitaire) : Number(s.article.prixAchat);
    }
    if (methode === "FIFO") {
      const first = await prisma.couchesFifo.findFirst({
        where: {
          articleId: s.articleId,
          depotId: s.depotId,
          quantiteRestante: { gt: 0 },
        },
        orderBy: { orderIndex: "asc" },
      });
      unit = first ? Number(first.prixUnitaire) : unit;
    }
    if (methode === "LIFO") {
      const lifo = await calculateLIFO(sid, s.articleId, s.depotId, Number(s.quantite));
      unit = lifo.unit_cost || unit;
    }
    if (methode === "DERNIER_PRIX_ACHAT") {
      const dp = await getDernierPrixAchat(sid, s.articleId, s.depotId);
      unit = dp.valeurUnit;
    }

    const q = Number(s.quantite);
    const valeur = round2(q * unit);
    total += valeur;
    lignes.push({
      articleId: s.articleId,
      articleCode: s.article.code,
      articleLibelle: s.article.libelle,
      depotId: s.depotId,
      depotCode: s.depot.code,
      quantite: q,
      prixUnitaire: round2(unit),
      valeur,
    });
  }

  lignes.sort((a, b) => b.valeur - a.valeur);

  const totalRows = lignes.length;
  const totalPages = Math.ceil(totalRows / limitNum) || 1;
  const skip = (pageNum - 1) * limitNum;
  const paginated = lignes.slice(skip, skip + limitNum);

  return {
    methodePrix: methode,
    valeurTotale: round2(total),
    lignes: paginated,
    data: paginated,
    total: totalRows,
    page: pageNum,
    totalPages,
    limit: limitNum,
    generatedAt: new Date().toISOString(),
  };
}

async function compareMethodes(societeId, articleId, depotId) {
  const sid = Number(societeId);
  const aid = Number(articleId);
  const did = Number(depotId);

  const stock = await prisma.stock.findFirst({
    where: { articleId: aid, depotId: did, depot: { societeId: sid } },
    include: { article: true },
  });
  const qte = stock ? Number(stock.quantite) : 0;
  const art = stock?.article || (await prisma.article.findFirst({ where: { id: aid, societeId: sid } }));
  if (!art) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }

  const paht = round2(Number(art.prixAchat));
  const pvht = round2(Number(art.prixVente));
  const cmp = await getCurrentCMP(sid, aid, did);

  const first = await prisma.couchesFifo.findFirst({
    where: { articleId: aid, depotId: did, quantiteRestante: { gt: 0 } },
    orderBy: { orderIndex: "asc" },
  });
  const fifo = first ? round2(Number(first.prixUnitaire)) : paht;

  const last = await prisma.couchesFifo.findFirst({
    where: { articleId: aid, depotId: did, quantiteRestante: { gt: 0 } },
    orderBy: { orderIndex: "desc" },
  });
  let lifo = last ? round2(Number(last.prixUnitaire)) : paht;
  if (qte > 0) {
    const lifoCalc = await calculateLIFO(sid, aid, did, qte);
    if (lifoCalc.unit_cost) lifo = lifoCalc.unit_cost;
  }

  const build = (methode, valeurUnit, extra = {}) => ({
    methode,
    valeurUnit: round2(valeurUnit),
    valeurTotale: round2(qte * valeurUnit),
    quantite: qte,
    ...extra,
  });

  const dernierPrix = await getDernierPrixAchat(sid, aid, did);

  return [
    build("PAHT", paht),
    build("CMP", cmp),
    build("FIFO", fifo),
    build("LIFO", lifo),
    build("PVHT", pvht),
    build("DERNIER_PRIX_ACHAT", dernierPrix.valeurUnit, {
      dateAchat: dernierPrix.dateAchat,
      achatReference: dernierPrix.achatReference,
    }),
  ];
}

async function getCMPHistory(societeId, articleId, depotId, limit = 30) {
  return prisma.historiqueCMP.findMany({
    where: {
      articleId: Number(articleId),
      depotId: Number(depotId),
      article: { societeId: Number(societeId) },
    },
    orderBy: { dateCalcul: "desc" },
    take: Math.min(100, Math.max(1, Number(limit) || 30)),
  });
}

/**
 * Comparaison valorisations par article (stocks > 0).
 */
async function getComparaisonMethodes({ societeId, depotId, articleId }) {
  const sid = Number(societeId);
  const stocks = await prisma.stock.findMany({
    where: {
      depot: { societeId: sid },
      quantite: { gt: 0 },
      ...(depotId ? { depotId: Number(depotId) } : {}),
      ...(articleId ? { articleId: Number(articleId) } : {}),
    },
    include: {
      article: { select: { id: true, code: true, libelle: true, prixAchat: true, prixVente: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
  });

  const out = [];
  for (const s of stocks) {
    const qte = Number(s.quantite);
    const paht = round2(Number(s.article.prixAchat));
    const pvht = round2(Number(s.article.prixVente));
    const cmpU = await getCurrentCMP(sid, s.articleId, s.depotId);
    const first = await prisma.couchesFifo.findFirst({
      where: { articleId: s.articleId, depotId: s.depotId, quantiteRestante: { gt: 0 } },
      orderBy: { orderIndex: "asc" },
    });
    const fifoU = first ? round2(Number(first.prixUnitaire)) : paht;
    const lifoCalc = await calculateLIFO(sid, s.articleId, s.depotId, qte);
    const lifoU = qte > 0 && lifoCalc.unit_cost ? round2(lifoCalc.unit_cost) : paht;
    const dernierPrix = await getDernierPrixAchat(sid, s.articleId, s.depotId);
    const dernierPrixU = dernierPrix.valeurUnit;

    const val_cmp = round2(qte * cmpU);
    const val_fifo = round2(qte * fifoU);
    const val_lifo = round2(qte * lifoU);
    const val_paht = round2(qte * paht);
    const val_pvht = round2(qte * pvht);
    const val_dernier_prix = round2(qte * dernierPrixU);
    const diff_cmp_fifo = round2(val_fifo - val_cmp);

    out.push({
      articleId: s.articleId,
      libelle: s.article.libelle,
      code: s.article.code,
      depotId: s.depotId,
      depotCode: s.depot.code,
      qte,
      val_cmp,
      val_fifo,
      val_lifo,
      val_paht,
      val_pvht,
      val_dernier_prix,
      dernier_prix_unitaire: dernierPrixU,
      dernier_prix_date: dernierPrix.dateAchat,
      diff_cmp_fifo,
    });
  }
  return out;
}

/**
 * Recalcule l’instantané CMP en base (table Valorisation).
 */
async function revalidateSnapshot({ societeId, articleId, depotId }) {
  const sid = Number(societeId);
  const aid = Number(articleId);
  const did = Number(depotId);
  const art = await prisma.article.findFirst({ where: { id: aid, societeId: sid } });
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

  const cmp = await getCurrentCMP(sid, aid, did);
  const existing = await prisma.valorisation.findFirst({
    where: { articleId: aid, methode: "CMP" },
    orderBy: { date: "desc" },
  });
  let row;
  if (existing) {
    row = await prisma.valorisation.update({
      where: { id: existing.id },
      data: { valeurUnit: cmp, date: new Date() },
    });
  } else {
    row = await prisma.valorisation.create({
      data: { articleId: aid, methode: "CMP", valeurUnit: cmp },
    });
  }
  return { valorisation: row, cmp, articleId: aid, depotId: did };
}

function roundPct(n) {
  return Math.round(Number(n) * 10) / 10;
}

function periodStart(periode) {
  const d = new Date();
  const months = periode === "3m" ? 3 : periode === "1y" ? 12 : 6;
  d.setMonth(d.getMonth() - months);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getRentabilite({ societeId, periode = "6m", familleId, depotId, seuilMargeMin }) {
  const sid = Number(societeId);
  const start = periodStart(periode);
  const seuil = seuilMargeMin != null && seuilMargeMin !== "" ? Number(seuilMargeMin) : null;

  const articles = await prisma.article.findMany({
    where: {
      societeId: sid,
      actif: true,
      ...(familleId ? { familleId: Number(familleId) } : {}),
    },
    select: { id: true, code: true, libelle: true, familleId: true },
  });

  const depots = depotId
    ? await prisma.depot.findMany({ where: { id: Number(depotId), societeId: sid } })
    : await prisma.depot.findMany({ where: { societeId: sid } });

  const items = [];
  let margeBruteTotal = 0;
  let margeNetteTotal = 0;
  let bestArticle = null;
  let articlesPerte = 0;

  for (const art of articles) {
    const lignes = await prisma.ligneVente.findMany({
      where: {
        articleId: art.id,
        vente: {
          societeId: sid,
          statut: { notIn: ["ANNULE", "BROUILLON"] },
          dateVente: { gte: start },
          ...(depotId ? { depotId: Number(depotId) } : {}),
        },
      },
      select: { prixUnit: true, quantite: true, totalHT: true },
    });
    if (!lignes.length) continue;

    let sumPxQ = 0;
    let sumQ = 0;
    for (const l of lignes) {
      const q = Number(l.quantite) || 0;
      sumPxQ += Number(l.prixUnit) * q;
      sumQ += q;
    }
    const qteVendue = round2(sumQ);
    const prixVenteMoyen = sumQ > 0 ? round2(sumPxQ / sumQ) : 0;

    const depRef = depots[0];
    const cmp = depRef ? await getCurrentCMP(sid, art.id, depRef.id) : 0;
    const cs = depRef ? await coutStockageSvc.getLatestCout(sid, art.id, depRef.id) : null;
    const coutStockageUnit = cs ? round2(Number(cs.coutUnitaire)) : 0;

    const margeBrute = round2((prixVenteMoyen - cmp) * qteVendue);
    const coutStockageTotal = round2(coutStockageUnit * qteVendue);
    const margeNette = round2((prixVenteMoyen - cmp - coutStockageUnit) * qteVendue);
    const tauxMarge = prixVenteMoyen > 0 ? roundPct((margeNette / (prixVenteMoyen * qteVendue)) * 100) : 0;

    if (seuil != null && tauxMarge < seuil) continue;

    margeBruteTotal += margeBrute;
    margeNetteTotal += margeNette;
    if (margeNette < 0) articlesPerte += 1;
    if (!bestArticle || margeNette > bestArticle.margeNette) {
      bestArticle = { article: art, margeNette };
    }

    items.push({
      article: art,
      qteVendue,
      cmp,
      prixVenteMoyen,
      margeBrute,
      coutStockage: coutStockageUnit,
      margeNette,
      tauxMarge,
    });
  }

  items.sort((a, b) => b.margeNette - a.margeNette);

  const evolutionMensuelle = [];
  const nMonths = periode === "3m" ? 3 : periode === "1y" ? 12 : 6;
  const now = new Date();
  for (let i = nMonths - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const moisKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const lignesM = await prisma.ligneVente.findMany({
      where: {
        article: { societeId: sid, ...(familleId ? { familleId: Number(familleId) } : {}) },
        vente: {
          societeId: sid,
          statut: { notIn: ["ANNULE", "BROUILLON"] },
          dateVente: { gte: mStart, lte: mEnd },
          ...(depotId ? { depotId: Number(depotId) } : {}),
        },
      },
      include: { article: { select: { prixAchat: true } } },
    });

    let margeM = 0;
    for (const l of lignesM) {
      const pa = Number(l.article?.prixAchat ?? 0);
      margeM += Number(l.totalHT) - Number(l.quantite) * pa;
    }
    evolutionMensuelle.push({ mois: moisKey, marge: round2(margeM) });
  }

  return {
    items,
    kpis: {
      margeBruteTotal: round2(margeBruteTotal),
      margeNetteTotal: round2(margeNetteTotal),
      articlePlusRentable: bestArticle?.article?.libelle || "—",
      articlesEnPerte: articlesPerte,
    },
    evolutionMensuelle,
  };
}

module.exports = {
  stockValuation,
  getCurrentCMP,
  getCoutUnitaireCourant,
  getDernierPrixAchat,
  getDernierPrixAchatHistory,
  onEntreeStock,
  onSortieStock,
  ensureStockCoveredByCouches,
  sumCouchesRestantes,
  compareMethodes,
  getCMPHistory,
  calculateLIFO,
  getComparaisonMethodes,
  revalidateSnapshot,
  consumeCouches,
  getRentabilite,
};
