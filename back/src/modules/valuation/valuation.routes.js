const { Router } = require("express");
const { param, query } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./valuation.controller");

const router = Router();

/**
 * @swagger
 * /valuation/comparaison:
 *   get:
 *     summary: Comparaison des méthodes de valorisation
 *     tags: [Valuation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Comparaison CMP / FIFO / etc.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/comparaison", auth, can("valorisation:read"), c.getComparaison);
router.post("/revalidate", auth, can("valorisation:read"), c.postRevalidate);
/**
 * @swagger
 * /valuation/stock:
 *   get:
 *     summary: Valorisation globale du stock
 *     tags: [Valuation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Valorisation du stock
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/stock", auth, can("valorisation:read"), c.getStockValuation);
/**
 * @swagger
 * /valuation/history/{articleId}:
 *   get:
 *     summary: Historique CMP d'un article
 *     tags: [Valuation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Historique des coûts moyens pondérés
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/history/:articleId", auth, can("valorisation:read"), [param("articleId").isInt({ min: 1 })], validate, c.getCMPHistory);
/**
 * @swagger
 * /valuation/compare/{articleId}:
 *   get:
 *     summary: Comparer les méthodes de valorisation pour un article
 *     tags: [Valuation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Comparaison par méthode
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/compare/:articleId", auth, can("valorisation:read"), [param("articleId").isInt({ min: 1 })], validate, c.compareMethodes);
/**
 * @swagger
 * /valuation/dernier-prix/{articleId}:
 *   get:
 *     summary: Dernier prix d'achat d'un article
 *     tags: [Valuation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: depotId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Dernier prix unitaire, date et référence achat
 *       400:
 *         description: depotId manquant
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  "/dernier-prix/:articleId",
  auth,
  can("valorisation:read"),
  [
    param("articleId").isInt({ min: 1 }),
    query("depotId").isInt({ min: 1 }).withMessage("depotId requis"),
  ],
  validate,
  c.getDernierPrixAchat
);
/**
 * @swagger
 * /valuation/dernier-prix/{articleId}/history:
 *   get:
 *     summary: Historique des derniers prix d'achat d'un article
 *     tags: [Valuation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: depotId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Historique des prix d'achat
 *       400:
 *         description: depotId manquant
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  "/dernier-prix/:articleId/history",
  auth,
  can("valorisation:read"),
  [
    param("articleId").isInt({ min: 1 }),
    query("depotId").isInt({ min: 1 }).withMessage("depotId requis"),
  ],
  validate,
  c.getDernierPrixAchatHistory
);
/**
 * @swagger
 * /valuation/rentabilite:
 *   get:
 *     summary: Analyse de rentabilité par article
 *     tags: [Valuation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Indicateurs de rentabilité
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/rentabilite", auth, can("valorisation:read"), c.getRentabilite);
/**
 * @swagger
 * /valuation/export-excel:
 *   get:
 *     summary: Export Excel de la valorisation du stock
 *     tags: [Valuation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: methodePrix
 *         schema: { type: string, example: CMP }
 *         description: Méthode de valorisation (CMP, FIFO, LIFO, etc.)
 *       - in: query
 *         name: depotId
 *         schema: { type: integer }
 *         description: Filtrer par dépôt (optionnel)
 *     responses:
 *       200:
 *         description: Fichier Excel (.xlsx) stylisé
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  "/export-excel",
  auth,
  can("valorisation:read"),
  [query("depotId").optional({ values: "falsy" }).isInt({ min: 1 })],
  validate,
  c.exportExcel
);

module.exports = router;
