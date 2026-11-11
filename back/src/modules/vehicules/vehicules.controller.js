const vehiculesService = require("./vehicules.service");

async function list(req, res, next) {
  try {
    const result = await vehiculesService.listVehicules({
      user: req.user,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
      actifOnly: req.query.actifOnly,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await vehiculesService.getVehicule(req.params.id, req.user.societeId);
    if (!row) return res.status(404).json({ message: "Vehicule introuvable" });
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const row = await vehiculesService.createVehicule(req.body, req.user.societeId);
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const row = await vehiculesService.updateVehicule(req.params.id, req.body, req.user.societeId);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    await vehiculesService.deleteVehicule(req.params.id, req.user.societeId);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, getOne, create, update, remove };
