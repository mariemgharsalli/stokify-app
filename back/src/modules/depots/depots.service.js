const prisma = require("../../config/database");
const { getSocieteWhere, stripSocieteFromBody, requireActiveSocieteId } = require("../../utils/societeScope");
const { normalizeCode } = require("../../utils/codeUtils");
const { isActifStatut } = require("../../utils/warehouseOps");
const {
  round1,
  mapEmplacementOccupancy,
  buildWarehouseLayout,
  attachLayoutToEmplacement,
  computePhysicalOccupancy,
  pctOrNull,
} = require("../../utils/warehouseLayout");

function parseCoord(val) {
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

const EMPLACEMENT_STOCK_SELECT = {
  where: { quantite: { gt: 0 } },
  select: {
    id: true,
    quantite: true,
    articleId: true,
    article: {
      select: {
        id: true,
        code: true,
        libelle: true,
        familleId: true,
        poids: true,
        volume: true,
      },
    },
  },
};

function mapEmplacementWithStock(e, layout) {
  const mapped = mapEmplacementOccupancy(e);
  return layout ? attachLayoutToEmplacement(mapped, layout) : mapped;
}

function storageFlagsFromDepot(d) {
  return {
    storageRefrigere: Boolean(d.storageRefrigere),
    storageChimique: Boolean(d.storageChimique),
    storageInflammable: Boolean(d.storageInflammable),
    storageFragile: Boolean(d.storageFragile),
  };
}

function mapDepotWithSummary(d) {
  const rawEmps = d.emplacements || [];
  const occupancy = rawEmps.map((e) => mapEmplacementOccupancy(e));
  const layout = buildWarehouseLayout(occupancy);
  const emplacements = occupancy.map((e) => attachLayoutToEmplacement(e, layout));
  const capaciteEmplacements = emplacements.reduce((s, e) => s + e.capaciteUnites, 0);
  const stockTotal = emplacements.reduce((s, e) => s + e.stockActuel, 0);
  const depotCap = d.capacite != null && Number(d.capacite) > 0 ? Number(d.capacite) : 0;
  const baseCap = depotCap > 0 ? depotCap : capaciteEmplacements || 1;
  const remplissagePct = Math.min(100, round1((stockTotal / baseCap) * 100));
  const nbArticles = new Set(
    (d.stocks || []).filter((x) => Number(x.quantite) > 0).map((x) => x.articleId)
  ).size;
  const physical = computePhysicalOccupancy(d.stocks || []);
  return {
    id: d.id,
    code: d.code,
    libelle: d.libelle,
    adresse: d.adresse,
    ville: d.ville,
    region: d.region,
    capacite: d.capacite,
    qteMin: d.qteMin,
    qteMax: d.qteMax,
    capaciteVolume: d.capaciteVolume ?? null,
    capacitePoids: d.capacitePoids ?? null,
    latitude: d.latitude,
    longitude: d.longitude,
    societeId: d.societeId,
    statut: d.statut ?? "ACTIF",
    ...storageFlagsFromDepot(d),
    emplacements,
    layout: {
      mode: layout.mode,
      cols: layout.cols,
      rows: layout.rows,
      aisles: layout.aisles,
      allees: layout.allees,
      dock: layout.dock,
      zones: layout.zones,
      heatmap: layout.heatmap,
      cells: layout.cells || [],
    },
    stockSummary: {
      nbEmplacements: emplacements.length,
      capaciteTotale: round1(baseCap),
      capaciteEmplacements: round1(capaciteEmplacements),
      stockTotal: round1(stockTotal),
      remplissagePct,
      nbArticles,
      poidsOccupe: physical.poids,
      volumeOccupe: physical.volume,
      remplissagePoidsPct: pctOrNull(physical.poids, d.capacitePoids),
      remplissageVolumePct: pctOrNull(physical.volume, d.capaciteVolume),
    },
  };
}

async function listDepotsEnriched({ user, search }) {
  const where = {
    ...getSocieteWhere(user),
    ...(search
      ? {
          OR: [
            { libelle: { contains: search } },
            { code: { contains: search } },
            { ville: { contains: search } },
            { adresse: { contains: search } },
            { emplacements: { some: { OR: [{ code: { contains: search } }, { libelle: { contains: search } }] } } },
          ],
        }
      : {}),
  };

  const depots = await prisma.depot.findMany({
    where,
    orderBy: { libelle: "asc" },
    include: {
      emplacements: {
        orderBy: { code: "asc" },
        include: { stocks: EMPLACEMENT_STOCK_SELECT },
      },
      stocks: {
        where: { quantite: { gt: 0 } },
        select: {
          quantite: true,
          articleId: true,
          article: { select: { poids: true, volume: true } },
        },
      },
    },
  });

  const items = depots.map(mapDepotWithSummary);
  const totals = items.reduce(
    (acc, d) => {
      acc.nbDepots += 1;
      acc.nbEmplacements += d.stockSummary.nbEmplacements;
      acc.nbArticles += d.stockSummary.nbArticles;
      acc.remplissageSum += d.stockSummary.remplissagePct;
      return acc;
    },
    { nbDepots: 0, nbEmplacements: 0, nbArticles: 0, remplissageSum: 0 }
  );

  const allArticleIds = new Set();
  for (const d of depots) {
    for (const s of d.stocks || []) {
      if (Number(s.quantite) > 0) allArticleIds.add(s.articleId);
    }
  }

  return {
    items,
    global: {
      nbDepots: totals.nbDepots,
      nbEmplacements: totals.nbEmplacements,
      nbArticlesDistinct: allArticleIds.size,
      capaciteUtiliseePct:
        totals.nbDepots > 0 ? round1(totals.remplissageSum / totals.nbDepots) : 0,
    },
  };
}

async function getDepotStats(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const depot = await prisma.depot.findFirst({
    where: { id: Number(id), societeId: sid },
    include: {
      emplacements: {
        orderBy: { code: "asc" },
        include: { stocks: EMPLACEMENT_STOCK_SELECT },
      },
      stocks: {
        where: { quantite: { gt: 0 } },
        select: {
          quantite: true,
          articleId: true,
          article: { select: { poids: true, volume: true } },
        },
      },
    },
  });
  if (!depot) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }

  const mapped = mapDepotWithSummary(depot);
  const articlesParEmplacement = mapped.emplacements.map((e) => ({
    code: e.code,
    libelle: e.libelle,
    nbArticles: e.nbArticles,
    stockActuel: e.stockActuel,
  }));

  const derniersMouvements = await prisma.mouvement.findMany({
    where: { depotId: Number(id) },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      article: { select: { code: true, libelle: true } },
      utilisateur: { select: { nom: true, prenom: true, email: true } },
    },
  });

  return {
    ...mapped.stockSummary,
    heatmap: mapped.layout?.heatmap || null,
    zones: mapped.layout?.zones || [],
    poidsTotal: depot.capacitePoids != null ? Number(depot.capacitePoids) : null,
    volumeTotal: depot.capaciteVolume != null ? Number(depot.capaciteVolume) : null,
    capaciteM2: depot.capacite != null ? Number(depot.capacite) : null,
    poidsOccupe: mapped.stockSummary.poidsOccupe,
    volumeOccupe: mapped.stockSummary.volumeOccupe,
    remplissagePoidsPct: mapped.stockSummary.remplissagePoidsPct,
    remplissageVolumePct: mapped.stockSummary.remplissageVolumePct,
    storageRefrigere: mapped.storageRefrigere,
    storageChimique: mapped.storageChimique,
    storageInflammable: mapped.storageInflammable,
    storageFragile: mapped.storageFragile,
    articlesParEmplacement,
    derniersMouvements: derniersMouvements.map((m) => ({
      id: m.id,
      reference: m.reference,
      type: m.type,
      quantite: m.quantite,
      createdAt: m.createdAt,
      article: m.article,
      utilisateur: m.utilisateur,
    })),
  };
}

