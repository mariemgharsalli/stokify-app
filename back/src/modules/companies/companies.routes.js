const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can, superAdminOnly } = require("../../middleware/rbac");

function adminOuSuperAdmin(req, res, next) {
  if (req.user?.role === "ADMIN" || req.user?.role === "SUPER_ADMIN") return next();
  return res.status(403).json({ message: "Action non autorisée" });
}
const uploadMiddleware = require("../../middleware/upload");
const { validate } = require("../../middleware/validate");
const {
  publicList,
  adminList,
  create,
  update,
  seuilValidation,
  platformSummary,
  globalStats,
  uploadLogo,
} = require("./companies.controller");

const router = Router();

/**
 * @swagger
 * /companies/public:
 *   get:
 *     summary: Liste publique des sociétés actives (inscription)
 *     tags: [Companies]
 *     security: []
 *     responses:
 *       200:
 *         description: Sociétés disponibles pour inscription
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/public", publicList);
router.get("/platform-summary", auth, superAdminOnly, platformSummary);
router.get("/global-stats", auth, superAdminOnly, globalStats);
/**
 * @swagger
 * /companies:
 *   get:
 *     summary: Lister les sociétés (administration)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des sociétés
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", auth, can("companies:read"), adminList);
/**
 * @swagger
 * /companies:
 *   post:
 *     summary: Créer une société
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [code, nom]
 *             properties:
 *               code: { type: string, minLength: 3, example: STOKIFY }
 *               nom: { type: string, minLength: 2, example: Stokify SARL }
 *               email: { type: string, format: email }
 *               adresse: { type: string }
 *               ville: { type: string }
 *               latitude: { type: number, minimum: -90, maximum: 90 }
 *               longitude: { type: number, minimum: -180, maximum: 180 }
 *               actif: { type: boolean }
 *               logo: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Société créée
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
  superAdminOnly,
  uploadMiddleware,
  [
    body("code").trim().isLength({ min: 3 }).withMessage("Code: min 3 caracteres"),
    body("nom").trim().isLength({ min: 2 }).withMessage("Nom: min 2 caracteres"),
    body("email")
      .trim()
      .optional({ values: "falsy" })
      .isEmail({ allow_utf8_local_part: true })
      .withMessage("Email invalide"),
    body("adresse").optional().isString(),
    body("ville").optional().isString(),
    body("latitude").optional().isFloat({ min: -90, max: 90 }).withMessage("Latitude invalide"),
    body("longitude").optional().isFloat({ min: -180, max: 180 }).withMessage("Longitude invalide"),
    body("actif")
      .optional({ values: "falsy" })
      .custom((v) => v === true || v === false || v === "true" || v === "false")
      .withMessage("actif doit etre true ou false"),
  ],
  validate,
  create
);
/**
 * @swagger
 * /companies/{id}:
 *   patch:
 *     summary: Modifier une société
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nom]
 *             properties:
 *               nom: { type: string, minLength: 2 }
 *               email: { type: string, format: email }
 *               adresse: { type: string }
 *               ville: { type: string }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               actif: { type: boolean }
 *     responses:
 *       200:
 *         description: Société modifiée
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
  "/:id/seuil-validation",
  auth,
  adminOuSuperAdmin,
  [
    body("seuilValidationMouvement").custom((value) => {
      if (value == null || (typeof value === "string" && value.trim() === "")) return true;
      const seuil = Number(value);
      if (!Number.isFinite(seuil) || seuil < 0) {
        throw new Error("Le seuil doit être un nombre supérieur ou égal à 0");
      }
      return true;
    }),
  ],
  validate,
  seuilValidation
);
router.patch(
  "/:id",
  auth,
  superAdminOnly,
  [
    body("nom")
      .trim()
      .notEmpty()
      .withMessage("Nom requis")
      .isLength({ min: 2 })
      .withMessage("Nom: min 2 caracteres"),
    body("email")
      .trim()
      .optional({ values: "falsy" })
      .isEmail({ allow_utf8_local_part: true })
      .withMessage("Email invalide"),
    body("adresse").optional().isString(),
    body("ville").optional().isString(),
    body("latitude").optional().isFloat({ min: -90, max: 90 }).withMessage("Latitude invalide"),
    body("longitude").optional().isFloat({ min: -180, max: 180 }).withMessage("Longitude invalide"),
    body("actif").optional().isBoolean().withMessage("actif doit etre un booleen"),
  ],
  validate,
  update
);
router.patch("/:id/logo", auth, superAdminOnly, uploadMiddleware, uploadLogo);

// DELETE /companies/:id retiré de l'API publique — désactivation via PATCH (actif: false) uniquement.
// Le contrôleur `remove` reste disponible pour un usage technique exceptionnel si besoin.

module.exports = router;
