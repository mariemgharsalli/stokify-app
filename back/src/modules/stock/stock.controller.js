const stockService = require("./stock.service");
const prisma = require("../../config/database");
const { toCsv } = require("../../utils/exportCsv");
const { generateStockExcel } = require("../../utils/excelHelper");

async function exportStockCsv(req, res, next) {
  try {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[CSV export stock] societe", req.user?.societeId);
    }
    const rows = await stockService.listStockRowsForExport(req.user);
    const data = rows.map((s) => ({
      articleCode: s.article?.code ?? "",
      designation: s.article?.libelle ?? "",
      unite: s.article?.unite ?? "",
      depot: [s.depot?.code, s.depot?.libelle].filter(Boolean).join(" — ") || "—",
      quantite: s.quantite,
    }));
    const fields = [
      { label: "Code article", value: "articleCode" },
      { label: "Désignation", value: "designation" },
      { label: "Unité", value: "unite" },
      { label: "Dépôt", value: "depot" },
      { label: "Quantité", value: "quantite" },
    ];
    return toCsv(res, data, fields, "stock-export.csv");
  } catch (error) {
    return next(error);
  }
}

async function exportStockExcel(req, res, next) {
  try {
    const rows = await stockService.listStockRowsForExport(req.user);
    const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });
    const buf = await generateStockExcel({ societe, rows, exportedAt: new Date() });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="stock-export.xlsx"');
    return res.send(Buffer.from(buf));
  } catch (error) {
    return next(error);
  }
}

