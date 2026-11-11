const { Router } = require("express");
const { body } = require("express-validator");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { uploadDir: resolveUploadDir } = require("../../config/paths");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const {
  list,
  listCatalogueClient,
  listSimilaires,
  getOne,
  create,
  update,
  remove,
  uploadImage,
  setStatut,
  getNextCode,
  importCsv,
  exportExcel,
} = require("./articles.controller");

const router = Router();

function requireClient(req, res, next) {
  if (req.user?.role !== "CLIENT") {
    return res.status(403).json({ message: "Accès réservé aux clients" });
  }
  return next();
}
/** Aligné avec `app.use('/uploads', express.static(UPLOAD_ROOT))` — évite d’écrire hors du dossier servi. */
const uploadDir = resolveUploadDir("articles");

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

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/vnd.ms-excel",
      "text/plain",
      "application/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (allowed.includes(file.mimetype) || ext === ".csv" || ext === ".xlsx") {
      return cb(null, true);
    }
    return cb(new Error("Format non supporte (CSV ou Excel .xlsx uniquement)"));
  },
});

/**
 * @swagger
 * /articles:
 *   get:
 *     summary: Lister les articles du référentiel produits (paginé, filtres)
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Recherche par code ou libellé
 *       - in: query
 *         name: statut
 *         schema: { type: string, enum: [actif, archive, bloque] }
 *         description: Filtrer par statut
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Liste des articles
 *         content:
 *           application/json:
 *             example:
 *               data: [{ id: 1, code: ART-001, libelle: "Vit'up", prixVente: 0.9, statut: actif }]
 *               total: 248
 *               page: 1
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", auth, can("stock:read"), list);
/**
 * Catalogue client — champs publics uniquement (pas de prixAchat / fournisseur / stocks détaillés).
 * Doit rester avant /:id.
 */
