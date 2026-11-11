const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { justificatifUpload } = require("../../middleware/upload");
const { validate } = require("../../middleware/validate");
const c = require("./reglements.controller");

const router = Router();

const reglementBodyValidators = [
  body("montant").custom((v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) throw new Error("Montant invalide");
    return true;
  }),
  body("mode").trim().notEmpty().withMessage("Mode requis"),
  body("reference").optional({ nullable: true }).isString(),
  body("datePayment").optional({ nullable: true }).isISO8601(),
  body("numeroCheque").optional({ nullable: true }).isString(),
  body("banque").optional({ nullable: true }).isString(),
  body("dateEcheance").optional({ nullable: true }).isISO8601(),
  body("commentaire").optional({ nullable: true }).isString(),
  body("referenceVirement").optional({ nullable: true }).isString(),
  body("dateValeur").optional({ nullable: true }).isISO8601(),
  body("referenceTransaction").optional({ nullable: true }).isString(),
  body("referenceEffet").optional({ nullable: true }).isString(),
  body("descriptionAutre").optional({ nullable: true }).isString(),
  body("dateReglement").optional({ nullable: true }).isISO8601(),
  body("pieceJointeUrl").optional({ nullable: true }).isString(),
];

/**
 * @swagger
 * /reglements/stats:
 *   get:
 *     summary: Statistiques globales des règlements
 *     tags: [Reglements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Statistiques des règlements
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/stats", auth, can("ventes:read"), c.stats);
/**
 * @swagger
 * /reglements/list/ventes:
 *   get:
 *     summary: Lister tous les règlements ventes
 *     tags: [Reglements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des règlements ventes
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/list/ventes", auth, can("ventes:read"), c.listAllVentes);
/**
 * @swagger
 * /reglements/list/achats:
 *   get:
 *     summary: Lister tous les règlements achats
 *     tags: [Reglements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des règlements achats
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/list/achats", auth, can("achats:read"), c.listAllAchats);

/**
 * @swagger
 * /reglements/ventes/{venteId}:
 *   get:
 *     summary: Règlements d'une vente
 *     tags: [Reglements]
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
 *         description: Règlements de la vente
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/ventes/:venteId", auth, can("ventes:read"), c.listVente);

router.post(
  "/ventes/:venteId",
  auth,
  can("reglements:write"),
  (req, res, next) => {
    const ct = String(req.headers["content-type"] || "");
    if (!ct.includes("multipart/form-data")) return next();
    justificatifUpload(req, res, (err) => (err ? next(err) : next()));
  },
  reglementBodyValidators,
  validate,
  c.createVente
);

router.delete("/vente-reglements/:id", auth, can("reglements:write"), c.removeVente);

router.get("/achats/:achatId", auth, can("achats:read"), c.listAchat);

router.post(
  "/achats/:achatId",
  auth,
  can("reglements:write"),
  (req, res, next) => {
    const ct = String(req.headers["content-type"] || "");
    if (!ct.includes("multipart/form-data")) return next();
    justificatifUpload(req, res, (err) => (err ? next(err) : next()));
  },
  reglementBodyValidators,
  validate,
  c.createAchat
);

router.delete("/achat-reglements/:id", auth, can("reglements:write"), c.removeAchat);

module.exports = router;
