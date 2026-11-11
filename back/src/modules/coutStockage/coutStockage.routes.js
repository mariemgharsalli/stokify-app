const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./coutStockage.controller");

const router = Router();

/**
 * @swagger
 * /cout-stockage:
 *   get:
 *     summary: Lister les coûts de stockage
 *     tags: [CoutStockage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des coûts de stockage
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", auth, can("valorisation:read"), c.list);
/**
 * @swagger
 * /cout-stockage/export-excel:
 *   get:
 *     summary: Export Excel des coûts de stockage
 *     tags: [CoutStockage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: periode
 *         schema: { type: string, example: "2025-06" }
 *         description: Période YYYY-MM (défaut mois courant)
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
router.get("/export-excel", auth, can("valorisation:read"), c.exportExcel);
/**
 * @swagger
 * /cout-stockage/depot-mensuel:
 *   get:
 *     summary: Coûts de stockage mensuels par dépôt
 *     tags: [CoutStockage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Coûts mensuels par dépôt
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/depot-mensuel", auth, can("valorisation:read"), c.listDepotMensuel);
router.get("/cout-entries", auth, can("valorisation:read"), c.listCoutEntries);
router.get("/cout-entries/total", auth, can("valorisation:read"), c.totalCoutEntries);
/**
 * @swagger
 * /cout-stockage/cout-entries/grouped:
 *   get:
 *     summary: Coûts dépôt groupés par catégorie pour une période
 *     tags: [CoutStockage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: depotId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: periode
 *         required: true
 *         schema: { type: string, pattern: '^\\d{4}-\\d{2}$' }
 *     responses:
 *       200:
 *         description: Totaux par catégorie
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/cout-entries/grouped", auth, can("valorisation:read"), c.getCoutEntriesGrouped);
router.get("/imputation", auth, can("valorisation:read"), c.imputation);
router.get("/parametres", auth, can("valorisation:read"), c.getParametres);
router.patch(
  "/parametres",
  auth,
  can("stock:write"),
  [body("tauxPossessionAnnuel").isFloat({ min: 0, max: 40 })],
  validate,
  c.updateParametres
);
router.post(
  "/cout-entries",
  auth,
  can("stock:write"),
  [
    body("nom").isString().trim().notEmpty(),
    body("montant").isFloat({ gt: 0 }),
    body("depotId").isInt(),
    body("periode").matches(/^\d{4}-\d{2}$/),
    body("categorie").optional().isIn(["STOCKAGE", "LOGISTIQUE", "MANUTENTION", "AUTRE"]),
    body("dupliquerMois").optional().isInt({ min: 0, max: 12 }),
  ],
  validate,
  c.createCoutEntry
);
router.put(
  "/cout-entries/:id",
  auth,
  can("stock:write"),
  [
    body("nom").optional().isString().trim().notEmpty(),
    body("montant").optional().isFloat({ gt: 0 }),
    body("categorie").optional().isIn(["STOCKAGE", "LOGISTIQUE", "MANUTENTION", "AUTRE"]),
  ],
  validate,
  c.updateCoutEntry
);
router.delete("/cout-entries/:id", auth, can("stock:write"), c.removeCoutEntry);
/**
 * @swagger
 * /cout-stockage/dead-stock:
 *   get:
 *     summary: Coût du stock dormant
 *     tags: [CoutStockage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Analyse du dead stock
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/dead-stock", auth, can("valorisation:read"), c.deadStock);
/**
 * @swagger
 * /cout-stockage/taux-rotation:
 *   get:
 *     summary: Taux de rotation du stock
 *     tags: [CoutStockage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Taux de rotation
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/taux-rotation", auth, can("valorisation:read"), c.tauxRotation);
/**
 * @swagger
 * /cout-stockage/total-periode:
 *   get:
 *     summary: Total des coûts de stockage sur une période
 *     tags: [CoutStockage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Total période
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/total-periode", auth, can("valorisation:read"), c.totalPeriode);
/**
 * @swagger
 * /cout-stockage/kpi-rentabilite:
 *   get:
 *     summary: KPI de rentabilité liés au stockage
 *     tags: [CoutStockage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: KPI rentabilité
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/kpi-rentabilite", auth, can("valorisation:read"), c.kpiRentabilite);
/**
 * @swagger
 * /cout-stockage/profitability/{articleId}:
 *   get:
 *     summary: Rentabilité d'un article (coût stockage)
 *     tags: [CoutStockage]
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
 *         description: Rentabilité de l'article
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/profitability/:articleId", auth, can("valorisation:read"), c.profitability);
router.post(
  "/depot-mensuel",
  auth,
  can("stock:write"),
  [body("depotId").isInt(), body("periode").isString()],
  validate,
  c.saveDepotMensuel
);
/**
 * @swagger
 * /cout-stockage:
 *   post:
 *     summary: Créer un enregistrement de coût de stockage
 *     tags: [CoutStockage]
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
 *             required: [articleId, depotId, coutUnitaire, periodeDebut]
 *             properties:
 *               articleId: { type: integer, example: 1 }
 *               depotId: { type: integer, example: 1 }
 *               coutUnitaire: { type: number, minimum: 0, example: 0.05 }
 *               periodeDebut: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Coût de stockage créé
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
  can("stock:write"),
  [
    body("articleId").isInt(),
    body("depotId").isInt(),
    body("coutUnitaire").isFloat({ min: 0 }),
    body("periodeDebut").isISO8601(),
  ],
  validate,
  c.create
);
/**
 * @swagger
 * /cout-stockage/{id}:
 *   get:
 *     summary: Détail d'un coût de stockage
 *     tags: [CoutStockage]
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
 *         description: Coût de stockage trouvé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id", auth, can("valorisation:read"), c.getOne);
/**
 * @swagger
 * /cout-stockage/{id}:
 *   patch:
 *     summary: Modifier un coût de stockage
 *     tags: [CoutStockage]
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
 *               coutUnitaire: { type: number, minimum: 0 }
 *               periodeDebut: { type: string, format: date-time }
 *               periodeFin: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Coût de stockage modifié
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
 * /cout-stockage/{id}:
 *   delete:
 *     summary: Supprimer un coût de stockage
 *     tags: [CoutStockage]
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
 *         description: Coût de stockage supprimé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/:id", auth, can("stock:write"), c.remove);

module.exports = router;
