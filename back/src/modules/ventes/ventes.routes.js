const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate: validateRequest } = require("../../middleware/validate");
const {
  list,
  getOne,
  create,
  update,
  remove,
  validate,
  confirmer,
  livrer,
  preparer,
  expedier,
  facture,
  facturePdf,
  relancePdf,
  bonLivraisonPdf,
  addReglement,
  searchArticles,
  exportVentes,
  stats,
  kpis,
  creerAvoir,
} = require("./ventes.controller");

const router = Router();

/**
 * @swagger
 * /ventes:
 *   get:
 *     summary: Lister les commandes / ventes clients
 *     tags: [Ventes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: statut
 *         schema: { type: string, enum: [BROUILLON, EN_ATTENTE, CONFIRME, LIVRE, ANNULE, ANNULEE] }
 *       - in: query
 *         name: clientId
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Liste des ventes
 *         content:
 *           application/json:
 *             example:
 *               data: [{ id: 1, numero: VTE-001, statut: CONFIRME, clientId: 3, montantTotal: 890 }]
 *               total: 67
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/export", auth, can("ventes:read"), exportVentes);
router.get("/stats", auth, can("ventes:read"), stats);
router.get("/kpis", auth, can("ventes:read"), kpis);
router.get("/", auth, can("ventes:read"), list);
router.get("/search/articles", auth, can("ventes:read"), searchArticles);
router.get("/:id/facture/pdf", auth, can("ventes:read"), facturePdf);
router.get("/:id/relance/pdf", auth, can("ventes:read"), relancePdf);
router.get("/:id/bon-livraison/pdf", auth, can("ventes:read"), bonLivraisonPdf);
router.get("/:id/facture", auth, can("ventes:read"), facture);
router.get("/:id", auth, can("ventes:read"), getOne);

/**
 * @swagger
 * /ventes:
 *   post:
 *     summary: Créer une commande client
 *     tags: [Ventes]
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
 *             required: [clientId, lignes]
 *             properties:
 *               clientId: { type: integer, example: 1 }
 *               depotId: { type: integer, example: 1 }
 *               statut: { type: string, enum: [BROUILLON, EN_ATTENTE], example: BROUILLON }
 *               modePaiement: { type: string, example: ESPECE }
 *               remiseGlobale: { type: number, example: 0 }
 *               lignes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     articleId: { type: integer, example: 1 }
 *                     quantite: { type: number, example: 10 }
 *                     prixUnit: { type: number, example: 12.5 }
 *     responses:
 *       201:
 *         description: Vente créée
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
  can("ventes:write"),
  [
    body("clientId").isInt({ min: 1 }).withMessage("clientId requis"),
    body("depotId").isInt({ min: 1 }).withMessage("Dépôt requis"),
    body("modePaiement")
      .optional()
      .isIn(["ESPECES", "ESPECE", "VIREMENT", "CHEQUE", "CARTE", "A_LA_LIVRAISON", "AUTRE"]),
    body("remiseGlobale").optional().isFloat({ min: 0, max: 100 }),
    body("statut").optional().isIn(["BROUILLON", "EN_ATTENTE"]),
    body("dateVente").optional().isString(),
    body("dateLivraison")
      .optional({ nullable: true })
      .custom((val, { req }) => {
        if (val && req.body.dateVente && new Date(val) < new Date(req.body.dateVente)) {
          throw new Error("dateLivraison ne peut pas précéder dateVente");
        }
        return true;
      }),
    body("lignes")
      .isArray({ min: 1 })
      .withMessage("lignes[] requis")
      .custom((arr) => {
        if (!Array.isArray(arr)) return false;
        const seen = new Set();
        for (const l of arr) {
          if (!l || Number(l.articleId) <= 0) throw new Error("articleId invalide dans lignes");
          if (Number(l.quantite) <= 0) throw new Error("quantite > 0 requise dans lignes");
          const prix = l.prixUnit ?? l.prixUnitHT;
          if (prix != null && Number(prix) < 0) throw new Error("prixUnit >= 0 requis dans lignes");
          if (l.remise != null && (Number(l.remise) < 0 || Number(l.remise) > 100)) {
            throw new Error("remise 0-100 dans lignes");
          }
          const aid = Number(l.articleId);
          if (seen.has(aid)) throw new Error(`Article en doublon dans lignes (id ${aid})`);
          seen.add(aid);
        }
        return true;
      }),
  ],
  validateRequest,
  create
);

/**
 * @swagger
 * /ventes/{id}:
 *   put:
 *     summary: Modifier une commande client
 *     tags: [Ventes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientId, lignes]
 *             properties:
 *               clientId: { type: integer }
 *               statut: { type: string, enum: [BROUILLON, EN_ATTENTE, ANNULE, ANNULEE] }
 *               lignes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     articleId: { type: integer }
 *                     quantite: { type: number }
 *                     prixUnit: { type: number }
 *     responses:
 *       200:
 *         description: Vente modifiée
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put(
  "/:id",
  auth,
  can("ventes:write"),
  [
    body("clientId").isInt({ min: 1 }).withMessage("clientId requis"),
    body("depotId").isInt({ min: 1 }).withMessage("Dépôt requis"),
    body("dateVente").optional().isString(),
    body("dateLivraison")
      .optional({ nullable: true })
      .custom((val, { req }) => {
        if (val && req.body.dateVente && new Date(val) < new Date(req.body.dateVente)) {
          throw new Error("dateLivraison ne peut pas précéder dateVente");
        }
        return true;
      }),
    body("modePaiement")
      .optional()
      .isIn(["ESPECES", "ESPECE", "VIREMENT", "CHEQUE", "CARTE", "A_LA_LIVRAISON", "AUTRE"]),
    body("remiseGlobale").optional().isFloat({ min: 0, max: 100 }),
    body("remise").optional().isFloat({ min: 0, max: 100 }),
    body("statut").optional().isIn(["BROUILLON", "EN_ATTENTE", "ANNULE", "ANNULEE"]),
    body("lignes")
      .isArray({ min: 1 })
      .withMessage("lignes[] requis")
      .custom((arr) => {
        if (!Array.isArray(arr)) return false;
        const seen = new Set();
        for (const l of arr) {
          if (!l || Number(l.articleId) <= 0) throw new Error("articleId invalide dans lignes");
          if (Number(l.quantite) <= 0) throw new Error("quantite > 0 requise dans lignes");
          const prix = l.prixUnit ?? l.prixUnitHT;
          if (prix != null && Number(prix) < 0) throw new Error("prixUnit >= 0 requis dans lignes");
          if (l.remise != null && (Number(l.remise) < 0 || Number(l.remise) > 100)) {
            throw new Error("remise 0-100 dans lignes");
          }
          const aid = Number(l.articleId);
          if (seen.has(aid)) throw new Error(`Article en doublon dans lignes (id ${aid})`);
          seen.add(aid);
        }
        return true;
      }),
  ],
  validateRequest,
  update
);

/**
 * @swagger
 * /ventes/{id}:
 *   delete:
 *     summary: Supprimer une vente brouillon
 *     tags: [Ventes]
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
 *         description: Vente supprimée
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", auth, can("ventes:write"), remove);

/**
 * @swagger
 * /ventes/{id}/confirmer:
 *   post:
 *     summary: Confirmer une vente (changement de statut)
 *     tags: [Ventes]
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
 *         description: Vente confirmée
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/confirmer", auth, can("ventes:write"), confirmer);
/**
 * @swagger
 * /ventes/{id}/valider:
 *   post:
 *     summary: Valider une vente (préparation / expédition)
 *     tags: [Ventes]
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
 *         description: Vente validée
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/valider", auth, can("ventes:write"), validate);
/**
 * @swagger
 * /ventes/{id}/livrer:
 *   post:
 *     summary: Marquer une vente comme livrée (sortie stock)
 *     tags: [Ventes]
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
 *         description: Livraison enregistrée
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/livrer", auth, can("ventes:write"), livrer);
router.post("/:id/preparer", auth, can("ventes:write"), preparer);
router.post("/:id/expedier", auth, can("ventes:write"), expedier);

router.post(
  "/:id/avoir",
  auth,
  can("ventes:write"),
  [
    body("motif").optional().isString(),
    body("lignes")
      .optional()
      .isArray()
      .custom((arr) =>
        !arr ||
        arr.every(
          (l) =>
            l &&
            Number(l.ligneId) > 0 &&
            Number(l.quantite) > 0 &&
            Number.isFinite(Number(l.quantite))
        )
      ),
  ],
  validateRequest,
  creerAvoir
);

router.post(
  "/:id/reglements",
  auth,
  can("reglements:write"),
  [
    body("montant").isFloat({ gt: 0 }).withMessage("montant > 0 requis"),
    body("mode").optional().isString(),
    body("reference").optional().isString(),
    body("statut").optional().isIn(["VALIDE", "EN_ATTENTE"]),
  ],
  validateRequest,
  addReglement
);

module.exports = router;
