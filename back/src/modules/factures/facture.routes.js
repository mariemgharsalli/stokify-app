const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./facture.controller");

const router = Router();

/**
 * @swagger
 * /factures/relances:
 *   get:
 *     summary: Factures en retard (échéance dépassée, solde restant)
 *     tags: [Factures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des factures en retard avec jours de retard
 */
router.get("/relances", auth, can("ventes:read"), c.listRelances);

/**
 * @swagger
 * /factures/vente/{venteId}:
 *   get:
 *     summary: Facture associée à une vente
 *     tags: [Factures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: path
 *         name: venteId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Facture de la vente
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/vente/:venteId", auth, can("ventes:read"), c.byVente);
/**
 * @swagger
 * /factures/{id}/apercu:
 *   get:
 *     summary: Aperçu HTML d'une facture
 *     tags: [Factures]
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
 *         description: Aperçu de la facture
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id/apercu", auth, can("ventes:read"), c.apercu);
/**
 * @swagger
 * /factures/{id}/pdf:
 *   get:
 *     summary: Télécharger une facture en PDF
 *     tags: [Factures]
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
 *         description: Fichier PDF de la facture
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id/pdf", auth, can("ventes:read"), c.pdf);
/**
 * @swagger
 * /factures/{id}/envoyer-email:
 *   post:
 *     summary: Envoyer une facture par e-mail
 *     tags: [Factures]
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
 *               to: { type: string, format: email }
 *               subject: { type: string }
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: E-mail envoyé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/:id/envoyer-email",
  auth,
  can("ventes:write"),
  [body("to").optional().isEmail(), body("subject").optional().isString(), body("message").optional().isString()],
  validate,
  c.envoyerEmail
);

/**
 * @swagger
 * /factures/{id}/relancer:
 *   post:
 *     summary: Créer une relance manuelle pour une facture en retard
 *     tags: [Factures]
 */
router.post(
  "/:id/relancer",
  auth,
  can("ventes:write"),
  [body("envoyerEmail").optional().isBoolean()],
  validate,
  c.relancer
);

module.exports = router;
