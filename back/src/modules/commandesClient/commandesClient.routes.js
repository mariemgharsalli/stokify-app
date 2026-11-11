const { Router } = require("express");
const { body } = require("express-validator");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { create, list, getOne, annuler } = require("./commandesClient.controller");

const router = Router();

function requireClient(req, res, next) {
  if (req.user?.role !== "CLIENT") {
    return res.status(403).json({ message: "Accès réservé aux clients" });
  }
  return next();
}

router.post(
  "/",
  requireClient,
  can("orders:write"),
  [
    body("lignes")
      .optional({ nullable: true })
      .isArray({ max: 200 })
      .withMessage("Lignes invalides (tableau de 200 elements max)"),
    body("adresseLivraison")
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .isLength({ max: 500 })
      .withMessage("Adresse de livraison trop longue (max 500)"),
    body("notesLivraison")
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .isLength({ max: 1000 })
      .withMessage("Notes de livraison trop longues (max 1000)"),
    body("modePaiement")
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .toUpperCase()
      .isIn(["ESPECES", "VIREMENT", "CHEQUE", "CARTE", "A_LA_LIVRAISON", "AUTRE"])
      .withMessage("Mode de paiement invalide"),
  ],
  validate,
  create
);
router.get("/", requireClient, can("orders:read"), list);
router.get("/:id", requireClient, can("orders:read"), getOne);
router.post("/:id/annuler", requireClient, can("orders:write"), annuler);

module.exports = router;
