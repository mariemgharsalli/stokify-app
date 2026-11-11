const prisma = require("../../config/database");
const { getSocieteWhere } = require("../../utils/societeScope");

async function listAlertes(user, { nonLues, limit = 20, page = 1 } = {}) {
  const { societeId } = getSocieteWhere(user);
  const take = Math.min(100, Math.max(1, Number(limit) || 20));
  const pageNum = Math.max(1, Number(page) || 1);
  const skip = (pageNum - 1) * take;

  const where = { societeId };
  if (nonLues === true || nonLues === "true" || nonLues === "1") {
    where.resolue = false;
  }

  const [items, total] = await Promise.all([
    prisma.alerteStock.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        article: { select: { id: true, code: true, libelle: true, imageUrl: true } },
        depot: { select: { id: true, code: true, libelle: true } },
      },
    }),
    prisma.alerteStock.count({ where }),
  ]);

  return {
    items,
    total,
    page: pageNum,
    pages: Math.ceil(total / take) || 1,
    limit: take,
  };
}

async function countAlertesNonResolues(user) {
  const { societeId } = getSocieteWhere(user);
  const count = await prisma.alerteStock.count({
    where: { societeId, resolue: false },
  });
  return { count };
}

async function resoudreAlerte(user, id) {
  const { societeId } = getSocieteWhere(user);
  const alerte = await prisma.alerteStock.findFirst({
    where: { id: Number(id), societeId },
  });
  if (!alerte) {
    const err = new Error("Alerte introuvable");
    err.status = 404;
    throw err;
  }
  if (alerte.resolue) return alerte;

  return prisma.alerteStock.update({
    where: { id: alerte.id },
    data: { resolue: true, resolueAt: new Date() },
    include: {
      article: { select: { id: true, code: true, libelle: true, imageUrl: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
  });
}

async function resoudreToutes(user) {
  const { societeId } = getSocieteWhere(user);
  const result = await prisma.alerteStock.updateMany({
    where: { societeId, resolue: false },
    data: { resolue: true, resolueAt: new Date() },
  });
  return { updated: result.count };
}

module.exports = {
  listAlertes,
  countAlertesNonResolues,
  resoudreAlerte,
  resoudreToutes,
};
