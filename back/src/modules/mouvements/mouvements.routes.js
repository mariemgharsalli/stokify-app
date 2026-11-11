const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const {
  list,
  exportList,
  entree,
  sortie,
  transfert,
  transfertEmplacement,
  valider,
  rejeter,
} = require("./mouvements.controller");
const { MOUVEMENT_TYPES } = require("./mouvements.service");

const router = Router();

const entreeTypes = [
  MOUVEMENT_TYPES.ENTREE_ACHAT,
  MOUVEMENT_TYPES.ENTREE_RETOUR_CLIENT,
  MOUVEMENT_TYPES.ENTREE_AJUSTEMENT,
];

const sortieTypes = [
  MOUVEMENT_TYPES.SORTIE_PERTE,
  MOUVEMENT_TYPES.SORTIE_CASSE,
  MOUVEMENT_TYPES.SORTIE_AUTRE,
];

/**
 * @swagger
 * /mouvements:
 *   get:
 *     summary: Historique des mouvements de stock
 *     tags: [Mouvements]
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
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Liste paginée des mouvements
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/export", auth, can("mouvements:read"), exportList);
router.get("/", auth, can("mouvements:read"), list);

/**
 * @swagger
 * /mouvements/entrees:
 *   post:
 *     summary: Enregistrer une entrée de stock (achat, retour, ajustement)
 *     tags: [Mouvements]
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
 *               quantite: { type: number, example: 50 }
 *               depotId: { type: integer, example: 1 }
 *               emplacementId: { type: integer, example: 1 }
 *               type: { type: string, example: ENTREE_ACHAT }
 *               commentaire: { type: string }
 *               valeur: { type: number }
 *     responses:
 *       201:
 *         description: Entrée enregistrée
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/entrees",
  auth,
  can("mouvements:write"),
  [
    body("articleId").isInt({ min: 1 }).withMessage("articleId requis"),
    body("quantite").isFloat({ gt: 0 }).withMessage("quantite > 0 requise"),
    body("depotId").optional().isInt({ min: 1 }),
    body("emplacementId").optional().isInt({ min: 1 }),
    body("type").optional().isIn(entreeTypes),
    body("commentaire").optional().isString(),
    body("valeur").optional().isFloat(),
  ],
  validate,
  entree
);

/**
 * @swagger
 * /mouvements/sorties:
 *   post:
 *     summary: Enregistrer une sortie de stock (perte, casse, autre)
 *     tags: [Mouvements]
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
 *               quantite: { type: number, example: 10 }
 *               depotId: { type: integer, example: 1 }
 *               emplacementId: { type: integer, example: 1 }
 *               type: { type: string, example: SORTIE_PERTE }
 *               commentaire: { type: string }
 *     responses:
 *       201:
 *         description: Sortie enregistrée
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/sorties",
  auth,
  can("mouvements:write"),
  [
    body("articleId").isInt({ min: 1 }).withMessage("articleId requis"),
    body("quantite").isFloat({ gt: 0 }).withMessage("quantite > 0 requise"),
    body("depotId").optional().isInt({ min: 1 }),
    body("emplacementId").optional().isInt({ min: 1 }),
    body("type").optional().isIn(sortieTypes),
    body("commentaire").optional().isString(),
    body("valeur").optional().isFloat(),
  ],
  validate,
  sortie
);

/**
 * @swagger
 * /mouvements/transferts:
 *   post:
 *     summary: Transférer du stock entre deux dépôts
 *     tags: [Mouvements]
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
 *             required: [articleId, depotOrigineId, depotDestId, quantite]
 *             properties:
 *               articleId: { type: integer, example: 1 }
 *               depotOrigineId: { type: integer, example: 1 }
 *               depotDestId: { type: integer, example: 2 }
 *               quantite: { type: number, example: 25 }
 *               commentaire: { type: string, example: Transfert inter-dépôts }
 *     responses:
 *       201:
 *         description: Transfert effectué
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/transferts",
  auth,
  can("mouvements:write"),
  [
    body("articleId").isInt({ min: 1 }).withMessage("articleId requis"),
    body("depotOrigineId").isInt({ min: 1 }).withMessage("depotOrigineId requis"),
    body("depotDestId").isInt({ min: 1 }).withMessage("depotDestId requis"),
    body("quantite").isFloat({ gt: 0 }).withMessage("quantite > 0 requise"),
    body("commentaire").optional().isString(),
  ],
  validate,
  transfert
);

router.post(
  "/transfert-emplacement",
  auth,
  can("stock:write"),
  [
    body("articleId").isInt({ min: 1 }).withMessage("articleId requis"),
    body("depotOrigineId").isInt({ min: 1 }).withMessage("depotOrigineId requis"),
    body("emplacementOrigineId").isInt({ min: 1 }).withMessage("emplacementOrigineId requis"),
    body("depotDestId").isInt({ min: 1 }).withMessage("depotDestId requis"),
    body("emplacementDestId").isInt({ min: 1 }).withMessage("emplacementDestId requis"),
    body("quantite").isFloat({ gt: 0 }).withMessage("quantite > 0 requise"),
    body("commentaire").optional().isString(),
  ],
  validate,
  transfertEmplacement
);

router.post("/:id/valider", auth, can("mouvements:validate"), valider);

router.post(
  "/:id/rejeter",
  auth,
  can("mouvements:validate"),
  [body("commentaire").optional().isString()],
  validate,
  rejeter
);

module.exports = router;
