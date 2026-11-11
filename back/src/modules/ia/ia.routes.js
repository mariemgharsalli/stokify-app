const { Router } = require("express");
const { can } = require("../../middleware/rbac");
const { dashboard, apply, health } = require("./ia.controller");
const { aiLimiter } = require("../../middleware/rateLimits");

const router = Router();

router.get("/dashboard", aiLimiter, can("ai:read"), dashboard);
router.get("/health", aiLimiter, can("ai:read"), health);
router.post("/recommandations/apply", aiLimiter, can("ai:read"), apply);

module.exports = router;
