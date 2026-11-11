const svc = require("./numeroserie.service");
const { auditFromReq } = require("../../utils/auditHelper");

async function list(req, res, next) {
  try {
    const result = await svc.listBySociete({
      societeId: req.user.societeId,
      articleId: req.query.articleId,
      depotId: req.query.depotId,
      statut: req.query.statut,
      lotId: req.query.lotId,
      search: req.query.search,
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
    const row = await svc.getNumeroSerie(req.params.id, req.user.societeId);
    if (!row) return res.status(404).json({ message: "Numero de serie introuvable" });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const row = await svc.createNumeroSerie(req.body, req.user.societeId);
    return res.status(201).json(row);
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const row = await svc.updateNumeroSerie(req.params.id, req.body, req.user.societeId);
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    const row = await svc.deactivateNumeroSerie(req.params.id, req.user.societeId);
    await auditFromReq(req, {
      action: "DESACTIVER",
      entite: "NumeroSerie",
      entiteId: row.id,
      module: "NumerosSerie",
      description: `Désactivation N° série ${row.numero}`,
    });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function assignerLot(req, res, next) {
  try {
    const lotId = req.body.lotId ?? req.body.lot_id;
    if (!lotId) return res.status(400).json({ message: "lotId requis" });
    const row = await svc.assignerLot(req.params.id, lotId, req.user.societeId);
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function transfert(req, res, next) {
  try {
    const depotId = req.body.depotId ?? req.body.newDepotId;
    if (!depotId) return res.status(400).json({ message: "depotId requis" });
    const row = await svc.transfertSerie(req.params.id, depotId, req.user.societeId, req.user, req);
    return res.json(row);
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ message: e.message });
    return next(e);
  }
}

async function historiqueMouvements(req, res, next) {
  try {
    const data = await svc.getHistoriqueNumeroSerie(req.user, req.params.id);
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function getNextCode(req, res, next) {
  try {
    const articleId = Number(req.query.articleId);
    if (!articleId) return res.status(400).json({ message: "articleId requis" });
    const numero = await svc.generateNumeroSerie(req.user.societeId, articleId);
    return res.json({ numero });
  } catch (error) {
    return next(error);
  }
}

async function bulkCreate(req, res, next) {
  try {
    const rows = Array.isArray(req.body.items) ? req.body.items : req.body.rows;
    if (!rows?.length) return res.status(400).json({ message: "items requis (tableau)" });
    const result = await svc.bulkCreateNumerosSerie(rows, req.user.societeId);
    await auditFromReq(req, {
      action: "BULK_IMPORT",
      entite: "NumeroSerie",
      entiteId: null,
      module: "NumerosSerie",
      description: `Import bulk : ${result.created}/${result.total} créé(s), ${result.errors?.length || 0} erreur(s)`,
    });
    return res.status(201).json(result);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  getOne,
  getNextCode,
  create,
  update,
  remove,
  assignerLot,
  transfert,
  historiqueMouvements,
  bulkCreate,
};
