const prisma = require("../../config/database");

function buildWhere(query, baseWhere = {}) {
  const { module, action, from, to } = query;
  const where = { ...baseWhere };

  if (module) where.module = String(module).toLowerCase();
  if (action) where.action = String(action).toUpperCase();

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  return where;
}

function serializeLog(log) {
  return {
    id: log.id,
    userId: log.userId,
    action: log.action,
    module: log.module,
    entity: log.entity,
    entityId: log.entityId,
    entityLabel: log.entityLabel,
    details: log.details,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    status: log.status,
    errorMsg: log.errorMsg,
    societeId: log.societeId,
    createdAt: log.createdAt,
    societe: log.societe,
    user: log.user
      ? {
          id: log.user.id,
          prenom: log.user.prenom,
          nom: log.user.nom,
          email: log.user.email,
        }
      : undefined,
  };
}

async function getUserActivity(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const where = buildWhere(req.query, { userId: id });

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          societe: { select: { nom: true } },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      logs: logs.map(serializeLog),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
}

async function getGlobalActivity(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const where = buildWhere(req.query);

    if (req.user.role !== "SUPER_ADMIN" && req.user.societeId) {
      where.societeId = req.user.societeId;
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          societe: { select: { nom: true } },
          user: { select: { id: true, prenom: true, nom: true, email: true } },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      logs: logs.map(serializeLog),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getUserActivity, getGlobalActivity };