async function getDepotDeleteBlockers(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const depot = await prisma.depot.findFirst({
    where: { id: Number(id), societeId: sid },
    include: {
      emplacements: {
        include: {
          stocks: {
            where: { quantite: { gt: 0 } },
            include: { article: { select: { code: true, libelle: true } } },
          },
        },
      },
      stocks: {
        where: { quantite: { gt: 0 } },
        include: { article: { select: { code: true, libelle: true } } },
      },
    },
  });
  if (!depot) return null;
  const articles = [];
  for (const e of depot.emplacements) {
    for (const s of e.stocks) {
      articles.push({
        emplacement: e.code,
        code: s.article?.code,
        libelle: s.article?.libelle,
        quantite: s.quantite,
      });
    }
  }
  for (const s of depot.stocks) {
    if (!s.emplacementId) {
      articles.push({
        emplacement: null,
        code: s.article?.code,
        libelle: s.article?.libelle,
        quantite: s.quantite,
      });
    }
  }
  return {
    nbEmplacements: depot.emplacements.length,
    articles: articles.slice(0, 20),
  };
}

function parseStatutFilter(statut) {
  const s = String(statut ?? "").trim().toUpperCase();
  if (s === "ACTIF" || s === "INACTIF") return s;
  return null;
}

async function listDepots({ user, search, page = 1, limit = 25, statut }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;
  const statutFilter = parseStatutFilter(statut);

  const where = {
    ...getSocieteWhere(user),
    ...(statutFilter ? { statut: statutFilter } : {}),
    ...(search
      ? {
          OR: [{ libelle: { contains: search } }, { code: { contains: search } }],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.depot.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { id: "desc" },
      include: { _count: { select: { emplacements: true, stocks: true } } },
    }),
    prisma.depot.count({ where }),
  ]);

  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

