const accountingService = require("./accounting.service");
const prisma = require("../../config/database");
const { generateRapportPdf } = require("../../utils/pdfHelper");
const { generateRapportExcel } = require("../../utils/excelHelper");

async function summary(req, res, next) {
  try {
    const data = await accountingService.getFinancialSummary(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function synthese(req, res, next) {
  try {
    const data = await accountingService.getSynthese(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function evolutionMensuelle(req, res, next) {
  try {
    const data = await accountingService.getEvolutionMensuelle(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function topArticles(req, res, next) {
  try {
    const data = await accountingService.getTopArticles(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function topClients(req, res, next) {
  try {
    const data = await accountingService.getTopClients(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function topFournisseurs(req, res, next) {
  try {
    const data = await accountingService.getTopFournisseurs(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function stockParDepot(req, res, next) {
  try {
    const data = await accountingService.getStockParDepot(req.user);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function facturesVentes(req, res, next) {
  try {
    const data = await accountingService.listFacturesVente(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function dashboard(req, res, next) {
  try {
    const data = await accountingService.getSyntheseComptable(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function facturesAchats(req, res, next) {
  try {
    const data = await accountingService.listFacturesAchat(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function loadDashboardForExport(req) {
  const { periode, dateDebut, dateFin } = req.query;
  const effectivePeriode = periode || (dateDebut && dateFin ? "custom" : "mois");
  if (!effectivePeriode && (!dateDebut || !dateFin)) {
    const err = new Error("periode ou dateDebut/dateFin requis");
    err.status = 400;
    throw err;
  }
  return accountingService.getSyntheseComptable(req.user, {
    periode: effectivePeriode,
    dateDebut,
    dateFin,
  });
}

async function exportRapportPdf(req, res, next) {
  try {
    const dashboard = await loadDashboardForExport(req);
    const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });
    const buf = await generateRapportPdf({ societe, dashboard });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="rapport-stokify.pdf"');
    return res.send(buf);
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ message: error.message });
    return next(error);
  }
}

async function exportRapportExcel(req, res, next) {
  try {
    const dashboard = await loadDashboardForExport(req);
    const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });
    const buf = await generateRapportExcel({ societe, dashboard });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="rapport-stokify.xlsx"');
    return res.send(Buffer.from(buf));
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ message: error.message });
    return next(error);
  }
}

module.exports = {
  summary,
  dashboard,
  synthese,
  evolutionMensuelle,
  topArticles,
  topClients,
  topFournisseurs,
  stockParDepot,
  facturesVentes,
  facturesAchats,
  exportRapportPdf,
  exportRapportExcel,
};
