const prisma = require("../../config/database");
const { resolveClientForUser } = require("./clientResolver");

const articleSelect = {
  id: true,
  code: true,
  libelle: true,
  description: true,
  imageUrl: true,
  unite: true,
  prixVente: true,
  actif: true,
  statut: true,
  poids: true,
  volume: true,
  famille: { select: { id: true, nom: true } },
  stocks: { select: { quantite: true, qteReservee: true, depotId: true } },
};

async function getOrCreatePanier(clientId, societeId) {
  let panier = await prisma.panier.findUnique({
    where: { clientId_societeId: { clientId, societeId } },
    include: {
      lignes: {
        include: { article: { select: articleSelect } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!panier) {
    panier = await prisma.panier.create({
      data: { clientId, societeId },
      include: {
        lignes: {
          include: { article: { select: articleSelect } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }
  return panier;
}

/** Max stock libre sur un dépôt (cohérent avec confirmation vente). */
function stockLivrableFromStocks(stocks) {
  const byDepot = new Map();
  for (const s of stocks || []) {
    const did = Number(s.depotId);
    if (!Number.isFinite(did)) continue;
    const libre = Math.max(0, (Number(s.quantite) || 0) - (Number(s.qteReservee) || 0));
    byDepot.set(did, (byDepot.get(did) || 0) + libre);
  }
  let max = 0;
  for (const q of byDepot.values()) {
    if (q > max) max = q;
  }
  return max;
}

function mapPanier(panier) {
  const lignes = (panier.lignes || []).map((l) => {
    const stockTotal = stockLivrableFromStocks(l.article?.stocks);
    return {
      id: l.id,
      articleId: l.articleId,
      quantite: Number(l.quantite),
      article: l.article
        ? {
            id: l.article.id,
            code: l.article.code,
            libelle: l.article.libelle,
            description: l.article.description,
            imageUrl: l.article.imageUrl,
            unite: l.article.unite,
            prixVente: l.article.prixVente,
            famille: l.article.famille,
            stockTotal,
          }
        : null,
    };
  });
  const totalTTC = lignes.reduce(
    (sum, l) => sum + l.quantite * Number(l.article?.prixVente || 0),
    0
  );
  return {
    id: panier.id,
    clientId: panier.clientId,
    societeId: panier.societeId,
    updatedAt: panier.updatedAt,
    lignes,
    totalItems: lignes.reduce((s, l) => s + l.quantite, 0),
    totalTTC,
  };
}

async function getPanier(user) {
  const { client, societeId } = await resolveClientForUser(user);
  const panier = await getOrCreatePanier(client.id, societeId);
  return mapPanier(panier);
}

async function assertArticleAvailable(articleId, societeId) {
  const article = await prisma.article.findFirst({
    where: {
      id: Number(articleId),
      societeId,
      actif: true,
      statut: "ACTIF",
    },
    select: articleSelect,
  });
  if (!article) {
    const err = new Error("Article introuvable ou indisponible");
    err.status = 404;
    throw err;
  }
  return article;
}

const MAX_QTY = 999999;

async function addItem(user, { articleId, quantite = 1 }) {
  const { client, societeId } = await resolveClientForUser(user);
  const qty = Math.floor(Number(quantite));
  if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) {
    const err = new Error(
      qty > MAX_QTY
        ? `Quantité trop élevée (max ${MAX_QTY.toLocaleString("fr-FR")})`
        : "Quantité invalide"
    );
    err.status = 400;
    throw err;
  }
  const article = await assertArticleAvailable(articleId, societeId);
  const stockLibre = stockLivrableFromStocks(article.stocks);
  const panier = await getOrCreatePanier(client.id, societeId);

  const existing = await prisma.lignePanier.findUnique({
    where: {
      panierId_articleId: { panierId: panier.id, articleId: Number(articleId) },
    },
  });

  const next = existing
    ? Math.min(MAX_QTY, Math.floor(Number(existing.quantite)) + qty)
    : qty;

  if (next > stockLibre + 1e-6) {
    const err = new Error(
      `Stock insuffisant pour « ${article.libelle} » (dispo : ${stockLibre}, demandé : ${next})`
    );
    err.status = 409;
    err.code = "STOCK_INSUFFISANT";
    throw err;
  }

  if (existing) {
    await prisma.lignePanier.update({
      where: { id: existing.id },
      data: { quantite: next },
    });
  } else {
    await prisma.lignePanier.create({
      data: {
        panierId: panier.id,
        articleId: Number(articleId),
        quantite: qty,
      },
    });
  }

  return getPanier(user);
}

async function updateItem(user, articleId, quantite) {
  const { client, societeId } = await resolveClientForUser(user);
  const qty = Math.floor(Number(quantite));
  if (!Number.isFinite(qty) || qty > MAX_QTY) {
    const err = new Error(
      qty > MAX_QTY
        ? `Quantité trop élevée (max ${MAX_QTY.toLocaleString("fr-FR")})`
        : "Quantité invalide"
    );
    err.status = 400;
    throw err;
  }

  const panier = await getOrCreatePanier(client.id, societeId);
  const existing = await prisma.lignePanier.findUnique({
    where: {
      panierId_articleId: { panierId: panier.id, articleId: Number(articleId) },
    },
  });
  if (!existing) {
    const err = new Error("Article absent du panier");
    err.status = 404;
    throw err;
  }

  if (qty <= 0) {
    await prisma.lignePanier.delete({ where: { id: existing.id } });
  } else {
    const article = await assertArticleAvailable(articleId, societeId);
    const stockLibre = stockLivrableFromStocks(article.stocks);
    if (qty > stockLibre + 1e-6) {
      const err = new Error(
        `Stock insuffisant pour « ${article.libelle} » (dispo : ${stockLibre}, demandé : ${qty})`
      );
      err.status = 409;
      err.code = "STOCK_INSUFFISANT";
      throw err;
    }
    await prisma.lignePanier.update({
      where: { id: existing.id },
      data: { quantite: qty },
    });
  }

  return getPanier(user);
}

async function removeItem(user, articleId) {
  const { client, societeId } = await resolveClientForUser(user);
  const panier = await getOrCreatePanier(client.id, societeId);
  await prisma.lignePanier.deleteMany({
    where: { panierId: panier.id, articleId: Number(articleId) },
  });
  return getPanier(user);
}

async function clearPanier(user) {
  const { client, societeId } = await resolveClientForUser(user);
  const panier = await prisma.panier.findUnique({
    where: { clientId_societeId: { clientId: client.id, societeId } },
  });
  if (panier) {
    await prisma.lignePanier.deleteMany({ where: { panierId: panier.id } });
  }
  return getPanier(user);
}

module.exports = {
  getPanier,
  addItem,
  updateItem,
  removeItem,
  clearPanier,
  getOrCreatePanier,
  mapPanier,
};
