const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./inventaires.controller");

const router = Router();

/**
 * @swagger
 * /inventaires:
 *   get:
 *     summary: Lister les inventaires
 *     tags: [Inventaires]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des inventaires
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", auth, can("stock:read"), c.list);
router.get("/next-code", auth, can("stock:read"), c.getNextCode);
router.get("/export-list-excel", auth, can("stock:read"), c.exportListExcel);
router.get("/:id/ecarts-rapport", auth, can("stock:read"), c.ecartsRapport);
router.get("/:id/export-pdf", auth, can("stock:read"), c.exportPdf);
router.get("/:id/export-excel", auth, can("stock:read"), c.exportExcel);
router.get("/:id/export", auth, can("stock:read"), c.exportCsv);
/**
 * @swagger
 * /inventaires/{id}:
 *   get:
 *     summary: Détail d'un inventaire
 *     tags: [Inventaires]
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
 *         description: Inventaire trouvé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id", auth, can("stock:read"), c.getOne);
/**
 * @swagger
 * /inventaires:
 *   post:
 *     summary: Créer un inventaire
 *     tags: [Inventaires]
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
 *             required: [depotId]
 *             properties:
 *               depotId: { type: integer, example: 1 }
 *     responses:
 *       201:
 *         description: Inventaire créé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/", auth, can("stock:write"), [
  body("depotId").isInt(),
  body("reference").optional().trim().isLength({ min: 1, max: 50 }),
  body("date").optional().isISO8601(),
  body("modeAveugle").optional().isBoolean(),
  body("typeInventaire").optional().isIn(["complet", "partiel", "tournant"]),
], validate, c.create);
router.post("/:id/duplicate", auth, can("stock:write"), c.duplicate);
/**
 * @swagger
 * /inventaires/{id}:
 *   delete:
 *     summary: Supprimer un inventaire
 *     tags: [Inventaires]
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
 *         description: Inventaire supprimé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/:id", auth, can("stock:write"), c.remove);
router.patch("/:id/cancel", auth, can("stock:write"), c.cancel);
router.post(
  "/:id/lignes",
  auth,
  can("stock:write"),
  [
    body("articleId").isInt(),
    body("qteTheorique").optional().isFloat({ min: 0 }),
    body("qteReelle").optional({ nullable: true }).isFloat({ min: 0 }),
    body("lotId").optional({ nullable: true }).isInt(),
    body("emplacementId").optional({ nullable: true }).isInt(),
  ],
  validate,
  c.addLigne
);
router.patch(
  "/:id/lignes/:ligneId/recomptage",
  auth,
  can("stock:write"),
  c.toggleRecomptage
);
router.patch(
  "/:id/lignes/:ligneId",
  auth,
  can("stock:write"),
  [
    body("qteTheorique").optional().isFloat({ min: 0 }),
    body("qteReelle").optional({ nullable: true }).isFloat({ min: 0 }),
    body("lotId").optional({ nullable: true }).isInt(),
    body("emplacementId").optional({ nullable: true }).isInt(),
  ],
  validate,
  c.patchLigne
);
router.put("/:id/lignes", auth, can("stock:write"), c.bulkLignes);
router.put("/:id/auto-save", auth, can("stock:write"), c.autoSave);
router.post("/:id/valider", auth, can("stock:write"), c.validateInv);

module.exports = router;
