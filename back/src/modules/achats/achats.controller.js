const { toCsv } = require("../../utils/exportCsv");
const prisma = require("../../config/database");
const { generateAchatsExcel } = require("../../utils/excelHelper");
const achatsService = require("./achats.service");
const articlesService = require("../articles/articles.service");
const { auditFromReq } = require("../../utils/auditHelper");
const { activityFromReq } = require("../../services/activityLogger");

async function exportAchats(req, res, next) {
  try {
    const format = String(req.query.format || "csv").toLowerCase();
    if (format !== "csv" && format !== "excel") {
      return res.status(400).json({ message: "format=csv ou format=excel requis" });
    }
    const rows = await achatsService.exportAchatsCsv(req.user, req.query);
    await activityFromReq(req, {
      action: "EXPORT",
      module: "achats",
      entityLabel: format === "excel" ? "Export Excel achats" : "Export CSV achats",
    });
    const today = new Date().toISOString().slice(0, 10);
    if (format === "excel") {
      const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });
      const buf = await generateAchatsExcel({ societe, rows, exportedAt: new Date() });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename="achats-${today}.xlsx"`);
      return res.send(Buffer.from(buf));
    }
    const defaultFields = [
      "Référence",
      "Date commande",
      "Fournisseur",
      "Dépôt",
      "Statut",
      "Total HT",
      "TVA",
      "Total TTC",
      "Montant réglé",
      "Statut paiement",
      "Date réception",
      "Nb lignes",
    ];
    const fields = rows.length ? Object.keys(rows[0]) : defaultFields;
    return toCsv(res, rows, fields, `achats-${today}.csv`);
  } catch (error) {
    return next(error);
  }
}

async function stats(req, res, next) {
  try {
    const data = await achatsService.getStatsAchats(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function bonCommande(req, res, next) {
  try {
    const buf = await achatsService.getBonCommandePdf(req.user, req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="bon-commande-${req.params.id}.pdf"`);
    return res.send(buf);
  } catch (error) {
    return next(error);
  }
}

async function bonReception(req, res, next) {
  try {
    const buf = await achatsService.getBonReceptionPdf(req.user, req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="bon-reception-${req.params.id}.pdf"`);
    return res.send(buf);
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const result = await achatsService.listAchats(req.user, req.query);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await achatsService.getAchat(req.user, req.params.id);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const row = await achatsService.createAchat(req.user, req.body);
    await auditFromReq(req, {
      action: "CREATE",
      entite: "Achat",
      entiteId: row.id,
      description: `Création achat ${row.reference}`,
    });
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function recevoir(req, res, next) {
  try {
    const row = await achatsService.recevoirAchat(req.user, req.params.id);
    await activityFromReq(req, {
      action: "RECEIVE",
      module: "receptions",
      entity: "Achat",
      entityId: row.id,
      entityLabel: `Réception achat ${row.reference || row.id}`,
    });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function receptionnerLigne(req, res, next) {
  try {
    const row = await achatsService.receptionnerLigne(
      req.user,
      req.params.id,
      req.params.ligneId,
      req.body
    );
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function paiement(req, res, next) {
  try {
    const row = await achatsService.enregistrerPaiementAchat(req.user, req.params.id, req.body);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const row = await achatsService.updateAchat(req.user, req.params.id, req.body);
    await activityFromReq(req, {
      action: "UPDATE",
      module: "achats",
      entity: "Achat",
      entityId: row.id,
      entityLabel: `Modification achat ${row.reference || row.id}`,
      details: { changes: req.body },
    });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    await achatsService.deleteAchat(req.user, req.params.id);
    await activityFromReq(req, {
      action: "DELETE",
      module: "achats",
      entity: "Achat",
      entityId: Number(req.params.id),
      entityLabel: `Suppression achat #${req.params.id}`,
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

async function confirmer(req, res, next) {
  try {
    const row = await achatsService.confirmerCommande(req.user, req.params.id);
    await auditFromReq(req, {
      action: "VALIDATE",
      entite: "Achat",
      entiteId: row.id,
      description: `Validation achat ${row.reference}`,
    });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function enRetard(req, res, next) {
  try {
    const data = await achatsService.getAchatsEnRetard(req.user);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function comparaisonFournisseurs(req, res, next) {
  try {
    const data = await achatsService.getComparaisonFournisseurs(req.user, req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function annuler(req, res, next) {
  try {
    const row = await achatsService.annulerAchat(req.user, req.params.id);
    return res.json(row);
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
  recevoir,
  receptionnerLigne,
  paiement,
  searchArticles,
  exportAchats,
  stats,
  bonCommande,
  bonReception,
  confirmer,
  annuler,
  enRetard,
  comparaisonFournisseurs,
};
