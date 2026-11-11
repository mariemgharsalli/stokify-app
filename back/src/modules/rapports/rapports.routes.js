const { Router } = require("express");
const { query } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can, canAny } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./rapports.controller");

const router = Router();

const rotationQueryValidators = [
  query("depotId").optional({ values: "falsy" }).isInt({ min: 1 }).withMessage("depotId invalide"),
  query("days").optional({ values: "falsy" }).isInt({ min: 1 }).withMessage("days invalide"),
];

const deadStockQueryValidators = [
  query("depotId").optional({ values: "falsy" }).isInt({ min: 1 }).withMessage("depotId invalide"),
  query("seuil").optional({ values: "falsy" }).isInt({ min: 1 }).withMessage("seuil invalide"),
  query("jours").optional({ values: "falsy" }).isInt({ min: 1 }),
];

/**
 * @swagger
 * /rapports/rotation:
 *   get:
 *     summary: Rapport de rotation des stocks
 *     tags: [Rapports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Données de rotation des stocks
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/rotation", auth, can("rapports:read"), rotationQueryValidators, validate, c.rotation);
/**
 * @swagger
 * /rapports/rotation/export-excel:
 *   get:
 *     summary: Export Excel du rapport de rotation des stocks
 *     tags: [Rapports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: depotId
 *         schema: { type: integer }
 *         description: Filtrer par dépôt (optionnel)
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *         description: Période glissante en jours
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
router.get("/rotation/export-excel", auth, can("rapports:read"), rotationQueryValidators, validate, c.exportRotationExcel);
/**
 * @swagger
 * /rapports/dead-stock:
 *   get:
 *     summary: Rapport de stock dormant (dead stock)
 *     tags: [Rapports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Articles en stock dormant
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/dead-stock", auth, canAny("rapports:read", "valorisation:read"), deadStockQueryValidators, validate, c.deadStock);
/**
 * @swagger
 * /rapports/dead-stock/export-excel:
 *   get:
 *     summary: Export Excel du rapport de stock dormant
 *     tags: [Rapports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: depotId
 *         schema: { type: integer }
 *         description: Filtrer par dépôt (optionnel)
 *       - in: query
 *         name: seuil
 *         schema: { type: integer, default: 90 }
 *         description: Seuil d'immobilisation en jours
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
router.get("/dead-stock/export-excel", auth, canAny("rapports:read", "valorisation:read"), deadStockQueryValidators, validate, c.exportDeadStockExcel);

module.exports = router;
