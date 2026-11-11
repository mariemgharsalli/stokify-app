const prisma = require("../config/database");

/**
 * Enregistre une entrée dans le journal d'audit (AuditLog).
 */
async function logAudit({
  userId,
  societeId,
  entityType,
  entityId,
  action,
  oldValue = null,
  newValue = null,
}) {
  if (!userId || !societeId) return null;
  const serialize = (v) => {
    if (v == null) return null;
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };
  return prisma.auditLog.create({
    data: {
      userId: Number(userId),
      societeId: Number(societeId),
      entityType: String(entityType),
      entityId: Number(entityId),
      action: String(action),
      oldValue: serialize(oldValue),
      newValue: serialize(newValue),
    },
  });
}

module.exports = { logAudit };
