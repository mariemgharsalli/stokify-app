const prisma = require("../../config/database");
const { getSocieteWhere, stripSocieteFromBody, requireActiveSocieteId } = require("../../utils/societeScope");
const { normalizeCode } = require("../../utils/codeUtils");

const STATUTS = new Set(["ACTIF", "INACTIF"]);

function parseStatutFilter(statut) {
  const s = String(statut ?? "").trim().toUpperCase();
  if (s === "ACTIF" || s === "INACTIF") return s;
  return null;
}

async function listMarques({ user, search, page = 1, limit = 25, statut }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;
  const statutFilter = parseStatutFilter(statut);
  const where = {
    ...getSocieteWhere(user),
    ...(statutFilter ? { statut: statutFilter } : {}),
    ...(search ? { OR: [{ nom: { contains: search } }, { code: { contains: search } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.marque.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { nom: "asc" },
      include: { _count: { select: { articles: true } } },
    }),
    prisma.marque.count({ where }),
  ]);
  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

async function getMarque(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  return prisma.marque.findFirst({
    where: { id: Number(id), societeId: sid },
  });
}

async function createMarque(data, societeId) {
  const clean = stripSocieteFromBody(data);
  const sid = requireActiveSocieteId(societeId);
  return prisma.marque.create({
    data: {
      code: normalizeCode(clean.code),
      nom: String(clean.nom).trim(),
      ...(clean.imageUrl != null ? { imageUrl: clean.imageUrl ? String(clean.imageUrl).trim() : null } : {}),
      societeId: sid,
    },
  });
}

async function updateMarque(id, data, societeId) {
  const clean = stripSocieteFromBody(data);
  const ex = await getMarque(id, societeId);
  if (!ex) {
    const err = new Error("Marque introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.marque.update({
    where: { id: ex.id },
    data: {
      ...(clean.code != null ? { code: normalizeCode(clean.code) } : {}),
      ...(clean.nom != null ? { nom: String(clean.nom).trim() } : {}),
      ...(clean.imageUrl !== undefined ? { imageUrl: clean.imageUrl ? String(clean.imageUrl).trim() : null } : {}),
    },
  });
}

async function deleteMarque(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const ex = await prisma.marque.findFirst({
    where: { id: Number(id), societeId: sid },
    include: { _count: { select: { articles: true } } },
  });
  if (!ex) {
    const err = new Error("Marque introuvable");
    err.status = 404;
    throw err;
  }
  if (ex._count.articles > 0) {
    const err = new Error("Impossible de supprimer : articles lies");
    err.status = 409;
    throw err;
  }
  await prisma.marque.delete({ where: { id: ex.id } });
}

async function setStatutMarque(id, societeId, newStatut) {
  const s = String(newStatut ?? "").trim().toUpperCase();
  if (!STATUTS.has(s)) {
    const err = new Error("Statut invalide");
    err.status = 400;
    throw err;
  }
  const sid = requireActiveSocieteId(societeId);
  const existing = await prisma.marque.findFirst({ where: { id: Number(id), societeId: sid } });
  if (!existing) {
    const err = new Error("Marque introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.marque.update({ where: { id: existing.id }, data: { statut: s } });
}

module.exports = { listMarques, getMarque, createMarque, updateMarque, deleteMarque, setStatutMarque };
