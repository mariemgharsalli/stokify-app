const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./familles.controller");

const router = Router();

/**
 * @swagger
 * /familles/sous-familles:
 *   get:
 *     summary: Lister les sous-familles
 *     tags: [Familles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des sous-familles
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/sous-familles", auth, can("stock:read"), c.listSous);
/**
 * @swagger
 * /familles/sous-familles:
 *   post:
 *     summary: Créer une sous-famille
 *     tags: [Familles]
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
 *             required: [code, nom, familleId]
 *             properties:
 *               code: { type: string, example: SF-01 }
 *               nom: { type: string, example: "Boissons gazeuses" }
 *               familleId: { type: integer, example: 1 }
 *     responses:
 *       201:
 *         description: Sous-famille créée
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/sous-familles",
  auth,
  can("stock:write"),
  [
    body("code").trim().isLength({ min: 1 }).withMessage("Code requis"),
    body("nom").trim().notEmpty().withMessage("Nom requis"),
    body("familleId").isInt(),
  ],
  validate,
  c.createSous
);
/**
 * @swagger
 * /familles/sous-familles/{id}:
 *   patch:
 *     summary: Modifier une sous-famille
 *     tags: [Familles]
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
 *               familleId: { type: integer }
 *     responses:
 *       200:
 *         description: Sous-famille modifiée
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch("/sous-familles/:id", auth, can("stock:write"), c.updateSous);
router.patch("/sous-familles/:id/statut", auth, can("stock:write"), c.setStatutSous);
/**
 * @swagger
 * /familles/sous-familles/{id}:
 *   delete:
 *     summary: Supprimer une sous-famille
 *     tags: [Familles]
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
 *         description: Sous-famille supprimée
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/sous-familles/:id", auth, can("stock:write"), c.removeSous);

/** CRUD groupes sous le même préfixe /api/familles (auth déjà appliqué dans app.js). Avant `/:id` pour éviter que « groupes » soit pris comme id de famille. */
router.use("/groupes", require("../groupes/groupes.routes"));

/**
 * @swagger
 * /familles:
 *   get:
 *     summary: Lister les familles d'articles
 *     tags: [Familles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des familles
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", auth, can("stock:read"), c.list);
/**
 * @swagger
 * /familles:
 *   post:
 *     summary: Créer une famille
 *     tags: [Familles]
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
 *               code: { type: string, example: FAM-01 }
 *               nom: { type: string, example: Boissons }
 *     responses:
 *       201:
 *         description: Famille créée
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
  [body("code").trim().isLength({ min: 1 }).withMessage("Code requis"), body("nom").trim().notEmpty().withMessage("Nom requis")],
  validate,
  c.create
);
/**
 * @swagger
 * /familles/{id}:
 *   get:
 *     summary: Détail d'une famille
 *     tags: [Familles]
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
 *         description: Famille trouvée
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id", auth, can("stock:read"), c.get);
/**
 * @swagger
 * /familles/{id}:
 *   patch:
 *     summary: Modifier une famille
 *     tags: [Familles]
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
 *     responses:
 *       200:
 *         description: Famille modifiée
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
 * /familles/{id}:
 *   delete:
 *     summary: Supprimer une famille
 *     tags: [Familles]
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
 *         description: Famille supprimée
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/:id", auth, can("stock:write"), c.remove);

module.exports = router;
