const prisma = require("../../config/database");
const svc = require("./rapports.service");
const { generateRotationExcel, generateDeadStockExcel } = require("../../utils/excelHelper");

async function rotation(req, res, next) {
  try {
    const result = await svc.getRotationReport(req.user.societeId, {
      depotId: req.query.depotId,
      days: req.query.days,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function deadStock(req, res, next) {
  try {
    const result = await svc.getDeadStockReport(req.user.societeId, {
      depotId: req.query.depotId,
      seuil: req.query.seuil ?? req.query.jours,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

function formatPeriodeLabel(days, dateDebut, dateFin) {
  if (dateDebut && dateFin) {
    const d0 = new Date(dateDebut).toLocaleDateString("fr-FR");
    const d1 = new Date(dateFin).toLocaleDateString("fr-FR");
    return `${d0} — ${d1}`;
  }
  return `${days || 30} jours glissants`;
}

async function resolveDepotLabel(societeId, depotId) {
  if (!depotId) return "Tous";
  const d = await prisma.depot.findFirst({
    where: { id: Number(depotId), societeId: Number(societeId) },
  });
  return d ? `${d.code} — ${d.libelle}` : String(depotId);
}

async function exportRotationExcel(req, res, next) {
  try {
    const report = await svc.getRotationReport(req.user.societeId, {
      depotId: req.query.depotId,
      days: req.query.days,
    });
    const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });
    const depotLabel = await resolveDepotLabel(req.user.societeId, req.query.depotId);
    const periodeLabel = formatPeriodeLabel(report.days, report.dateDebut, report.dateFin);

    const buf = await generateRotationExcel({
      societe,
      report,
      depotLabel,
      periodeLabel,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rapport-rotation-${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.send(Buffer.from(buf));
  } catch (e) {
    return next(e);
  }
}

async function exportDeadStockExcel(req, res, next) {
  try {
    const report = await svc.getDeadStockReport(req.user.societeId, {
      depotId: req.query.depotId,
      seuil: req.query.seuil ?? req.query.jours,
    });
    const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });
    const depotLabel = await resolveDepotLabel(req.user.societeId, req.query.depotId);

    const buf = await generateDeadStockExcel({
      societe,
      report,
      depotLabel,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rapport-stock-dormant-${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.send(Buffer.from(buf));
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  rotation,
  deadStock,
  exportRotationExcel,
  exportDeadStockExcel,
};
