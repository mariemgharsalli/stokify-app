const prisma = require("../../config/database");
const mouvementsService = require("../mouvements/mouvements.service");
const valuationService = require("../valuation/valuation.service");
const { getSocieteWhere, stripSocieteFromBody, requireActiveSocieteId } = require("../../utils/societeScope");
const { normalizeCode, createWithAutoCode, resolveAutoCode } = require("../../utils/codeUtils");
const { generateInventairePdf } = require("../../utils/pdfHelper");
const { generateInventaireExcel, generateInventairesListExcel } = require("../../utils/excelHelper");
const { assertDepotOperable } = require("../../utils/warehouseOps");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

const LOT_WARNING_MSG = "Aucun lot identifiable pour cette perte";

function parseLotsAjustes(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isLotWarning(lotsAjustes) {
  const parsed = parseLotsAjustes(lotsAjustes);
  return Boolean(parsed && parsed.warning);
}

const ligneInclude = {
  article: {
    select: {
      id: true,
      code: true,
      libelle: true,
      unite: true,
      modeGestion: true,
      modeTracage: true,
      tracageAuto: true,
      prixAchat: true,
      strategieSortie: true,
    },
  },
  lot: { select: { id: true, numero: true } },
  emplacement: { select: { id: true, code: true, libelle: true } },
};

async function assertNoEnCoursInDepot(tx, depotId, excludeId = null) {
  const existing = await tx.inventaire.findFirst({
    where: {
      depotId: Number(depotId),
      statut: "EN_COURS",
      ...(excludeId ? { id: { not: Number(excludeId) } } : {}),
    },
  });
  if (existing) {
    const err = new Error(
      `Un inventaire est deja en cours pour ce depot (${existing.reference}). Terminez-le ou annulez-le avant d'en creer un nouveau.`
    );
    err.status = 409;
    err.code = "DEPOT_INVENTAIRE_EN_COURS";
    err.details = {
      existingId: existing.id,
      existingReference: existing.reference,
      depotId: Number(depotId),
    };
    throw err;
  }
}

function mapInventaireSummary(inv, lignesStats) {
  const total = lignesStats?.total ?? inv._count?.lignes ?? 0;
  const saisis = lignesStats?.saisis ?? 0;
  const ecarts = lignesStats?.ecarts ?? 0;
  const valeurEcart = round2(lignesStats?.valeurEcart ?? 0);
  const conformes = lignesStats?.conformes ?? 0;
  return {
    id: inv.id,
    reference: inv.reference,
    date: inv.date,
    statut: inv.statut,
    modeAveugle: Boolean(inv.modeAveugle),
    depotId: inv.depotId,
    depot: inv.depot,
    _count: { lignes: total },
    summary: {
      totalLignes: total,
      saisis,
      ecarts,
      conformes,
      valeurEcart,
      progressionPct: total > 0 ? round2((saisis / total) * 100) : 0,
      precisionPct: saisis > 0 ? round2((conformes / saisis) * 100) : null,
    },
  };
}

function assertNoRecomptagePending(lignes) {
  const pending = (lignes || []).filter((l) => l.recomptageDemande);
  if (!pending.length) return;
  const codes = pending
    .map((l) => l.article?.code || `#${l.id}`)
    .join(", ");
  const err = new Error(`Recomptage requis pour : ${codes}`);
  err.status = 400;
  err.code = "RECOMPTAGE_REQUIS";
  err.details = { ligneIds: pending.map((l) => l.id), codes: pending.map((l) => l.article?.code).filter(Boolean) };
  throw err;
}

async function listInventairesEnriched({ user, depotId, statut, search, page = 1, limit = 50 }) {
  const { societeId: sid } = getSocieteWhere(user);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;
  const where = {
    depot: { societeId: sid },
    ...(depotId ? { depotId: Number(depotId) } : {}),
    ...(statut ? { statut: String(statut) } : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search } },
            { depot: { libelle: { contains: search } } },
            { depot: { code: { contains: search } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.inventaire.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { id: "desc" },
      include: {
        depot: { select: { id: true, code: true, libelle: true } },
        lignes: {
          select: {
            qteTheorique: true,
            qteReelle: true,
            ecart: true,
            valeurEcart: true,
          },
        },
      },
    }),
    prisma.inventaire.count({ where }),
  ]);

  const mapped = items.map((inv) => {
    const lignes = inv.lignes || [];
    let saisis = 0;
    let ecarts = 0;
    let conformes = 0;
    let valeurEcart = 0;
    for (const l of lignes) {
      if (l.qteReelle != null) {
        saisis += 1;
        const ec = round2(Number(l.qteReelle) - Number(l.qteTheorique));
        if (Math.abs(ec) < 1e-9) conformes += 1;
        else {
          ecarts += 1;
          valeurEcart += Number(l.valeurEcart ?? 0);
        }
      }
    }
    const { lignes: _drop, ...rest } = inv;
    return mapInventaireSummary(rest, {
      total: lignes.length,
      saisis,
      ecarts,
      conformes,
      valeurEcart,
    });
  });

  const allForGlobal = await prisma.inventaire.findMany({
    where: { depot: { societeId: sid } },
    select: {
      statut: true,
      lignes: {
        select: { qteTheorique: true, qteReelle: true, ecart: true, valeurEcart: true },
      },
    },
  });

  let globalSaisis = 0;
  let globalConformes = 0;
  let globalValeurEcart = 0;
  let enCours = 0;
  for (const inv of allForGlobal) {
    if (inv.statut === "EN_COURS") enCours += 1;
    for (const l of inv.lignes) {
      if (l.qteReelle != null) {
        globalSaisis += 1;
        const ec = round2(Number(l.qteReelle) - Number(l.qteTheorique));
        if (Math.abs(ec) < 1e-9) globalConformes += 1;
        else globalValeurEcart += Number(l.valeurEcart ?? 0);
      }
    }
  }

  return {
    items: mapped,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
    limit: limitNum,
    global: {
      nbInventaires: allForGlobal.length,
      enCours,
      precisionPct: globalSaisis > 0 ? round2((globalConformes / globalSaisis) * 100) : 100,
      valeurEcartsTnd: round2(globalValeurEcart),
    },
  };
}

