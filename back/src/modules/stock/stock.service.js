const prisma = require("../../config/database");
const { getSocieteWhere, requireActiveSocieteId } = require("../../utils/societeScope");
const { logAudit } = require("../../utils/auditLogger");
const { checkEmplacementCompatibility } = require("../../utils/emplacementCompatibility");
const { getAlertThreshold, syncAlerteStockAfterQtyChange } = require("../../utils/stockAlertUtils");
const slottingService = require("./slotting.service");
const { emplacementCapaciteUnits } = require("../../utils/warehouseLayout");
const { assertDepotOperable, assertEmplacementOperable } = require("../../utils/warehouseOps");
const { aiFetch, AiBusyError, isAiBusy } = require("../../utils/aiClient");

async function getStock({ user, depotId, articleId, emplacementId, statut, search, page = 1, limit = 25 }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(5000, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;

  const articleWhere = { ...getSocieteWhere(user) };
  if (search) {
    const q = String(search).trim();
    articleWhere.OR = [{ libelle: { contains: q } }, { code: { contains: q } }];
  }

  const hasDepotFilter = depotId != null && String(depotId).trim() !== "";
  const where = {
    article: articleWhere,
    ...(hasDepotFilter
      ? Number(depotId) > 0
        ? { depotId: Number(depotId) }
        : { depotId: -1 }
      : {}),
    ...(articleId ? { articleId: Number(articleId) } : {}),
    ...(emplacementId ? { emplacementId: Number(emplacementId) } : {}),
    ...(statut ? { statut: String(statut).trim() } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.stock.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        article: {
          select: {
            id: true,
            code: true,
            libelle: true,
            unite: true,
            stockMin: true,
            stockMax: true,
            seuilAlerte: true,
            modeGestion: true,
            modeTracage: true,
            tracageAuto: true,
            prixAchat: true,
            imageUrl: true,
            famille: { select: { id: true, nom: true } },
            familleId: true,
          },
        },
        depot: { select: { code: true, libelle: true } },
        emplacement: { select: { code: true, libelle: true } },
      },
      orderBy: { id: "desc" },
    }),
    prisma.stock.count({ where }),
  ]);

  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

async function getStockLine(id, user) {
  return prisma.stock.findFirst({
    where: {
      id: Number(id),
      article: { ...getSocieteWhere(user) },
    },
    include: {
      article: {
        select: {
          id: true,
          code: true,
          libelle: true,
          unite: true,
          imageUrl: true,
          famille: { select: { id: true, nom: true } },
        },
      },
      depot: { select: { id: true, code: true, libelle: true } },
      emplacement: { select: { id: true, code: true, libelle: true } },
    },
  });
}

/** Export CSV — toutes les lignes stock de la société (plafonné). */
async function listStockRowsForExport(user, { limit = 5000 } = {}) {
  const takeNum = Math.min(5000, Math.max(1, Number(limit) || 5000));
  const where = {
    article: { ...getSocieteWhere(user) },
  };
  return prisma.stock.findMany({
    where,
    take: takeNum,
    include: {
      article: { select: { code: true, libelle: true, unite: true } },
      depot: { select: { code: true, libelle: true } },
    },
    orderBy: [{ depotId: "asc" }, { articleId: "asc" }],
  });
}

async function getStockAlerts(user) {
  const { societeId } = getSocieteWhere(user);
  const stocks = await prisma.stock.findMany({
    where: { article: { societeId } },
    include: { article: true, depot: true },
  });

  return stocks
    .map((s) => {
      const seuil = getAlertThreshold(s.article) ?? 0;
      const quantite = Number(s.quantite);
      let statut = "OK";
      if (quantite <= 0) statut = "RUPTURE";
      else if (quantite <= seuil) statut = "CRITIQUE";

      return {
        articleId: s.articleId,
        depotId: s.depotId,
        code: s.article.code,
        libelle: s.article.libelle,
        imageUrl: s.article.imageUrl || null,
        prixAchat: s.article.prixAchat ?? null,
        unite: s.article.unite || null,
        quantite,
        seuil,
        statut,
        depot: s.depot ? { id: s.depot.id, code: s.depot.code, libelle: s.depot.libelle } : null,
      };
    })
    .filter((s) => s.statut !== "OK");
}

async function assertArticleDepot(societeId, articleId, depotId) {
  const sid = requireActiveSocieteId(societeId);
  const [article, depot] = await Promise.all([
    prisma.article.findFirst({ where: { id: Number(articleId), societeId: sid } }),
    prisma.depot.findFirst({ where: { id: Number(depotId), societeId: sid } }),
  ]);
  if (!article) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  if (!depot) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }
  return { article, depot };
}

