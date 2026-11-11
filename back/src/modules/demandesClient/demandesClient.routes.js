const { Router } = require("express");
const { body, param, query } = require("express-validator");
const { can, canAny } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const ctrl = require("./demandesClient.controller");

const router = Router();

function requireClient(req, res, next) {
  if (req.user?.role !== "CLIENT") {
    return res.status(403).json({ message: "Accès réservé aux clients" });
  }
  return next();
}

const read = canAny("orders:read", "ventes:read");
const write = canAny("orders:write", "ventes:read");

router.get("/count", read, ctrl.count);
router.get(
  "/sujet",
  requireClient,
  can("orders:read"),
  [
    query("articleId").optional({ nullable: true }).isInt({ min: 1 }),
    query("commandeId").optional({ nullable: true }).isInt({ min: 1 }),
  ],
  validate,
  ctrl.sujet
);
router.get("/", read, ctrl.list);
router.get("/:id", read, [param("id").isInt({ min: 1 })], validate, ctrl.getOne);
router.post(
  "/",
  requireClient,
  can("orders:write"),
  [
    body("message").isString().isLength({ min: 2, max: 2000 }),
    body("articleId").optional({ nullable: true }).isInt({ min: 1 }),
    body("commandeId").optional({ nullable: true }).isInt({ min: 1 }),
  ],
  validate,
  ctrl.create
);
router.post(
  "/:id/messages",
  write,
  [param("id").isInt({ min: 1 }), body("message").isString().isLength({ min: 2, max: 2000 })],
  validate,
  ctrl.reply
);
router.post("/:id/fermer", write, [param("id").isInt({ min: 1 })], validate, ctrl.close);

module.exports = router;
