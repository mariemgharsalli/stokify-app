const rateLimit = require("express-rate-limit");
const { Router } = require("express");
const { body } = require("express-validator");
const { login, register, me, refresh, changePassword, forgotPassword, resetPassword } = require("./auth.controller");
const { auth } = require("../../middleware/auth");
const { validate } = require("../../middleware/validate");
const { PUBLIC_REGISTRATION_ROLES } = require("./auth.service");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
});

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authentification — obtenir un token JWT
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, motDePasse]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@stokify.tn
 *               motDePasse:
 *                 type: string
 *                 format: password
 *                 example: Admin123!
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             example:
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               user: { id: 1, email: admin@stokify.tn, role: ADMIN, nom: Admin, prenom: Stokify }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Identifiants incorrects
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/login",
  authLimiter,
  [
    body("email").trim().isEmail().normalizeEmail(),
    // Ne pas imposer une longueur min ici : un mauvais MDP court doit compter
    // comme échec (verrouillage + alerte admin), pas être rejeté en 422.
    body("motDePasse").isString().notEmpty().withMessage("Mot de passe requis"),
  ],
  validate,
  login
);
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Inscription publique d'un utilisateur
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nom, prenom, email, motDePasse, motDePasseConfirmation]
 *             properties:
 *               nom: { type: string, example: Dupont }
 *               prenom: { type: string, example: Jean }
 *               email: { type: string, format: email, example: jean@example.com }
 *               motDePasse: { type: string, example: Motdepasse1 }
 *               motDePasseConfirmation: { type: string, example: Motdepasse1 }
 *               role: { type: string, enum: [CLIENT, FOURNISSEUR] }
 *               societeCode: { type: string, example: SOC-001 }
 *     responses:
 *       201:
 *         description: Compte créé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/register",
  authLimiter,
  [
    body("nom")
      .trim()
      .isLength({ min: 2 })
      .withMessage("Nom : 2 caractères minimum"),
    body("prenom")
      .trim()
      .isLength({ min: 2 })
      .withMessage("Prénom : 2 caractères minimum"),
    body("email")
      .trim()
      .isEmail()
      .withMessage("Adresse e-mail invalide")
      .normalizeEmail(),
    body("motDePasse")
      .isLength({ min: 8 })
      .withMessage("Mot de passe: 8 caractères minimum")
      .bail()
      .matches(/[A-Z]/)
      .withMessage("Mot de passe: au moins une majuscule")
      .bail()
      .matches(/[a-z]/)
      .withMessage("Mot de passe: au moins une minuscule")
      .bail()
      .matches(/[0-9]/)
      .withMessage("Mot de passe: au moins un chiffre"),
    body("motDePasseConfirmation")
      .custom((value, { req }) => value === req.body.motDePasse)
      .withMessage("La confirmation du mot de passe ne correspond pas"),
    body("role")
      .optional()
      .isIn(PUBLIC_REGISTRATION_ROLES)
      .withMessage("Rôle non autorisé pour l'inscription"),
    body("societeCode")
      .optional()
      .customSanitizer((value) => (value == null ? value : String(value).trim()))
      .isLength({ min: 1 })
      .withMessage("Code société invalide"),
  ],
  validate,
  register
);
/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Profil de l'utilisateur connecté
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil utilisateur
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               email: admin@stokify.tn
 *               nom: Admin
 *               prenom: Stokify
 *               role: ADMIN
 *               societeId: 1
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/me", auth, me);
/**
 * @swagger
 * /auth/change-password:
 *   patch:
 *     summary: Changer le mot de passe de l'utilisateur connecté
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ancienMotDePasse, nouveauMotDePasse, confirmation]
 *             properties:
 *               ancienMotDePasse: { type: string }
 *               nouveauMotDePasse: { type: string, example: Nouveau1Pass }
 *               confirmation: { type: string, example: Nouveau1Pass }
 *     responses:
 *       200:
 *         description: Mot de passe modifié
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch(
  "/change-password",
  auth,
  [
    body("ancienMotDePasse").isLength({ min: 6 }),
    body("nouveauMotDePasse")
      .isLength({ min: 8 })
      .withMessage("Mot de passe: 8 caractères minimum")
      .bail()
      .matches(/[A-Z]/)
      .withMessage("Mot de passe: au moins une majuscule")
      .bail()
      .matches(/[a-z]/)
      .withMessage("Mot de passe: au moins une minuscule")
      .bail()
      .matches(/[0-9]/)
      .withMessage("Mot de passe: au moins un chiffre"),
    body("confirmation")
      .custom((value, { req }) => value === req.body.nouveauMotDePasse)
      .withMessage("La confirmation du mot de passe ne correspond pas"),
  ],
  validate,
  changePassword
);
/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Rafraîchir le token JWT
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Nouveau token
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post("/refresh", refresh);

const passwordRules = [
  body("motDePasse")
    .isLength({ min: 8 })
    .withMessage("Mot de passe: 8 caractères minimum")
    .bail()
    .matches(/[A-Z]/)
    .withMessage("Mot de passe: au moins une majuscule")
    .bail()
    .matches(/[a-z]/)
    .withMessage("Mot de passe: au moins une minuscule")
    .bail()
    .matches(/[0-9]/)
    .withMessage("Mot de passe: au moins un chiffre"),
];

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Demander une réinitialisation de mot de passe par e-mail
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: E-mail envoyé si le compte existe
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post(
  "/forgot-password",
  authLimiter,
  [body("email").trim().isEmail().normalizeEmail()],
  validate,
  forgotPassword
);
/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Réinitialiser le mot de passe avec un token reçu par e-mail
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, motDePasse, confirmation]
 *             properties:
 *               token: { type: string }
 *               motDePasse: { type: string, example: Nouveau1Pass }
 *               confirmation: { type: string, example: Nouveau1Pass }
 *     responses:
 *       200:
 *         description: Mot de passe réinitialisé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post(
  "/reset-password",
  authLimiter,
  [
    body("token").trim().isLength({ min: 20 }),
    ...passwordRules,
    body("confirmation")
      .custom((value, { req }) => value === req.body.motDePasse)
      .withMessage("La confirmation du mot de passe ne correspond pas"),
  ],
  validate,
  resetPassword
);

module.exports = router;
