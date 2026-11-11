const prisma = require("../../config/database");

function societeFilter(sid) {
  return { societeId: Number(sid) };
}

async function listGroupes({ societeId, search }) {
  const where = {
    ...societeFilter(societeId),
    ...(search ? { OR: [{ nom: { contains: search } }, { code: { contains: search } }] } : {}),
  };
  return prisma.groupe.findMany({
    where,
    orderBy: { nom: "asc" },
    include: { _count: { select: { articles: true } } },
  });
}

async function getGroupe(id, societeId) {
  return prisma.groupe.findFirst({
    where: { id: Number(id), ...societeFilter(societeId) },
  });
}

async function createGroupe(data, societeId) {
  try {
    return await prisma.groupe.create({
      data: {
        code: String(data.code).trim(),
        nom: String(data.nom).trim(),
        description: data.description || null,
        societeId: Number(societeId),
      },
    });
  } catch (e) {
    if (e.code === "P2002") {
      const err = new Error("Code groupe deja utilise pour cette societe");
      err.status = 409;
      throw err;
    }
    throw e;
  }
}

async function updateGroupe(id, data, societeId) {
  const ex = await getGroupe(id, societeId);
  if (!ex) {
    const err = new Error("Groupe introuvable");
    err.status = 404;
    throw err;
  }
  try {
    return await prisma.groupe.update({
      where: { id: ex.id },
      data: {
        ...(data.code != null ? { code: String(data.code).trim() } : {}),
        ...(data.nom != null ? { nom: String(data.nom).trim() } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
      },
    });
  } catch (e) {
    if (e.code === "P2002") {
      const err = new Error("Code groupe deja utilise pour cette societe");
      err.status = 409;
      throw err;
    }
    throw e;
  }
}

async function deleteGroupe(id, societeId) {
  const ex = await prisma.groupe.findFirst({
    where: { id: Number(id), ...societeFilter(societeId) },
    include: { _count: { select: { articles: true } } },
  });
  if (!ex) {
    const err = new Error("Groupe introuvable");
    err.status = 404;
    throw err;
  }
  if (ex._count.articles > 0) {
    const err = new Error("Impossible de supprimer : articles lies");
    err.status = 409;
    throw err;
  }
  await prisma.groupe.delete({ where: { id: ex.id } });
}

module.exports = { listGroupes, getGroupe, createGroupe, updateGroupe, deleteGroupe };
