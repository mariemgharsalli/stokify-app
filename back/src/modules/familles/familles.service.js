const prisma = require("../../config/database");
const { getSocieteWhere, stripSocieteFromBody, requireActiveSocieteId } = require("../../utils/societeScope");
const { normalizeCode } = require("../../utils/codeUtils");

const STATUTS = new Set(["ACTIF", "INACTIF"]);

function parseStatutFilter(statut) {
  const s = String(statut ?? "").trim().toUpperCase();
  if (s === "ACTIF" || s === "INACTIF") return s;
  return null;
}

// ─── FAMILLES ────────────────────────────────────────────────────────────────

async function listFamilles({ user, search, page = 1, limit = 25, statut }) {
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
    prisma.famille.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { nom: "asc" },
      include: { _count: { select: { articles: true, sousFamilles: true } } },
    }),
    prisma.famille.count({ where }),
  ]);
  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

async function getFamille(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  return prisma.famille.findFirst({
    where: { id: Number(id), societeId: sid },
    include: { sousFamilles: { orderBy: { nom: "asc" } } },
  });
}

async function createFamille(data, societeId) {
  const clean = stripSocieteFromBody(data);
  const sid = requireActiveSocieteId(societeId);
  try {
    return await prisma.famille.create({
      data: {
        code: normalizeCode(clean.code),
        nom: String(clean.nom).trim(),
        description: clean.description || null,
        societeId: sid,
      },
    });
  } catch (e) {
    throw e;
  }
}

async function updateFamille(id, data, societeId) {
  const clean = stripSocieteFromBody(data);
  const ex = await prisma.famille.findFirst({
    where: { id: Number(id), societeId: requireActiveSocieteId(societeId) },
  });
  if (!ex) {
    const err = new Error("Famille introuvable");
    err.status = 404;
    throw err;
  }
  try {
    return await prisma.famille.update({
      where: { id: ex.id },
      data: {
        ...(clean.code != null ? { code: normalizeCode(clean.code) } : {}),
        ...(clean.nom != null ? { nom: String(clean.nom).trim() } : {}),
        ...(clean.description !== undefined ? { description: clean.description || null } : {}),
      },
    });
  } catch (e) {
    if (e.code === "P2002") {
      throw e;
    }
    throw e;
  }
}

async function deleteFamille(id, societeId) {
  const ex = await prisma.famille.findFirst({
    where: { id: Number(id), societeId: requireActiveSocieteId(societeId) },
    include: {
      sousFamilles: { select: { id: true } },
      _count: { select: { articles: true, sousFamilles: true } },
    },
  });
  if (!ex) {
    const err = new Error("Famille introuvable");
    err.status = 404;
    throw err;
  }
  const sousIds = ex.sousFamilles.map((s) => s.id);
  await prisma.$transaction(async (tx) => {
    if (sousIds.length > 0) {
      await tx.article.updateMany({
        where: { OR: [{ familleId: ex.id }, { sousFamilleId: { in: sousIds } }] },
        data: { familleId: null, sousFamilleId: null },
      });
      await tx.sousFamille.deleteMany({ where: { id: { in: sousIds } } });
    } else {
      await tx.article.updateMany({
        where: { familleId: ex.id },
        data: { familleId: null },
      });
    }
    await tx.famille.delete({ where: { id: ex.id } });
  });
}

// ─── SOUS-FAMILLES ───────────────────────────────────────────────────────────

async function listSousFamilles({ user, familleId, search, page = 1, limit = 25, statut }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;
  const statutFilter = parseStatutFilter(statut);
  const where = {
    ...getSocieteWhere(user),
    ...(statutFilter ? { statut: statutFilter } : {}),
    ...(familleId ? { familleId: Number(familleId) } : {}),
    ...(search ? { OR: [{ nom: { contains: search } }, { code: { contains: search } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.sousFamille.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { nom: "asc" },
      include: {
        famille: { select: { id: true, code: true, nom: true } },
        _count: { select: { articles: true } },
      },
    }),
    prisma.sousFamille.count({ where }),
  ]);
  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

async function createSousFamille(data, societeId) {
  const clean = stripSocieteFromBody(data);
  const sid = requireActiveSocieteId(societeId);
  const fam = await prisma.famille.findFirst({
    where: { id: Number(clean.familleId), societeId: sid },
  });
  if (!fam) {
    const err = new Error("Famille parente introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.sousFamille.create({
    data: {
      code: normalizeCode(clean.code),
      nom: String(clean.nom).trim(),
      familleId: fam.id,
      societeId: sid,
    },
  });
}

async function updateSousFamille(id, data, societeId) {
  const clean = stripSocieteFromBody(data);
  const sid = requireActiveSocieteId(societeId);
  const ex = await prisma.sousFamille.findFirst({
    where: { id: Number(id), societeId: sid },
  });
  if (!ex) {
    const err = new Error("Sous-famille introuvable");
    err.status = 404;
    throw err;
  }
  if (clean.familleId != null) {
    const fam = await prisma.famille.findFirst({
      where: { id: Number(clean.familleId), societeId: sid },
    });
    if (!fam) {
      const err = new Error("Famille parente introuvable");
      err.status = 404;
      throw err;
    }
  }
  return prisma.sousFamille.update({
    where: { id: ex.id },
    data: {
      ...(clean.code != null ? { code: normalizeCode(clean.code) } : {}),
      ...(clean.nom != null ? { nom: String(clean.nom).trim() } : {}),
      ...(clean.familleId != null ? { familleId: Number(clean.familleId) } : {}),
    },
  });
}

async function deleteSousFamille(id, societeId) {
  const ex = await prisma.sousFamille.findFirst({
    where: { id: Number(id), societeId: requireActiveSocieteId(societeId) },
    include: { _count: { select: { articles: true } } },
  });
  if (!ex) {
    const err = new Error("Sous-famille introuvable");
    err.status = 404;
    throw err;
  }
  await prisma.$transaction(async (tx) => {
    if (ex._count.articles > 0) {
      await tx.article.updateMany({
        where: { sousFamilleId: ex.id },
        data: { sousFamilleId: null },
      });
    }
    await tx.sousFamille.delete({ where: { id: ex.id } });
  });
}

async function setStatutFamille(id, societeId, newStatut) {
  const s = String(newStatut ?? "").trim().toUpperCase();
  if (!STATUTS.has(s)) {
    const err = new Error("Statut invalide");
    err.status = 400;
    throw err;
  }
  const sid = requireActiveSocieteId(societeId);
  const existing = await prisma.famille.findFirst({ where: { id: Number(id), societeId: sid } });
  if (!existing) {
    const err = new Error("Famille introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.famille.update({ where: { id: existing.id }, data: { statut: s } });
}

async function setStatutSousFamille(id, societeId, newStatut) {
  const s = String(newStatut ?? "").trim().toUpperCase();
  if (!STATUTS.has(s)) {
    const err = new Error("Statut invalide");
    err.status = 400;
    throw err;
  }
  const sid = requireActiveSocieteId(societeId);
  const existing = await prisma.sousFamille.findFirst({ where: { id: Number(id), societeId: sid } });
  if (!existing) {
    const err = new Error("Sous-famille introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.sousFamille.update({ where: { id: existing.id }, data: { statut: s } });
}

module.exports = {
  listFamilles, getFamille, createFamille, updateFamille, deleteFamille, setStatutFamille,
  listSousFamilles, createSousFamille, updateSousFamille, deleteSousFamille, setStatutSousFamille,
};