async function createStockLine({ societeId, articleId, depotId, emplacementId, quantite, quantiteMin, quantiteMax }) {
  await assertArticleDepot(societeId, articleId, depotId);
  await assertDepotOperable(prisma, { id: depotId, societeId });
  if (emplacementId) {
    await assertEmplacementOperable(prisma, { id: emplacementId, depotId, societeId });
    const emp = await prisma.emplacement.findFirst({
      where: { id: Number(emplacementId), depotId: Number(depotId) },
    });
    if (!emp) {
      const err = new Error("Emplacement introuvable pour ce depot");
      err.status = 404;
      throw err;
    }
    const compat = await checkEmplacementCompatibility(articleId, emplacementId, societeId);
    if (!compat.ok) {
      const err = new Error(compat.message);
      err.status = 409;
      throw err;
    }
  }
  const empl = emplacementId ? Number(emplacementId) : null;
  const existing = await prisma.stock.findFirst({
    where: {
      articleId: Number(articleId),
      depotId: Number(depotId),
      emplacementId: empl,
    },
  });
  if (existing) {
    const err = new Error("Une ligne de stock existe deja pour cet article / depot / emplacement");
    err.status = 409;
    throw err;
  }
  const created = await prisma.stock.create({
    data: {
      articleId: Number(articleId),
      depotId: Number(depotId),
      emplacementId: empl,
      quantite: Number(quantite) || 0,
      quantiteMin: quantiteMin != null ? Number(quantiteMin) : null,
      quantiteMax: quantiteMax != null ? Number(quantiteMax) : null,
      statut: "ACTIF",
    },
    include: {
      article: { select: { code: true, libelle: true, unite: true } },
      depot: { select: { code: true, libelle: true } },
      emplacement: { select: { code: true, libelle: true } },
    },
  });
  await syncAlerteStockAfterQtyChange(prisma, {
    societeId,
    articleId: created.articleId,
    depotId: created.depotId,
  });
  return created;
}

async function updateStockLine(id, { societeId, quantite, quantiteMin, quantiteMax, qteReservee, depotId, emplacementId }) {
  const line = await prisma.stock.findFirst({
    where: { id: Number(id) },
    include: { article: true },
  });
  if (!line || line.article.societeId !== requireActiveSocieteId(societeId)) {
    const err = new Error("Ligne de stock introuvable");
    err.status = 404;
    throw err;
  }

  let nextDepotId = line.depotId;
  if (depotId !== undefined && depotId !== null && String(depotId).trim() !== "") {
    nextDepotId = Number(depotId);
  }

  let nextEmplacementId = line.emplacementId;
  if (emplacementId !== undefined) {
    nextEmplacementId =
      emplacementId === null || emplacementId === "" ? null : Number(emplacementId);
  }

  const locationActuallyChanges =
    nextDepotId !== line.depotId || nextEmplacementId !== line.emplacementId;

  if (locationActuallyChanges) {
    await assertArticleDepot(societeId, line.articleId, nextDepotId);
    await assertDepotOperable(prisma, { id: nextDepotId, societeId });
    if (nextEmplacementId != null) {
      await assertEmplacementOperable(prisma, {
        id: nextEmplacementId,
        depotId: nextDepotId,
        societeId,
      });
      const emp = await prisma.emplacement.findFirst({
        where: { id: Number(nextEmplacementId), depotId: Number(nextDepotId) },
      });
      if (!emp) {
        const err = new Error("Emplacement introuvable pour ce depot");
        err.status = 404;
        throw err;
      }
      const compat = await checkEmplacementCompatibility(line.articleId, nextEmplacementId, societeId);
      if (!compat.ok) {
        const err = new Error(compat.message);
        err.status = 409;
        throw err;
      }
    }
    const emplKey = nextEmplacementId != null ? Number(nextEmplacementId) : null;
    const conflict = await prisma.stock.findFirst({
      where: {
        articleId: line.articleId,
        depotId: nextDepotId,
        emplacementId: emplKey,
        NOT: { id: line.id },
      },
    });
    if (conflict) {
      const err = new Error("Une ligne de stock existe deja pour cet article / depot / emplacement");
      err.status = 409;
      throw err;
    }
  }

  const updated = await prisma.stock.update({
    where: { id: line.id },
    data: {
      ...(quantite !== undefined ? { quantite: Number(quantite) } : {}),
      ...(quantiteMin !== undefined ? { quantiteMin: quantiteMin != null ? Number(quantiteMin) : null } : {}),
      ...(quantiteMax !== undefined ? { quantiteMax: quantiteMax != null ? Number(quantiteMax) : null } : {}),
      ...(qteReservee !== undefined ? { qteReservee: Number(qteReservee) } : {}),
      ...(depotId !== undefined && depotId !== null && String(depotId).trim() !== ""
        ? { depotId: nextDepotId }
        : {}),
      ...(emplacementId !== undefined ? { emplacementId: nextEmplacementId } : {}),
      dateLastMvt: new Date(),
    },
    include: {
      article: { select: { code: true, libelle: true, unite: true, stockMin: true, stockMax: true } },
      depot: { select: { code: true, libelle: true } },
      emplacement: { select: { code: true, libelle: true } },
    },
  });
  if (quantite !== undefined || locationActuallyChanges) {
    await syncAlerteStockAfterQtyChange(prisma, {
      societeId,
      articleId: updated.articleId,
      depotId: updated.depotId,
    });
    if (locationActuallyChanges && line.depotId !== updated.depotId) {
      await syncAlerteStockAfterQtyChange(prisma, {
        societeId,
        articleId: line.articleId,
        depotId: line.depotId,
      });
    }
  }
  return updated;
}