async function getDepot(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  return prisma.depot.findFirst({
    where: { id: Number(id), societeId: sid },
    include: {
      emplacements: { orderBy: { code: "asc" } },
    },
  });
}

async function createDepot(data, societeId) {
  const clean = stripSocieteFromBody(data);
  const sid = requireActiveSocieteId(societeId);
  return prisma.depot.create({
    data: {
      code: normalizeCode(clean.code),
      libelle: String(clean.libelle).trim(),
      adresse: clean.adresse || null,
      ville: clean.ville || null,
      region: clean.region || null,
      capacite: clean.capacite != null ? Number(clean.capacite) : null,
      qteMin: clean.qteMin != null ? Number(clean.qteMin) : null,
      qteMax: clean.qteMax != null ? Number(clean.qteMax) : null,
      capaciteVolume: clean.capaciteVolume != null && clean.capaciteVolume !== "" ? Number(clean.capaciteVolume) : null,
      capacitePoids: clean.capacitePoids != null && clean.capacitePoids !== "" ? Number(clean.capacitePoids) : null,
      latitude: parseCoord(clean.latitude),
      longitude: parseCoord(clean.longitude),
      storageRefrigere: Boolean(clean.storageRefrigere),
      storageChimique: Boolean(clean.storageChimique),
      storageInflammable: Boolean(clean.storageInflammable),
      storageFragile: Boolean(clean.storageFragile),
      societeId: sid,
    },
  });
}

async function updateDepot(id, data, societeId) {
  const clean = stripSocieteFromBody(data);
  const existing = await getDepot(id, societeId);
  if (!existing) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.depot.update({
    where: { id: existing.id },
    data: {
      ...(clean.code != null ? { code: normalizeCode(clean.code) } : {}),
      ...(clean.libelle != null ? { libelle: String(clean.libelle).trim() } : {}),
      ...(clean.adresse !== undefined ? { adresse: clean.adresse || null } : {}),
      ...(clean.ville !== undefined ? { ville: clean.ville || null } : {}),
      ...(clean.region !== undefined ? { region: clean.region || null } : {}),
      ...(clean.capacite !== undefined ? { capacite: clean.capacite != null ? Number(clean.capacite) : null } : {}),
      ...(clean.qteMin !== undefined ? { qteMin: clean.qteMin != null ? Number(clean.qteMin) : null } : {}),
      ...(clean.qteMax !== undefined ? { qteMax: clean.qteMax != null ? Number(clean.qteMax) : null } : {}),
      ...(clean.capaciteVolume !== undefined
        ? { capaciteVolume: clean.capaciteVolume != null && clean.capaciteVolume !== "" ? Number(clean.capaciteVolume) : null }
        : {}),
      ...(clean.capacitePoids !== undefined
        ? { capacitePoids: clean.capacitePoids != null && clean.capacitePoids !== "" ? Number(clean.capacitePoids) : null }
        : {}),
      ...(clean.latitude !== undefined ? { latitude: parseCoord(clean.latitude) } : {}),
      ...(clean.longitude !== undefined ? { longitude: parseCoord(clean.longitude) } : {}),
      ...(clean.storageRefrigere !== undefined ? { storageRefrigere: Boolean(clean.storageRefrigere) } : {}),
      ...(clean.storageChimique !== undefined ? { storageChimique: Boolean(clean.storageChimique) } : {}),
      ...(clean.storageInflammable !== undefined ? { storageInflammable: Boolean(clean.storageInflammable) } : {}),
      ...(clean.storageFragile !== undefined ? { storageFragile: Boolean(clean.storageFragile) } : {}),
    },
  });
}

const STATUTS_DEPOT = new Set(["ACTIF", "INACTIF"]);

