const prisma = require("../../config/database");
const mouvementsService = require("../mouvements/mouvements.service");
const { getSocieteWhere } = require("../../utils/societeScope");
const { auditFromReq } = require("../../utils/auditHelper");
const { normalizeCode, resolveAutoCode, createWithAutoCode } = require("../../utils/codeUtils");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function assertArticle(articleId, societeId) {
  const a = await prisma.article.findFirst({
    where: { id: Number(articleId), societeId: Number(societeId) },
  });
  if (!a) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  return a;
}

function isLotBlocked(lot) {
  if (!lot) return false;
  const statut = String(lot.statut || "").toUpperCase();
  if (statut === "EPUISE" || statut === "EXPIRE") return true;
  if (Number(lot.quantiteRestante) <= 0) return true;
  if (lot.dateExpiration) {
    const exp = new Date(lot.dateExpiration);
    if (!Number.isNaN(exp.getTime()) && exp < new Date()) return true;
  }
  return false;
}

const serieInclude = {
  article: { select: { id: true, code: true, libelle: true, imageUrl: true } },
  depot: { select: { id: true, code: true, libelle: true } },
  lot: { select: { id: true, numero: true, statut: true, quantiteRestante: true, dateExpiration: true } },
};

async function listBySociete({ societeId, articleId, depotId, statut, lotId, search, page = 1, limit = 50 }) {
  const pageNum = Number(page) || 1;
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;
  const where = {
    societeId: Number(societeId),
    ...(articleId ? { articleId: Number(articleId) } : {}),
    ...(depotId ? { depotId: Number(depotId) } : {}),
    ...(statut ? { statut: String(statut) } : {}),
    ...(lotId ? { lotId: Number(lotId) } : {}),
    ...(search ? { numero: { contains: String(search) } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.numeroSerie.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { id: "desc" },
      include: serieInclude,
    }),
    prisma.numeroSerie.count({ where }),
  ]);
  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1 };
}

async function listNumerosSerie(params) {
  return listBySociete(params);
}

async function getNumeroSerie(id, societeId) {
  return prisma.numeroSerie.findFirst({
    where: { id: Number(id), societeId: Number(societeId) },
    include: serieInclude,
  });
}