const STATUTS_STOCK = new Set(["ACTIF", "ARCHIVE", "BLOQUE"]);

async function setStatutStockLine(id, societeId, statut, userId = null) {
  const s = String(statut ?? "").trim();
  if (!STATUTS_STOCK.has(s)) {
    const err = new Error("Statut invalide (ACTIF, ARCHIVE ou BLOQUE attendu)");
    err.status = 400;
    throw err;
  }
  const line = await prisma.stock.findFirst({
    where: { id: Number(id) },
    include: { article: true },
  });
  if (!line || line.article.societeId !== requireActiveSocieteId(societeId)) {
    const err = new Error("Ligne de stock introuvable");
    err.status = 404;
    throw err;
  }
  const oldStatut = line.statut;
  const updated = await prisma.stock.update({
    where: { id: line.id },
    data: { statut: s, dateLastMvt: new Date() },
    include: {
      article: { select: { code: true, libelle: true, unite: true, stockMin: true, stockMax: true } },
      depot: { select: { code: true, libelle: true } },
      emplacement: { select: { code: true, libelle: true } },
    },
  });
  if (userId && oldStatut !== s) {
    await logAudit({
      userId,
      societeId: requireActiveSocieteId(societeId),
      entityType: "STOCK",
      entityId: line.id,
      action: "STATUS_CHANGE",
      oldValue: { statut: oldStatut },
      newValue: { statut: s },
    });
  }
  return updated;
}

async function toggleActifStockLine(id, societeId) {
  const line = await prisma.stock.findFirst({
    where: { id: Number(id) },
    include: { article: true },
  });
  if (!line || line.article.societeId !== requireActiveSocieteId(societeId)) {
    const err = new Error("Ligne de stock introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.stock.update({
    where: { id: line.id },
    data: {
      actif: !line.actif,
      dateLastMvt: new Date(),
    },
    include: {
      article: { select: { code: true, libelle: true, unite: true, stockMin: true, stockMax: true } },
      depot: { select: { code: true, libelle: true } },
      emplacement: { select: { code: true, libelle: true } },
    },
  });
}

async function deleteStockLine(id, societeId, userId = null) {
  const line = await prisma.stock.findFirst({
    where: { id: Number(id) },
    include: { article: true, depot: true },
  });
  if (!line || line.article.societeId !== requireActiveSocieteId(societeId)) {
    const err = new Error("Ligne de stock introuvable");
    err.status = 404;
    throw err;
  }
  await prisma.stock.delete({ where: { id: line.id } });
  if (userId) {
    await logAudit({
      userId,
      societeId: requireActiveSocieteId(societeId),
      entityType: "STOCK",
      entityId: line.id,
      action: "DELETE",
      oldValue: {
        articleId: line.articleId,
        depotId: line.depotId,
        quantite: line.quantite,
      },
      newValue: null,
    });
  }
}

