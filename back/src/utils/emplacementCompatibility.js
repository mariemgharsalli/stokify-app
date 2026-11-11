const prisma = require("../config/database");
const { requireActiveSocieteId } = require("./societeScope");

function normalizeCategorieAutorisee(value) {
  const v = String(value || "").trim().toUpperCase();
  if (!v || v === "MIXTE") return "";
  return v;
}

/**
 * Règles pures (testables) — zone dangereuse + catégorie autorisée + mixité.
 */
function evaluateCompatibility({ article, emplacement, occupants = [] }) {
  if (!emplacement) return { ok: true };

  if (article?.dangereuxChimique && !emplacement.zoneDangereuse) {
    return {
      ok: false,
      message:
        'Article dangereux: cet emplacement n\'est pas une zone sécurisée. Choisissez un emplacement marqué "Zone dangereuse".',
    };
  }

  if (!article?.dangereuxChimique && emplacement.zoneDangereuse) {
    return {
      ok: false,
      message: "Cet emplacement est réservé aux produits dangereux.",
    };
  }

  const cat = normalizeCategorieAutorisee(emplacement.categorieAutorisee);
  if (cat === "ALIMENTAIRE" && article?.dangereuxChimique) {
    return {
      ok: false,
      message: "Cet emplacement n'accepte que des articles alimentaires (catégorie autorisée).",
    };
  }
  if (cat === "CHIMIQUE" && !article?.dangereuxChimique) {
    return {
      ok: false,
      message: "Cet emplacement est réservé aux produits chimiques.",
    };
  }

  for (const s of occupants) {
    const occArticle = s.article || s;
    if (Number(s.articleId || occArticle.id) === Number(article?.id)) continue;
    const occDanger = Boolean(occArticle.dangereuxChimique);
    if (occDanger !== Boolean(article?.dangereuxChimique)) {
      const label = occArticle.libelle || occArticle.code || "un article";
      return {
        ok: false,
        message: `Incompatibilité: cet emplacement contient déjà "${label}" (${occDanger ? "dangereux" : "standard"}), incompatible avec un article ${article?.dangereuxChimique ? "dangereux" : "standard"}.`,
      };
    }
  }

  return { ok: true };
}

async function checkEmplacementCompatibility(articleId, emplacementId, societeId) {
  if (!emplacementId) return { ok: true };

  const sid = requireActiveSocieteId(societeId);
  const [article, emplacement, existingStocks] = await Promise.all([
    prisma.article.findFirst({ where: { id: Number(articleId), societeId: sid } }),
    prisma.emplacement.findUnique({
      where: { id: Number(emplacementId) },
      include: { depot: { select: { societeId: true, statut: true } } },
    }),
    prisma.stock.findMany({
      where: { emplacementId: Number(emplacementId), quantite: { gt: 0 } },
      include: { article: true },
    }),
  ]);

  if (!article) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  if (!emplacement || emplacement.depot?.societeId !== sid) {
    const err = new Error("Emplacement introuvable");
    err.status = 404;
    throw err;
  }

  return evaluateCompatibility({
    article,
    emplacement,
    occupants: existingStocks,
  });
}

module.exports = {
  checkEmplacementCompatibility,
  evaluateCompatibility,
  normalizeCategorieAutorisee,
};
