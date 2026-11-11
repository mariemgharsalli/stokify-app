const emplacementsService = require("./emplacements.service");
const { activityFromReq } = require("../../services/activityLogger");

async function list(req, res, next) {
  try {
    if (!req.query.depotId) return res.status(400).json({ message: "depotId requis" });
    const items = await emplacementsService.listByDepot(
      req.query.depotId,
      req.user.societeId,
      req.query.statut
    );
    return res.json(items);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const row = await emplacementsService.createEmplacement(req.body, req.user.societeId);
    await activityFromReq(req, { action: "CREATE", module: "depots", entity: "Emplacement", entityId: row.id, entityLabel: `Emplacement: ${row.code || row.libelle}` });
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const row = await emplacementsService.updateEmplacement(req.params.id, req.body, req.user.societeId);
    await activityFromReq(req, { action: "UPDATE", module: "depots", entity: "Emplacement", entityId: row.id, entityLabel: `Emplacement: ${row.code || row.libelle}` });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    await emplacementsService.deleteEmplacement(req.params.id, req.user.societeId);
    await activityFromReq(req, { action: "DELETE", module: "depots", entity: "Emplacement", entityId: Number(req.params.id), entityLabel: `Suppression emplacement #${req.params.id}` });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function setStatut(req, res, next) {
  try {
    const { statut } = req.body;
    const row = await emplacementsService.setStatutEmplacement(req.params.id, req.user.societeId, statut);
    await activityFromReq(req, {
      action: "UPDATE",
      module: "depots",
      entity: "Emplacement",
      entityId: row.id,
      entityLabel: `Statut emplacement: ${row.code || row.libelle} → ${row.statut}`,
    });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, update, remove, setStatut };
