const { Router } = require("express");
const { body } = require("express-validator");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { list, getOne, create, update, remove } = require("./vehicules.controller");

const router = Router();

/**
 * @swagger
 * /vehicules:
 *   get:
 *     summary: Lister les véhicules de livraison
 *     tags: [Vehicules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/SocieteHeader'
 *     responses:
 *       200:
 *         description: Liste des véhicules
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", can("stock:read"), list);
/**
 * @swagger
 * /vehicules/{id}:
 *   get:
 *     summary: Détail d'un véhicule
 *     tags: [Vehicules]
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
 *         description: Véhicule trouvé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id", can("stock:read"), getOne);
/**
 * @swagger
 * /vehicules:
 *   post:
 *     summary: Créer un véhicule
 *     tags: [Vehicules]
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
 *             required: [nom, capacitePoids, capaciteVolume]
 *             properties:
 *               nom: { type: string, example: "Camion 3T" }
 *               capacitePoids: { type: number, minimum: 0.001, example: 3000 }
 *               capaciteVolume: { type: number, minimum: 0.0001, example: 15 }
 *               immatriculation: { type: string }
 *     responses:
 *       201:
 *         description: Véhicule créé
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
  [
    body("nom").trim().isLength({ min: 1 }).withMessage("Nom requis"),
    body("capacitePoids").isFloat({ min: 0.001 }).withMessage("Capacite poids requise"),
    body("capaciteVolume").isFloat({ min: 0.0001 }).withMessage("Capacite volume requise"),
  ],
  validate,
  create
);
/**
 * @swagger
 * /vehicules/{id}:
 *   patch:
 *     summary: Modifier un véhicule
 *     tags: [Vehicules]
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
 *               nom: { type: string }
 *               capacitePoids: { type: number }
 *               capaciteVolume: { type: number }
 *               immatriculation: { type: string }
 *               actif: { type: boolean }
 *     responses:
 *       200:
 *         description: Véhicule modifié
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch("/:id", can("stock:write"), update);
/**
 * @swagger
 * /vehicules/{id}:
 *   delete:
 *     summary: Supprimer un véhicule
 *     tags: [Vehicules]
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
 *         description: Véhicule supprimé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/:id", can("stock:write"), remove);

module.exports = router;
