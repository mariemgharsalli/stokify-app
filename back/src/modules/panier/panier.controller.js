const panierService = require("./panier.service");

async function get(req, res, next) {
  try {
    const panier = await panierService.getPanier(req.user);
    return res.json(panier);
  } catch (error) {
    return next(error);
  }
}

async function addItem(req, res, next) {
  try {
    const panier = await panierService.addItem(req.user, {
      articleId: req.body.articleId,
      quantite: req.body.quantite ?? 1,
    });
    return res.status(201).json(panier);
  } catch (error) {
    return next(error);
  }
}

async function updateItem(req, res, next) {
  try {
    const panier = await panierService.updateItem(
      req.user,
      req.params.articleId,
      req.body.quantite
    );
    return res.json(panier);
  } catch (error) {
    return next(error);
  }
}

async function removeItem(req, res, next) {
  try {
    const panier = await panierService.removeItem(req.user, req.params.articleId);
    return res.json(panier);
  } catch (error) {
    return next(error);
  }
}

async function clear(req, res, next) {
  try {
    const panier = await panierService.clearPanier(req.user);
    return res.json(panier);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get, addItem, updateItem, removeItem, clear };
