const prisma = require("../../config/database");
const svc = require("./valuation.service");
const { generateValuationExcel } = require("../../utils/excelHelper");

async function getComparaison(req, res, next) {
  try {
    const items = await svc.getComparaisonMethodes({
      societeId: req.user.societeId,
      depotId: req.query.depotId,
      articleId: req.query.articleId,
    });
    return res.json({ items });
  } catch (e) {
    return next(e);
  }
}

async function postRevalidate(req, res, next) {
  try {
    const { articleId, depotId } = req.body || {};
    if (!articleId || !depotId) {
      return res.status(400).json({ message: "articleId et depotId requis" });
    }
    const result = await svc.revalidateSnapshot({
      societeId: req.user.societeId,
      articleId: Number(articleId),
      depotId: Number(depotId),
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function getStockValuation(req, res, next) {
  try {
    const result = await svc.stockValuation({
      societeId: req.user.societeId,
      depotId: req.query.depotId,
      methodePrix: req.query.methodePrix,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function getCMPHistory(req, res, next) {
  try {
    const depotId = req.query.depotId;
    if (!depotId) return res.status(400).json({ message: "depotId requis" });
    const rows = await svc.getCMPHistory(
      req.user.societeId,
      req.params.articleId,
      depotId,
      req.query.limit
    );
    return res.json({ items: rows });
  } catch (e) {
    return next(e);
  }
}

async function compareMethodes(req, res, next) {
  try {
    const depotId = req.query.depotId;
    if (!depotId) return res.status(400).json({ message: "depotId requis" });
    const rows = await svc.compareMethodes(req.user.societeId, req.params.articleId, depotId);
    return res.json({ items: rows });
  } catch (e) {
    return next(e);
  }
}

async function getDernierPrixAchat(req, res, next) {
  try {
    const depotId = req.query.depotId;
    if (!depotId) return res.status(400).json({ message: "depotId requis" });
    const result = await svc.getDernierPrixAchat(
      req.user.societeId,
      req.params.articleId,
      depotId
    );
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function getDernierPrixAchatHistory(req, res, next) {
  try {
    const depotId = req.query.depotId;
    if (!depotId) return res.status(400).json({ message: "depotId requis" });
    const rows = await svc.getDernierPrixAchatHistory(
      req.user.societeId,
      req.params.articleId,
      depotId,
      req.query.limit
    );
    return res.json({ items: rows });
  } catch (e) {
    return next(e);
  }
}

async function getRentabilite(req, res, next) {
  try {
    const data = await svc.getRentabilite({
      societeId: req.user.societeId,
      periode: req.query.periode,
      familleId: req.query.familleId,
      depotId: req.query.depotId,
      seuilMargeMin: req.query.seuilMargeMin,
    });
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function exportExcel(req, res, next) {
  try {
    const methodePrix = req.query.methodePrix || req.query.methode || "CMP";
    const depotId = req.query.depotId;

    const result = await svc.stockValuation({
      societeId: req.user.societeId,
      depotId,
      methodePrix,
      page: 1,
      limit: 50000,
    });

    const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });

    let depotLabel = "Tous";
    if (depotId) {
      const d = await prisma.depot.findFirst({
        where: { id: Number(depotId), societeId: Number(req.user.societeId) },
      });
      depotLabel = d ? `${d.code} — ${d.libelle}` : String(depotId);
    }

    const methods = ["CMP", "FIFO", "LIFO", "DERNIER_PRIX_ACHAT", "PAHT"];
    const methodTotals = [];
    for (const m of methods) {
      const r = await svc.stockValuation({
        societeId: req.user.societeId,
        depotId,
        methodePrix: m,
        page: 1,
        limit: 1,
      });
      methodTotals.push({ methode: m, valeurTotale: r.valeurTotale });
    }

    const buf = await generateValuationExcel({
      societe,
      methode: result.methodePrix,
      depotLabel,
      lignes: result.lignes,
      valeurTotale: result.valeurTotale,
      methodTotals,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="valorisation-${result.methodePrix}-${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.send(Buffer.from(buf));
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  getStockValuation,
  getCMPHistory,
  compareMethodes,
  getComparaison,
  postRevalidate,
  getRentabilite,
  getDernierPrixAchat,
  getDernierPrixAchatHistory,
  exportExcel,
};
