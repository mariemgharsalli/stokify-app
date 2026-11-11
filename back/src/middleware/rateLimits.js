"use strict";

/**
 * Quotas IA et chat. La clé est l'utilisateur authentifié, sinon l'IP (IPv6 inclus).
 * À monter après auth pour que req.user soit déjà posé.
 */
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const key = (req) => (req.user?.id ? `u:${req.user.id}` : ipKeyGenerator(req.ip));
const common = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: key,
  message: { success: false, message: "Trop de requêtes, réessayez dans un instant." },
};

const aiLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 30 });
const chatLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 12 });
const chatDaily = rateLimit({ ...common, windowMs: 24 * 3600_000, limit: 200 });

module.exports = { aiLimiter, chatLimiter, chatDaily };
