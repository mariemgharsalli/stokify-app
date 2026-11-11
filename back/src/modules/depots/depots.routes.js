const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { list, getOne, stats, create, update, remove, withStockSummary, setStatut, layout } = require("./depots.controller");

const router = Router();

const depotOptionalFields = [
  body("capacite").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("capaciteVolume").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("capacitePoids").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("qteMin").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("qteMax").optional({ values: "falsy" }).isFloat({ min: 0 }),
  body("qteMax").custom((val, { req }) => {
    if (val != null && val !== "" && req.body.qteMin != null && req.body.qteMin !== "") {
      if (Number(req.body.qteMin) > Number(val)) {
        throw new Error("qteMin ne peut pas dépasser qteMax");
      }
    }
    return true;
  }),
  body("latitude").optional({ values: "falsy" }).isFloat({ min: -90, max: 90 }),
  body("longitude").optional({ values: "falsy" }).isFloat({ min: -180, max: 180 }),
  body("storageRefrigere").optional().isBoolean(),
  body("storageChimique").optional().isBoolean(),
  body("storageInflammable").optional().isBoolean(),
  body("storageFragile").optional().isBoolean(),
  body("longitude").custom((val, { req }) => {
    const hasLat = req.body.latitude != null && req.body.latitude !== "";
    const hasLng = val != null && val !== "";
    if (hasLat !== hasLng) {
      throw new Error("Renseignez latitude ET longitude, ou aucune des deux");
    }
    return true;
  }),
];

/**
 * @swagger
 * /depots:
 *   get:
 *     summary: Lister les dépôts (multi-dépôts)
 *     tags: [Depots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des dépôts
 *         content:
 *           application/json:
 *             example: [{ id: 1, code: DEP-01, libelle: "Entrepôt central", actif: true }]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", auth, can("stock:read"), list);
router.get("/with-stock-summary", auth, can("stock:read"), withStockSummary);
router.get("/:id/stats", auth, can("stock:read"), stats);
router.get("/:id/layout", auth, can("stock:read"), layout);
/**
 * @swagger
 * /depots/{id}:
 *   get:
 *     summary: Détail d'un dépôt
 *     tags: [Depots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Dépôt trouvé
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", auth, can("stock:read"), getOne);
/**
 * @swagger
 * /depots:
 *   post:
 *     summary: Créer un dépôt
 *     tags: [Depots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, libelle]
 *             properties:
 *               code: { type: string, example: DEP-02 }
 *               libelle: { type: string, example: "Dépôt régional Sud" }
 *               adresse: { type: string }
 *               ville: { type: string }
 *     responses:
 *       201:
 *         description: Dépôt créé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post(
  "/",
  auth,
  can("stock:write"),
  [
    body("code").trim().isLength({ min: 1 }).withMessage("Code requis"),
    body("libelle").trim().isLength({ min: 2 }).withMessage("Libelle requis"),
    ...depotOptionalFields,
  ],
  validate,
  create
);
/**
 * @swagger
 * /depots/{id}:
 *   patch:
 *     summary: Modifier un dépôt
 *     tags: [Depots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               libelle: { type: string }
 *               adresse: { type: string }
 *               actif: { type: boolean }
 *     responses:
 *       200:
 *         description: Dépôt modifié
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch("/:id/statut", auth, can("stock:write"), setStatut);
router.patch(
  "/:id",
  auth,
  can("stock:write"),
  [
    body("code").optional().trim().isLength({ min: 1 }).withMessage("Code requis"),
    body("libelle").optional().trim().isLength({ min: 2 }).withMessage("Libelle requis"),
    ...depotOptionalFields,
  ],
  validate,
  update
);
/**
 * @swagger
 * /depots/{id}:
 *   delete:
 *     summary: Supprimer un dépôt
 *     tags: [Depots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Dépôt supprimé
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", auth, can("stock:write"), remove);

module.exports = router;