async function listInventaires({ user, depotId, statut, page = 1, limit = 25 }) {
  const { societeId: sid } = getSocieteWhere(user);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;
  const where = {
    depot: { societeId: sid },
    ...(depotId ? { depotId: Number(depotId) } : {}),
    ...(statut ? { statut: String(statut) } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.inventaire.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { id: "desc" },
      include: {
        depot: { select: { id: true, code: true, libelle: true } },
        _count: { select: { lignes: true } },
      },
    }),
    prisma.inventaire.count({ where }),
  ]);
  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

async function getInventaire(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  return prisma.inventaire.findFirst({
    where: { id: Number(id), depot: { societeId: sid } },
    include: {
      depot: true,
      lignes: {
        orderBy: { id: "asc" },
        include: ligneInclude,
      },
    },
  });
}

async function generateInventaireReference(societeId) {
  const sid = requireActiveSocieteId(societeId);
  const last = await prisma.inventaire.findFirst({
    where: {
      depot: { societeId: sid },
      reference: { startsWith: "INV-" },
    },
    orderBy: { id: "desc" },
  });

  let nextNum = 1;
  if (last) {
    const match = last.reference.match(/INV-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  let reference = `INV-${String(nextNum).padStart(3, "0")}`;
  while (await prisma.inventaire.findFirst({ where: { reference } })) {
    nextNum += 1;
    reference = `INV-${String(nextNum).padStart(3, "0")}`;
  }

  return reference;
}

async function assertLotForArticle(tx, societeId, articleId, lotId) {
  if (lotId == null || lotId === "") return null;
  const lot = await tx.lot.findFirst({
    where: {
      id: Number(lotId),
      articleId: Number(articleId),
      article: { societeId },
    },
  });
  if (!lot) {
    const err = new Error("Lot introuvable ou ne correspond pas a l'article");
    err.status = 400;
    throw err;
  }
  return lot.id;
}

async function assertEmplacementForDepot(tx, societeId, depotId, emplacementId) {
  if (emplacementId == null || emplacementId === "") return null;
  const em = await tx.emplacement.findFirst({
    where: {
      id: Number(emplacementId),
      depotId: Number(depotId),
      depot: { societeId },
    },
  });
  if (!em) {
    const err = new Error("Emplacement introuvable pour ce depot");
    err.status = 400;
    throw err;
  }
  return em.id;
}

async function createInventaire(data, societeId) {
  const clean = stripSocieteFromBody(data);
  const sid = requireActiveSocieteId(societeId);
  const dep = await prisma.depot.findFirst({
    where: { id: Number(clean.depotId), societeId: sid },
  });
  if (!dep) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }
  await assertDepotOperable(prisma, { id: dep.id, societeId: sid });
  const typeInventaire = clean.typeInventaire ?? (clean.populateFromStock ? "complet" : "partiel");
  const modeAveugle = clean.modeAveugle != null ? Boolean(clean.modeAveugle) : false;
  const emplacementIds = Array.isArray(clean.emplacementIds)
    ? clean.emplacementIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [];
  const articleIds = Array.isArray(clean.articleIds)
    ? clean.articleIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [];

  const persistInventaire = async ({ reference }) => {
    return prisma.$transaction(async (tx) => {
      await assertNoEnCoursInDepot(tx, dep.id);
      const inv = await tx.inventaire.create({
        data: {
          reference: normalizeCode(reference),
          date: clean.date ? new Date(clean.date) : undefined,
          depotId: dep.id,
          statut: "EN_COURS",
          typeInventaire,
          modeAveugle,
          zoneIds: Array.isArray(clean.zonesSelectionnees)
            ? JSON.stringify(clean.zonesSelectionnees)
            : null,
        },
      });

      if (typeInventaire === "partiel" && articleIds.length > 0) {
        for (const articleId of articleIds) {
          const stocks = await tx.stock.findMany({
            where: { depotId: dep.id, articleId, quantite: { gt: 0 } },
            orderBy: { id: "asc" },
          });

          if (stocks.length === 0) continue;

          for (const s of stocks) {
            await tx.ligneInventaire.create({
              data: {
                inventaireId: inv.id,
                articleId,
                qteTheorique: round2(Number(s.quantite)),
                qteReelle: null,
                ecart: null,
                valide: false,
                emplacementId: s.emplacementId ?? null,
              },
            });
          }
        }
      } else {
        const stockWhere = {
          depotId: dep.id,
          quantite: { gt: 0 },
        };
        if (typeInventaire === "tournant" && emplacementIds.length > 0) {
          stockWhere.emplacementId = { in: emplacementIds };
        }
        const shouldPopulate =
          clean.populateFromStock || typeInventaire === "complet" || typeInventaire === "tournant";
        if (shouldPopulate) {
          const stocks = await tx.stock.findMany({
            where: stockWhere,
            include: { article: true },
          });
          for (const s of stocks) {
            const q = round2(Number(s.quantite));
            await tx.ligneInventaire.create({
              data: {
                inventaireId: inv.id,
                articleId: s.articleId,
                qteTheorique: q,
                qteReelle: null,
                ecart: null,
                valide: false,
                emplacementId: s.emplacementId ?? null,
              },
            });
          }
        }
      }

      return tx.inventaire.findUnique({
        where: { id: inv.id },
        include: { lignes: { include: ligneInclude }, depot: true },
      });
    });
  };

  const { isAuto, code: resolvedReference } = await resolveAutoCode(
    sid,
    clean.reference,
    generateInventaireReference
  );
  if (isAuto) {
    return createWithAutoCode(
      sid,
      { reference: resolvedReference || undefined },
      generateInventaireReference,
      persistInventaire,
      3,
      "reference"
    );
  }
  return persistInventaire({ reference: resolvedReference });
}

async function addLigne(inventaireId, data, societeId) {
  const inv = await getInventaire(inventaireId, societeId);
  if (!inv || inv.statut !== "EN_COURS") {
    const err = new Error("Inventaire introuvable ou deja cloture");
    err.status = 400;
    throw err;
  }
  const sid = requireActiveSocieteId(societeId);
  const art = await prisma.article.findFirst({
    where: { id: Number(data.articleId), societeId: sid },
  });
  if (!art) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  const qteTheorique = data.qteTheorique != null ? round2(Number(data.qteTheorique)) : 0;
  return prisma.$transaction(async (tx) => {
    const lotId = await assertLotForArticle(tx, sid, art.id, data.lotId);
    const emplacementId = await assertEmplacementForDepot(tx, sid, inv.depotId, data.emplacementId);
    return tx.ligneInventaire.create({
      data: {
        inventaireId: inv.id,
        articleId: art.id,
        qteTheorique,
        qteReelle: data.qteReelle != null ? round2(Number(data.qteReelle)) : null,
        ecart:
          data.qteReelle != null ? round2(Number(data.qteReelle) - qteTheorique) : null,
        valide: false,
        ...(lotId != null ? { lotId } : {}),
        ...(emplacementId != null ? { emplacementId } : {}),
      },
      include: ligneInclude,
    });
  });
}

async function updateLigne(inventaireId, ligneId, data, societeId) {
  const inv = await getInventaire(inventaireId, societeId);
  if (!inv || inv.statut !== "EN_COURS") {
    const err = new Error("Inventaire introuvable ou deja cloture");
    err.status = 400;
    throw err;
  }
  const ligne = await prisma.ligneInventaire.findFirst({
    where: { id: Number(ligneId), inventaireId: inv.id },
  });
  if (!ligne) {
    const err = new Error("Ligne introuvable");
    err.status = 404;
    throw err;
  }
  const sid = requireActiveSocieteId(societeId);
  const qteReelle = data.qteReelle !== undefined ? (data.qteReelle != null ? round2(Number(data.qteReelle)) : null) : ligne.qteReelle;
  const qteTheorique =
    data.qteTheorique != null ? round2(Number(data.qteTheorique)) : ligne.qteTheorique;
  const ecart = qteReelle != null ? round2(Number(qteReelle) - Number(qteTheorique)) : null;
  const qteReelleChanged = data.qteReelle !== undefined && qteReelle !== ligne.qteReelle;

  return prisma.$transaction(async (tx) => {
    let nextLotId = ligne.lotId;
    let nextEmplacementId = ligne.emplacementId;
    if (data.lotId !== undefined) {
      nextLotId = await assertLotForArticle(tx, sid, ligne.articleId, data.lotId);
    }
    if (data.emplacementId !== undefined) {
      nextEmplacementId = await assertEmplacementForDepot(tx, sid, inv.depotId, data.emplacementId);
    }
    return tx.ligneInventaire.update({
      where: { id: ligne.id },
      data: {
        ...(data.qteTheorique != null ? { qteTheorique } : {}),
        ...(data.qteReelle !== undefined ? { qteReelle: qteReelle != null ? qteReelle : null } : {}),
        ecart,
        ...(qteReelleChanged ? { recomptageDemande: false } : {}),
        ...(data.valide !== undefined ? { valide: Boolean(data.valide) } : {}),
        ...(data.lotId !== undefined ? { lotId: nextLotId } : {}),
        ...(data.emplacementId !== undefined ? { emplacementId: nextEmplacementId } : {}),
      },
      include: ligneInclude,
    });
  });
}

async function bulkUpdateLignes(inventaireId, lignes, societeId) {
  const inv = await getInventaire(inventaireId, societeId);
  if (!inv || inv.statut !== "EN_COURS") {
    const err = new Error("Inventaire introuvable ou deja cloture");
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(lignes) || !lignes.length) {
    return { savedAt: new Date().toISOString(), updated: 0, lignes: inv.lignes || [] };
  }
  const sid = requireActiveSocieteId(societeId);
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of lignes) {
      const ligneId = Number(row.id);
      if (!Number.isFinite(ligneId)) continue;
      const ligne = await tx.ligneInventaire.findFirst({
        where: { id: ligneId, inventaireId: inv.id },
        include: { article: { select: { prixAchat: true, strategieSortie: true } } },
      });
      if (!ligne) continue;
      const qteReelle =
        row.quantite_reelle !== undefined
          ? row.quantite_reelle != null
            ? round2(Number(row.quantite_reelle))
            : null
          : row.qteReelle !== undefined
            ? row.qteReelle != null
              ? round2(Number(row.qteReelle))
              : null
            : ligne.qteReelle;
      const ecart = qteReelle != null ? round2(Number(qteReelle) - Number(ligne.qteTheorique)) : null;
      const qteReelleChanged = qteReelle !== ligne.qteReelle;
      const coutUnitaire = await valuationService.getCoutUnitaireCourant(tx, {
        societeId: sid,
        articleId: ligne.articleId,
        depotId: inv.depotId,
      });
      const valeurEcart =
        ecart != null && Math.abs(ecart) >= 1e-9
          ? round2(ecart * coutUnitaire)
          : ecart === 0
            ? 0
            : null;
      await tx.ligneInventaire.update({
        where: { id: ligne.id },
        data: {
          qteReelle,
          ecart,
          valeurEcart,
          ...(qteReelleChanged ? { recomptageDemande: false } : {}),
        },
      });
      updated += 1;
    }
  });
  const refreshed = await getInventaire(inventaireId, societeId);
  return {
    savedAt: new Date().toISOString(),
    updated,
    lignes: refreshed?.lignes || [],
  };
}

