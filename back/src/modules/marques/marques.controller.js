const svc = require("./marques.service");
const { activityFromReq } = require("../../services/activityLogger");

async function list(req, res, next) {
  try {
    const result = await svc.listMarques({
      user: req.user,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
      statut: req.query.statut,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await svc.getMarque(req.params.id, req.user.societeId);
    if (!row) return res.status(404).json({ message: "Marque introuvable" });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const row = await svc.createMarque(req.body, req.user.societeId);
    await activityFromReq(req, { action: "CREATE", module: "refs", entity: "Marque", entityId: row.id, entityLabel: `Marque: ${row.nom}` });
    return res.status(201).json(row);
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const row = await svc.updateMarque(req.params.id, req.body, req.user.societeId);
    await activityFromReq(req, { action: "UPDATE", module: "refs", entity: "Marque", entityId: row.id, entityLabel: `Marque: ${row.nom}` });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    await svc.deleteMarque(req.params.id, req.user.societeId);
    await activityFromReq(req, { action: "DELETE", module: "refs", entity: "Marque", entityId: Number(req.params.id), entityLabel: `Suppression marque #${req.params.id}` });
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
}

async function uploadImage(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "Image requise" });
    const url = `/uploads/marques/${req.file.filename}`;
    return res.status(201).json({ url });
  } catch (e) {
    return next(e);
  }
}

async function setStatut(req, res, next) {
  try {
    const { statut } = req.body;
    const row = await svc.setStatutMarque(req.params.id, req.user.societeId, statut);
    await activityFromReq(req, {
      action: "UPDATE",
      module: "refs",
      entity: "Marque",
      entityId: row.id,
      entityLabel: `Statut marque: ${row.nom} → ${row.statut}`,
    });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getOne, create, update, remove, uploadImage, setStatut };
