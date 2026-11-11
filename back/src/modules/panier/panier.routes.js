const { Router } = require("express");
const { body, param } = require("express-validator");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { get, addItem, updateItem, removeItem, clear } = require("./panier.controller");

const router = Router();

function requireClient(req, res, next) {
  if (req.user?.role !== "CLIENT") {
    return res.status(403).json({ message: "Accès réservé aux clients" });
  }
  return next();
}

router.get("/", requireClient, can("orders:read"), get);
router.post(
  "/items",
  requireClient,
  can("orders:write"),
  [
    body("articleId").isInt({ min: 1 }).withMessage("Article invalide"),
    body("quantite")
      .isInt({ min: 1, max: 10000 })
      .withMessage("Quantite doit etre un entier entre 1 et 10000"),
  ],
  validate,
  addItem
);
router.patch(
  "/items/:articleId",
  requireClient,
  can("orders:write"),
  [
    param("articleId").isInt({ min: 1 }).withMessage("Article invalide"),
    body("quantite")
      .isInt({ min: 1, max: 10000 })
      .withMessage("Quantite doit etre un entier entre 1 et 10000"),
  ],
  validate,
  updateItem
);
router.delete(
  "/items/:articleId",
  requireClient,
  can("orders:write"),
  [param("articleId").isInt({ min: 1 }).withMessage("Article invalide")],
  validate,
  removeItem
);
router.delete("/", requireClient, can("orders:write"), clear);

module.exports = router;