async function toggleRecomptageLigne(inventaireId, ligneId, societeId) {
  const inv = await getInventaire(inventaireId, societeId);
  if (!inv || inv.statut !== "EN_COURS") {
    const err = new Error("Inventaire introuvable ou deja cloture");
    err.status = 400;
    throw err;
  }
  const ligne = await prisma.ligneInventaire.findFirst({
    where: { id: Number(ligneId), inventaireId: inv.id },
  });
  if (!ligne) {
    const err = new Error("Ligne introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.ligneInventaire.update({
    where: { id: ligne.id },
    data: { recomptageDemande: !ligne.recomptageDemande },
    include: ligneInclude,
  });
}

async function validateInventaire(inventaireId, user, options = {}) {
  const action = options.action || "ajuster";
  const sid = requireActiveSocieteId(user.societeId);
  const pre = await prisma.inventaire.findFirst({
    where: { id: Number(inventaireId), depot: { societeId: sid } },
    select: { id: true, statut: true },
  });
  if (!pre || pre.statut !== "EN_COURS") {
    const err = new Error("Inventaire introuvable ou deja cloture");
    err.status = 400;
    throw err;
  }

  if (action === "rejeter") {
    return prisma.$transaction(async (tx) => {
      await tx.ligneInventaire.updateMany({
        where: { inventaireId: pre.id },
        data: {
          qteReelle: null,
          ecart: null,
          valeurEcart: null,
          valide: false,
          lotsAjustes: null,
        },
      });
      await tx.inventaire.update({
        where: { id: pre.id },
        data: { statut: "EN_COURS" },
      });
      return tx.inventaire.findUnique({
        where: { id: pre.id },
        include: { lignes: { include: ligneInclude }, depot: true },
      });
    });
  }

  if (action === "valider_sans_ajustement") {
    return prisma.$transaction(async (tx) => {
      const inv = await tx.inventaire.findFirst({
        where: { id: pre.id },
        include: {
          lignes: {
            include: { article: { select: { id: true, code: true } } },
          },
        },
      });
      assertNoRecomptagePending(inv.lignes);
      for (const ligne of inv.lignes) {
        if (ligne.qteReelle == null) {
          const err = new Error(`Quantite reelle manquante pour ligne ${ligne.id}`);
          err.status = 400;
          throw err;
        }
        const ecart = round2(Number(ligne.qteReelle) - Number(ligne.qteTheorique));
        await tx.ligneInventaire.update({
          where: { id: ligne.id },
          data: { ecart, valide: true },
        });
      }
      await tx.inventaire.update({ where: { id: inv.id }, data: { statut: "VALIDE" } });
      return tx.inventaire.findUnique({
        where: { id: inv.id },
        include: { lignes: { include: ligneInclude }, depot: true },
      });
    });
  }

  return prisma.$transaction(async (tx) => {
    const inv = await tx.inventaire.findFirst({
      where: { id: pre.id },
      include: {
        depot: true,
        lignes: {
          orderBy: { id: "asc" },
          include: {
            article: {
              select: {
                id: true,
                code: true,
                libelle: true,
                prixAchat: true,
                strategieSortie: true,
              },
            },
            lot: { select: { id: true } },
            emplacement: { select: { id: true } },
          },
        },
      },
    });

    assertNoRecomptagePending(inv.lignes);

    const lotWarnings = [];
    let ajustementsAppliques = 0;
    let valeurNette = 0;

    for (const ligne of inv.lignes) {
      if (ligne.qteReelle == null) {
        const err = new Error(`Quantite reelle manquante pour article ${ligne.article?.code}`);
        err.status = 400;
        throw err;
      }
      if (Number(ligne.qteReelle) < 0) {
        const nom = ligne.article?.libelle || ligne.article?.code || String(ligne.articleId);
        const err = new Error(`Quantité réelle négative pour l'article ${nom}`);
        err.status = 400;
        throw err;
      }
      const ecart = round2(Number(ligne.qteReelle) - Number(ligne.qteTheorique));
      const coutUnitaire = await valuationService.getCoutUnitaireCourant(tx, {
        societeId: sid,
        articleId: ligne.articleId,
        depotId: inv.depotId,
      });

      if (Math.abs(ecart) < 1e-9) {
        await tx.ligneInventaire.update({
          where: { id: ligne.id },
          data: { ecart: 0, valide: true, valeurEcart: 0, lotsAjustes: null },
        });
        continue;
      }

      const valeurEcart = round2(ecart * coutUnitaire);
      ajustementsAppliques += 1;
      valeurNette = round2(valeurNette + valeurEcart);
      let lotsAjustes = null;

      await mouvementsService.adjustStock(tx, {
        societeId: sid,
        articleId: ligne.articleId,
        depotId: inv.depotId,
        emplacementId: ligne.emplacementId ?? null,
        delta: ecart,
      });
      await mouvementsService.insertMouvement(tx, {
        reference: mouvementsService.genRef("MVT-INV"),
        type: ecart > 0 ? "ENTREE_AJUSTEMENT" : "SORTIE_AUTRE",
        articleId: ligne.articleId,
        depotId: inv.depotId,
        emplacementId: ligne.emplacementId ?? null,
        quantite: Math.abs(ecart),
        valeur: coutUnitaire > 0 ? round2(Math.abs(ecart) * coutUnitaire) : null,
        utilisateurId: user.id,
        commentaire: `Inventaire ${inv.reference} ecart ${ecart}`,
        lotId: ligne.lotId ?? null,
      });

      // Entrée inventaire : aligner lots + couches FIFO sur le stock physique
      if (ecart > 0) {
        const lotsService = require("../lots/lots.service");
        await lotsService.ensureStockCoveredByLots(tx, {
          articleId: ligne.articleId,
          depotId: inv.depotId,
        });
        await valuationService.ensureStockCoveredByCouches(tx, {
          societeId: sid,
          articleId: ligne.articleId,
          depotId: inv.depotId,
        });
      }

      // Sortie inventaire : consommer des lots précis pour traçabilité
      if (ecart < 0) {
        const perte = Math.abs(ecart);
        const lotsService = require("../lots/lots.service");
        try {
          const { lotsConsumed } = await lotsService.consumeLotsInTransaction(tx, {
            articleId: ligne.articleId,
            depotId: inv.depotId,
            societeId: sid,
            quantite: perte,
            strategie: ligne.article?.strategieSortie,
          });
          lotsAjustes = JSON.stringify(lotsConsumed);
        } catch (e) {
          if (e.code === "STOCK_INSUFFISANT") {
            lotsAjustes = JSON.stringify({ warning: LOT_WARNING_MSG });
            lotWarnings.push({
              ligneId: ligne.id,
              articleId: ligne.articleId,
              articleCode: ligne.article?.code,
              articleLibelle: ligne.article?.libelle,
              message: LOT_WARNING_MSG,
            });
          } else {
            throw e;
          }
        }
      }

      await tx.ligneInventaire.update({
        where: { id: ligne.id },
        data: { ecart, valide: true, valeurEcart, lotsAjustes },
      });
    }
    await tx.inventaire.update({
      where: { id: inv.id },
      data: { statut: "VALIDE" },
    });
    const result = await tx.inventaire.findUnique({
      where: { id: inv.id },
      include: { lignes: { include: ligneInclude }, depot: true },
    });
    return {
      ...result,
      validationSummary: {
        ajustementsAppliques,
        valeurNette,
        lotWarnings,
      },
    };
  });
}

