const { Router } = require("express");
const { body, param } = require("express-validator");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { list, ids, add, remove } = require("./wishlist.controller");

const router = Router();

function requireClient(req, res, next) {
  if (req.user?.role !== "CLIENT") {
    return res.status(403).json({ message: "Accès réservé aux clients" });
  }
  return next();
}

router.get("/", requireClient, can("orders:read"), list);
router.get("/ids", requireClient, can("orders:read"), ids);
router.post(
  "/items",
  requireClient,
  can("orders:write"),
  [body("articleId").isInt({ min: 1 }).withMessage("Article invalide")],
  validate,
  add
);
router.delete(
  "/items/:articleId",
  requireClient,
  can("orders:write"),
  [param("articleId").isInt({ min: 1 }).withMessage("Article invalide")],
  validate,
  remove
);

module.exports = router;
