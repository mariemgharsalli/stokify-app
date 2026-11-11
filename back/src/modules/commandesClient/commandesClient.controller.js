const commandesClientService = require("./commandesClient.service");

async function create(req, res, next) {
  try {
    const commande = await commandesClientService.createCommande(req.user, req.body || {});
    return res.status(201).json(commande);
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const result = await commandesClientService.listCommandes(req.user, {
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const commande = await commandesClientService.getCommande(req.user, req.params.id);
    return res.json(commande);
  } catch (error) {
    return next(error);
  }
}

async function annuler(req, res, next) {
  try {
    const commande = await commandesClientService.annulerCommande(req.user, req.params.id);
    return res.json(commande);
  } catch (error) {
    return next(error);
  }
}

module.exports = { create, list, getOne, annuler };
