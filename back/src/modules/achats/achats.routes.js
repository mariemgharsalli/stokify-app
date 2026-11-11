const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const {
  list,
  getOne,
  create,
  update,
  remove,
  recevoir,
  receptionnerLigne,
  confirmer,
  annuler,
  enRetard,
  comparaisonFournisseurs,
  paiement,
  searchArticles,
  exportAchats,
  stats,
  bonCommande,
  bonReception,
} = require("./achats.controller");

const router = Router();

router.use("/retours-fournisseur", require("./retoursFournisseur.routes"));

/**
 * @swagger
 * /achats:
 *   get:
 *     summary: Lister les bons de commande fournisseur
 *     tags: [Achats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: statut
 *         schema: { type: string, enum: [BROUILLON, CONFIRME, RECU, ANNULE] }
 *       - in: query
 *         name: fournisseurId
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Liste des achats
 *         content:
 *           application/json:
 *             example:
 *               data: [{ id: 1, numero: BC-001, statut: CONFIRME, fournisseurId: 2, montantTotal: 1500 }]
 *               total: 42
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/export", auth, can("achats:read"), exportAchats);
router.get("/stats", auth, can("achats:read"), stats);
router.get("/en-retard", auth, can("achats:read"), enRetard);
router.get("/comparaison-fournisseurs", auth, can("achats:read"), comparaisonFournisseurs);
router.get("/", auth, can("achats:read"), list);
router.get("/search/articles", auth, can("achats:read"), searchArticles);
/**
 * @swagger
 * /achats:
 *   post:
 *     summary: Créer un bon de commande fournisseur
 *     tags: [Achats]
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
 *             required: [fournisseurId, lignes]
 *             properties:
 *               fournisseurId: { type: integer, example: 1 }
 *               depotId: { type: integer, example: 1 }
 *               statut: { type: string, enum: [BROUILLON, CONFIRME], example: BROUILLON }
 *               dateCommande: { type: string, format: date }
 *               dateLivraisonPrevue: { type: string, format: date }
 *               remiseGlobale: { type: number, example: 0 }
 *               lignes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     articleId: { type: integer, example: 1 }
 *                     quantite: { type: number, example: 100 }
 *                     prixUnit: { type: number, example: 5.5 }
 *     responses:
 *       201:
 *         description: Bon de commande créé
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
  can("achats:write"),
  [
    body("fournisseurId").isInt({ min: 1 }).withMessage("fournisseurId requis"),
    body("societeId").optional().isInt({ min: 1 }).withMessage("societeId invalide"),
    body("depotId").isInt({ min: 1 }).withMessage("Dépôt requis"),
    body("remiseGlobale").optional().isFloat({ min: 0, max: 100 }),
    body("statut").optional().isIn(["BROUILLON", "CONFIRME"]),
    body("dateCommande").optional().isString(),
    body("dateLivraisonPrevue")
      .optional({ nullable: true })
      .custom((val, { req }) => {
        const dateAchat = req.body.dateCommande || req.body.dateAchat;
        if (val && dateAchat && new Date(val) < new Date(dateAchat)) {
          throw new Error("dateLivraisonPrevue ne peut pas précéder dateCommande");
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
          if (!Number.isFinite(Number(l.prixUnit)) || Number(l.prixUnit) < 0) {
            throw new Error("prixUnit >= 0 requis dans lignes");
          }
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
  validate,
  create
);
/**
 * @swagger
 * /achats/{id}/confirmer:
 *   post:
 *     summary: Confirmer un bon de commande (changement de statut)
 *     tags: [Achats]
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
 *         description: Commande confirmée
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/confirmer", auth, can("achats:write"), confirmer);
/**
 * @swagger
 * /achats/{id}/annuler:
 *   post:
 *     summary: Annuler un bon de commande
 *     tags: [Achats]
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
 *         description: Commande annulée
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/annuler", auth, can("achats:write"), annuler);
/**
 * @swagger
 * /achats/{id}/reception:
 *   post:
 *     summary: Réceptionner une commande (mise à jour stock)
 *     tags: [Achats]
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
 *         description: Réception enregistrée
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/reception", auth, can("achats:write"), recevoir);
router.post(
  "/:id/lignes/:ligneId/reception",
  auth,
  can("achats:write"),
  [body("quantiteRecue").isFloat({ gt: 0 })],
  validate,
  receptionnerLigne
);
router.post(
  "/:id/paiement",
  auth,
  can("reglements:write"),
  [body("montant").isFloat({ gt: 0 }).withMessage("montant > 0 requis")],
  validate,
  paiement
);
/**
 * @swagger
 * /achats/{id}:
 *   put:
 *     summary: Modifier un bon de commande
 *     tags: [Achats]
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
 *             required: [fournisseurId, lignes]
 *             properties:
 *               fournisseurId: { type: integer }
 *               statut: { type: string, enum: [BROUILLON, CONFIRME] }
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
 *         description: Commande modifiée
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put(
  "/:id",
  auth,
  can("achats:write"),
  [
    body("fournisseurId").isInt({ min: 1 }).withMessage("fournisseurId requis"),
    body("societeId").optional().isInt({ min: 1 }).withMessage("societeId invalide"),
    body("depotId").isInt({ min: 1 }).withMessage("Dépôt requis"),
    body("dateCommande").optional().isString(),
    body("dateLivraisonPrevue")
      .optional({ nullable: true })
      .custom((val, { req }) => {
        const dateAchat = req.body.dateCommande || req.body.dateAchat;
        if (val && dateAchat && new Date(val) < new Date(dateAchat)) {
          throw new Error("dateLivraisonPrevue ne peut pas précéder dateCommande");
        }
        return true;
      }),
    body("remiseGlobale").optional().isFloat({ min: 0, max: 100 }),
    body("remise").optional().isFloat({ min: 0, max: 100 }),
    body("statut").optional().isIn(["BROUILLON", "CONFIRME"]),
    body("lignes")
      .isArray({ min: 1 })
      .withMessage("lignes[] requis")
      .custom((arr) => {
        if (!Array.isArray(arr)) return false;
        const seen = new Set();
        for (const l of arr) {
          if (!l || Number(l.articleId) <= 0) throw new Error("articleId invalide dans lignes");
          if (Number(l.quantite) <= 0) throw new Error("quantite > 0 requise dans lignes");
          if (!Number.isFinite(Number(l.prixUnit)) || Number(l.prixUnit) < 0) {
            throw new Error("prixUnit >= 0 requis dans lignes");
          }
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
  validate,
  update
);
/**
 * @swagger
 * /achats/{id}:
 *   delete:
 *     summary: Supprimer un bon de commande brouillon
 *     tags: [Achats]
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
 *         description: Commande supprimée
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", auth, can("achats:write"), remove);
router.get("/:id/bon-commande/pdf", auth, can("achats:read"), bonCommande);
router.get("/:id/bon-reception/pdf", auth, can("achats:read"), bonReception);
/**
 * @swagger
 * /achats/{id}:
 *   get:
 *     summary: Détail d'un bon de commande
 *     tags: [Achats]
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
 *         description: Détail de la commande
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", auth, can("achats:read"), getOne);

module.exports = router;
