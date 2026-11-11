const prisma = require("../../config/database");
const { getSocieteWhere, stripSocieteFromBody, requireActiveSocieteId } = require("../../utils/societeScope");
const { normalizeCode } = require("../../utils/codeUtils");

async function listVehicules({ user, search, page = 1, limit = 50, actifOnly = true }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;
  const where = {
    ...getSocieteWhere(user),
    ...(actifOnly !== false && actifOnly !== "false" ? { actif: true } : {}),
    ...(search
      ? {
          OR: [
            { nom: { contains: search } },
            { immatriculation: { contains: search } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.vehicule.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { nom: "asc" },
    }),
    prisma.vehicule.count({ where }),
  ]);
  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

async function getVehicule(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  return prisma.vehicule.findFirst({
    where: { id: Number(id), societeId: sid },
  });
}

async function createVehicule(data, societeId) {
  const clean = stripSocieteFromBody(data);
  const sid = requireActiveSocieteId(societeId);
  const capacitePoids = Number(clean.capacitePoids);
  const capaciteVolume = Number(clean.capaciteVolume);
  if (!clean.nom?.trim()) {
    const err = new Error("Nom du vehicule requis");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(capacitePoids) || capacitePoids <= 0) {
    const err = new Error("Capacite poids invalide");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(capaciteVolume) || capaciteVolume <= 0) {
    const err = new Error("Capacite volume invalide");
    err.status = 400;
    throw err;
  }
  return prisma.vehicule.create({
    data: {
      nom: String(clean.nom).trim(),
      immatriculation: clean.immatriculation ? normalizeCode(clean.immatriculation) : null,
      capacitePoids,
      capaciteVolume,
      actif: clean.actif !== false,
      societeId: sid,
    },
  });
}

async function updateVehicule(id, data, societeId) {
  const clean = stripSocieteFromBody(data);
  const ex = await getVehicule(id, societeId);
  if (!ex) {
    const err = new Error("Vehicule introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.vehicule.update({
    where: { id: ex.id },
    data: {
      ...(clean.nom != null ? { nom: String(clean.nom).trim() } : {}),
      ...(clean.immatriculation !== undefined
        ? { immatriculation: clean.immatriculation ? normalizeCode(clean.immatriculation) : null }
        : {}),
      ...(clean.capacitePoids != null ? { capacitePoids: Number(clean.capacitePoids) } : {}),
      ...(clean.capaciteVolume != null ? { capaciteVolume: Number(clean.capaciteVolume) } : {}),
      ...(clean.actif !== undefined ? { actif: Boolean(clean.actif) } : {}),
    },
  });
}

async function deleteVehicule(id, societeId) {
  const ex = await getVehicule(id, societeId);
  if (!ex) {
    const err = new Error("Vehicule introuvable");
    err.status = 404;
    throw err;
  }
  await prisma.vehicule.update({
    where: { id: ex.id },
    data: { actif: false },
  });
}

module.exports = { listVehicules, getVehicule, createVehicule, updateVehicule, deleteVehicule };