async function setStatutDepot(id, societeId, newStatut) {
  const s = String(newStatut ?? "").trim().toUpperCase();
  if (!STATUTS_DEPOT.has(s)) {
    const err = new Error("Statut invalide (ACTIF ou INACTIF)");
    err.status = 400;
    throw err;
  }
  const sid = requireActiveSocieteId(societeId);
  const existing = await prisma.depot.findFirst({ where: { id: Number(id), societeId: sid } });
  if (!existing) {
    const err = new Error("Dépôt introuvable");
    err.status = 404;
    throw err;
  }

  return prisma.depot.update({ where: { id: existing.id }, data: { statut: s } });
}

async function deleteDepot(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const existing = await prisma.depot.findFirst({
    where: { id: Number(id), societeId: sid },
    include: { _count: { select: { stocks: true, emplacements: true } } },
  });
  if (!existing) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }
  if (isActifStatut(existing)) {
    const err = new Error("Désactivez le dépôt avant de le supprimer définitivement");
    err.status = 409;
    err.code = "DEPOT_STILL_ACTIF";
    throw err;
  }
  if (existing._count.emplacements > 0) {
    const err = new Error(
      `Impossible de supprimer : ${existing._count.emplacements} emplacement(s) encore rattache(s) a ce depot`
    );
    err.status = 409;
    err.code = "DEPOT_HAS_EMPLACEMENTS";
    throw err;
  }
  if (existing._count.stocks > 0) {
    const blockers = await getDepotDeleteBlockers(id, societeId);
    const err = new Error("Impossible de supprimer : du stock est encore present sur ce depot");
    err.status = 409;
    err.code = "DEPOT_HAS_STOCK";
    err.details = blockers;
    throw err;
  }
  await prisma.depot.delete({ where: { id: existing.id } });
}

function getAlertThreshold(article) {
  if (article?.seuilAlerte != null && article.seuilAlerte !== "") return Number(article.seuilAlerte);
  if (article?.stockMin != null && article.stockMin !== "") return Number(article.stockMin);
  return null;
}

async function getDepotsWithStockSummary(user) {
  const sid = requireActiveSocieteId(user.societeId);
  const depots = await prisma.depot.findMany({
    where: { societeId: sid },
    include: {
      stocks: {
        include: {
          article: { select: { id: true, prixAchat: true, stockMin: true, seuilAlerte: true } },
        },
      },
    },
  });

  return depots.map((d) => {
    let valeurStock = 0;
    let ruptures = 0;
    let critiques = 0;
    const articleIds = new Set();

    for (const s of d.stocks || []) {
      const q = Number(s.quantite) || 0;
      if (q > 0 && s.articleId) articleIds.add(s.articleId);
      valeurStock += q * Number(s.article?.prixAchat || 0);
      const threshold = getAlertThreshold(s.article);
      if (q <= 0) ruptures += 1;
      else if (threshold != null && q <= threshold) critiques += 1;
    }

    let health = "green";
    if (ruptures > 0) health = "red";
    else if (critiques > 0) health = "amber";

    return {
      id: d.id,
      code: d.code,
      libelle: d.libelle,
      region: d.region,
      ville: d.ville,
      latitude: d.latitude,
      longitude: d.longitude,
      totalArticles: articleIds.size,
      valeurStock: Math.round(valeurStock * 100) / 100,
      ruptures,
      critiques,
      health,
    };
  });
}

async function getDepotLayout(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const depot = await prisma.depot.findFirst({
    where: { id: Number(id), societeId: sid },
    include: {
      emplacements: {
        orderBy: { code: "asc" },
        include: { stocks: EMPLACEMENT_STOCK_SELECT },
      },
      stocks: {
        where: { quantite: { gt: 0 } },
        select: {
          quantite: true,
          articleId: true,
          article: { select: { poids: true, volume: true } },
        },
      },
    },
  });
  if (!depot) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }
  const mapped = mapDepotWithSummary(depot);
  return {
    depot: {
      id: mapped.id,
      code: mapped.code,
      libelle: mapped.libelle,
      statut: mapped.statut,
      ville: mapped.ville,
      region: mapped.region,
      capacite: mapped.capacite,
      capaciteVolume: mapped.capaciteVolume,
      capacitePoids: mapped.capacitePoids,
      ...storageFlagsFromDepot(mapped),
    },
    summary: mapped.stockSummary,
    layout: mapped.layout,
    emplacements: mapped.emplacements,
  };
}

module.exports = {
  listDepots,
  listDepotsEnriched,
  getDepot,
  getDepotStats,
  getDepotLayout,
  getDepotDeleteBlockers,
  createDepot,
  updateDepot,
  deleteDepot,
  setStatutDepot,
  getDepotsWithStockSummary,
  mapEmplacementWithStock,
};