async function deleteInventaire(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const inv = await prisma.inventaire.findFirst({
    where: { id: Number(id), depot: { societeId: sid } },
  });
  if (!inv) {
    const err = new Error("Inventaire introuvable");
    err.status = 404;
    throw err;
  }
  if (inv.statut !== "EN_COURS") {
    const err = new Error("Seuls les inventaires en cours peuvent etre supprimes");
    err.status = 400;
    throw err;
  }
  await prisma.$transaction(async (tx) => {
    await tx.ligneInventaire.deleteMany({ where: { inventaireId: inv.id } });
    await tx.inventaire.delete({ where: { id: inv.id } });
  });
  return { ok: true, id: inv.id };
}

async function duplicateInventaire(id, societeId) {
  const source = await getInventaire(id, societeId);
  if (!source) {
    const err = new Error("Inventaire introuvable");
    err.status = 404;
    throw err;
  }
  const articleIds = [...new Set((source.lignes || []).map((l) => l.articleId).filter(Boolean))];
  if (!articleIds.length) {
    const err = new Error("Cet inventaire ne contient aucun article a dupliquer");
    err.status = 400;
    throw err;
  }
  return createInventaire({ depotId: source.depotId, articleIds }, societeId);
}

async function cancelInventaire(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const inv = await prisma.inventaire.findFirst({
    where: { id: Number(id), depot: { societeId: sid } },
    include: {
      depot: { select: { id: true, code: true, libelle: true } },
      _count: { select: { lignes: true } },
    },
  });
  if (!inv) {
    const err = new Error("Inventaire introuvable");
    err.status = 404;
    throw err;
  }
  if (inv.statut !== "EN_COURS") {
    const err = new Error("Seuls les inventaires en cours peuvent etre annules");
    err.status = 400;
    throw err;
  }
  return prisma.inventaire.update({
    where: { id: inv.id },
    data: { statut: "ANNULE" },
    include: {
      depot: { select: { id: true, code: true, libelle: true } },
      _count: { select: { lignes: true } },
    },
  });
}

