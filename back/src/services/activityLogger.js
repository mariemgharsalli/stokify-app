const prisma = require("../config/database");

const SENSITIVE_KEYS = new Set([
  "password",
  "motDePasse",
  "token",
  "refreshToken",
  "smtpPass",
  "secret",
  "apiKey",
]);

function sanitizeBody(body) {
  if (!body || typeof body !== "object") return null;
  const clean = Array.isArray(body) ? [...body] : { ...body };
  if (!Array.isArray(clean)) {
    for (const key of Object.keys(clean)) {
      if (SENSITIVE_KEYS.has(key)) delete clean[key];
    }
  }
  return clean;
}

function resolveIp(req) {
  if (!req) return null;
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.ip || null;
}

/**
 * Log a user action (never throws — failures are logged to console).
 */
async function logActivity({
  userId,
  action,
  module,
  entity,
  entityId,
  entityLabel,
  details,
  status = "SUCCESS",
  errorMsg,
  societeId,
  req,
}) {
  if (!userId || !action || !module) return;
  try {
    await prisma.activityLog.create({
      data: {
        userId: Number(userId),
        action: String(action),
        module: String(module).toLowerCase(),
        entity: entity ?? null,
        entityId: entityId != null && !Number.isNaN(Number(entityId)) ? Number(entityId) : null,
        entityLabel: entityLabel ?? null,
        details: details ?? null,
        status: status ?? "SUCCESS",
        errorMsg: errorMsg ?? null,
        societeId: societeId != null ? Number(societeId) : null,
        ipAddress: resolveIp(req),
        userAgent: req?.headers?.["user-agent"] ?? null,
      },
    });
  } catch (e) {
    console.error("[ActivityLogger] Failed to log:", e.message);
  }
}

function activityFromReq(req, data) {
  return logActivity({
    userId: req.user?.id,
    societeId: req.user?.societeId ?? req.body?.societeId,
    req,
    ...data,
    details: data.details ?? (data.body ? { body: sanitizeBody(data.body) } : undefined),
  });
}

module.exports = { logActivity, activityFromReq, sanitizeBody };
