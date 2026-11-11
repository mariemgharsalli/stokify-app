const { Router } = require("express");
const { body } = require("express-validator");
const { auth } = require("../../middleware/auth");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { list, create, update, remove, setStatut } = require("./emplacements.controller");

const router = Router();

/**
 * @swagger
 * /emplacements:
 *   get:
 *     summary: Lister les emplacements par dépôt
 *     tags: [Emplacements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: depotId
 *         schema: { type: integer }
 *         description: Filtrer par dépôt
 *     responses:
 *       200:
 *         description: Liste des emplacements
 *         content:
 *           application/json:
 *             example: [{ id: 1, code: A-01, libelle: "Rayon A — Niveau 1", depotId: 1 }]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/", auth, can("stock:read"), list);
/**
 * @swagger
 * /emplacements:
 *   post:
 *     summary: Créer un emplacement dans un dépôt
 *     tags: [Emplacements]
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
 *             required: [depotId, code, libelle]
 *             properties:
 *               depotId: { type: integer, example: 1 }
 *               code: { type: string, example: A-02 }
 *               libelle: { type: string, example: "Rayon A — Niveau 2" }
 *               niveaux: { type: integer, example: 3 }
 *     responses:
 *       201:
 *         description: Emplacement créé
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post(
  "/",
  auth,
  can("stock:write"),
  [
    body("depotId").isInt().withMessage("depotId requis"),
    body("code").trim().notEmpty().withMessage("Code requis"),
    body("libelle").trim().isLength({ min: 1 }),
    body("distanceQuai").optional({ values: "falsy" }).isFloat({ min: 0 }),
    body("capaciteSlots").optional({ values: "falsy" }).isInt({ min: 0 }),
  ],
  validate,
  create
);
/**
 * @swagger
 * /emplacements/{id}:
 *   patch:
 *     summary: Modifier un emplacement
 *     tags: [Emplacements]
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
 *               libelle: { type: string }
 *               niveaux: { type: integer }
 *     responses:
 *       200:
 *         description: Emplacement modifié
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch("/:id/statut", auth, can("stock:write"), setStatut);
router.patch(
  "/:id",
  auth,
  can("stock:write"),
  [
    body("code").optional().trim().notEmpty().withMessage("Code requis"),
    body("libelle").optional().trim().isLength({ min: 1 }).withMessage("Libelle requis"),
    body("niveaux").optional({ nullable: true }).isInt({ min: 0 }).withMessage("Niveaux invalide"),
    body("distanceQuai").optional({ values: "falsy" }).isFloat({ min: 0 }),
    body("capaciteSlots").optional({ values: "falsy" }).isInt({ min: 0 }),
  ],
  validate,
  update
);
/**
 * @swagger
 * /emplacements/{id}:
 *   delete:
 *     summary: Supprimer un emplacement
 *     tags: [Emplacements]
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
 *         description: Emplacement supprimé
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", auth, can("stock:write"), remove);

module.exports = router;
