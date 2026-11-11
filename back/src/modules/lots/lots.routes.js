const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./lots.controller");

const router = Router();

/**
 * @swagger
 * /lots:
 *   get:
 *     summary: Lister les lots avec suivi DLC/DLUO (FEFO/FIFO)
 *     tags: [Lots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: articleId
 *         schema: { type: integer }
 *       - in: query
 *         name: depotId
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Liste des lots
 *         content:
 *           application/json:
 *             example:
 *               data: [{ id: 1, numero: LOT-2024-001, articleId: 5, quantiteRestante: 80, datePeremption: "2026-06-01" }]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", auth, can("stock:read"), c.list);
router.get("/rappels", auth, can("stock:read"), c.listRappels);
router.get("/generate-numero", auth, can("stock:read"), c.generateNumero);
router.get("/export/expiring", auth, can("stock:read"), c.exportExpiring);
/**
 * @swagger
 * /lots/expiring-soon:
 *   get:
 *     summary: Lots proches de la date de péremption (alertes DLC)
 *     tags: [Lots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *         description: Fenêtre en jours avant péremption
 *     responses:
 *       200:
 *         description: Lots expirant bientôt
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/expiring-soon", auth, can("stock:read"), c.expiringSoon);
/**
 * @swagger
 * /lots/peremption-risk:
 *   get:
 *     summary: Risque de péremption par lot (prévision de demande + épuisement FEFO)
 *     tags: [Lots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30, minimum: 1, maximum: 366 }
 *         description: Fenêtre en jours avant la date d'expiration
 *       - in: query
 *         name: depotId
 *         schema: { type: integer }
 *         description: Filtrer sur un dépôt
 *       - in: query
 *         name: niveau
 *         schema: { type: string, enum: [faible, moyen, élevé] }
 *         description: Filtrer par niveau de risque
 *     responses:
 *       200:
 *         description: Lots scorés, triés par perte potentielle décroissante
 *         content:
 *           application/json:
 *             example:
 *               days: 30
 *               depotId: null
 *               niveau: null
 *               source: ai
 *               valeurEnJeu: 860.5
 *               lotsEleves: 1
 *               total: 1
 *               items:
 *                 - lotId: 12
 *                   numero: LOT-2026-014
 *                   articleLibelle: Yaourt nature
 *                   quantiteRisquee: 40
 *                   probabiliteRisque: 72
 *                   valeurRisquee: 860.5
 *                   niveau: élevé
 *       400:
 *         description: Paramètre niveau invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/peremption-risk", auth, can("stock:read"), c.peremptionRiskList);
router.get("/preview-pick", auth, can("stock:read"), c.previewPick);
/**
 * @swagger
 * /lots/sortie-fifo-fefo:
 *   post:
 *     summary: Sortie de stock par stratégie FIFO ou FEFO
 *     tags: [Lots]
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
 *             required: [articleId, quantite]
 *             properties:
 *               articleId: { type: integer, example: 1 }
 *               quantite: { type: number, example: 20 }
 *               strategie: { type: string, enum: [FIFO, FEFO, fifo, fefo], example: FEFO }
 *     responses:
 *       200:
 *         description: Sortie effectuée selon la stratégie
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/sortie-fifo-fefo",
  auth,
  can("mouvements:write"),
  [
    body("articleId").isInt(),
    body("quantite").isFloat({ gt: 0 }),
    body("strategie").optional().isIn(["FIFO", "FEFO", "fifo", "fefo"]),
  ],
  validate,
  c.sortieLots
);
/**
 * @swagger
 * /lots:
 *   post:
 *     summary: Créer un lot avec numéro, quantité et dates DLC
 *     tags: [Lots]
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
 *             required: [articleId, depotId, quantiteInitiale]
 *             properties:
 *               numero: { type: string, example: LOT-2024-001 }
 *               articleId: { type: integer, example: 1 }
 *               depotId: { type: integer, example: 1 }
 *               quantiteInitiale: { type: number, example: 100 }
 *               datePeremption: { type: string, format: date, example: "2026-12-31" }
 *               dateFabrication: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Lot créé
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
    body("numero").trim().notEmpty().withMessage("Numéro de lot requis"),
    body("articleId").isInt(),
    body("depotId").isInt(),
    body("quantiteInitiale").isFloat({ gt: 0 }).withMessage("Quantité initiale > 0"),
    body("dateExpiration").optional({ values: "falsy" }).isISO8601(),
    body("datePeremption").optional({ values: "falsy" }).isISO8601(),
    body("dateFabrication").optional({ values: "falsy" }).isISO8601(),
    body().custom((_, { req }) => {
      const fab = req.body.dateFabrication;
      const exp = req.body.dateExpiration || req.body.datePeremption;
      if (fab && exp && new Date(exp) <= new Date(fab)) {
        throw new Error("La date d'expiration doit être postérieure à la date de fabrication");
      }
      return true;
    }),
  ],
  validate,
  c.create
);
router.post("/:id/rappel", auth, can("stock:write"), c.declencherRappel);
router.post("/:id/notifier", auth, can("stock:write"), c.notifierClients);
router.put("/:id/statut-rappel", auth, can("stock:write"), c.statutRappel);
router.get("/:id/traceabilite/pdf", auth, can("stock:read"), c.traceabilitePdf);
router.get("/:id/qrcode", auth, can("stock:read"), c.qrcode);
router.get("/:id/mouvements", auth, can("stock:read"), c.historiqueMouvements);
/**
 * @swagger
 * /lots/{id}/traceabilite:
 *   get:
 *     summary: Traçabilité complète d'un lot (mouvements, origine)
 *     tags: [Lots]
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
 *         description: Données de traçabilité
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id/traceabilite", auth, can("stock:read"), c.traceabilite);
router.get("/:id/deactivate-warnings", auth, can("stock:read"), c.deactivateWarnings);
/**
 * @swagger
 * /lots/{id}:
 *   get:
 *     summary: Détail d'un lot
 *     tags: [Lots]
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
 *         description: Lot trouvé
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", auth, can("stock:read"), c.getOne);
router.patch("/:id", auth, can("stock:write"), c.update);
router.delete("/:id", auth, can("stock:write"), c.remove);

module.exports = router;
