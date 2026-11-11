const svc = require("./groupes.service");

async function list(req, res, next) {
  try {
    const items = await svc.listGroupes({ societeId: req.user.societeId, search: req.query.search });
    return res.json(items);
  } catch (e) {
    return next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await svc.getGroupe(req.params.id, req.user.societeId);
    if (!row) return res.status(404).json({ message: "Groupe introuvable" });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const row = await svc.createGroupe(req.body, req.user.societeId);
    return res.status(201).json(row);
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const row = await svc.updateGroupe(req.params.id, req.body, req.user.societeId);
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    await svc.deleteGroupe(req.params.id, req.user.societeId);
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getOne, create, update, remove };