function computeInventaireSummary(lignes) {
  let saisis = 0;
  let ecarts = 0;
  let valeurEcart = 0;
  for (const l of lignes || []) {
    if (l.qteReelle != null) {
      saisis += 1;
      const ec = round2(Number(l.qteReelle) - Number(l.qteTheorique));
      if (Math.abs(ec) >= 1e-9) {
        ecarts += 1;
        valeurEcart += Number(l.valeurEcart ?? 0);
      }
    }
  }
  return { saisis, ecarts, valeurEcart: round2(valeurEcart), totalLignes: (lignes || []).length };
}

async function getEcartsRapport(id, societeId) {
  const inv = await getInventaire(id, societeId);
  if (!inv) {
    const err = new Error("Inventaire introuvable");
    err.status = 404;
    throw err;
  }
  if (inv.statut !== "VALIDE") {
    const err = new Error("Seuls les inventaires validés peuvent générer ce rapport d'écarts");
    err.status = 400;
    throw err;
  }

  const lignes = (inv.lignes || [])
    .map((l) => {
      const qteTheorique = Number(l.qteTheorique ?? 0);
      const qteReelle = l.qteReelle != null ? Number(l.qteReelle) : null;
      const ecart =
        l.ecart != null
          ? Number(l.ecart)
          : qteReelle != null
            ? round2(qteReelle - qteTheorique)
            : null;
      const pctEcart =
        qteTheorique > 0 && ecart != null ? round2((ecart / qteTheorique) * 100) : null;
      return {
        id: l.id,
        article: l.article,
        qteTheorique,
        qteReelle,
        ecart,
        pctEcart,
        valeurEcart: round2(Number(l.valeurEcart ?? 0)),
      };
    })
    .filter((l) => l.qteReelle != null);

  lignes.sort((a, b) => Math.abs(b.ecart || 0) - Math.abs(a.ecart || 0));

  let totalEcartsPositifs = 0;
  let totalEcartsNegatifs = 0;
  let valeurTotaleEcart = 0;
  let sansEcart = 0;

  for (const l of lignes) {
    const ec = l.ecart || 0;
    valeurTotaleEcart += l.valeurEcart || 0;
    if (Math.abs(ec) < 1e-9) sansEcart += 1;
    else if (ec > 0) totalEcartsPositifs += ec;
    else totalEcartsNegatifs += ec;
  }

  const tauxFiabilite = lignes.length > 0 ? round2((sansEcart / lignes.length) * 100) : 100;
  const top10 = lignes.filter((l) => Math.abs(l.ecart || 0) >= 1e-9).slice(0, 10);

  return {
    inventaire: {
      id: inv.id,
      reference: inv.reference,
      date: inv.date,
      statut: inv.statut,
      depot: inv.depot,
      responsable: inv.depot?.libelle || "—",
    },
    summary: {
      totalEcartsPositifs: round2(totalEcartsPositifs),
      totalEcartsNegatifs: round2(totalEcartsNegatifs),
      valeurTotaleEcart: round2(valeurTotaleEcart),
      tauxFiabilite,
      lignesAvecEcart: lignes.length - sansEcart,
      totalLignes: lignes.length,
    },
    top10,
    items: lignes,
  };
}

