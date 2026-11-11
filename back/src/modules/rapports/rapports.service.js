const prisma = require("../../config/database");
const coutStockageService = require("../coutStockage/coutStockage.service");

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

function rotationRecommendation(tauxPct) {
  if (tauxPct < 10) return { label: "Considérer déstockage ou promotion", color: "danger" };
  if (tauxPct <= 50) return { label: "Surveillance normale", color: "warning" };
  return { label: "Bonne rotation", color: "success" };
}

function deadStockRecommendation(jours) {
  if (jours > 180) return { label: "Déstockage urgent recommandé", tranche: ">180j" };
  if (jours > 90) return { label: "Promotion à envisager", tranche: ">90j" };
  if (jours >= 60) return { label: "Promotion à envisager", tranche: "60-90j" };
  return { label: "Surveillance", tranche: "30-60j" };
}

function deadStockTranche(jours) {
  if (jours > 90) return ">90j";
  if (jours >= 60) return "60-90j";
  return "30-60j";
}

/**
 * Rapport rotation sur N jours glissants.
 * taux = (qté vendue / stock moyen) × 100
 */
async function getRotationReport(societeId, { depotId, days = 30 } = {}) {
  const sid = Number(societeId);
  const nbDays = Math.max(1, Math.min(365, Number(days) || 30));
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - nbDays);
  const did = depotId ? Number(depotId) : null;

  const stocks = await prisma.stock.findMany({
    where: {
      quantite: { gt: 0 },
      depot: { societeId: sid, ...(did ? { id: did } : {}) },
    },
    include: {
      article: { select: { id: true, code: true, libelle: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
  });

  const byKey = new Map();
  for (const s of stocks) {
    const key = `${s.articleId}-${s.depotId}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        articleId: s.articleId,
        depotId: s.depotId,
        article: s.article,
        depot: s.depot,
        stockMoyen: 0,
      });
    }
    byKey.get(key).stockMoyen += Number(s.quantite);
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

  const sortieMap = new Map(
    sorties.map((r) => [`${r.articleId}-${r.depotId}`, Number(r._sum.quantite || 0)])
  );

  const items = [];
  for (const row of byKey.values()) {
    const key = `${row.articleId}-${row.depotId}`;
    const qteVendue = sortieMap.get(key) || 0;
    const stockMoyen = round3(row.stockMoyen);
    const taux = stockMoyen > 0 ? round3((qteVendue / stockMoyen) * 100) : 0;
    const reco = rotationRecommendation(taux);
    items.push({
      articleId: row.articleId,
      depotId: row.depotId,
      article: row.article,
      depot: row.depot,
      stockMoyen,
      qteVendue: round3(qteVendue),
      taux,
      recommandation: reco.label,
      recommandationNiveau: reco.color,
    });
  }

  items.sort((a, b) => a.taux - b.taux);

  const tauxList = items.map((i) => i.taux);
  const rotationMoyenne =
    tauxList.length > 0 ? round3(tauxList.reduce((s, t) => s + t, 0) / tauxList.length) : 0;
  const articlesForteRotation = items.filter((i) => i.taux > 50).length;
  const articlesFaibleRotation = items.filter((i) => i.taux < 10).length;

  return {
    days: nbDays,
    dateDebut: start.toISOString(),
    dateFin: end.toISOString(),
    summary: {
      rotationMoyenne,
      articlesForteRotation,
      articlesFaibleRotation,
      totalArticles: items.length,
    },
    items,
  };
}

/**
 * Rapport stock dormant enrichi (famille, coût détention, tranches).
 */
async function getDeadStockReport(societeId, { depotId, seuil = 90 } = {}) {
  const joursMin = Math.max(30, Number(seuil) || 90);
  const base = await coutStockageService.getDeadStock(societeId, {
    depotId,
    joursSeuilSansMouvement: joursMin,
  });

  const tranches = { ">90j": 0, "60-90j": 0, "30-60j": 0, ">180j": 0 };
  let totalCoutMensuel = 0;

  const items = (base.items || []).map((row) => {
    const art = row.article;
    const valeurStock = row.valeurBloquee;
    const coutDetentionMois = round3((valeurStock * 0.02) / 12);
    totalCoutMensuel += coutDetentionMois;
    const reco = deadStockRecommendation(row.joursImmobilise);
    const tranche = deadStockTranche(row.joursImmobilise);
    tranches[tranche] = (tranches[tranche] || 0) + 1;
    if (row.joursImmobilise > 180) tranches[">180j"] = (tranches[">180j"] || 0) + 1;

    return {
      articleId: row.articleId,
      depotId: row.depotId,
      article: art,
      code: art?.code,
      famille: art?.famille?.nom || "—",
      depot: row.depot,
      quantite: row.quantite,
      dateLastMvt: row.dateLastMvt,
      joursImmobilise: row.joursImmobilise,
      valeurStock,
      coutDetentionMois,
      tranche,
      recommandation: reco.label,
    };
  });

  items.sort((a, b) => b.joursImmobilise - a.joursImmobilise);

  return {
    seuil: joursMin,
    summary: {
      totalValeurImmobilisee: round3(base.totalValeurBloquee),
      totalCoutMensuel: round3(totalCoutMensuel),
      nbArticles: items.length,
      tranches,
      alerteMontantEleve: base.alerteMontantEleve,
      seuilAlerteMontant: base.seuilAlerteMontant,
    },
    items,
  };
}

module.exports = {
  getRotationReport,
  getDeadStockReport,
};