async function getDisponible(req, res, next) {
  try {
    const { articleId, depotId } = req.query;
    if (!articleId || !depotId) {
      return res.status(400).json({ message: "articleId et depotId requis" });
    }
    const data = await stockService.getStockDisponible(req.user, { articleId, depotId });
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function getStock(req, res, next) {
  try {
    const { depotId, articleId, emplacementId, statut, search, page = 1, limit = 50 } = req.query;
    const result = await stockService.getStock({
      user: req.user,
      depotId,
      articleId,
      emplacementId,
      statut,
      search,
      page,
      limit,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function getAlerts(req, res, next) {
  try {
    const alerts = await stockService.getStockAlerts(req.user);
    return res.json(alerts);
  } catch (error) {
    return next(error);
  }
}

async function getLine(req, res, next) {
  try {
    const row = await stockService.getStockLine(req.params.id, req.user);
    if (!row) return res.status(404).json({ message: "Ligne de stock introuvable" });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function createLine(req, res, next) {
  try {
    const row = await stockService.createStockLine({
      societeId: req.user.societeId,
      articleId: req.body.articleId,
      depotId: req.body.depotId,
      emplacementId: req.body.emplacementId,
      quantite: req.body.quantite,
      quantiteMin: req.body.quantiteMin,
      quantiteMax: req.body.quantiteMax,
    });
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function updateLine(req, res, next) {
  try {
    const row = await stockService.updateStockLine(req.params.id, {
      societeId: req.user.societeId,
      quantite: req.body.quantite,
      quantiteMin: req.body.quantiteMin,
      quantiteMax: req.body.quantiteMax,
      qteReservee: req.body.qteReservee,
      depotId: req.body.depotId,
      emplacementId: req.body.emplacementId,
    });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function setStatut(req, res, next) {
  try {
    const { statut } = req.body;
    const row = await stockService.setStatutStockLine(req.params.id, req.user.societeId, statut, req.user.id);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function toggleActifLine(req, res, next) {
  try {
    const row = await stockService.toggleActifStockLine(req.params.id, req.user.societeId);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function deleteLine(req, res, next) {
  try {
    await stockService.deleteStockLine(req.params.id, req.user.societeId, req.user.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function valeurConsolidee(req, res, next) {
  try {
    const data = await stockService.getValeurConsolidee(req.user);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function tendance(req, res, next) {
  try {
    const days = req.query.days || 30;
    const data = await stockService.getStockTendance(req.user, days);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function calendar(req, res, next) {
  try {
    const data = await stockService.getStockCalendar(req.user, req.query.month);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function rotationSummary(req, res, next) {
  try {
    const data = await stockService.getRotationSummary(req.user);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function auditLogs(req, res, next) {
  try {
    const data = await stockService.listAuditLogs(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function depotCapacity(req, res, next) {
  try {
    const data = await stockService.getDepotCapacitySummary(req.params.depotId, req.user.societeId);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function emplacementCompatibility(req, res, next) {
  try {
    const { articleId, emplacementId } = req.query;
    if (!articleId || !emplacementId) {
      return res.status(400).json({ message: "articleId et emplacementId requis" });
    }
    const data = await stockService.checkEmplacementCompatibility(
      articleId,
      emplacementId,
      req.user.societeId
    );
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function getVentesALivrer(req, res, next) {
  try {
    const data = await stockService.getVentesALivrer(req.user);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function heatmap(req, res, next) {
  try {
    const { months = 12, metric = "quantite" } = req.query;
    const data = await stockService.getStockHeatmap(req.user, months, metric);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function loadOptimization(req, res, next) {
  try {
    const { ventes, depotId, vehiculeId } = req.body;
    const data = await stockService.optimizeLoad({
      ventes,
      depotId,
      vehiculeId,
      societeId: req.user.societeId,
    });
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function emplacementSuggestions(req, res, next) {
  try {
    const { articleId, depotId } = req.query;
    if (!articleId || !depotId) {
      return res.status(400).json({ message: "articleId et depotId requis" });
    }
    const data = await stockService.suggestEmplacements(
      articleId,
      depotId,
      req.user.societeId
    );
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function emplacementAudit(req, res, next) {
  try {
    const data = await stockService.auditEmplacements(
      req.params.depotId,
      req.user.societeId
    );
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function forecast(req, res, next) {
  try {
    const forecastService = require("./forecast.service");
    const data = await forecastService.getForecast(req.params.articleId, req.user.societeId);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function forecastCompare(req, res, next) {
  try {
    const forecastService = require("./forecast.service");
    const data = await forecastService.getForecastMulti(
      req.body?.articleIds,
      req.user.societeId
    );
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function listAnomalies(req, res, next) {
  try {
    const anomaliesService = require("./anomalies.service");
    const data = await anomaliesService.listAnomalies(req.user.societeId, {
      statut: req.query.statut || "NON_RESOLU",
    });
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function resolveAnomalie(req, res, next) {
  try {
    const anomaliesService = require("./anomalies.service");
    const data = await anomaliesService.resolveAnomalie(req.params.id, req.user.societeId);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function detectAnomalies(req, res, next) {
  try {
    const anomaliesService = require("./anomalies.service");
    const data = await anomaliesService.detectAndPersistAnomalies(req.user.societeId);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function confirmAnomalie(req, res, next) {
  try {
    const anomaliesService = require("./anomalies.service");
    const data = await anomaliesService.confirmAnomalie(req.params.id, req.user.societeId);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function trainAnomalies(req, res, next) {
  try {
    const anomaliesService = require("./anomalies.service");
    const data = await anomaliesService.trainAnomalyModels(req.user.societeId);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function anomalyMlStatus(req, res, next) {
  try {
    const anomaliesService = require("./anomalies.service");
    const data = await anomaliesService.getAnomalyMlStatus(req.user.societeId);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function expiryWaste(req, res, next) {
  try {
    const expiryWasteService = require("./expiryWaste.service");
    const data = await expiryWasteService.getExpiryWasteRisk(req.user.societeId);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function expiryWasteModel(req, res, next) {
  try {
    const expiryWasteService = require("./expiryWaste.service");
    const data = await expiryWasteService.getExpiryModelCard();
    return res.json(data || {});
  } catch (error) {
    return next(error);
  }
}

async function expiryWasteMonitoring(req, res, next) {
  try {
    const expiryWasteService = require("./expiryWaste.service");
    const data = await expiryWasteService.getExpiryMonitoring(req.user.societeId);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function expiryWasteWhatIf(req, res, next) {
  try {
    const expiryWasteService = require("./expiryWaste.service");
    const data = await expiryWasteService.whatIfExpiry(req.user.societeId, req.body || {});
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  exportStockCsv,
  exportStockExcel,
  getStock,
  getDisponible,
  getAlerts,
  getLine,
  createLine,
  updateLine,
  deleteLine,
  toggleActifLine,
  setStatut,
  valeurConsolidee,
  tendance,
  calendar,
  rotationSummary,
  auditLogs,
  depotCapacity,
  emplacementCompatibility,
  getVentesALivrer,
  loadOptimization,
  emplacementSuggestions,
  emplacementAudit,
  heatmap,
  forecast,
  forecastCompare,
  listAnomalies,
  resolveAnomalie,
  confirmAnomalie,
  detectAnomalies,
  trainAnomalies,
  anomalyMlStatus,
  expiryWaste,
  expiryWasteModel,
  expiryWasteMonitoring,
  expiryWasteWhatIf,
};
