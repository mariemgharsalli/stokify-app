const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can, canAny } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./clients.controller");

const router = Router();

/**
 * @swagger
 * /clients:
 *   get:
 *     summary: Lister les clients
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des clients
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", auth, can("ventes:read"), c.list);
/**
 * @swagger
 * /clients/encours:
 *   get:
 *     summary: Liste des encours clients
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Encours par client
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/encours", auth, can("encours:read"), c.encoursList);

/** Comptes CLIENT en attente de rattachement (société active) */
router.get("/utilisateurs-en-attente", auth, can("clients:write"), c.listUtilisateursEnAttente);

/** Fiche Client de l'utilisateur connecté (role CLIENT) — localisation profil */
router.get("/me", auth, c.getMe);
router.patch("/me", auth, c.updateMe);

/** Rattacher un Utilisateur (contact) à une fiche Client */
router.post(
  "/:clientId/rattacher-utilisateur",
  auth,
  can("clients:write"),
  [body("utilisateurId").notEmpty().withMessage("utilisateurId requis")],
  validate,
  c.rattacherUtilisateur
);

/**
 * @swagger
 * /clients/{id}/stats:
 *   get:
 *     summary: Statistiques d'un client
 *     tags: [Clients]
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
 *         description: Statistiques du client
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/next-code", auth, can("ventes:read"), c.getNextCode);
router.get("/:id/stats", auth, can("ventes:read"), c.statsClient);
router.get("/:id/encours", auth, canAny("encours:read", "ventes:read"), c.encoursClient);
router.post("/:id/relancer", auth, can("ventes:write"), c.relancer);
router.get("/:id/historique-ventes", auth, can("ventes:read"), c.historiqueVentes);
/**
 * @swagger
 * /clients/{id}:
 *   get:
 *     summary: Détail d'un client
 *     tags: [Clients]
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
 *         description: Client trouvé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id", auth, can("ventes:read"), c.getOne);
/**
 * @swagger
 * /clients:
 *   post:
 *     summary: Créer un client
 *     tags: [Clients]
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
 *             required: [code, nom]
 *             properties:
 *               code: { type: string, example: CLI-01 }
 *               nom: { type: string, example: "Café Central" }
 *               email: { type: string, format: email }
 *               telephone: { type: string }
 *     responses:
 *       201:
 *         description: Client créé
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
    body("code").trim().isLength({ min: 1 }),
    body("nom").trim().notEmpty().withMessage("Nom requis"),
    body("email").optional({ values: "falsy" }).isEmail().withMessage("Email invalide"),
    body("telephone").optional({ values: "falsy" }).matches(/^[+]?[0-9\s().-]{6,20}$/).withMessage("Téléphone invalide"),
    body("plafondCredit").optional({ values: "falsy" }).isFloat({ min: 0 }),
    body("tauxRemise").optional({ values: "falsy" }).isFloat({ min: 0, max: 100 }),
    body("latitude").optional({ values: "falsy" }).isFloat({ min: -90, max: 90 }),
    body("longitude").optional({ values: "falsy" }).isFloat({ min: -180, max: 180 }),
    body("longitude").custom((val, { req }) => {
      const hasLat = req.body.latitude != null && req.body.latitude !== "";
      const hasLng = val != null && val !== "";
      if (hasLat !== hasLng) throw new Error("Renseignez latitude ET longitude, ou aucune des deux");
      return true;
    }),
  ],
  validate,
  c.create
);
/**
 * @swagger
 * /clients/{id}:
 *   patch:
 *     summary: Modifier un client
 *     tags: [Clients]
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
 *               code: { type: string }
 *               nom: { type: string }
 *               email: { type: string }
 *               telephone: { type: string }
 *     responses:
 *       200:
 *         description: Client modifié
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch(
  "/:id",
  auth,
  can("ventes:write"),
  [
    body("nom").optional().trim().notEmpty().withMessage("Nom requis"),
    body("email").optional({ values: "falsy" }).isEmail().withMessage("Email invalide"),
    body("telephone").optional({ values: "falsy" }).matches(/^[+]?[0-9\s().-]{6,20}$/).withMessage("Téléphone invalide"),
    body("plafondCredit").optional({ values: "falsy" }).isFloat({ min: 0 }),
    body("tauxRemise").optional({ values: "falsy" }).isFloat({ min: 0, max: 100 }),
    body("latitude").optional({ values: "falsy" }).isFloat({ min: -90, max: 90 }),
    body("longitude").optional({ values: "falsy" }).isFloat({ min: -180, max: 180 }),
    body("longitude").custom((val, { req }) => {
      const hasLat = req.body.latitude != null && req.body.latitude !== "";
      const hasLng = val != null && val !== "";
      if (hasLat !== hasLng) throw new Error("Renseignez latitude ET longitude, ou aucune des deux");
      return true;
    }),
    body("actif")
      .optional()
      .custom((v) => v === true || v === false || v === "true" || v === "false" || v === 0 || v === 1 || v === "0" || v === "1")
      .withMessage("actif doit etre true ou false"),
  ],
  validate,
  c.update
);

// DELETE /clients/:id retiré de l'API publique — désactivation via PATCH (actif: false).

module.exports = router;
