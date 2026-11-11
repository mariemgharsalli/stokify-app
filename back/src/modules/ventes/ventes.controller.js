const { toCsv } = require("../../utils/exportCsv");
const prisma = require("../../config/database");
const { generateVentesExcel } = require("../../utils/excelHelper");
const ventesService = require("./ventes.service");
const articlesService = require("../articles/articles.service");
const { auditFromReq } = require("../../utils/auditHelper");
const { activityFromReq } = require("../../services/activityLogger");

async function list(req, res, next) {
  try {
    const commandesClientService = require("../commandesClient/commandesClient.service");
    const { societeId } = require("../../utils/societeScope").getSocieteWhere(req.user);
    await commandesClientService.syncOrphanCommandesToVentes(societeId);
    await commandesClientService.realignWebVenteDepots(societeId);
    const result = await ventesService.listVentes(req.user, req.query);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const commandesClientService = require("../commandesClient/commandesClient.service");
    const { societeId } = require("../../utils/societeScope").getSocieteWhere(req.user);
    await commandesClientService.realignWebVenteDepots(societeId);
    const row = await ventesService.getVente(req.user, req.params.id);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const row = await ventesService.createVente(req.user, req.body);
    await auditFromReq(req, {
      action: "CREATE",
      entite: "Vente",
      entiteId: row.id,
      description: `Création vente ${row.reference}`,
    });
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function confirmer(req, res, next) {
  try {
    const row = await ventesService.confirmerVente(req.user, req.params.id);
    await auditFromReq(req, {
      action: "VALIDATE",
      entite: "Vente",
      entiteId: row.id,
      description: `Validation vente ${row.reference}`,
    });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function validate(req, res, next) {
  return confirmer(req, res, next);
}

async function livrer(req, res, next) {
  try {
    const row = await ventesService.livrerVente(req.user, req.params.id);
    await activityFromReq(req, {
      action: "VALIDATE",
      module: "ventes",
      entity: "Vente",
      entityId: row.id,
      entityLabel: `Livraison vente ${row.reference || row.id}`,
    });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function preparer(req, res, next) {
  try {
    const row = await ventesService.preparerVente(req.user, req.params.id);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function expedier(req, res, next) {
  try {
    const row = await ventesService.expedierVente(req.user, req.params.id);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function facture(req, res, next) {
  try {
    const json = await ventesService.getFactureJson(req.user, req.params.id);
    return res.json(json);
  } catch (error) {
    return next(error);
  }
}

async function facturePdf(req, res, next) {
  try {
    const buf = await ventesService.getFacturePdf(req.user, req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="facture-${req.params.id}.pdf"`);
    return res.send(buf);
  } catch (error) {
    return next(error);
  }
}

async function relancePdf(req, res, next) {
  try {
    const buf = await ventesService.getRelancePdf(req.user, req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="relance-${req.params.id}.pdf"`);
    return res.send(buf);
  } catch (error) {
    return next(error);
  }
}

async function bonLivraisonPdf(req, res, next) {
  try {
    const buf = await ventesService.getBonLivraisonPdf(req.user, req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="bon-livraison-${req.params.id}.pdf"`);
    return res.send(buf);
  } catch (error) {
    return next(error);
  }
}

async function exportVentes(req, res, next) {
  try {
    const format = String(req.query.format || "csv").toLowerCase();
    if (format !== "csv" && format !== "excel") {
      return res.status(400).json({ message: "format=csv ou format=excel requis" });
    }
    const rows = await ventesService.exportVentesCsv(req.user, req.query);
    await activityFromReq(req, {
      action: "EXPORT",
      module: "ventes",
      entityLabel: format === "excel" ? "Export Excel ventes" : "Export CSV ventes",
    });
    const today = new Date().toISOString().slice(0, 10);
    if (format === "excel") {
      const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });
      const buf = await generateVentesExcel({ societe, rows, exportedAt: new Date() });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename="ventes-${today}.xlsx"`);
      return res.send(Buffer.from(buf));
    }
    const defaultFields = [
      "Référence",
      "Date vente",
      "Client",
      "Dépôt",
      "Statut",
      "Mode paiement",
      "Total HT",
      "TVA",
      "Total TTC",
      "Montant réglé",
      "Solde restant",
      "Date livraison",
      "Nb lignes",
    ];
    const fields = rows.length ? Object.keys(rows[0]) : defaultFields;
    return toCsv(res, rows, fields, `ventes-${today}.csv`);
  } catch (error) {
    return next(error);
  }
}

async function stats(req, res, next) {
  try {
    const data = await ventesService.getStatsVentes(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function kpis(req, res, next) {
  try {
    const data = await ventesService.getVentesKpis(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function creerAvoir(req, res, next) {
  try {
    const row = await ventesService.creerAvoir(req.user, req.params.id, req.body);
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function addReglement(req, res, next) {
  try {
    const result = await ventesService.addReglement(req.user, req.params.id, req.body);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const row = await ventesService.updateVente(req.user, req.params.id, req.body);
    await activityFromReq(req, {
      action: "UPDATE",
      module: "ventes",
      entity: "Vente",
      entityId: row.id,
      entityLabel: `Modification vente ${row.reference || row.id}`,
      details: { changes: req.body },
    });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    await ventesService.deleteVente(req.user, req.params.id);
    await activityFromReq(req, {
      action: "DELETE",
      module: "ventes",
      entity: "Vente",
      entityId: Number(req.params.id),
      entityLabel: `Suppression vente #${req.params.id}`,
    });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function searchArticles(req, res, next) {
  try {
    const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 10));
    const result = await articlesService.listArticles({
      societeId: req.user.societeId,
      search: req.query.search,
      page: 1,
      limit,
      statut: "ACTIF",
    });
    return res.json(result.items || []);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  validate,
  confirmer,
  livrer,
  preparer,
  expedier,
  facture,
  facturePdf,
  relancePdf,
  bonLivraisonPdf,
  addReglement,
  searchArticles,
  exportVentes,
  stats,
  kpis,
  creerAvoir,
};
