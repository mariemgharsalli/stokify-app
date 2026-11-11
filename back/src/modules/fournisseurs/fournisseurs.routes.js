const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./fournisseurs.controller");

const router = Router();

/**
 * @swagger
 * /fournisseurs:
 *   get:
 *     summary: Lister les fournisseurs
 *     tags: [Fournisseurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des fournisseurs
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", auth, can("achats:read"), c.list);
/**
 * @swagger
 * /fournisseurs/proximite:
 *   get:
 *     summary: Fournisseurs à proximité (géolocalisation)
 *     tags: [Fournisseurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Fournisseurs triés par proximité
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/proximite", auth, can("achats:read"), c.proximite);
/**
 * @swagger
 * /fournisseurs/{id}/stats:
 *   get:
 *     summary: Statistiques d'un fournisseur
 *     tags: [Fournisseurs]
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
 *         description: Statistiques du fournisseur
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/next-code", auth, can("achats:read"), c.getNextCode);
router.get("/:id/stats", auth, can("achats:read"), c.statsFournisseur);
/**
 * @swagger
 * /fournisseurs/{id}/historique-achats:
 *   get:
 *     summary: Historique des achats d'un fournisseur
 *     tags: [Fournisseurs]
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
 *         description: Historique des achats
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id/historique-achats", auth, can("achats:read"), c.historiqueAchats);
/**
 * @swagger
 * /fournisseurs/{id}:
 *   get:
 *     summary: Détail d'un fournisseur
 *     tags: [Fournisseurs]
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
 *         description: Fournisseur trouvé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id", auth, can("achats:read"), c.getOne);
/**
 * @swagger
 * /fournisseurs:
 *   post:
 *     summary: Créer un fournisseur
 *     tags: [Fournisseurs]
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
 *             required: [code, nom]
 *             properties:
 *               code: { type: string, example: FRN-01 }
 *               nom: { type: string, example: "Distrib Boissons SA" }
 *               email: { type: string, format: email }
 *               telephone: { type: string }
 *     responses:
 *       201:
 *         description: Fournisseur créé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/",
  auth,
  can("achats:write"),
  [
    body("code").trim().isLength({ min: 1 }),
    body("nom").trim().notEmpty().withMessage("Nom requis"),
    body("email").optional({ values: "falsy" }).isEmail().withMessage("Email invalide"),
    body("telephone").optional({ values: "falsy" }).matches(/^[+]?[0-9\s().-]{6,20}$/).withMessage("Téléphone invalide"),
    body("tauxRemise").optional({ values: "falsy" }).isFloat({ min: 0, max: 100 }),
    body("delaiPayment").optional({ values: "falsy" }).isInt({ min: 0, max: 365 }),
    body("noteCredit").optional({ values: "falsy" }).isFloat({ min: 0 }),
    body("latitude").optional({ values: "falsy" }).isFloat({ min: -90, max: 90 }),
    body("longitude").optional({ values: "falsy" }).isFloat({ min: -180, max: 180 }),
    body("longitude").custom((val, { req }) => {
      const hasLat = req.body.latitude != null && req.body.latitude !== "";
      const hasLng = val != null && val !== "";
      if (hasLat !== hasLng) throw new Error("Renseignez latitude ET longitude, ou aucune des deux");
      return true;
    }),
  ],
  validate,
  c.create
);
/**
 * @swagger
 * /fournisseurs/{id}:
 *   patch:
 *     summary: Modifier un fournisseur
 *     tags: [Fournisseurs]
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
 *               code: { type: string }
 *               nom: { type: string }
 *               email: { type: string }
 *               telephone: { type: string }
 *     responses:
 *       200:
 *         description: Fournisseur modifié
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch(
  "/:id",
  auth,
  can("achats:write"),
  [
    body("nom").optional().trim().notEmpty().withMessage("Nom requis"),
    body("email").optional({ values: "falsy" }).isEmail().withMessage("Email invalide"),
    body("telephone").optional({ values: "falsy" }).matches(/^[+]?[0-9\s().-]{6,20}$/).withMessage("Téléphone invalide"),
    body("tauxRemise").optional({ values: "falsy" }).isFloat({ min: 0, max: 100 }),
    body("delaiPayment").optional({ values: "falsy" }).isInt({ min: 0, max: 365 }),
    body("noteCredit").optional({ values: "falsy" }).isFloat({ min: 0 }),
    body("latitude").optional({ values: "falsy" }).isFloat({ min: -90, max: 90 }),
    body("longitude").optional({ values: "falsy" }).isFloat({ min: -180, max: 180 }),
    body("longitude").custom((val, { req }) => {
      const hasLat = req.body.latitude != null && req.body.latitude !== "";
      const hasLng = val != null && val !== "";
      if (hasLat !== hasLng) throw new Error("Renseignez latitude ET longitude, ou aucune des deux");
      return true;
    }),
    body("actif")
      .optional()
      .custom((v) => v === true || v === false || v === "true" || v === "false" || v === 0 || v === 1 || v === "0" || v === "1")
      .withMessage("actif doit etre true ou false"),
  ],
  validate,
  c.update
);

// DELETE /fournisseurs/:id retiré de l'API publique — désactivation via PATCH (actif: false).

module.exports = router;
