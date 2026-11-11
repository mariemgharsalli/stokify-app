const wishlistService = require("./wishlist.service");

async function list(req, res, next) {
  try {
    return res.json(await wishlistService.listWishlist(req.user));
  } catch (e) {
    return next(e);
  }
}

async function ids(req, res, next) {
  try {
    return res.json(await wishlistService.idsWishlist(req.user));
  } catch (e) {
    return next(e);
  }
}

async function add(req, res, next) {
  try {
    const articleId = req.body?.articleId ?? req.params.articleId;
    return res.status(201).json(await wishlistService.addWishlist(req.user, articleId));
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    return res.json(await wishlistService.removeWishlist(req.user, req.params.articleId));
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, ids, add, remove };