async function buildInventairePdfBuffer(id, societeId) {
  const inv = await getInventaire(id, societeId);
  if (!inv) return null;
  const sid = requireActiveSocieteId(societeId);
  const societe = await prisma.societe.findUnique({ where: { id: sid } });
  return generateInventairePdf(inv, inv.lignes, societe);
}

async function buildInventaireExcelBuffer(id, societeId) {
  const inv = await getInventaire(id, societeId);
  if (!inv) return null;
  const sid = requireActiveSocieteId(societeId);
  const societe = await prisma.societe.findUnique({ where: { id: sid } });
  const summary = computeInventaireSummary(inv.lignes);
  return generateInventaireExcel({ ...inv, summary, societe }, inv.lignes);
}

async function buildInventairesListExcelBuffer(user, filters = {}) {
  const result = await listInventairesEnriched({ user, ...filters, limit: 500 });
  return generateInventairesListExcel(result.items);
}

module.exports = {
  listInventaires,
  listInventairesEnriched,
  getInventaire,
  createInventaire,
  addLigne,
  updateLigne,
  bulkUpdateLignes,
  toggleRecomptageLigne,
  validateInventaire,
  cancelInventaire,
  deleteInventaire,
  duplicateInventaire,
  buildInventairePdfBuffer,
  buildInventaireExcelBuffer,
  buildInventairesListExcelBuffer,
  getEcartsRapport,
  parseLotsAjustes,
  isLotWarning,
  LOT_WARNING_MSG,
  generateInventaireReference,
};
