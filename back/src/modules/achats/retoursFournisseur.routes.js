const { Router } = require("express");
const { body, param } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./retoursFournisseur.controller");

const router = Router();

/**
 * @swagger
 * /achats/retours-fournisseur:
 *   get:
 *     summary: Lister les retours fournisseur
 *     tags: [Achats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: fournisseurId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Liste des retours fournisseur
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/", auth, can("achats:read"), c.list);

/**
 * @swagger
 * /achats/retours-fournisseur/{id}/pdf:
 *   get:
 *     summary: Télécharger le bon de retour fournisseur (PDF)
 *     tags: [Achats]
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
 *         description: Bon de retour PDF
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 */
router.get(
  "/:id/pdf",
  auth,
  can("achats:read"),
  [param("id").isInt({ min: 1 }).withMessage("id invalide")],
  validate,
  c.pdf
);

/**
 * @swagger
 * /achats/retours-fournisseur:
 *   post:
 *     summary: Créer un retour fournisseur (sortie stock + lot)
 *     tags: [Achats]
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
 *             required: [fournisseurId, articleId, depotId, quantite, motif]
 *             properties:
 *               fournisseurId: { type: integer }
 *               articleId: { type: integer }
 *               depotId: { type: integer }
 *               quantite: { type: number }
 *               motif: { type: string }
 *     responses:
 *       201:
 *         description: Retour fournisseur créé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post(
  "/",
  auth,
  can("achats:write"),
  [
    body("fournisseurId").isInt({ min: 1 }).withMessage("fournisseurId requis"),
    body("articleId").isInt({ min: 1 }).withMessage("articleId requis"),
    body("depotId").isInt({ min: 1 }).withMessage("depotId requis"),
    body("quantite").isFloat({ gt: 0 }).withMessage("quantite > 0 requise"),
    body("motif").isString().trim().notEmpty().withMessage("motif obligatoire"),
  ],
  validate,
  c.create
);

module.exports = router;