async function getStockDisponible(user, { articleId, depotId }) {
  const sid = requireActiveSocieteId(user.societeId);
  await assertArticleDepot(sid, articleId, depotId);
  const agg = await prisma.stock.aggregate({
    where: { articleId: Number(articleId), depotId: Number(depotId) },
    _sum: { quantite: true },
  });
  return {
    articleId: Number(articleId),
    depotId: Number(depotId),
    disponible: round2(Number(agg._sum.quantite ?? 0)),
    quantite: round2(Number(agg._sum.quantite ?? 0)),
  };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function getDepotCapacitySummary(depotId, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const depot = await prisma.depot.findFirst({
    where: { id: Number(depotId), societeId: sid },
  });
  if (!depot) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }

  const stocks = await prisma.stock.findMany({
    where: { depotId: Number(depotId), article: { societeId: sid } },
    include: {
      article: {
        select: {
          id: true,
          code: true,
          libelle: true,
          poids: true,
          volume: true,
          fragile: true,
          dangereuxChimique: true,
          temperatureMin: true,
          temperatureMax: true,
        },
      },
    },
  });

  let volumeOccupe = 0;
  let poidsTotal = 0;
  const articlesDangereux = [];
  const articlesFragiles = [];

  for (const s of stocks) {
    const qte = Number(s.quantite) || 0;
    const vol = (Number(s.article.volume) || 0) * qte;
    const poids = (Number(s.article.poids) || 0) * qte;
    volumeOccupe += vol;
    poidsTotal += poids;
    if (s.article.dangereuxChimique && qte > 0) {
      articlesDangereux.push({
        articleId: s.article.id,
        code: s.article.code,
        libelle: s.article.libelle,
        quantite: qte,
        emplacementId: s.emplacementId,
      });
    }
    if (s.article.fragile && qte > 0) {
      articlesFragiles.push({
        articleId: s.article.id,
        code: s.article.code,
        libelle: s.article.libelle,
        quantite: qte,
        emplacementId: s.emplacementId,
      });
    }
  }

  const capaciteVolume = Number(depot.capaciteVolume) || null;
  const capacitePoids = Number(depot.capacitePoids) || null;
  const pctVolume = capaciteVolume ? round2((volumeOccupe / capaciteVolume) * 100) : null;
  const pctPoids = capacitePoids ? round2((poidsTotal / capacitePoids) * 100) : null;

  return {
    depotId: depot.id,
    depotLibelle: depot.libelle,
    volumeOccupe: round2(volumeOccupe),
    capaciteVolume,
    pctVolume,
    poidsTotal: round2(poidsTotal),
    capacitePoids,
    pctPoids,
    statutVolume:
      pctVolume == null ? "NON_CONFIGURE" : pctVolume >= 100 ? "DEPASSE" : pctVolume >= 85 ? "CRITIQUE" : "OK",
    statutPoids:
      pctPoids == null ? "NON_CONFIGURE" : pctPoids >= 100 ? "DEPASSE" : pctPoids >= 85 ? "CRITIQUE" : "OK",
    articlesDangereux,
    articlesFragiles,
  };
}

async function checkDepotCapacity(depotId, articleId, quantiteAjoutee, societeId) {
  const summary = await getDepotCapacitySummary(depotId, societeId);
  const article = await prisma.article.findFirst({
    where: { id: Number(articleId), societeId: Number(societeId) },
  });

  const capPoids = Number(summary.capacitePoids);
  const capVol = Number(summary.capaciteVolume);
  const poidsAjoute = (Number(article?.poids) || 0) * Number(quantiteAjoutee);
  const volumeAjoute = (Number(article?.volume) || 0) * Number(quantiteAjoutee);

  if (Number.isFinite(capVol) && capVol > 0) {
    const futureVolume = summary.volumeOccupe + volumeAjoute;
    const futurePct = (futureVolume / capVol) * 100;
    if (futurePct > 100) {
      return {
        ok: false,
        blocked: true,
        message: `Capacité volume dépassée: ${futureVolume.toFixed(1)}/${capVol} m³ (${futurePct.toFixed(0)}%)`,
        futurePct: Math.round(futurePct),
      };
    }
    if (futurePct > 90) {
      return {
        ok: true,
        warning: true,
        message: `Attention: capacité volume à ${futurePct.toFixed(0)}% après cette opération`,
      };
    }
  }

  if (Number.isFinite(capPoids) && capPoids > 0) {
    const futurePoids = summary.poidsTotal + poidsAjoute;
    const futurePct = (futurePoids / capPoids) * 100;
    if (futurePct > 100) {
      return {
        ok: false,
        blocked: true,
        message: `Capacité poids dépassée: ${futurePoids.toFixed(1)}/${capPoids} kg (${futurePct.toFixed(0)}%)`,
        futurePct: Math.round(futurePct),
      };
    }
    if (futurePct > 90) {
      return {
        ok: true,
        warning: true,
        message: `Attention: capacité poids à ${futurePct.toFixed(0)}% après cette opération`,
      };
    }
  }

  return { ok: true };
}

async function getVentesALivrer(user) {
  const sid = requireActiveSocieteId(user.societeId);
  const items = await prisma.vente.findMany({
    where: {
      societeId: sid,
      statut: "CONFIRME",
      livree: false,
      typeVente: { not: "AVOIR" },
    },
    include: {
      client: { select: { id: true, code: true, nom: true, ville: true } },
      lignes: {
        include: {
          article: {
            select: {
              code: true,
              libelle: true,
              unite: true,
              poids: true,
              volume: true,
              fragile: true,
            },
          },
        },
      },
    },
    orderBy: { dateVente: "desc" },
  });
  return { items, total: items.length };
}

