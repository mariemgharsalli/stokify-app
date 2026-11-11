const prisma = require("../../config/database");
const { resolveClientForUser } = require("../panier/clientResolver");

function stockLivrable(stocks) {
  const byDepot = new Map();
  for (const s of stocks || []) {
    const did = Number(s.depotId);
    if (!Number.isFinite(did)) continue;
    const libre = Math.max(0, (Number(s.quantite) || 0) - (Number(s.qteReservee) || 0));
    byDepot.set(did, (byDepot.get(did) || 0) + libre);
  }
  let max = 0;
  for (const q of byDepot.values()) if (q > max) max = q;
  return max;
}

function mapItem(row) {
  const a = row.article;
  return {
    id: row.id,
    articleId: row.articleId,
    createdAt: row.createdAt,
    article: a
      ? {
          id: a.id,
          code: a.code,
          libelle: a.libelle,
          imageUrl: a.imageUrl,
          prixVente: a.prixVente,
          unite: a.unite,
          stockDisponible: stockLivrable(a.stocks),
          famille: a.famille,
        }
      : null,
  };
}

async function listWishlist(user) {
  const { client, societeId } = await resolveClientForUser(user);
  const rows = await prisma.wishlistItem.findMany({
    where: { clientId: client.id, societeId },
    orderBy: { createdAt: "desc" },
    include: {
      article: {
        select: {
          id: true,
          code: true,
          libelle: true,
          imageUrl: true,
          prixVente: true,
          unite: true,
          famille: { select: { id: true, nom: true } },
          stocks: { select: { quantite: true, qteReservee: true, depotId: true } },
        },
      },
    },
  });
  return { items: rows.map(mapItem), total: rows.length };
}

async function addWishlist(user, articleId) {
  const { client, societeId } = await resolveClientForUser(user);
  const aid = Number(articleId);
  const article = await prisma.article.findFirst({
    where: { id: aid, societeId, actif: true, statut: "ACTIF" },
    select: { id: true },
  });
  if (!article) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  await prisma.wishlistItem.upsert({
    where: {
      clientId_societeId_articleId: {
        clientId: client.id,
        societeId,
        articleId: aid,
      },
    },
    create: { clientId: client.id, societeId, articleId: aid },
    update: {},
  });
  return listWishlist(user);
}

async function removeWishlist(user, articleId) {
  const { client, societeId } = await resolveClientForUser(user);
  await prisma.wishlistItem.deleteMany({
    where: { clientId: client.id, societeId, articleId: Number(articleId) },
  });
  return listWishlist(user);
}

async function idsWishlist(user) {
  const { client, societeId } = await resolveClientForUser(user);
  const rows = await prisma.wishlistItem.findMany({
    where: { clientId: client.id, societeId },
    select: { articleId: true },
  });
  return { articleIds: rows.map((r) => r.articleId) };
}

module.exports = { listWishlist, addWishlist, removeWishlist, idsWishlist };
