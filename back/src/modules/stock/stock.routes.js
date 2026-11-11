const { Router } = require("express");
const { body, query } = require("express-validator");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const {
  exportStockCsv,
  exportStockExcel,
  getStock,
  getDisponible,
  getAlerts,
  createLine,
  updateLine,
  deleteLine,
  toggleActifLine,
  setStatut,
  getLine,
  valeurConsolidee,
  tendance,
  calendar,
  rotationSummary,
  auditLogs,
  depotCapacity,
  emplacementCompatibility,
  getVentesALivrer,
  loadOptimization,
  emplacementSuggestions,
  emplacementAudit,
  heatmap,
  forecast,
  forecastCompare,
  listAnomalies,
  resolveAnomalie,
  confirmAnomalie,
  detectAnomalies,
  trainAnomalies,
  anomalyMlStatus,
  expiryWaste,
  expiryWasteModel,
  expiryWasteMonitoring,
  expiryWasteWhatIf,
} = require("./stock.controller");
const { aiLimiter } = require("../../middleware/rateLimits");

const router = Router();

router.get("/export", can("stock:read"), exportStockCsv);
router.get("/export-excel", can("stock:read"), exportStockExcel);
/**
 * @swagger
 * /stock/disponible:
 *   get:
 *     summary: Quantité disponible pour un article dans un dépôt
 *     tags: [Stock]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: articleId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: depotId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Stock disponible
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/disponible", can("stock:read"), getDisponible);
/**
 * @swagger
 * /stock/alerts:
 *   get:
 *     summary: Alertes stock (seuils minimum, rupture)
 *     tags: [Stock]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des alertes
 *         content:
 *           application/json:
 *             example: [{ articleId: 5, libelle: "Vit'up", quantite: 3, seuilMin: 10 }]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/alerts", can("stock:read"), getAlerts);
router.get("/valeur-consolidee", can("stock:read"), valeurConsolidee);
router.get("/tendance", can("stock:read"), tendance);
router.get("/calendar", can("stock:read"), calendar);
router.get("/rotation-summary", can("stock:read"), rotationSummary);
router.get("/heatmap", can("stock:read"), heatmap);
router.get("/audit-logs", can("stock:read"), auditLogs);
router.get("/depot-capacity/:depotId", can("stock:read"), depotCapacity);
router.get("/emplacement-compatibility", can("stock:read"), emplacementCompatibility);
router.get("/ventes-a-livrer", can("stock:read"), getVentesALivrer);
router.get("/emplacement-suggestions", aiLimiter, can("stock:read"), emplacementSuggestions);
router.get("/emplacement-audit/:depotId", aiLimiter, can("stock:read"), emplacementAudit);
router.post("/load-optimization", aiLimiter, can("stock:read"), loadOptimization);
router.post("/forecast/compare", aiLimiter, can("stock:read"), forecastCompare);
router.get("/forecast/:articleId", aiLimiter, can("stock:read"), forecast);
router.get("/anomalies", aiLimiter, can("stock:read"), listAnomalies);
router.get("/anomalies/ml", aiLimiter, can("stock:read"), anomalyMlStatus);
router.post("/anomalies/detect", aiLimiter, can("stock:write"), detectAnomalies);
router.post("/anomalies/train", aiLimiter, can("stock:write"), trainAnomalies);
router.patch("/anomalies/:id/resoudre", aiLimiter, can("stock:write"), resolveAnomalie);
router.patch("/anomalies/:id/confirmer", aiLimiter, can("stock:write"), confirmAnomalie);
router.get(
  "/expiry-waste/model",
  aiLimiter,
  can("stock:read"),
  query("refresh").optional().isBoolean().withMessage("refresh doit être un booléen"),
  validate,
  expiryWasteModel
);
router.get(
  "/expiry-waste/monitoring",
  aiLimiter,
  can("stock:read"),
  query("window").optional().isInt({ min: 7, max: 90 }).withMessage("fenêtre entre 7 et 90 jours"),
  validate,
  expiryWasteMonitoring
);
router.post(
  "/expiry-waste/what-if",
  aiLimiter,
  can("stock:read"),
  body("lotId").isInt({ min: 1 }).withMessage("lotId entier requis"),
  body("velocityMultiplier").isFloat({ min: 0.5, max: 3 }).withMessage("multiplicateur entre 0,5 et 3"),
  body("extraDays").optional().isInt({ min: 0, max: 14 }).withMessage("jours supplémentaires entre 0 et 14"),
  validate,
  expiryWasteWhatIf
);
router.get("/expiry-waste", aiLimiter, can("stock:read"), expiryWaste);
/**
 * @swagger
 * /stock:
 *   get:
 *     summary: État du stock avec filtres et niveaux d'alerte
 *     tags: [Stock]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Recherche par code ou libellé article
 *       - in: query
 *         name: depotId
 *         schema: { type: integer }
 *       - in: query
 *         name: articleId
 *         schema: { type: integer }
 *       - in: query
 *         name: emplacementId
 *         schema: { type: integer }
 *       - in: query
 *         name: statut
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Lignes de stock
 *         content:
 *           application/json:
 *             example:
 *               data: [{ id: 1, articleId: 5, depotId: 1, quantite: 120, seuilMin: 10, alerte: false }]
 *               total: 45
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", can("stock:read"), getStock);
/**
 * @swagger
 * /stock/lines:
 *   post:
 *     summary: Créer une ligne de stock (entrée initiale ou ajustement)
 *     tags: [Stock]
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
 *             required: [articleId, depotId]
 *             properties:
 *               articleId: { type: integer, example: 1 }
 *               depotId: { type: integer, example: 1 }
 *               quantite: { type: number, example: 100 }
 *     responses:
 *       201:
 *         description: Ligne de stock créée
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/lines",
  can("stock:write"),
  [
    body("articleId").isInt().withMessage("articleId requis"),
    body("depotId").isInt().withMessage("depotId requis"),
    body("quantite").optional().isFloat(),
  ],
  validate,
  createLine
);
router.get("/lines/:id", can("stock:read"), getLine);
/**
 * @swagger
 * /stock/lines/{id}:
 *   patch:
 *     summary: Modifier une ligne de stock
 *     tags: [Stock]
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
 *         description: Ligne mise à jour
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch("/lines/:id/statut", can("stock:write"), setStatut);
router.patch("/lines/:id/toggle-actif", can("stock:write"), toggleActifLine);
router.patch("/lines/:id", can("stock:write"), updateLine);
/**
 * @swagger
 * /stock/lines/{id}:
 *   delete:
 *     summary: Supprimer une ligne de stock
 *     tags: [Stock]
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
 *         description: Ligne supprimée
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/lines/:id", can("stock:write"), deleteLine);

module.exports = router;
