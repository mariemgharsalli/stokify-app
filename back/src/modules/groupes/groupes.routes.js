const { Router } = require("express");
const { body } = require("express-validator");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const c = require("./groupes.controller");

const router = Router();

/** `auth` est appliqué une seule fois dans `app.js` sur le préfixe `/api/groupes`. */
/**
 * @swagger
 * /groupes:
 *   get:
 *     summary: Lister les groupes d'articles
 *     tags: [Groupes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des groupes
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", can("stock:read"), c.list);
/**
 * @swagger
 * /groupes/{id}:
 *   get:
 *     summary: Détail d'un groupe
 *     tags: [Groupes]
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
 *         description: Groupe trouvé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id", can("stock:read"), c.getOne);
/**
 * @swagger
 * /groupes:
 *   post:
 *     summary: Créer un groupe
 *     tags: [Groupes]
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
 *               code: { type: string, example: GRP-01 }
 *               nom: { type: string, example: "Pack promo" }
 *     responses:
 *       201:
 *         description: Groupe créé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/",
  can("stock:write"),
  [body("code").trim().isLength({ min: 1 }), body("nom").trim().isLength({ min: 1 })],
  validate,
  c.create
);
/**
 * @swagger
 * /groupes/{id}:
 *   patch:
 *     summary: Modifier un groupe
 *     tags: [Groupes]
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
 *         description: Groupe modifié
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch("/:id", can("stock:write"), c.update);
/**
 * @swagger
 * /groupes/{id}:
 *   delete:
 *     summary: Supprimer un groupe
 *     tags: [Groupes]
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
 *         description: Groupe supprimé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/:id", can("stock:write"), c.remove);

module.exports = router;
