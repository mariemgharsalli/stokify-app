const prisma = require("../../config/database");
const articlesService = require("./articles.service");
const { generateArticlesExcel } = require("../../utils/excelHelper");
const { auditFromReq } = require("../../utils/auditHelper");

async function getNextCode(req, res, next) {
  try {
    const code = await articlesService.generateArticleCode(req.user.societeId);
    return res.json({ code });
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const result = await articlesService.listArticles({
      user: req.user,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
      statut: req.query.statut,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function listCatalogueClient(req, res, next) {
  try {
    const result = await articlesService.listArticlesCatalogueClient({
      user: req.user,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
      statut: req.query.statut,
      familleId: req.query.familleId,
      prixMin: req.query.prixMin,
      prixMax: req.query.prixMax,
      enStock: req.query.enStock,
      sort: req.query.sort,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function listSimilaires(req, res, next) {
  try {
    const result = await articlesService.listArticlesSimilaires(
      req.params.id,
      req.user.societeId,
      { limit: req.query.limit }
    );
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const article = await articlesService.getArticle(req.params.id, req.user.societeId);
    if (!article) return res.status(404).json({ message: "Article introuvable" });
    return res.json(article);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const article = await articlesService.createArticle(
      { ...req.body, userId: req.user.id },
      req.user.societeId
    );
    await auditFromReq(req, {
      action: "CREATE",
      entite: "Article",
      entiteId: article.id,
      description: `Création article ${article.libelle}`,
    });
    return res.status(201).json(article);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const article = await articlesService.updateArticle(req.params.id, req.body, req.user.societeId);
    await auditFromReq(req, {
      action: "UPDATE",
      entite: "Article",
      entiteId: article.id,
      description: `Modification article ${article.libelle}`,
    });
    return res.json(article);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await articlesService.getArticle(req.params.id, req.user.societeId);
    const result = await articlesService.deleteArticle(
      req.params.id,
      req.user.societeId,
      req.user.role
    );
    await auditFromReq(req, {
      action: "DELETE",
      entite: "Article",
      entiteId: req.params.id,
      description: `Suppression article ${existing?.libelle || req.params.id}`,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function setStatut(req, res, next) {
  try {
    const { statut } = req.body;
    const row = await articlesService.setStatutArticle(req.params.id, req.user.societeId, statut);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function uploadImage(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "Image requise" });
    /** Chemin relatif uniquement — le client résout l’origine (proxy Vite / même domaine en prod). */
    const url = `/uploads/articles/${req.file.filename}`;
    return res.status(201).json({ url });
  } catch (error) {
    return next(error);
  }
}

async function importCsv(req, res, next) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: "Fichier CSV requis" });
    }
    const result = await articlesService.importArticlesFromFile(req.file.buffer, req.user.societeId);
    await auditFromReq(req, {
      action: "IMPORT",
      entite: "Article",
      entiteId: null,
      description: `Import produits (CSV/Excel) : ${result.success} succès, ${result.failed} échec(s)`,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function exportExcel(req, res, next) {
  try {
    const items = await articlesService.listArticlesForExport({
      user: req.user,
      search: req.query.search,
      statut: req.query.statut,
      ids: req.query.ids,
    });
    const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });
    const buf = await generateArticlesExcel({ societe, items, exportedAt: new Date() });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="articles-export-${items.length}-${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.send(Buffer.from(buf));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  listCatalogueClient,
  listSimilaires,
  getOne,
  create,
  update,
  remove,
  uploadImage,
  setStatut,
  getNextCode,
  importCsv,
  exportExcel,
};