async function optimizeLoad({ ventes, depotId, vehiculeId, societeId }) {
  const sid = requireActiveSocieteId(societeId);
  const venteIds = (Array.isArray(ventes) ? ventes : []).map(Number).filter((id) => id > 0);
  if (!venteIds.length) {
    const err = new Error("Aucune vente selectionnee");
    err.status = 400;
    throw err;
  }

  const lignes = await prisma.ligneVente.findMany({
    where: { venteId: { in: venteIds }, vente: { societeId: sid } },
    include: {
      article: true,
      vente: {
        include: {
          client: true,
          depot: { select: { latitude: true, longitude: true, libelle: true } },
        },
      },
    },
  });

  const articles = lignes.map((l) => ({
    articleId: l.articleId,
    code: l.article.code,
    libelle: l.article.libelle,
    quantite: l.quantite,
    poidsUnitaire: l.article.poids || 0,
    volumeUnitaire: l.article.volume || 0,
    destination: l.vente.client?.ville || l.vente.client?.nom,
    destLat: l.vente.client?.latitude ?? null,
    destLng: l.vente.client?.longitude ?? null,
    fragile: l.article.fragile || false,
    dangereuxChimique: l.article.dangereuxChimique || false,
    prixVente: l.article.prixVente || 0,
    imageUrl: l.article.imageUrl || null,
  }));

  const pairMap = new Map();
  const byVente = new Map();
  for (const l of lignes) {
    if (!byVente.has(l.venteId)) byVente.set(l.venteId, new Set());
    byVente.get(l.venteId).add(l.articleId);
  }
  for (const ids of byVente.values()) {
    const arr = [...ids];
    for (let i = 0; i < arr.length; i += 1) {
      for (let j = i + 1; j < arr.length; j += 1) {
        const a = Math.min(arr[i], arr[j]);
        const b = Math.max(arr[i], arr[j]);
        const key = `${a}:${b}`;
        pairMap.set(key, (pairMap.get(key) || 0) + 1);
      }
    }
  }
  const cooccurrence = [...pairMap.entries()].map(([key, count]) => {
    const [a, b] = key.split(":").map(Number);
    return { a, b, count };
  });

  const depotRow = lignes.find((l) => l.vente?.depot)?.vente?.depot || null;
  const depotPayload =
    depotRow && (depotRow.latitude != null || depotRow.longitude != null)
      ? {
          latitude: depotRow.latitude,
          longitude: depotRow.longitude,
          libelle: depotRow.libelle,
        }
      : null;

  const vehicule = await prisma.vehicule.findFirst({
    where: { id: Number(vehiculeId), societeId: sid, actif: true },
  });
  if (!vehicule) {
    const err = new Error("Vehicule introuvable");
    err.status = 404;
    throw err;
  }

  const vehiculePayload = {
    nom: vehicule.nom,
    capacitePoids: vehicule.capacitePoids,
    capaciteVolume: vehicule.capaciteVolume,
  };

  let result = null;
  if (!isAiBusy()) {
    try {
      const response = await aiFetch("/load-optimization", {
        body: {
          articles,
          vehicule: vehiculePayload,
          depot: depotPayload,
          cooccurrence,
        },
        timeoutMs: 14000,
      });
      if (response.ok) {
        result = await response.json();
        result.mode = result.mode || "ai";
      }
    } catch (err) {
      // AiBusyError ou réseau : result reste null, le plan local (mode: "local") s'applique.
      if (err instanceof AiBusyError) result = null;
    }
  }

  if (!result) {
    const { localLoadOptimization } = require("./aiLocal.fallback");
    result = localLoadOptimization(articles, vehiculePayload);
  }

  // Ne pas marquer les ventes comme livrées : l'optimisation calcule un plan,
  // la livraison reste un acte métier séparé.
  return {
    ...result,
    methodology:
      result.methodologyLabel ||
      result.methodology ||
      "HAC + HGB OOF + soute 3D + Pareto GPS",
    methodologyLabel:
      result.methodologyLabel ||
      "HAC + HGB OOF + soute 3D + Pareto GPS",
  };
}

function formatDateKey(d) {
  const x = new Date(d);
  return x.toISOString().slice(0, 10);
}

async function getValeurConsolidee(user) {
  const sid = requireActiveSocieteId(user.societeId);
  const stocks = await prisma.stock.findMany({
    where: { article: { societeId: sid } },
    include: {
      article: { select: { prixAchat: true } },
      depot: { select: { id: true, libelle: true } },
    },
  });
  let total = 0;
  const byDepotMap = new Map();
  for (const s of stocks) {
    const valeur = Number(s.quantite || 0) * Number(s.article?.prixAchat || 0);
    total += valeur;
    const prev = byDepotMap.get(s.depotId) || {
      depotId: s.depotId,
      libelle: s.depot?.libelle || `Dépôt #${s.depotId}`,
      valeur: 0,
    };
    prev.valeur += valeur;
    byDepotMap.set(s.depotId, prev);
  }
  return {
    total: round2(total),
    byDepot: [...byDepotMap.values()]
      .map((d) => ({ ...d, valeur: round2(d.valeur) }))
      .sort((a, b) => b.valeur - a.valeur),
  };
}

