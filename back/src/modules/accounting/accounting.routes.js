const { Router } = require("express");
const { query } = require("express-validator");
const { can, canAny } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const {
  summary,
  synthese,
  evolutionMensuelle,
  topArticles,
  topClients,
  topFournisseurs,
  stockParDepot,
  facturesVentes,
  facturesAchats,
  dashboard,
  exportRapportPdf,
  exportRapportExcel,
} = require("./accounting.controller");

const router = Router();

const filterQueryValidators = [
  query("dateDebut").optional({ values: "falsy" }).isISO8601(),
  query("dateFin").optional({ values: "falsy" }).isISO8601(),
  query("limit").optional({ values: "falsy" }).isInt({ min: 1 }),
  query("depotId").optional({ values: "falsy" }).isInt({ min: 1 }),
];

/**
 * @swagger
 * /accounting/dashboard:
 *   get:
 *     summary: Tableau de bord comptable
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Données du tableau de bord
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  "/dashboard",
  canAny("accounting:read", "ventes:read", "achats:read"),
  filterQueryValidators,
  validate,
  dashboard
);
/**
 * @swagger
 * /accounting/summary:
 *   get:
 *     summary: Résumé comptable
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Résumé comptable
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/summary", can("accounting:read"), filterQueryValidators, validate, summary);
/**
 * @swagger
 * /accounting/synthese:
 *   get:
 *     summary: Synthèse comptable
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Synthèse comptable
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/synthese", can("accounting:read"), filterQueryValidators, validate, synthese);
/**
 * @swagger
 * /accounting/evolution-mensuelle:
 *   get:
 *     summary: Évolution mensuelle des indicateurs
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Évolution mensuelle
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/evolution-mensuelle", can("accounting:read"), filterQueryValidators, validate, evolutionMensuelle);
/**
 * @swagger
 * /accounting/top-articles:
 *   get:
 *     summary: Top articles par chiffre d'affaires
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Classement des articles
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/top-articles", can("accounting:read"), filterQueryValidators, validate, topArticles);
/**
 * @swagger
 * /accounting/top-clients:
 *   get:
 *     summary: Top clients par chiffre d'affaires
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Classement des clients
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/top-clients", can("accounting:read"), filterQueryValidators, validate, topClients);
/**
 * @swagger
 * /accounting/top-fournisseurs:
 *   get:
 *     summary: Top fournisseurs par volume d'achats
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Classement des fournisseurs
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/top-fournisseurs", can("accounting:read"), filterQueryValidators, validate, topFournisseurs);
/**
 * @swagger
 * /accounting/stock-par-depot:
 *   get:
 *     summary: Valorisation du stock par dépôt
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Stock valorisé par dépôt
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/stock-par-depot", can("accounting:read"), filterQueryValidators, validate, stockParDepot);
/**
 * @swagger
 * /accounting/factures/ventes:
 *   get:
 *     summary: Factures ventes pour la comptabilité
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des factures ventes
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/factures/ventes", can("accounting:read"), filterQueryValidators, validate, facturesVentes);
/**
 * @swagger
 * /accounting/factures/achats:
 *   get:
 *     summary: Factures achats pour la comptabilité
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des factures achats
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/factures/achats", can("accounting:read"), filterQueryValidators, validate, facturesAchats);
/**
 * @swagger
 * /accounting/export-rapport-pdf:
 *   get:
 *     summary: Exporter le rapport comptable en PDF
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Fichier PDF
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/export-rapport-pdf", can("rapports:read"), filterQueryValidators, validate, exportRapportPdf);
/**
 * @swagger
 * /accounting/export-rapport-excel:
 *   get:
 *     summary: Exporter le rapport comptable en Excel
 *     tags: [Accounting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Fichier Excel
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
router.get("/export-rapport-excel", can("rapports:read"), filterQueryValidators, validate, exportRapportExcel);

module.exports = router;