router.get("/catalogue", auth, requireClient, can("stock:read"), listCatalogueClient);
router.get("/:id/similaires", auth, can("stock:read"), listSimilaires);
/**
 * @swagger
 * /articles/next-code:
 *   get:
 *     summary: Obtenir le prochain code article disponible
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Code suggéré
 *         content:
 *           application/json:
 *             example: { code: ART-249 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/next-code", auth, can("stock:read"), getNextCode);
/**
 * @swagger
 * /articles/export-excel:
 *   get:
 *     summary: Export Excel stylisé des articles
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: statut
 *         schema: { type: string }
 *       - in: query
 *         name: ids
 *         schema: { type: string }
 *         description: Liste d'IDs séparés par des virgules (export sélection)
 *     responses:
 *       200:
 *         description: Fichier Excel (.xlsx) stylisé
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/export-excel", auth, can("stock:read"), exportExcel);
/**
 * @swagger
 * /articles/import:
 *   post:
 *     summary: Import CSV ou Excel (.xlsx) en masse d'articles
 *     tags: [Articles]
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
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Fichier CSV ou Excel .xlsx (max 5 Mo)
 *     responses:
 *       200:
 *         description: Import terminé
 *         content:
 *           application/json:
 *             example: { imported: 120, errors: [], skipped: 3 }
 *       400:
 *         description: Fichier invalide ou erreurs de validation
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
/** Import CSV ou Excel (.xlsx) en masse — nécessite un backend à jour (npm run dev ou redémarrage si npm start). */
router.post("/import", auth, can("stock:write"), csvUpload.single("file"), importCsv);
/**
 * @swagger
 * /articles/{id}:
 *   get:
 *     summary: Détail d'un article
 *     tags: [Articles]
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
 *         description: Article trouvé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", auth, can("stock:read"), getOne);
/**
 * @swagger
 * /articles:
 *   post:
 *     summary: Créer un nouvel article
 *     tags: [Articles]
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
 *             required: [code, libelle, familleId, sousFamilleId, fournisseurId, depotId, emplacementId]
 *             properties:
 *               code: { type: string, example: ART-001 }
 *               libelle: { type: string, example: "Vit'up Nature" }
 *               familleId: { type: integer, example: 1 }
 *               sousFamilleId: { type: integer, example: 2 }
 *               fournisseurId: { type: integer, example: 1 }
 *               depotId: { type: integer, example: 1 }
 *               emplacementId: { type: integer, example: 1 }
 *               unite: { type: string, example: pièce }
 *               prixAchat: { type: number, example: 0.65 }
 *               prixVente: { type: number, example: 0.9 }
 *               poids: { type: number, example: 0.125 }
 *               volume: { type: number, example: 0.0001 }
 *               imageUrl: { type: string, example: /uploads/articles/photo.jpg }
 *     responses:
 *       201:
 *         description: Article créé
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
    body("code").trim().isLength({ min: 1 }).withMessage("Code requis"),
    body("libelle").trim().isLength({ min: 2 }).withMessage("Libelle requis"),
    body("familleId").isInt({ min: 1 }).withMessage("Famille requise"),
    body("sousFamilleId").isInt({ min: 1 }).withMessage("Sous-famille requise"),
    body("fournisseurId").isInt({ min: 1 }).withMessage("Fournisseur requis"),
    body("depotId").isInt({ min: 1 }).withMessage("Depot requis"),
    body("emplacementId").isInt({ min: 1 }).withMessage("Emplacement requis"),
    body("unite").optional().trim().isLength({ min: 1 }),
    body("prixAchat").optional().isFloat({ min: 0 }).withMessage("Prix doit être >= 0"),
    body("prixVente").optional().isFloat({ min: 0 }).withMessage("Prix doit être >= 0"),
    body("stockMin").optional().isFloat({ min: 0 }),
    body("stockMax").optional().isFloat({ min: 0 }),
    body().custom((_, { req }) => {
      const min = req.body.stockMin;
      const max = req.body.stockMax;
      if (min != null && min !== "" && max != null && max !== "" && Number(min) > Number(max)) {
        throw new Error("stockMin doit être <= stockMax");
      }
      return true;
    }),
    body("tauxTva").optional().isFloat({ min: 0, max: 100 }),
    body("modeTracage").optional().isIn(["AUCUN", "LOT", "SERIE", "LOT_SERIE"]).withMessage("modeTracage invalide"),
    body("tracageAuto").optional().isBoolean().withMessage("tracageAuto doit être un booléen"),
    body("strategieSortie").optional().isIn(["FIFO", "FEFO", "STANDARD"]),
    body().custom((_, { req }) => {
      const mode = String(req.body.modeTracage || "AUCUN").toUpperCase();
      const strat = String(req.body.strategieSortie || "FIFO").toUpperCase();
      if (mode !== "AUCUN" && strat === "STANDARD") {
        throw new Error("La stratégie de sortie doit être FIFO ou FEFO lorsque la traçabilité est activée");
      }
      return true;
    }),
    body("poids").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Poids doit etre >= 0"),
    body("volume").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Volume doit etre >= 0"),
    body("imageUrl")
      .optional({ checkFalsy: true })
      .custom((value) => {
        const s = String(value).trim();
        if (!s) return true;
        if (s.startsWith("/uploads/")) return true;
        try {
          const u = new URL(s);
          return u.protocol === "http:" || u.protocol === "https:";
        } catch {
          return false;
        }
      })
      .withMessage("URL de l'image invalide (http ou https)"),
  ],
  validate,
  create
);
/**
 * @swagger
 * /articles/upload-image:
 *   post:
 *     summary: Téléverser une image produit
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: URL de l'image
 *         content:
 *           application/json:
 *             example: { imageUrl: /uploads/articles/123456.jpg }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post("/upload-image", auth, can("stock:write"), upload.single("image"), uploadImage);
/**
 * @swagger
 * /articles/{id}/statut:
 *   patch:
 *     summary: Modifier le statut d'un article (actif, archivé, bloqué)
 *     tags: [Articles]
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
 *               statut: { type: string, enum: [actif, archive, bloque] }
 *     responses:
 *       200:
 *         description: Statut mis à jour
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch("/:id/statut", auth, can("stock:write"), setStatut);
/**
 * @swagger
 * /articles/{id}:
 *   patch:
 *     summary: Modifier un article existant
 *     tags: [Articles]
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
 *             required: [familleId, sousFamilleId, fournisseurId, depotId, emplacementId]
 *             properties:
 *               libelle: { type: string, example: "Vit'up Fraise" }
 *               familleId: { type: integer }
 *               sousFamilleId: { type: integer }
 *               fournisseurId: { type: integer }
 *               depotId: { type: integer }
 *               emplacementId: { type: integer }
 *               prixAchat: { type: number }
 *               prixVente: { type: number }
 *               poids: { type: number }
 *               volume: { type: number }
 *     responses:
 *       200:
 *         description: Article modifié
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
  can("stock:write"),
  [
    body("familleId").isInt({ min: 1 }).withMessage("Famille requise"),
    body("sousFamilleId").isInt({ min: 1 }).withMessage("Sous-famille requise"),
    body("fournisseurId").isInt({ min: 1 }).withMessage("Fournisseur requis"),
    body("depotId").isInt({ min: 1 }).withMessage("Depot requis"),
    body("emplacementId").isInt({ min: 1 }).withMessage("Emplacement requis"),
    body("prixAchat").optional().isFloat({ min: 0 }).withMessage("Prix doit être >= 0"),
    body("prixVente").optional().isFloat({ min: 0 }).withMessage("Prix doit être >= 0"),
    body("stockMin").optional().isFloat({ min: 0 }),
    body("stockMax").optional().isFloat({ min: 0 }),
    body().custom((_, { req }) => {
      const min = req.body.stockMin;
      const max = req.body.stockMax;
      if (min != null && min !== "" && max != null && max !== "" && Number(min) > Number(max)) {
        throw new Error("stockMin doit être <= stockMax");
      }
      return true;
    }),
    body("tauxTva").optional().isFloat({ min: 0, max: 100 }),
    body("modeTracage").optional().isIn(["AUCUN", "LOT", "SERIE", "LOT_SERIE"]).withMessage("modeTracage invalide"),
    body("tracageAuto").optional().isBoolean().withMessage("tracageAuto doit être un booléen"),
    body("strategieSortie").optional().isIn(["FIFO", "FEFO", "STANDARD"]),
    body().custom((_, { req }) => {
      const mode = String(req.body.modeTracage || "AUCUN").toUpperCase();
      const strat = String(req.body.strategieSortie || "FIFO").toUpperCase();
      if (mode !== "AUCUN" && strat === "STANDARD") {
        throw new Error("La stratégie de sortie doit être FIFO ou FEFO lorsque la traçabilité est activée");
      }
      return true;
    }),
    body("poids").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Poids doit etre >= 0"),
    body("volume").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Volume doit etre >= 0"),
  ],
  validate,
  update
);
/**
 * @swagger
 * /articles/{id}:
 *   delete:
 *     summary: Archiver ou supprimer un article
 *     tags: [Articles]
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
 *         description: Article archivé/supprimé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/:id", auth, can("stock:delete"), remove);

module.exports = router;