async function getStockTendance(user, days = 30) {
  const sid = requireActiveSocieteId(user.societeId);
  const nbDays = Math.min(90, Math.max(1, Number(days) || 30));
  const since = new Date();
  since.setDate(since.getDate() - nbDays + 1);
  since.setHours(0, 0, 0, 0);

  const mouvements = await prisma.mouvement.findMany({
    where: {
      createdAt: { gte: since },
      article: { societeId: sid },
      statut: "VALIDE",
    },
    select: { type: true, quantite: true, createdAt: true },
  });

  const buckets = new Map();
  for (let i = 0; i < nbDays; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(formatDateKey(d), { date: formatDateKey(d), entrees: 0, sorties: 0, solde: 0 });
  }

  for (const m of mouvements) {
    const key = formatDateKey(m.createdAt);
    if (!buckets.has(key)) continue;
    const b = buckets.get(key);
    const q = Number(m.quantite) || 0;
    const t = String(m.type || "").toUpperCase();
    if (t.startsWith("ENTREE") || t === "ENTREE") {
      b.entrees += q;
      b.solde += q;
    } else if (t.startsWith("SORTIE") || t === "SORTIE" || t === "RETOUR_FOURNISSEUR") {
      b.sorties += q;
      b.solde -= q;
    } else if (t === "TRANSFERT") {
      b.entrees += q;
      b.sorties += q;
    }
  }

  return [...buckets.values()];
}

async function getStockCalendar(user, month) {
  const sid = requireActiveSocieteId(user.societeId);
  const m = String(month || "").trim();
  const match = m.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const mon = match ? Number(match[2]) - 1 : now.getMonth();
  const start = new Date(year, mon, 1);
  const end = new Date(year, mon + 1, 0, 23, 59, 59, 999);

  const mouvements = await prisma.mouvement.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      article: { societeId: sid },
      statut: "VALIDE",
    },
    select: { type: true, quantite: true, createdAt: true },
  });

  const daysInMonth = end.getDate();
  const buckets = new Map();
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, mon, d);
    buckets.set(formatDateKey(dt), { date: formatDateKey(dt), entrees: 0, sorties: 0, total: 0 });
  }

  for (const mvt of mouvements) {
    const key = formatDateKey(mvt.createdAt);
    if (!buckets.has(key)) continue;
    const b = buckets.get(key);
    const q = Number(mvt.quantite) || 0;
    const t = String(mvt.type || "").toUpperCase();
    if (t.startsWith("ENTREE") || t === "ENTREE") {
      b.entrees += q;
    } else {
      b.sorties += q;
    }
    b.total += 1;
  }

  return [...buckets.values()];
}

async function getRotationSummary(user) {
  const sid = requireActiveSocieteId(user.societeId);
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const grouped = await prisma.mouvement.groupBy({
    by: ["articleId"],
    where: {
      article: { societeId: sid },
      createdAt: { gte: since },
      statut: "VALIDE",
    },
    _count: { id: true },
  });

  return grouped.map((g) => {
    const count = g._count.id;
    let rotationLabel = "Faible";
    if (count > 10) rotationLabel = "Fort";
    else if (count >= 3) rotationLabel = "Moyen";
    return { articleId: g.articleId, rotationScore: count, rotationLabel };
  });
}

