const depotsService = require("./depots.service");
const { activityFromReq } = require("../../services/activityLogger");

function wantsEnrichedDepots(query) {
  const e = query.enriched;
  if (e == null || e === "" || e === "0" || e === "false") return false;
  if (e === "1" || e === "true" || e === true) return true;
  return String(e) === "1";
}

async function list(req, res, next) {
  try {
    if (wantsEnrichedDepots(req.query) || req.query.with === "emplacements") {
      const result = await depotsService.listDepotsEnriched({
        user: req.user,
        search: req.query.search,
      });
      res.set("Cache-Control", "no-store, no-cache, must-revalidate");
      res.set("Pragma", "no-cache");
      return res.json(result);
    }
    const result = await depotsService.listDepots({
      user: req.user,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
      statut: req.query.statut,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function stats(req, res, next) {
  try {
    const result = await depotsService.getDepotStats(req.params.id, req.user.societeId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function layout(req, res, next) {
  try {
    const result = await depotsService.getDepotLayout(req.params.id, req.user.societeId);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const depot = await depotsService.getDepot(req.params.id, req.user.societeId);
    if (!depot) return res.status(404).json({ message: "Depot introuvable" });
    return res.json(depot);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const depot = await depotsService.createDepot(req.body, req.user.societeId);
    await activityFromReq(req, {
      action: "CREATE",
      module: "depots",
      entity: "Depot",
      entityId: depot.id,
      entityLabel: `Dépôt: ${depot.libelle || depot.code}`,
    });
    return res.status(201).json(depot);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const depot = await depotsService.updateDepot(req.params.id, req.body, req.user.societeId);
    await activityFromReq(req, {
      action: "UPDATE",
      module: "depots",
      entity: "Depot",
      entityId: depot.id,
      entityLabel: `Dépôt: ${depot.libelle || depot.code}`,
    });
    return res.json(depot);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    await depotsService.deleteDepot(req.params.id, req.user.societeId);
    await activityFromReq(req, {
      action: "DELETE",
      module: "depots",
      entity: "Depot",
      entityId: Number(req.params.id),
      entityLabel: `Suppression dépôt #${req.params.id}`,
    });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function withStockSummary(req, res, next) {
  try {
    const data = await depotsService.getDepotsWithStockSummary(req.user);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function setStatut(req, res, next) {
  try {
    const { statut } = req.body;
    const row = await depotsService.setStatutDepot(req.params.id, req.user.societeId, statut);
    await activityFromReq(req, {
      action: "UPDATE",
      module: "depots",
      entity: "Depot",
      entityId: row.id,
      entityLabel: `Statut dépôt: ${row.libelle || row.code} → ${row.statut}`,
    });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, getOne, stats, layout, create, update, remove, withStockSummary, setStatut };
