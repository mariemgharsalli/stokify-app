/**
 * Seuil d'alerte article : seuilAlerte personnalisé, sinon stockMin.
 * Retourne null si aucun seuil n'est configuré (seule la rupture qty<=0 est alors pertinente).
 */
function getAlertThreshold(article) {
  if (article?.seuilAlerte != null && article.seuilAlerte !== "") return Number(article.seuilAlerte);
  if (article?.stockMin != null && article.stockMin !== "") return Number(article.stockMin);
  return null;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

const DEDUP_MS = 24 * 60 * 60 * 1000;

/**
 * Après un mouvement de stock (article + dépôt), crée ou résout les AlerteStock.
 * Quantité agrégée sur tous les emplacements du dépôt.
 * @param {import("@prisma/client").Prisma.TransactionClient | import("@prisma/client").PrismaClient} db
 */
async function syncAlerteStockAfterQtyChange(db, { societeId, articleId, depotId }) {
  const sid = Number(societeId);
  const aid = Number(articleId);
  const did = Number(depotId);
  if (!sid || !aid || !did) return;

  const article = await db.article.findFirst({
    where: { id: aid, societeId: sid },
    select: { id: true, seuilAlerte: true, stockMin: true },
  });
  if (!article) return;

  const agg = await db.stock.aggregate({
    where: { articleId: aid, depotId: did },
    _sum: { quantite: true },
  });
  const quantite = round2(Number(agg._sum.quantite ?? 0));
  const seuil = getAlertThreshold(article);
  const seuilNum = seuil ?? 0;

  let type = null;
  if (quantite <= 0) type = "RUPTURE";
  else if (seuil != null && quantite <= seuilNum) type = "CRITIQUE";

  if (!type) {
    await db.alerteStock.updateMany({
      where: {
        articleId: aid,
        depotId: did,
        societeId: sid,
        resolue: false,
      },
      data: { resolue: true, resolueAt: new Date() },
    });
    return;
  }

  const since = new Date(Date.now() - DEDUP_MS);
  const existing = await db.alerteStock.findFirst({
    where: {
      articleId: aid,
      depotId: did,
      type,
      resolue: false,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  if (existing) return;

  await db.alerteStock.create({
    data: {
      articleId: aid,
      depotId: did,
      societeId: sid,
      type,
    },
  });
}

module.exports = {
  getAlertThreshold,
  syncAlerteStockAfterQtyChange,
};
