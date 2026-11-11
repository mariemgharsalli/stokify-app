const { Router } = require("express");
const { body } = require("express-validator");
const { can } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { postChat, postClientChat, getStockChatBriefing, getClientChatBriefing } = require("./chat.controller");
const { chatLimiter, chatDaily } = require("../../middleware/rateLimits");

const router = Router();

/**
 * @swagger
 * /ai/chat:
 *   post:
 *     summary: Envoyer un message à l'assistant IA (stock interne)
 *     tags: [AI]
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
 *             required: [message]
 *             properties:
 *               message: { type: string, example: "Quels articles sont en rupture de stock ?" }
 *               conversationId: { type: string }
 *     responses:
 *       200:
 *         description: Réponse de l'assistant IA
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/chat",
  chatLimiter,
  chatDaily,
  can("ai:read"),
  [body("message").trim().notEmpty().withMessage("Message requis")],
  validate,
  postChat
);

router.get("/chat/briefing", can("ai:read"), getStockChatBriefing);

/**
 * Assistant B2B clients — catalogue, panier, commandes.
 * Permission: orders:read (rôle CLIENT).
 */
router.post(
  "/chat-client",
  chatLimiter,
  chatDaily,
  can("orders:read"),
  [body("message").trim().notEmpty().withMessage("Message requis")],
  validate,
  postClientChat
);

router.get("/chat-client/briefing", can("orders:read"), getClientChatBriefing);

module.exports = router;