async function listAuditLogs(user, { entityType, userId, from, to, page = 1, limit = 50 } = {}) {
  const sid = requireActiveSocieteId(user.societeId);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const where = {
    societeId: sid,
    ...(entityType ? { entityType: String(entityType) } : {}),
    ...(userId ? { userId: Number(userId) } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        utilisateur: { select: { id: true, nom: true, prenom: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1 };
}

function isEntreeType(type) {
  const t = String(type || "").toUpperCase();
  return t.startsWith("ENTREE") || t === "ENTREE";
}

function isSortieType(type) {
  const t = String(type || "").toUpperCase();
  return t.startsWith("SORTIE") || t === "SORTIE" || t === "RETOUR_FOURNISSEUR";
}

async function getStockHeatmap(user, months = 12, metric = "quantite") {
  const sid = requireActiveSocieteId(user.societeId);
  const nbMonths = Math.min(24, Math.max(1, Number(months) || 12));
  const metricKey = String(metric || "quantite").toLowerCase();

  const stockRows = await prisma.stock.findMany({
    where: { article: { societeId: sid } },
    include: { article: { select: { id: true, code: true, libelle: true } } },
    distinct: ["articleId"],
    take: 100,
  });

  const monthRanges = [];
  for (let i = nbMonths - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - i);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const from = new Date(d.getFullYear(), d.getMonth(), 1);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    monthRanges.push({ monthStr, from, to });
  }

  const result = [];
  for (const s of stockRows) {
    const monthData = [];

    if (metricKey === "quantite") {
      const stock = await prisma.stock.aggregate({
        where: { articleId: s.articleId, article: { societeId: sid } },
        _sum: { quantite: true },
      });
      const qty = Number(stock._sum.quantite || 0);
      for (const { monthStr } of monthRanges) {
        monthData.push({ month: monthStr, value: qty });
      }
    } else {
      const mvts = await prisma.mouvement.findMany({
        where: {
          articleId: s.articleId,
          article: { societeId: sid },
          statut: "VALIDE",
          createdAt: { gte: monthRanges[0].from, lte: monthRanges[monthRanges.length - 1].to },
        },
        select: { type: true, quantite: true, createdAt: true },
      });

      for (const { monthStr, from, to } of monthRanges) {
        let value = 0;
        for (const m of mvts) {
          const created = new Date(m.createdAt);
          if (created < from || created > to) continue;
          const t = String(m.type || "").toUpperCase();
          if (metricKey === "entrees" && isEntreeType(t)) {
            value += Number(m.quantite) || 0;
          } else if (metricKey === "sorties" && isSortieType(t)) {
            value += Number(m.quantite) || 0;
          }
        }
        monthData.push({ month: monthStr, value: round2(value) });
      }
    }

    result.push({
      articleId: s.articleId,
      articleCode: s.article.code,
      articleLibelle: s.article.libelle,
      months: monthData,
    });
  }

  return result;
}

function resolveAbcClass(rotationLabel) {
  if (rotationLabel === "Fort") return "A";
  if (rotationLabel === "Moyen") return "B";
  return "C";
}

/** Zone physique selon distance au quai (0 = quai, 100 = fond). */
function resolveZone(distanceQuai) {
  const d = Number(distanceQuai);
  const dist = Number.isFinite(d) ? Math.max(0, Math.min(100, d)) : 50;
  if (dist <= 33) {
    return { key: "A", label: "Zone picking", short: "Près du quai", idealFor: "A" };
  }
  if (dist <= 66) {
    return { key: "B", label: "Zone mixte", short: "Milieu dépôt", idealFor: "B" };
  }
  return { key: "C", label: "Zone réserve", short: "Fond dépôt", idealFor: "C" };
}

/** Distance idéale (0–100) pour une rotation normalisée. */
function idealDistanceForRotation(rotationNorm) {
  const r = Math.max(0, Math.min(1, Number(rotationNorm) || 0));
  return Math.round((1 - r) * 100);
}

function estimatePickGainSec(fromDistance, toDistance, abcClass) {
  const delta = Number(fromDistance) - Number(toDistance);
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  const weight = abcClass === "A" ? 0.9 : abcClass === "B" ? 0.55 : 0.3;
  return Math.round(delta * weight);
}

function buildSuggestionReasons(abcClass, zone, proximityPct, spacePct, occupationPct) {
  const reasons = [];
  if (zone.idealFor === abcClass) {
    reasons.push(`Zone ${zone.key} alignée avec la classe ${abcClass}`);
  } else {
    reasons.push(`Meilleur compromis zone / capacité (cible classe ${abcClass})`);
  }
  if (proximityPct >= 75) reasons.push("Excellent alignement distance–rotation");
  else if (proximityPct >= 50) reasons.push("Bon alignement distance–rotation");
  if (spacePct >= 70) reasons.push("Capacité résiduelle confortable");
  else if (occupationPct >= 70) reasons.push("Occupation élevée — à surveiller");
  return reasons.slice(0, 3);
}

function buildExplication({
  rotationLabel,
  abcClass,
  rotationScore,
  top3,
  currentDistance,
  currentCode,
}) {
  if (!top3.length) {
    return "Aucun emplacement compatible disponible dans ce dépôt. Vérifiez la compatibilité (froid, dangereux, capacité) ou libérez des emplacements.";
  }
  const best = top3[0];
  const zone = best.zone || resolveZone(best.distanceQuai);
  const gain = estimatePickGainSec(currentDistance, best.distanceQuai, abcClass);
  const alreadyOptimal =
    currentCode &&
    String(currentCode).toUpperCase() === String(best.code).toUpperCase();

  const classBlurb =
    abcClass === "A"
      ? `Classe A (forte rotation, ${rotationScore} mvt/30 j) : priorité picking près du quai.`
      : abcClass === "B"
        ? `Classe B (rotation moyenne, ${rotationScore} mvt/30 j) : équilibre entre accessibilité et occupation.`
        : `Classe C (faible rotation, ${rotationScore} mvt/30 j) : privilégier la zone réserve pour libérer le quai.`;

  if (alreadyOptimal) {
    return `${classBlurb} L'article est déjà sur ${best.code} (${zone.label}, d=${best.distanceQuai}/100) — position optimale selon le slotting ABC.`;
  }

  const moveHint =
    currentCode != null
      ? ` Aujourd'hui en ${currentCode} (d=${currentDistance ?? "—"}/100) → ${best.code} (d=${best.distanceQuai}/100, ${zone.short}).`
      : ` Emplacement recommandé : ${best.code} (${zone.label}, d=${best.distanceQuai}/100).`;

  const gainHint =
    gain > 0
      ? ` Gain estimé de parcours : ~${gain} s par préparation.`
      : " Score maximisé sur proximité cible et capacité libre.";

  return `${classBlurb}${moveHint}${gainHint}`;
}

/** Capacité par emplacement — même règle que KPI / plan 2D / slotting. */
function resolveEmplacementCapacity(empl) {
  return emplacementCapaciteUnits(empl);
}

function computeOccupationRatio(occupationQty, capacite) {
  if (!capacite || capacite <= 0) return 0;
  return Math.min(1, Number(occupationQty) / capacite);
}

async function scoreEmplacementsForArticle(
  article,
  emplacements,
  rotationNorm,
  occupancyByEmpl,
  societeId,
  depotCapacite,
  options = {}
) {
  const abcClass = options.abcClass || resolveAbcClass(
    rotationNorm >= 0.67 ? "Fort" : rotationNorm >= 0.33 ? "Moyen" : "Faible"
  );
  const idealDistance = idealDistanceForRotation(rotationNorm);
  const emplacementCount = emplacements.length || 1;
  const scored = [];

  for (const empl of emplacements) {
    const compat = await checkEmplacementCompatibility(article.id, empl.id, societeId);
    if (!compat.ok) continue;

    const occupation = occupancyByEmpl.get(empl.id) || 0;
    const capacite = resolveEmplacementCapacity(empl);
    const occupationRatio = computeOccupationRatio(occupation, capacite);
    if (occupationRatio >= 1) continue;

    const distanceQuai = Number(empl.distanceQuai);
    const distanceNorm = (Number.isFinite(distanceQuai) ? distanceQuai : 50) / 100;
    // Cible : forte rotation → distance faible ; faible rotation → distance élevée
    const proximityFit = 1 - Math.abs(distanceNorm - (1 - rotationNorm));
    const spaceScore = 1 - occupationRatio;
    const zone = resolveZone(distanceQuai);
    const zoneBonus = zone.idealFor === abcClass ? 1 : zone.key === "B" ? 0.55 : 0.25;
    // Pondération métier : alignement rotation 55 %, capacité 30 %, cohérence zone ABC 15 %
    const score = Math.round((proximityFit * 0.55 + spaceScore * 0.3 + zoneBonus * 0.15) * 100);
    const proximityPct = Math.round(proximityFit * 100);
    const spacePct = Math.round(spaceScore * 100);
    const zonePct = Math.round(zoneBonus * 100);
    const occupationPct = Math.round(occupationRatio * 100);

    scored.push({
      emplacementId: empl.id,
      code: empl.code,
      libelle: empl.libelle,
      distanceQuai: Number.isFinite(distanceQuai) ? distanceQuai : 50,
      occupationRatio: occupationPct,
      score,
      zone: { key: zone.key, label: zone.label, short: zone.short },
      idealDistance,
      scoreBreakdown: {
        proximity: proximityPct,
        capacity: spacePct,
        zoneAlignment: zonePct,
      },
      reasons: buildSuggestionReasons(abcClass, zone, proximityPct, spacePct, occupationPct),
    });
  }
  scored.sort((a, b) => b.score - a.score || a.distanceQuai - b.distanceQuai);
  return scored;
}

/**
 * Recommande les meilleurs emplacements (GMM + HGB + affinité, fallback local).
 */
async function suggestEmplacements(articleId, depotId, societeId) {
  return slottingService.suggestEmplacements(articleId, depotId, societeId);
}

/**
 * Audit global : articles mal placés selon le slotting ML.
 */
async function auditEmplacements(depotId, societeId) {
  return slottingService.auditEmplacements(depotId, societeId);
}

/** Vérifie que Stock.quantite ≈ Σ(Lot.quantiteRestante) pour un article+dépôt. */
async function verifyStockLotConsistency(articleId, depotId) {
  const stocks = await prisma.stock.findMany({
    where: { articleId: Number(articleId), depotId: Number(depotId) },
    select: { quantite: true },
  });
  const stockQuantite = stocks.reduce((s, row) => s + Number(row.quantite || 0), 0);
  const lots = await prisma.lot.findMany({
    where: { articleId: Number(articleId), depotId: Number(depotId) },
    select: { quantiteRestante: true },
  });
  const totalLots = lots.reduce((s, l) => s + Number(l.quantiteRestante || 0), 0);
  return {
    coherent: Math.abs(stockQuantite - totalLots) < 0.001,
    stockQuantite,
    totalLots,
  };
}

module.exports = {
  getStock,
  getStockLine,
  getStockDisponible,
  getStockAlerts,
  listStockRowsForExport,
  createStockLine,
  updateStockLine,
  deleteStockLine,
  toggleActifStockLine,
  setStatutStockLine,
  getValeurConsolidee,
  getStockTendance,
  getStockCalendar,
  getRotationSummary,
  listAuditLogs,
  getDepotCapacitySummary,
  checkDepotCapacity,
  checkEmplacementCompatibility,
  getVentesALivrer,
  optimizeLoad,
  suggestEmplacements,
  auditEmplacements,
  verifyStockLotConsistency,
  getStockHeatmap,
  scoreEmplacementsForArticle,
  resolveAbcClass,
  resolveZone,
};
