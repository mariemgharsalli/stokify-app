const alertesService = require("./alertes.service");

async function list(req, res, next) {
  try {
    const data = await alertesService.listAlertes(req.user, {
      nonLues: req.query.nonLues,
      limit: req.query.limit,
      page: req.query.page,
    });
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function count(req, res, next) {
  try {
    const data = await alertesService.countAlertesNonResolues(req.user);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function resoudre(req, res, next) {
  try {
    const data = await alertesService.resoudreAlerte(req.user, req.params.id);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function resoudreToutes(req, res, next) {
  try {
    const data = await alertesService.resoudreToutes(req.user);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, count, resoudre, resoudreToutes };
