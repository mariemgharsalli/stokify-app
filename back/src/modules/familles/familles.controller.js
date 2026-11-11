const svc = require("./familles.service");
const { activityFromReq } = require("../../services/activityLogger");

async function list(req, res, next) {
  try {
    const data = await svc.listFamilles({
      user: req.user,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
      statut: req.query.statut,
    });
    res.json(data);
  } catch (e) { next(e); }
}

async function get(req, res, next) {
  try {
    const data = await svc.getFamille(req.params.id, req.user.societeId);
    if (!data) return res.status(404).json({ message: "Famille introuvable" });
    res.json(data);
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const data = await svc.createFamille(req.body, req.user.societeId);
    await activityFromReq(req, { action: "CREATE", module: "refs", entity: "Famille", entityId: data.id, entityLabel: `Famille: ${data.nom}` });
    res.status(201).json(data);
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    const data = await svc.updateFamille(req.params.id, req.body, req.user.societeId);
    await activityFromReq(req, { action: "UPDATE", module: "refs", entity: "Famille", entityId: data.id, entityLabel: `Famille: ${data.nom}` });
    res.json(data);
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    await svc.deleteFamille(req.params.id, req.user.societeId);
    await activityFromReq(req, { action: "DELETE", module: "refs", entity: "Famille", entityId: Number(req.params.id), entityLabel: `Suppression famille #${req.params.id}` });
    res.status(204).end();
  } catch (e) { next(e); }
}

// ─── SOUS-FAMILLES ───────────────────────────────────────────────────────────

async function listSous(req, res, next) {
  try {
    const data = await svc.listSousFamilles({
      user: req.user,
      familleId: req.query.familleId,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
      statut: req.query.statut,
    });
    res.json(data);
  } catch (e) { next(e); }
}

async function createSous(req, res, next) {
  try {
    const data = await svc.createSousFamille(req.body, req.user.societeId);
    res.status(201).json(data);
  } catch (e) { next(e); }
}

async function updateSous(req, res, next) {
  try {
    const data = await svc.updateSousFamille(req.params.id, req.body, req.user.societeId);
    res.json(data);
  } catch (e) { next(e); }
}

async function removeSous(req, res, next) {
  try {
    await svc.deleteSousFamille(req.params.id, req.user.societeId);
    res.status(204).end();
  } catch (e) { next(e); }
}

async function setStatut(req, res, next) {
  try {
    const { statut } = req.body;
    const row = await svc.setStatutFamille(req.params.id, req.user.societeId, statut);
    await activityFromReq(req, {
      action: "UPDATE",
      module: "refs",
      entity: "Famille",
      entityId: row.id,
      entityLabel: `Statut famille: ${row.nom} → ${row.statut}`,
    });
    res.json(row);
  } catch (e) { next(e); }
}

async function setStatutSous(req, res, next) {
  try {
    const { statut } = req.body;
    const row = await svc.setStatutSousFamille(req.params.id, req.user.societeId, statut);
    await activityFromReq(req, {
      action: "UPDATE",
      module: "refs",
      entity: "SousFamille",
      entityId: row.id,
      entityLabel: `Statut sous-famille: ${row.nom} → ${row.statut}`,
    });
    res.json(row);
  } catch (e) { next(e); }
}

module.exports = {
  list, get, create, update, remove, listSous, createSous, updateSous, removeSous, setStatut, setStatutSous,
};
