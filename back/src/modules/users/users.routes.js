const { Router } = require("express");
const { body } = require("express-validator");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { uploadDir } = require("../../config/paths");
const prisma = require("../../config/database");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { trouverUtilisateurPourAppelant, roleAuDessusDeLappelant } = require("./users.service");
const {
  listUsers,
  listPendingUsers,
  approveUser,
  rejectUser,
  updateUserRole,
  updateUserStatus,
  resetUserPassword,
  sendUserInvitation,
  createUser,
  auditLog,
  getMe,
  updateMyProfile,
  getMyAudit,
  uploadMyAvatar,
  getUserPermissions,
  updateUserPermissions,
  patchUserPermissionsJson,
  getUserById,
  resetUserPermissions,
  roleValidation,
  activeValidation,
} = require("./users.controller");
const { getUserActivity, getGlobalActivity } = require("./activity.controller");

const router = Router();

const avatarUploadDir = uploadDir("avatars");

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(avatarUploadDir, { recursive: true });
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
    cb(null, `user-${req.user.id}-${Date.now()}${safeExt}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Format image non supporté (jpg, png, webp)"));
    }
    return cb(null, true);
  },
});

const createUserValidation = [
  body("nom").trim().notEmpty(),
  body("prenom").trim().notEmpty(),
  body("email").trim().isEmail(),
  body("motDePasse").isLength({ min: 8 }),
  body("role").isString().notEmpty(),
  body("telephone").optional({ values: "falsy" }).trim(),
  body("forceChangeOnFirstLogin").optional().isBoolean(),
  body("sendInviteEmail").optional().isBoolean(),
];

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lister les utilisateurs
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", can("users:read"), listUsers);
router.get("/pending", can("users:manage"), listPendingUsers);
router.get("/audit-log", auth, can("users:manage"), auditLog);
router.get("/activity/global", auth, can("users:manage"), getGlobalActivity);
/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Profil de l'utilisateur connecté
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil utilisateur
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/me", auth, getMe);
router.patch("/me/profile", auth, updateMyProfile);
router.post("/me/avatar", auth, avatarUpload.single("image"), uploadMyAvatar);
router.get("/me/audit", auth, getMyAudit);
/**
 * @swagger
 * /users:
 *   post:
 *     summary: Créer un utilisateur
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nom, prenom, email, motDePasse, role]
 *             properties:
 *               nom: { type: string, example: Dupont }
 *               prenom: { type: string, example: Jean }
 *               email: { type: string, format: email, example: jean@example.com }
 *               motDePasse: { type: string, minLength: 8 }
 *               role: { type: string, example: USER }
 *               telephone: { type: string }
 *               forceChangeOnFirstLogin: { type: boolean }
 *               sendInviteEmail: { type: boolean }
 *     responses:
 *       201:
 *         description: Utilisateur créé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/", can("users:manage"), createUserValidation, validate, createUser);
router.patch("/:id/approve", can("users:manage"), approveUser);
router.patch("/:id/reject", can("users:manage"), rejectUser);
router.patch("/:id/role", can("users:manage"), roleValidation, validate, updateUserRole);
router.patch("/:id/status", can("users:manage"), activeValidation, validate, updateUserStatus);
router.post("/:id/reset-password", auth, can("users:manage"), resetUserPassword);
router.post("/:id/send-invite", auth, can("users:manage"), sendUserInvitation);
router.get("/:id/activity", auth, can("users:read"), getUserActivity);
router.get("/:id/permissions", can("users:manage"), getUserPermissions);
router.put("/:id/permissions", can("users:manage"), updateUserPermissions);
router.patch("/:id/permissions", can("users:manage"), patchUserPermissionsJson);
router.delete("/:id/permissions", can("users:manage"), resetUserPermissions);
router.patch("/:id", auth, can("users:manage"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    if (id === req.user.id && req.body.actif === false) {
      return res.status(400).json({
        message: "Vous ne pouvez pas désactiver votre propre compte",
      });
    }

    const allowed = ["actif", "role", "prenom", "nom", "email"];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Aucune donnée à mettre à jour" });
    }

    let existing;
    try {
      existing = await trouverUtilisateurPourAppelant({
        id,
        callerRole: req.user.role,
        callerSocieteId: req.user.societeId,
      });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ message: "Utilisateur introuvable" });
      throw error;
    }

    if (data.role != null && roleAuDessusDeLappelant(req.user.role, data.role)) {
      return res.status(400).json({ message: "Role invalide" });
    }

    const updated = await prisma.utilisateur.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
      },
    });
    res.json(updated);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }
    next(err);
  }
});
router.delete("/:id", auth, can("users:manage"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    let user;
    try {
      user = await trouverUtilisateurPourAppelant({
        id,
        callerRole: req.user.role,
        callerSocieteId: req.user.societeId,
      });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ message: "Utilisateur introuvable" });
      throw error;
    }
    if (id === req.user.id) return res.status(400).json({ message: "Suppression de votre propre compte interdite" });
    if (req.user.role !== "SUPER_ADMIN") return res.status(403).json({ message: "Action réservée au super administrateur" });
    if (user.actif) return res.status(400).json({ message: "Désactivez d'abord le compte avant suppression" });

    await prisma.utilisateur.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(400).json({
        message: "Suppression impossible: cet utilisateur est lié à un historique (mouvements/audit).",
      });
    }
    next(err);
  }
});
/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Détail d'un utilisateur
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Utilisateur trouvé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id", auth, can("users:read"), getUserById);

module.exports = router;
