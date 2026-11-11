const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./numeroserie.controller");

const router = Router();

/**
 * @swagger
 * /numeros-serie:
 *   get:
 *     summary: Lister les numéros de série
 *     tags: [NumerosSerie]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des numéros de série
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", auth, can("stock:read"), c.list);
/**
 * @swagger
 * /numeros-serie:
 *   post:
 *     summary: Créer un numéro de série
 *     tags: [NumerosSerie]
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
 *             required: [numero, articleId]
 *             properties:
 *               numero: { type: string, example: SN-2024-001 }
 *               articleId: { type: integer, example: 1 }
 *               lotId: { type: integer }
 *               depotId: { type: integer }
 *     responses:
 *       201:
 *         description: Numéro de série créé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/next-code", auth, can("stock:read"), c.getNextCode);
router.post(
  "/",
  auth,
  can("stock:write"),
  [body("numero").trim().isLength({ min: 1 }), body("articleId").isInt()],
  validate,
  c.create
);
router.post("/bulk", auth, can("stock:write"), c.bulkCreate);
router.patch("/:id/assigner-lot", auth, can("stock:write"), [body("lotId").isInt()], validate, c.assignerLot);
router.patch("/:id/transfert", auth, can("stock:write"), [body("depotId").isInt()], validate, c.transfert);
router.get("/:id/mouvements", auth, can("stock:read"), c.historiqueMouvements);
/**
 * @swagger
 * /numeros-serie/{id}:
 *   get:
 *     summary: Détail d'un numéro de série
 *     tags: [NumerosSerie]
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
 *         description: Numéro de série trouvé
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
 * /numeros-serie/{id}:
 *   patch:
 *     summary: Modifier un numéro de série
 *     tags: [NumerosSerie]
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
 *               numero: { type: string }
 *               statut: { type: string }
 *               lotId: { type: integer }
 *               depotId: { type: integer }
 *     responses:
 *       200:
 *         description: Numéro de série modifié
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch("/:id", auth, can("stock:write"), c.update);
/**
 * @swagger
 * /numeros-serie/{id}:
 *   delete:
 *     summary: Désactiver un numéro de série (soft archive)
 *     tags: [NumerosSerie]
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
 *         description: Numéro de série désactivé (statut DESACTIVE)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/:id", auth, can("stock:write"), c.remove);

module.exports = router;
