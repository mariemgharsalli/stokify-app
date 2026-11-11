const { Router } = require("express");
const { body } = require("express-validator");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { uploadDir: resolveUploadDir } = require("../../config/paths");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./marques.controller");

const router = Router();

const uploadDir = resolveUploadDir("marques");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png"].includes(ext) ? ext : ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Format image non supporte (jpg, jpeg, png)"));
    }
    return cb(null, true);
  },
});

/**
 * @swagger
 * /marques:
 *   get:
 *     summary: Lister les marques
 *     tags: [Marques]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des marques
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", auth, can("stock:read"), c.list);
/**
 * @swagger
 * /marques/upload-image:
 *   post:
 *     summary: Téléverser une image de marque
 *     tags: [Marques]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: URL de l'image téléversée
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/upload-image", auth, can("stock:write"), upload.single("image"), c.uploadImage);
/**
 * @swagger
 * /marques/{id}:
 *   get:
 *     summary: Détail d'une marque
 *     tags: [Marques]
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
 *         description: Marque trouvée
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id", auth, can("stock:read"), c.getOne);
/**
 * @swagger
 * /marques:
 *   post:
 *     summary: Créer une marque
 *     tags: [Marques]
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
 *               code: { type: string, example: MRQ-01 }
 *               nom: { type: string, example: Coca-Cola }
 *               logoUrl: { type: string }
 *     responses:
 *       201:
 *         description: Marque créée
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
  [body("code").trim().isLength({ min: 1 }), body("nom").trim().notEmpty().withMessage("Nom requis")],
  validate,
  c.create
);
/**
 * @swagger
 * /marques/{id}:
 *   patch:
 *     summary: Modifier une marque
 *     tags: [Marques]
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
 *               logoUrl: { type: string }
 *     responses:
 *       200:
 *         description: Marque modifiée
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch("/:id", auth, can("stock:write"), c.update);
router.patch("/:id/statut", auth, can("stock:write"), c.setStatut);
/**
 * @swagger
 * /marques/{id}:
 *   delete:
 *     summary: Supprimer une marque
 *     tags: [Marques]
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
 *         description: Marque supprimée
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/:id", auth, can("stock:write"), c.remove);

module.exports = router;