async function generateNumeroSerie(societeId, articleId, db = prisma) {
  const sid = Number(societeId);
  const art = await assertArticle(articleId, sid);
  const client = db || prisma;
  const prefix = `SN-${String(art.code).toUpperCase().replace(/[^A-Z0-9]/g, "")}-`;
  const last = await client.numeroSerie.findFirst({
    where: { articleId: art.id, numero: { startsWith: prefix } },
    orderBy: { id: "desc" },
  });
  let nextNum = 1;
  if (last) {
    const match = last.numero.slice(prefix.length).match(/^(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  let numero = `${prefix}${String(nextNum).padStart(4, "0")}`;
  while (await client.numeroSerie.findFirst({ where: { numero } })) {
    nextNum++;
    numero = `${prefix}${String(nextNum).padStart(4, "0")}`;
  }
  return numero;
}

async function createNumeroSerie(data, societeId) {
  const art = await assertArticle(data.articleId, societeId);
  const sid = Number(societeId);
  if (data.depotId) {
    const d = await prisma.depot.findFirst({ where: { id: Number(data.depotId), societeId: sid } });
    if (!d) {
      const err = new Error("Depot introuvable");
      err.status = 404;
      throw err;
    }
  }
  if (data.lotId) {
    const lot = await prisma.lot.findFirst({
      where: { id: Number(data.lotId), article: { societeId: sid } },
    });
    if (!lot) {
      const err = new Error("Lot introuvable");
      err.status = 404;
      throw err;
    }
    if (isLotBlocked(lot)) {
      const err = new Error("Lot epise ou expire — impossible d'y rattacher un numero de serie");
      err.status = 409;
      throw err;
    }
  }

  const persist = (d) =>
    prisma.numeroSerie.create({
      data: {
        numero: normalizeCode(d.numero),
        articleId: art.id,
        societeId: sid,
        statut: data.statut || "DISPONIBLE",
        depotId: data.depotId ? Number(data.depotId) : null,
        lotId: data.lotId ? Number(data.lotId) : null,
        notes: data.notes || null,
      },
      include: serieInclude,
    });

  const { isAuto, code: resolvedNumero } = await resolveAutoCode(
    sid,
    data.numero,
    () => generateNumeroSerie(sid, data.articleId)
  );
  if (isAuto) {
    return createWithAutoCode(
      sid,
      { numero: resolvedNumero || undefined },
      () => generateNumeroSerie(sid, data.articleId),
      persist,
      3,
      "numero"
    );
  }
  return persist({ numero: resolvedNumero });
}

async function updateNumeroSerie(id, data, societeId) {
  const ex = await getNumeroSerie(id, societeId);
  if (!ex) {
    const err = new Error("Numero de serie introuvable");
    err.status = 404;
    throw err;
  }
  if (data.depotId != null) {
    if (data.depotId !== "" && data.depotId !== null) {
      const d = await prisma.depot.findFirst({
        where: { id: Number(data.depotId), societeId: Number(societeId) },
      });
      if (!d) {
        const err = new Error("Depot introuvable");
        err.status = 404;
        throw err;
      }
    }
  }
  return prisma.numeroSerie.update({
    where: { id: ex.id },
    data: {
      ...(data.statut != null ? { statut: String(data.statut) } : {}),
      ...(data.depotId !== undefined ? { depotId: data.depotId ? Number(data.depotId) : null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
    include: serieInclude,
  });
}

async function assignerLot(numeroSerieId, lotId, societeId) {
  const sid = Number(societeId);
  const ns = await getNumeroSerie(numeroSerieId, sid);
  if (!ns) {
    const err = new Error("Numero de serie introuvable");
    err.status = 404;
    throw err;
  }
  if (String(ns.statut || "").toUpperCase() === "DESACTIVE") {
    const err = new Error("Numero de serie desactive — assignation impossible");
    err.status = 409;
    throw err;
  }
  const lot = await prisma.lot.findFirst({
    where: { id: Number(lotId), article: { societeId: sid } },
    include: { article: true, depot: true },
  });
  if (!lot) {
    const err = new Error("Lot introuvable");
    err.status = 404;
    throw err;
  }
  if (Number(lot.articleId) !== Number(ns.articleId)) {
    const err = new Error("Le lot et le numero de serie doivent concerner le meme article");
    err.status = 400;
    throw err;
  }
  if (isLotBlocked(lot)) {
    const err = new Error("Lot epise ou expire — assignation impossible");
    err.status = 409;
    throw err;
  }
  return prisma.numeroSerie.update({
    where: { id: ns.id },
    data: {
      lotId: lot.id,
      depotId: lot.depotId,
    },
    include: serieInclude,
  });
}

async function tryAdjustStock(tx, params) {
  try {
    await mouvementsService.adjustStock(tx, params);
    return true;
  } catch (e) {
    if (e.status === 400 && /stock/i.test(String(e.message || ""))) {
      return false;
    }
    throw e;
  }
}

async function transfertSerie(id, newDepotId, societeId, user, req) {
  const sid = Number(societeId);
  const ns = await getNumeroSerie(id, sid);
  if (!ns) {
    const err = new Error("Numero de serie introuvable");
    err.status = 404;
    throw err;
  }

  if (String(ns.statut || "").toUpperCase() === "DESACTIVE") {
    const err = new Error("Numero de serie desactive — transfert impossible");
    err.status = 409;
    throw err;
  }

  const newDepId = Number(newDepotId);
  const dep = await prisma.depot.findFirst({
    where: { id: newDepId, societeId: sid },
  });
  if (!dep) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }

  if (ns.depotId != null && Number(ns.depotId) === newDepId) {
    const err = new Error("Le numéro est déjà dans ce dépôt");
    err.status = 400;
    throw err;
  }

  if (!user?.id) {
    const err = new Error("Utilisateur requis pour le transfert");
    err.status = 400;
    throw err;
  }

  const oldDepotId = ns.depotId != null ? Number(ns.depotId) : null;
  const ancienDepotCode = ns.depot?.code || ns.depot?.libelle || null;
  const isInitial = oldDepotId == null;

  const updated = await prisma.$transaction(async (tx) => {
    let stockAdjusted = false;

    if (oldDepotId != null) {
      const debited = await tryAdjustStock(tx, {
        societeId: sid,
        articleId: ns.articleId,
        depotId: oldDepotId,
        emplacementId: null,
        delta: -1,
      });
      if (debited) {
        await tryAdjustStock(tx, {
          societeId: sid,
          articleId: ns.articleId,
          depotId: newDepId,
          emplacementId: null,
          delta: 1,
        });
        stockAdjusted = true;
      }
    } else {
      await tryAdjustStock(tx, {
        societeId: sid,
        articleId: ns.articleId,
        depotId: newDepId,
        emplacementId: null,
        delta: 1,
      });
      stockAdjusted = true;
    }

    const commentaire = isInitial
      ? `Affectation initiale N° série ${ns.numero}`
      : `Transfert N° série ${ns.numero}${stockAdjusted ? "" : " (traçabilité sérialisée — stock agrégé inchangé)"}`;

    await mouvementsService.insertMouvement(tx, {
      reference: mouvementsService.genRef("MVT-TRANSFERT-NS"),
      type: mouvementsService.MOUVEMENT_TYPES.TRANSFERT,
      articleId: ns.articleId,
      depotId: isInitial ? newDepId : oldDepotId,
      depotDestId: isInitial ? null : newDepId,
      quantite: 1,
      utilisateurId: user.id,
      commentaire,
      lotId: ns.lotId,
    });

    return tx.numeroSerie.update({
      where: { id: ns.id },
      data: { depotId: newDepId },
      include: serieInclude,
    });
  });

  if (req) {
    await auditFromReq(req, {
      action: "TRANSFERT",
      entite: "NumeroSerie",
      entiteId: ns.id,
      module: "NumerosSerie",
      description: `Transfert N° série ${ns.numero} : ${ancienDepotCode || "—"} → ${dep.code || dep.libelle || newDepId}`,
    });
  }

  return updated;
}

/**
 * Historique mouvements liés au N° de série (commentaire ou lot associé).
 */
async function getHistoriqueNumeroSerie(user, id) {
  const { societeId: sid } = getSocieteWhere(user);
  const ns = await getNumeroSerie(id, sid);
  if (!ns) {
    const err = new Error("Numero de serie introuvable");
    err.status = 404;
    throw err;
  }

  const orFilters = [{ commentaire: { contains: ns.numero } }];
  if (ns.lotId) {
    orFilters.push({ lotId: ns.lotId });
  }

  const items = await prisma.mouvement.findMany({
    where: {
      articleId: ns.articleId,
      article: { societeId: sid },
      OR: orFilters,
    },
    orderBy: { createdAt: "desc" },
    include: {
      article: { select: { id: true, code: true, libelle: true } },
      depot: { select: { id: true, code: true, libelle: true } },
      depotDest: { select: { id: true, code: true, libelle: true } },
      utilisateur: { select: { id: true, nom: true, prenom: true, email: true } },
    },
  });

  return { numeroSerie: { id: ns.id, numero: ns.numero, lotId: ns.lotId }, items };
}

/**
 * Import en masse de numéros de série.
 * @param {{ numero: string, articleId: number, depotId?: number, lotId?: number }[]} rows
 */
async function bulkCreateNumerosSerie(rows, societeId) {
  const sid = Number(societeId);
  const created = [];
  const errors = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const item = await createNumeroSerie(
        {
          numero: row.numero,
          articleId: row.articleId,
          depotId: row.depotId,
          lotId: row.lotId,
          statut: row.statut || "DISPONIBLE",
        },
        sid
      );
      created.push(item);
    } catch (e) {
      errors.push({ index: i, numero: row.numero, message: e.message || "Erreur" });
    }
  }
  return { created: created.length, total: rows.length, errors, items: created };
}

/**
 * Désactive un N° de série (statut DESACTIVE) — pas de suppression physique.
 * L'historique reste consultable ; réactivation via PATCH statut.
 */
async function deactivateNumeroSerie(id, societeId) {
  const ex = await getNumeroSerie(id, societeId);
  if (!ex) {
    const err = new Error("Numero de serie introuvable");
    err.status = 404;
    throw err;
  }
  if (String(ex.statut || "").toUpperCase() === "DESACTIVE") {
    return ex;
  }
  return prisma.numeroSerie.update({
    where: { id: ex.id },
    data: { statut: "DESACTIVE" },
    include: serieInclude,
  });
}

/** @deprecated Use deactivateNumeroSerie — conserve le nom pour compatibilité routes. */
async function deleteNumeroSerie(id, societeId) {
  return deactivateNumeroSerie(id, societeId);
}

module.exports = {
  listBySociete,
  listNumerosSerie,
  getNumeroSerie,
  generateNumeroSerie,
  createNumeroSerie,
  updateNumeroSerie,
  deleteNumeroSerie,
  deactivateNumeroSerie,
  assignerLot,
  transfertSerie,
  getHistoriqueNumeroSerie,
  bulkCreateNumerosSerie,
};
