const svc = require("./inventaires.service");
const { toCsv } = require("../../utils/exportCsv");
const { activityFromReq } = require("../../services/activityLogger");

function wantsEnriched(query) {
  const e = query.enriched;
  return e === "1" || e === "true" || e === true;
}

async function getNextCode(req, res, next) {
  try {
    const code = await svc.generateInventaireReference(req.user.societeId);
    return res.json({ code });
  } catch (e) {
    return next(e);
  }
}

async function list(req, res, next) {
  try {
    if (wantsEnriched(req.query)) {
      const result = await svc.listInventairesEnriched({
        user: req.user,
        depotId: req.query.depotId,
        statut: req.query.statut,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit,
      });
      return res.json(result);
    }
    const result = await svc.listInventaires({
      user: req.user,
      depotId: req.query.depotId,
      statut: req.query.statut,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await svc.getInventaire(req.params.id, req.user.societeId);
    if (!row) return res.status(404).json({ message: "Inventaire introuvable" });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const depotId = Number(req.body.depotId);
    if (!Number.isFinite(depotId) || depotId <= 0) {
      return res.status(400).json({ message: "depotId est requis et doit être un nombre." });
    }
    const row = await svc.createInventaire(req.body, req.user.societeId);
    await activityFromReq(req, {
      action: "CREATE",
      module: "inventaire",
      entity: "Inventaire",
      entityId: row.id,
      entityLabel: `Inventaire #${row.id}`,
      details: { depotId: req.body.depotId },
    });
    return res.status(201).json(row);
  } catch (e) {
    return next(e);
  }
}

async function addLigne(req, res, next) {
  try {
    const articleId = Number(req.body.articleId);
    if (!Number.isFinite(articleId) || articleId <= 0) {
      return res.status(400).json({ message: "articleId est requis et doit être un nombre." });
    }
    if (req.body.qteReelle !== undefined && req.body.qteReelle !== null && req.body.qteReelle !== "") {
      const q = Number(req.body.qteReelle);
      if (Number.isNaN(q) || q < 0) {
        return res.status(400).json({ message: "qteReelle doit être un nombre valide (>= 0)." });
      }
    }
    const row = await svc.addLigne(req.params.id, req.body, req.user.societeId);
    return res.status(201).json(row);
  } catch (e) {
    return next(e);
  }
}

async function patchLigne(req, res, next) {
  try {
    if (req.body.qteReelle !== undefined && req.body.qteReelle !== null && req.body.qteReelle !== "") {
      const q = Number(req.body.qteReelle);
      if (Number.isNaN(q) || q < 0) {
        return res.status(400).json({ message: "qteReelle doit être un nombre valide (>= 0)." });
      }
    }
    const row = await svc.updateLigne(req.params.id, req.params.ligneId, req.body, req.user.societeId);
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function bulkLignes(req, res, next) {
  try {
    const lignes = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body?.lignes)
        ? req.body.lignes
        : [];
    const result = await svc.bulkUpdateLignes(req.params.id, lignes, req.user.societeId);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function autoSave(req, res, next) {
  return bulkLignes(req, res, next);
}

async function toggleRecomptage(req, res, next) {
  try {
    const row = await svc.toggleRecomptageLigne(
      req.params.id,
      req.params.ligneId,
      req.user.societeId
    );
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function validateInv(req, res, next) {
  try {
    const row = await svc.validateInventaire(req.params.id, req.user, {
      action: req.body?.action || "ajuster",
      commentaire: req.body?.commentaire,
    });
    await activityFromReq(req, {
      action: "VALIDATE",
      module: "inventaire",
      entity: "Inventaire",
      entityId: row.id,
      entityLabel: `Validation inventaire #${row.id}`,
      details: { action: req.body?.action, ecarts: row.ecarts },
    });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function cancel(req, res, next) {
  try {
    const row = await svc.cancelInventaire(req.params.id, req.user.societeId);
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    const result = await svc.deleteInventaire(req.params.id, req.user.societeId);
    await activityFromReq(req, {
      action: "DELETE",
      module: "inventaire",
      entity: "Inventaire",
      entityId: Number(req.params.id),
      entityLabel: `Suppression inventaire #${req.params.id}`,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function duplicate(req, res, next) {
  try {
    const row = await svc.duplicateInventaire(req.params.id, req.user.societeId);
    return res.status(201).json(row);
  } catch (e) {
    return next(e);
  }
}

async function exportCsv(req, res, next) {
  try {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[CSV export inventaire]", req.params.id);
    }
    const inv = await svc.getInventaire(req.params.id, req.user.societeId);
    if (!inv) return res.status(404).json({ message: "Inventaire introuvable" });
    const rows = inv.lignes.map((l) => ({
      code: l.article?.code ?? "",
      libelle: l.article?.libelle ?? "",
      unite: l.article?.unite ?? "",
      qteTheorique: l.qteTheorique,
      qteReelle: l.qteReelle ?? "",
      ecart: l.ecart ?? "",
      valide: l.valide ? "Oui" : "Non",
    }));
    const fields = [
      { label: "Code", value: "code" },
      { label: "Désignation", value: "libelle" },
      { label: "Unité", value: "unite" },
      { label: "Qté théorique", value: "qteTheorique" },
      { label: "Qté réelle", value: "qteReelle" },
      { label: "Écart", value: "ecart" },
      { label: "Validé", value: "valide" },
    ];
    return toCsv(res, rows, fields, `INV-${inv.reference}.csv`);
  } catch (err) {
    return next(err);
  }
}

async function exportPdf(req, res, next) {
  try {
    const buf = await svc.buildInventairePdfBuffer(req.params.id, req.user.societeId);
    if (!buf) return res.status(404).json({ message: "Inventaire introuvable" });
    const inv = await svc.getInventaire(req.params.id, req.user.societeId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="inventaire-${inv.reference}.pdf"`);
    return res.send(buf);
  } catch (err) {
    return next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const buf = await svc.buildInventaireExcelBuffer(req.params.id, req.user.societeId);
    if (!buf) return res.status(404).json({ message: "Inventaire introuvable" });
    const inv = await svc.getInventaire(req.params.id, req.user.societeId);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="inventaire-${inv.reference}.xlsx"`);
    return res.send(Buffer.from(buf));
  } catch (err) {
    return next(err);
  }
}

async function exportListExcel(req, res, next) {
  try {
    const buf = await svc.buildInventairesListExcelBuffer(req.user, {
      depotId: req.query.depotId,
      statut: req.query.statut,
      search: req.query.search,
    });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="inventaires-liste.xlsx"');
    return res.send(Buffer.from(buf));
  } catch (err) {
    return next(err);
  }
}

async function ecartsRapport(req, res, next) {
  try {
    const data = await svc.getEcartsRapport(req.params.id, req.user.societeId);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getNextCode,
  list,
  getOne,
  ecartsRapport,
  create,
  addLigne,
  patchLigne,
  bulkLignes,
  autoSave,
  toggleRecomptage,
  validateInv,
  cancel,
  remove,
  duplicate,
  exportCsv,
  exportPdf,
  exportExcel,
  exportListExcel,
};
