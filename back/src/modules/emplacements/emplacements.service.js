const prisma = require("../../config/database");
const { requireActiveSocieteId } = require("../../utils/societeScope");
const { mapEmplacementWithStock } = require("../depots/depots.service");
const { buildWarehouseLayout } = require("../../utils/warehouseLayout");
const { isActifStatut } = require("../../utils/warehouseOps");

function parseStatutFilter(statut) {
  const s = String(statut ?? "").trim().toUpperCase();
  if (s === "ACTIF" || s === "INACTIF") return s;
  return null;
}

async function assertDepotSociete(depotId, societeId) {
  const depot = await prisma.depot.findFirst({
    where: { id: Number(depotId), societeId: Number(societeId) },
  });
  if (!depot) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }
  return depot;
}

async function listByDepot(depotId, societeId, statut) {
  await assertDepotSociete(depotId, societeId);
  const statutFilter = parseStatutFilter(statut);
  const items = await prisma.emplacement.findMany({
    where: {
      depotId: Number(depotId),
      ...(statutFilter ? { statut: statutFilter } : {}),
    },
    orderBy: { code: "asc" },
    include: {
      stocks: {
        where: { quantite: { gt: 0 } },
        select: {
          id: true,
          quantite: true,
          articleId: true,
          article: {
            select: { id: true, code: true, libelle: true, familleId: true, poids: true, volume: true },
          },
        },
      },
    },
  });
  const occupancy = items.map((e) => mapEmplacementWithStock(e));
  const layout = buildWarehouseLayout(occupancy);
  return occupancy.map((e) => mapEmplacementWithStock(e, layout));
}

async function createEmplacement(data, societeId) {
  const depot = await assertDepotSociete(data.depotId, societeId);
  if (!isActifStatut(depot)) {
    const err = new Error(
      `Le dépôt « ${depot.libelle || depot.code} » est inactif. Réactivez-le avant d'y créer un emplacement.`
    );
    err.status = 409;
    err.code = "DEPOT_INACTIF";
    throw err;
  }
  try {
    return await prisma.emplacement.create({
      data: {
        code: String(data.code).trim(),
        libelle: String(data.libelle).trim(),
        categorie: data.categorie || null,
        barcode: data.barcode || null,
        niveaux: data.niveaux != null ? Number(data.niveaux) : null,
        zoneDangereuse: Boolean(data.zoneDangereuse),
        categorieAutorisee: data.categorieAutorisee || null,
        distanceQuai: data.distanceQuai != null ? Number(data.distanceQuai) : 50,
        capaciteSlots: data.capaciteSlots != null ? Number(data.capaciteSlots) : null,
        depotId: Number(data.depotId),
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      const err = new Error("Ce code existe déjà dans ce dépôt");
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

async function updateEmplacement(id, data, societeId) {
  const existing = await prisma.emplacement.findFirst({
    where: { id: Number(id) },
    include: { depot: true },
  });
  if (!existing || existing.depot.societeId !== Number(societeId)) {
    const err = new Error("Emplacement introuvable");
    err.status = 404;
    throw err;
  }
  try {
    return await prisma.emplacement.update({
      where: { id: existing.id },
      data: {
        ...(data.code != null ? { code: String(data.code).trim() } : {}),
        ...(data.libelle != null ? { libelle: String(data.libelle).trim() } : {}),
        ...(data.categorie !== undefined ? { categorie: data.categorie || null } : {}),
        ...(data.barcode !== undefined ? { barcode: data.barcode || null } : {}),
        ...(data.niveaux !== undefined ? { niveaux: data.niveaux != null ? Number(data.niveaux) : null } : {}),
        ...(data.zoneDangereuse !== undefined ? { zoneDangereuse: Boolean(data.zoneDangereuse) } : {}),
        ...(data.categorieAutorisee !== undefined ? { categorieAutorisee: data.categorieAutorisee || null } : {}),
        ...(data.distanceQuai !== undefined
          ? { distanceQuai: data.distanceQuai != null ? Number(data.distanceQuai) : 50 }
          : {}),
        ...(data.capaciteSlots !== undefined
          ? { capaciteSlots: data.capaciteSlots != null ? Number(data.capaciteSlots) : null }
          : {}),
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      const err = new Error("Ce code existe déjà dans ce dépôt");
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

async function deleteEmplacement(id, societeId) {
  const existing = await prisma.emplacement.findFirst({
    where: { id: Number(id) },
    include: { depot: true, _count: { select: { stocks: true } } },
  });
  if (!existing || existing.depot.societeId !== Number(societeId)) {
    const err = new Error("Emplacement introuvable");
    err.status = 404;
    throw err;
  }
  if (isActifStatut(existing)) {
    const err = new Error("Désactivez l'emplacement avant de le supprimer définitivement");
    err.status = 409;
    err.code = "EMPLACEMENT_STILL_ACTIF";
    throw err;
  }
  if (existing._count.stocks > 0) {
    const stocks = await prisma.stock.findMany({
      where: { emplacementId: existing.id, quantite: { gt: 0 } },
      include: { article: { select: { code: true, libelle: true } } },
      take: 20,
    });
    const err = new Error("Impossible de supprimer : du stock est present sur cet emplacement");
    err.status = 409;
    err.code = "EMPLACEMENT_HAS_STOCK";
    err.details = {
      articles: stocks.map((s) => ({
        code: s.article?.code,
        libelle: s.article?.libelle,
        quantite: s.quantite,
      })),
    };
    throw err;
  }
  await prisma.emplacement.delete({ where: { id: existing.id } });
}

const STATUTS_EMPLACEMENT = new Set(["ACTIF", "INACTIF"]);

async function setStatutEmplacement(id, societeId, newStatut) {
  const s = String(newStatut ?? "").trim().toUpperCase();
  if (!STATUTS_EMPLACEMENT.has(s)) {
    const err = new Error("Statut invalide (ACTIF ou INACTIF)");
    err.status = 400;
    throw err;
  }
  const sid = requireActiveSocieteId(societeId);
  const existing = await prisma.emplacement.findFirst({
    where: { id: Number(id) },
    include: { depot: true },
  });
  if (!existing || existing.depot.societeId !== sid) {
    const err = new Error("Emplacement introuvable");
    err.status = 404;
    throw err;
  }

  return prisma.emplacement.update({ where: { id: existing.id }, data: { statut: s } });
}

module.exports = {
  listByDepot,
  createEmplacement,
  updateEmplacement,
  deleteEmplacement,
  setStatutEmplacement,
};
