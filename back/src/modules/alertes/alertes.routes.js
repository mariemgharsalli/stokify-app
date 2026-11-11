const { Router } = require("express");
const { query, param } = require("express-validator");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { list, count, resoudre, resoudreToutes } = require("./alertes.controller");

const router = Router();

/**
 * @swagger
 * /alertes:
 *   get:
 *     summary: Liste paginée des alertes stock (rupture / critique)
 *     tags: [Alertes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *       - in: query
 *         name: nonLues
 *         schema: { type: boolean }
 *         description: Si true, uniquement les alertes non résolues
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Liste paginée des alertes avec article et dépôt
 *         content:
 *           application/json:
 *             example:
 *               items:
 *                 - id: 1
 *                   type: RUPTURE
 *                   resolue: false
 *                   article: { id: 5, code: "ART-01", libelle: "Vit'up", imageUrl: null }
 *                   depot: { id: 1, code: "DEP1", libelle: "Principal" }
 *               total: 1
 *               page: 1
 *               pages: 1
 *               limit: 20
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get(
  "/",
  can("stock:read"),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page doit etre un entier >= 1"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit doit etre un entier entre 1 et 100"),
    query("nonLues")
      .optional()
      .isIn(["true", "false", "1", "0"])
      .withMessage("nonLues invalide (true, false, 1 ou 0)"),
  ],
  validate,
  list
);

/**
 * @swagger
 * /alertes/count:
 *   get:
 *     summary: Nombre d'alertes stock non résolues (badge cloche)
 *     tags: [Alertes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Compteur
 *         content:
 *           application/json:
 *             example: { count: 3 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/count", can("stock:read"), count);

/**
 * @swagger
 * /alertes/resoudre-toutes:
 *   patch:
 *     summary: Marquer toutes les alertes non résolues comme lues
 *     tags: [Alertes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Nombre d'alertes mises à jour
 *         content:
 *           application/json:
 *             example: { updated: 5 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.patch("/resoudre-toutes", can("stock:read"), resoudreToutes);

/**
 * @swagger
 * /alertes/{id}/resoudre:
 *   patch:
 *     summary: Marquer une alerte comme résolue / lue
 *     tags: [Alertes]
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
 *         description: Alerte mise à jour
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.patch(
  "/:id/resoudre",
  can("stock:read"),
  [param("id").isInt({ min: 1 }).withMessage("Identifiant alerte invalide")],
  validate,
  resoudre
);

module.exports = router;
