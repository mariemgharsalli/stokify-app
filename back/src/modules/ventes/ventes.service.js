const prisma = require("../../config/database");
const {
  adjustStock,
  sumStockQuantite,
  insertMouvement,
  resolveDepot,
  releaseVenteReservations,
  reserveVenteLignes,
  MOUVEMENT_TYPES,
} = require("../mouvements/mouvements.service");
const { getSocieteWhere, stripSocieteFromBody } = require("../../utils/societeScope");
const { assertArticleActif } = require("../articles/articles.service");
const { createBaseDoc, drawTable, drawTotalsBlock, drawDocTitle, drawMetaStrip, drawPartyCards, drawSignatureRow, fmtDate, fmtMoney, SUCCESS, DANGER, SOFT_ACCENT, ACCENT } = require("../../utils/pdfHelper");
const AppError = require("../../utils/AppError");
const valuationService = require("../valuation/valuation.service");
const factureService = require("../factures/facture.service");
const lotsService = require("../lots/lots.service");
const { normalizeCode, createWithAutoCode, resolveAutoCode } = require("../../utils/codeUtils");
const { resolveModeTracage, tracksLot, tracksSerie, assertIntegerQuantite } = require("../../utils/tracage");

function buildTvaLabelFromLignes(lignes) {
  const taux = [...new Set((lignes || []).map((l) => l.tauxTva))].filter((t) => t != null);
  if (taux.length === 0) return "TVA";
  if (taux.length === 1) return `TVA (${taux[0]}%)`;
  return `TVA (taux multiples : ${taux.join("% / ")}%)`;
}

/** @deprecated Conservé pour compat tests / exports — préférer tauxTva par ligne */
const TVA_DEFAULT = 0.19;
const STATUTS_CONFIRMES = ["CONFIRME", "VALIDE", "LIVRE"];

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function isVenteConfirmee(statut) {
  return STATUTS_CONFIRMES.includes(String(statut || "").toUpperCase());
}

function statutFilter(statut) {
  if (!statut) return {};
  const s = String(statut).toUpperCase();
  if (s === "CONFIRME") return { statut: { in: STATUTS_CONFIRMES } };
  if (s === "ANNULE" || s === "ANNULEE") return { statut: { in: ["ANNULE", "ANNULEE"] } };
  return { statut: s };
}

async function nextAvoirReference(tx, societeId) {
  const year = new Date().getFullYear();
  const prefix = `AVO-${year}-`;
  const last = await tx.vente.findFirst({
    where: { societeId: Number(societeId), reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
  });
  let seq = 1;
  if (last?.reference) {
    const m = String(last.reference).match(/-(\d{4})$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function nextVenteReference(tx, societeId) {
  const year = new Date().getFullYear();
  const prefix = `VTE-${year}-`;
  const last = await tx.vente.findFirst({
    where: { societeId: Number(societeId), reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
  });
  let seq = 1;
  if (last?.reference) {
    const m = String(last.reference).match(/-(\d{4})$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function syncClientEncours(tx, clientId) {
  const ventes = await tx.vente.findMany({
    where: {
      clientId: Number(clientId),
      statut: { in: STATUTS_CONFIRMES },
      typeVente: { not: "AVOIR" },
    },
    include: { reglements: true },
  });
  let total = 0;
  for (const v of ventes) {
    const reg = (v.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
    const solde = Number(v.totalTTC) - reg;
    if (solde > 0.009) total += solde;
  }
  await tx.client.update({
    where: { id: Number(clientId) },
    data: { encours: round2(total) },
  });
}

async function consumeLotsWithDetails(tx, articleId, quantiteToConsume, depotId, societeId, strategieOverride) {
  try {
    return await lotsService.consumeLotsInTransaction(tx, {
      articleId,
      depotId,
      societeId,
      quantite: quantiteToConsume,
      strategie: strategieOverride,
    });
  } catch (e) {
    if (e.status === 404) {
      throw new AppError(e.message, "NOT_FOUND", 404);
    }
    if (e.status === 409 || e.code === "STOCK_INSUFFISANT") {
      throw new AppError(e.message, "STOCK_INSUFFISANT", 409, e.details || {});
    }
    throw e;
  }
}

async function consumeNumerosSerieWithDetails(tx, articleId, quantite, depotId, strategie) {
  let n;
  try {
    n = assertIntegerQuantite(
      quantite,
      "La quantité vendue doit être un entier pour un article en numéro de série"
    );
  } catch (e) {
    throw new AppError(e.message, "VALIDATION_ERROR", 422);
  }
  const orderBy =
    String(strategie || "").toUpperCase() === "FEFO"
      ? [{ lot: { dateExpiration: "asc" } }, { createdAt: "asc" }]
      : { createdAt: "asc" };
  const disponibles = await tx.numeroSerie.findMany({
    where: { articleId: Number(articleId), depotId: Number(depotId), statut: "DISPONIBLE" },
    orderBy,
    take: n,
  });
  if (disponibles.length < n) {
    throw new AppError(
      `Stock de numéros de série insuffisant (${disponibles.length}/${n} disponibles)`,
      "VALIDATION_ERROR",
      422
    );
  }
  await tx.numeroSerie.updateMany({
    where: { id: { in: disponibles.map((s) => s.id) } },
    data: { statut: "VENDU" },
  });
  return disponibles;
}

/** Décrémente les lots parents des numéros de série déjà sortis (mode lot + série). */
async function decrementLotsOfSeries(tx, series) {
  const groups = new Map();
  for (const serie of series) {
    if (!serie.lotId) {
      throw new AppError(
        `Le numéro de série ${serie.numero} n'est rattaché à aucun lot`,
        "VALIDATION_ERROR",
        422
      );
    }
    const group = groups.get(serie.lotId) || { qty: 0, numeros: [] };
    group.qty += 1;
    group.numeros.push(serie.numero);
    groups.set(serie.lotId, group);
  }

  const lotsConsumed = [];
  for (const [lotId, group] of groups) {
    const lot = await tx.lot.findUnique({ where: { id: lotId } });
    if (!lot) {
      throw new AppError("Lot introuvable pour un numéro de série", "NOT_FOUND", 404);
    }
    const rest = Number(lot.quantiteRestante);
    if (rest + 1e-6 < group.qty) {
      throw new AppError(
        `Stock lot insuffisant pour le lot ${lot.numero}`,
        "STOCK_INSUFFISANT",
        409
      );
    }
    const newQ = round2(rest - group.qty);
    await tx.lot.update({
      where: { id: lot.id },
      data: {
        quantiteRestante: newQ,
        statut: newQ <= 1e-9 ? "EPUISE" : lot.statut,
      },
    });
    lotsConsumed.push({
      lotId: lot.id,
      lotNumero: lot.numero,
      quantite: group.qty,
      dateExpiration: lot.dateExpiration,
      numerosSerie: group.numeros,
    });
  }
  return lotsConsumed;
}

/** @deprecated use consumeLotsWithDetails */
async function consumeLots(tx, articleId, quantiteToConsume, depotId, societeId) {
  await consumeLotsWithDetails(tx, articleId, quantiteToConsume, depotId, societeId);
}

async function listVentes(user, { statut, clientId, depotId, search, dateDebut, dateFin, modePaiement, page = 1, limit = 25 } = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;

  const searchStr = search ? String(search).trim() : "";
  let dateFilter = {};
  if (dateDebut || dateFin) {
    dateFilter = {
      dateVente: {
        ...(dateDebut ? { gte: new Date(String(dateDebut)) } : {}),
        ...(dateFin
          ? {
              lte: (() => {
                const d = new Date(String(dateFin));
                d.setHours(23, 59, 59, 999);
                return d;
              })(),
            }
          : {}),
      },
    };
  }

  const where = {
    societeId: sid,
    ...statutFilter(statut),
    ...(clientId ? { clientId: Number(clientId) } : {}),
    ...(depotId ? { depotId: Number(depotId) } : {}),
    ...(modePaiement ? { modePaiement: String(modePaiement) } : {}),
    ...(searchStr
      ? {
          OR: [
            { reference: { contains: searchStr } },
            { client: { nom: { contains: searchStr } } },
            { client: { code: { contains: searchStr } } },
          ],
        }
      : {}),
    ...dateFilter,
  };

  const [items, total] = await Promise.all([
    prisma.vente.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { id: "desc" },
      include: {
        client: { select: { id: true, code: true, nom: true, email: true, plafondCredit: true, encours: true } },
        depot: { select: { id: true, code: true, libelle: true } },
        lignes: { include: { article: { select: { code: true, libelle: true, unite: true } } } },
        reglements: true,
        facture: { select: { id: true, numero: true, statut: true, dateEcheance: true } },
      },
    }),
    prisma.vente.count({ where }),
  ]);

  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

async function getVente(user, id) {
  const { societeId: sid } = getSocieteWhere(user);
  const v = await prisma.vente.findFirst({
    where: { id: Number(id), societeId: sid },
    include: {
      client: true,
      depot: true,
      societe: {
        select: {
          nom: true,
          code: true,
          adresse: true,
          ville: true,
          telephones: true,
          email: true,
          logo: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
        },
      },
      confirmateur: { select: { id: true, nom: true, prenom: true, email: true } },
      facture: true,
      venteOrigine: { select: { id: true, reference: true, facture: { select: { numero: true } } } },
      avoirs: {
        select: {
          id: true,
          reference: true,
          facture: { select: { numero: true, statut: true } },
          lignes: { select: { articleId: true, quantite: true } },
        },
      },
      lignes: { include: { article: { include: { famille: true } } } },
      reglements: true,
    },
  });
  if (!v) {
    const err = new Error("Vente introuvable");
    err.status = 404;
    throw err;
  }
  return v;
}

async function buildVenteLignePayload(sid, lignes) {
  const ligneData = [];
  let totalHT = 0;
  let totalTVA = 0;
  for (const l of lignes) {
    const articleId = Number(l.articleId);
    const quantite = Number(l.quantite);
    if (!articleId || quantite <= 0) {
      const err = new Error("Chaque ligne doit avoir articleId et quantite valides");
      err.status = 400;
      throw err;
    }
    await assertArticleActif(articleId, sid);
    const article = await prisma.article.findFirst({
      where: { id: articleId, societeId: sid, actif: true },
    });
    if (!article) {
      const err = new Error(`Article ${articleId} introuvable ou inactif`);
      err.status = 404;
      throw err;
    }
    const prixUnit = l.prixUnit != null ? Number(l.prixUnit) : Number(article.prixVente) || 0;
    const remise = Number(l.remise) || 0;
    const lineHT = round2(quantite * prixUnit - remise);
    if (lineHT < 0) {
      const err = new Error("Montant ligne invalide (remise trop importante ?)");
      err.status = 400;
      throw err;
    }
    const tauxTva = Number(article.tauxTva ?? 19);
    const montantTva = round2(lineHT * (tauxTva / 100));
    totalHT += lineHT;
    totalTVA += montantTva;
    ligneData.push({
      articleId: article.id,
      quantite,
      prixUnit,
      remise,
      totalHT: lineHT,
      tauxTva,
      montantTva,
    });
  }
  return { ligneData, totalHTBrut: totalHT, totalTVA: round2(totalTVA) };
}

async function createVente(user, data) {
  const clean = stripSocieteFromBody(data);
  const { societeId: sid } = getSocieteWhere(user);
  const { clientId, depotId, lignes, modePaiement, remiseGlobale = 0, statut = "BROUILLON" } = clean;

  if (!Array.isArray(lignes) || lignes.length === 0) {
    const err = new Error("Au moins une ligne de vente est requise");
    err.status = 400;
    throw err;
  }

  const client = await prisma.client.findFirst({
    where: { id: Number(clientId), societeId: sid },
  });
  if (!client) {
    const err = new Error("Client introuvable");
    err.status = 404;
    throw err;
  }

  const { ligneData, totalHTBrut, totalTVA: totalTVABrut } = await buildVenteLignePayload(sid, lignes);
  const remGlob = Number(remiseGlobale) || 0;
  let totalHT = round2(totalHTBrut - remGlob);
  if (totalHT < 0) {
    const err = new Error("Total HT invalide");
    err.status = 400;
    throw err;
  }
  const ratioRemise = totalHTBrut > 0 ? totalHT / totalHTBrut : 1;
  const totalTVA = round2(totalTVABrut * ratioRemise);
  const totalTTC = round2(totalHT + totalTVA);

  const generateRef = () => nextVenteReference(prisma, sid);
  const { isAuto, code: resolvedRef } = await resolveAutoCode(sid, clean.reference, generateRef);

  const persistVente = async ({ reference }) =>
    prisma.$transaction(async (tx) => {
      const depId = await resolveDepot(tx, sid, depotId);
      return tx.vente.create({
        data: {
          reference: normalizeCode(reference),
          clientId: client.id,
          societeId: sid,
          depotId: depId,
          ...(clean.dateVente ? { dateVente: new Date(clean.dateVente) } : {}),
          ...(clean.dateLivraison ? { dateLivraison: new Date(clean.dateLivraison) } : {}),
          statut,
          totalHT,
          totalTVA,
          totalTTC,
          remise: remGlob,
          modePaiement: modePaiement || null,
          lignes: { create: ligneData },
        },
        include: {
          client: { select: { nom: true, code: true } },
          depot: { select: { code: true, libelle: true } },
          lignes: { include: { article: { select: { code: true, libelle: true } } } },
        },
      });
    });

  if (isAuto) {
    return createWithAutoCode(
      sid,
      { reference: resolvedRef || undefined },
      generateRef,
      persistVente,
      3,
      "reference"
    );
  }
  return persistVente({ reference: resolvedRef });
}

async function confirmerVente(user, venteId) {
  const { societeId: sid } = getSocieteWhere(user);
  const userId = user.id;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM Vente WHERE id = ${Number(venteId)} FOR UPDATE`;

    const vente = await tx.vente.findFirst({
      where: { id: Number(venteId), societeId: sid },
      include: { lignes: { include: { article: true } } },
    });
    if (!vente) {
      throw new AppError("Vente introuvable", "NOT_FOUND", 404);
    }
    if (!["BROUILLON", "EN_ATTENTE"].includes(vente.statut)) {
      throw new AppError("Seule une vente en brouillon peut etre confirmee", "VALIDATION_ERROR", 400);
    }

    let depId = vente.depotId ?? (await resolveDepot(tx, sid, null));
    const isCommandeWeb = String(vente.typeVente || "") === "COMMANDE_WEB";

    // Libérer la réservation avant contrôle/consommation (elle était pour cette vente)
    if (isCommandeWeb) {
      await releaseVenteReservations(tx, vente);
    }

    // Commande web : uniquement un dépôt qui couvre TOUTES les lignes
    if (isCommandeWeb && vente.lignes?.length) {
      const { findCoveringDepot } = require("../commandesClient/commandesClient.service");
      const coveringId = await findCoveringDepot(tx, sid, vente.lignes);
      if (!coveringId) {
        throw new AppError(
          "Aucun dépôt ne peut honorer cette commande en une seule livraison (stock insuffisant)",
          "STOCK_INSUFFISANT",
          409
        );
      }
      if (coveringId !== depId) {
        await tx.vente.update({ where: { id: vente.id }, data: { depotId: coveringId } });
        depId = coveringId;
      }
    }

    for (const ligne of vente.lignes) {
      await assertArticleActif(ligne.articleId, sid);
      const modeTracage = resolveModeTracage(ligne.article);
      if (tracksLot(modeTracage)) {
        await lotsService.ensureStockCoveredByLots(tx, {
          articleId: ligne.articleId,
          depotId: depId,
        });
      }
      await valuationService.ensureStockCoveredByCouches(tx, {
        societeId: sid,
        articleId: ligne.articleId,
        depotId: depId,
      });
      const disponible = await sumStockQuantite(tx, ligne.articleId, depId);
      if (disponible + 1e-6 < Number(ligne.quantite)) {
        const depot = await tx.depot.findFirst({
          where: { id: depId },
          select: { libelle: true, code: true },
        });
        throw new AppError(
          `Stock insuffisant pour "${ligne.article?.libelle || "article"}" sur ${depot?.libelle || "ce dépôt"} (dispo : ${disponible}, demandé : ${ligne.quantite})`,
          "STOCK_INSUFFISANT",
          409,
          {
            articleId: ligne.articleId,
            libelle: ligne.article?.libelle || "",
            disponible,
            demande: ligne.quantite,
            depotId: depId,
            depotLibelle: depot?.libelle || null,
          }
        );
      }
      if (tracksLot(modeTracage)) {
        const lotDispo = await lotsService.sumLotQuantiteRestante(tx, ligne.articleId, depId);
        if (lotDispo + 1e-6 < Number(ligne.quantite)) {
          throw new AppError(
            `Stock lot insuffisant pour "${ligne.article?.libelle || "article"}" — ${Number(ligne.quantite) - lotDispo} unité(s) manquante(s) dans les lots du dépôt.`,
            "STOCK_INSUFFISANT",
            409,
            {
              articleId: ligne.articleId,
              libelle: ligne.article?.libelle || "",
              disponibleLots: lotDispo,
              demande: ligne.quantite,
            }
          );
        }
      }
      if (tracksSerie(modeTracage)) {
        let n;
        try {
          n = assertIntegerQuantite(
            ligne.quantite,
            "La quantité vendue doit être un entier pour un article en numéro de série"
          );
        } catch (e) {
          throw new AppError(e.message, "VALIDATION_ERROR", 422);
        }
        const serieDispo = await tx.numeroSerie.count({
          where: { articleId: ligne.articleId, depotId: depId, statut: "DISPONIBLE" },
        });
        if (serieDispo < n) {
          throw new AppError(
            `Stock de numéros de série insuffisant pour "${ligne.article?.libelle || "article"}" (${serieDispo}/${n})`,
            "STOCK_INSUFFISANT",
            409
          );
        }
      }
    }

    for (const ligne of vente.lignes) {
      const articleStrategy = String(ligne.article?.strategieSortie || "FIFO").toUpperCase();
      const modeTracage = resolveModeTracage(ligne.article);
      let strategy = articleStrategy;
      let lotsConsumed = [];
      let seriesConsumed = [];

      if (modeTracage === "LOT") {
        const consumed = await consumeLotsWithDetails(
          tx,
          ligne.articleId,
          ligne.quantite,
          depId,
          sid,
          articleStrategy
        );
        strategy = consumed.strategy;
        lotsConsumed = consumed.lotsConsumed;
      } else if (modeTracage === "LOT_SERIE") {
        seriesConsumed = await consumeNumerosSerieWithDetails(
          tx,
          ligne.articleId,
          ligne.quantite,
          depId,
          articleStrategy
        );
        lotsConsumed = await decrementLotsOfSeries(tx, seriesConsumed);
        strategy = articleStrategy === "FEFO" ? "FEFO" : "FIFO";
      } else if (modeTracage === "SERIE") {
        seriesConsumed = await consumeNumerosSerieWithDetails(
          tx,
          ligne.articleId,
          ligne.quantite,
          depId,
          articleStrategy
        );
        strategy = articleStrategy === "FEFO" ? "FEFO" : "FIFO";
        lotsConsumed = seriesConsumed.map((n) => ({
          numeroSerieId: n.id,
          numero: n.numero,
          lotId: n.lotId || null,
        }));
      }

      const mode = String(ligne.article?.strategieSortie || "FIFO").toUpperCase();
      const methode = mode === "FEFO" || mode === "FIFO" || mode === "STANDARD" ? "FIFO" : "CMP";

      try {
        await valuationService.onSortieStock(tx, {
          societeId: sid,
          articleId: ligne.articleId,
          depotId: depId,
          quantite: ligne.quantite,
          methode,
          lotsConsumed,
        });
      } catch (e) {
        if (e.message?.includes("FIFO insuffisantes")) {
          throw new AppError("Stock insuffisant (couches)", "STOCK_INSUFFISANT", 409, {
            articleId: ligne.articleId,
            libelle: ligne.article?.libelle || "",
          });
        }
        throw e;
      }

      await adjustStock(tx, {
        societeId: sid,
        articleId: ligne.articleId,
        depotId: depId,
        emplacementId: null,
        delta: -Number(ligne.quantite),
      });

      const ref = `SOR-${vente.reference}-${ligne.articleId}-${ligne.id}`;
      await insertMouvement(tx, {
        reference: ref,
        type: MOUVEMENT_TYPES.SORTIE_VENTE,
        articleId: ligne.articleId,
        depotId: depId,
        emplacementId: null, // sortie agrégée dépôt — pas d'emplacement unique fiable (voir note FIFO ci-dessous)
        quantite: ligne.quantite,
        valeur: ligne.totalHT,
        utilisateurId: userId,
        commentaire: `Vente ${vente.reference} — ${strategy}${
          tracksSerie(modeTracage) && seriesConsumed.length
            ? ` (${seriesConsumed.length} n° série)`
            : ""
        }${
          tracksLot(modeTracage) && lotsConsumed.length
            ? ` (${lotsConsumed.length} lot(s))`
            : ""
        }`,
        lotId: lotsConsumed[0]?.lotId || null,
        lotsDetail: lotsConsumed.length ? JSON.stringify(lotsConsumed) : null,
      });

      await tx.ligneVente.update({
        where: { id: ligne.id },
        data: {
          lotsConsumed: JSON.stringify(lotsConsumed),
          strategieAppliquee: strategy,
          strategie: strategy,
        },
      });
    }

    const confirmedAt = new Date();
    const updated = await tx.vente.update({
      where: { id: vente.id },
      data: {
        statut: "CONFIRME",
        confirmedAt,
        confirmedBy: userId,
        depotId: depId,
        statutPaiement: "NON_REGLE",
      },
      include: {
        client: true,
        depot: true,
        confirmateur: { select: { id: true, nom: true, prenom: true } },
        lignes: { include: { article: { include: { famille: true } } } },
        reglements: true,
      },
    });

    await factureService.createFactureForVente(tx, updated);
    await syncClientEncours(tx, updated.clientId);

    const full = await tx.vente.findUnique({
      where: { id: updated.id },
      include: {
        client: true,
        depot: true,
        confirmateur: { select: { id: true, nom: true, prenom: true } },
        facture: true,
        lignes: { include: { article: { include: { famille: true } } } },
        reglements: true,
      },
    });
    return full;
  }).then(async (full) => {
    // Hors transaction : statut commande + email
    try {
      const cmdSvc = require("../commandesClient/commandesClient.service");
      await cmdSvc.setCommandeStatutByVenteId(full.id, "CONFIRMEE", sid);
    } catch {
      /* ignore */
    }
    return full;
  });
}

/** @deprecated alias — use confirmerVente */
async function validateVente(user, venteId) {
  return confirmerVente(user, venteId);
}

function buildFacturePayload(vente) {
  const totalRegle = (vente.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
  return {
    type: "FACTURE_VENTE",
    numero: vente.reference,
    date: vente.dateVente,
    societe: vente.societe,
    client: {
      code: vente.client.code,
      nom: vente.client.nom,
      adresse: vente.client.adresse,
      email: vente.client.email,
    },
    depot: vente.depot,
    lignes: vente.lignes.map((l) => ({
      code: l.article.code,
      libelle: l.article.libelle,
      unite: l.article.unite,
      quantite: l.quantite,
      prixUnitaire: l.prixUnit,
      remise: l.remise,
      tauxTva: l.tauxTva,
      montantTva: l.montantTva,
      totalHT: l.totalHT,
    })),
    totaux: {
      totalHT: vente.totalHT,
      totalTVA: vente.totalTVA,
      totalTTC: vente.totalTTC,
      remiseGlobale: vente.remise,
      modePaiement: vente.modePaiement,
      montantRegle: round2(totalRegle),
      solde: round2(Number(vente.totalTTC) - totalRegle),
    },
    statut: vente.statut,
  };
}

async function getFactureJson(user, venteId) {
  const v = await getVente(user, venteId);
  return buildFacturePayload(v);
}

async function updateVente(user, venteId, data) {
  const clean = stripSocieteFromBody(data);
  const { societeId: sid } = getSocieteWhere(user);
  const id = Number(venteId);
  const {
    clientId,
    depotId,
    dateVente,
    dateLivraison,
    modePaiement,
    remiseGlobale,
    remise,
    statut: statutIn,
    lignes,
  } = clean;

  if (!Array.isArray(lignes) || lignes.length === 0) {
    const err = new Error("Au moins une ligne de vente est requise");
    err.status = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const ex = await tx.vente.findFirst({
      where: { id, societeId: sid },
      include: { lignes: true },
    });
    if (!ex) {
      const err = new Error("Vente introuvable");
      err.status = 404;
      throw err;
    }
    if (ex.statut !== "BROUILLON") {
      const err = new Error("Modification reservee aux ventes en brouillon");
      err.status = 400;
      throw err;
    }

    const client = await tx.client.findFirst({
      where: { id: Number(clientId), societeId: sid },
    });
    if (!client) {
      const err = new Error("Client introuvable");
      err.status = 404;
      throw err;
    }

    const { ligneData, totalHTBrut, totalTVA: totalTVABrut } = await buildVenteLignePayload(sid, lignes);
    const remGlob = Number(remiseGlobale ?? remise ?? 0) || 0;
    let totalHT = round2(totalHTBrut - remGlob);
    if (totalHT < 0) {
      const err = new Error("Total HT invalide");
      err.status = 400;
      throw err;
    }
    const ratioRemise = totalHTBrut > 0 ? totalHT / totalHTBrut : 1;
    const totalTVA = round2(totalTVABrut * ratioRemise);
    const totalTTC = round2(totalHT + totalTVA);

    let nextStatut = ex.statut;
    if (statutIn != null && String(statutIn).trim() !== "") {
      const s = String(statutIn);
      if (["BROUILLON", "EN_ATTENTE", "ANNULE", "ANNULEE"].includes(s)) nextStatut = s;
    }

    const depId = await resolveDepot(tx, sid, depotId ?? ex.depotId);
    const isWeb = String(ex.typeVente || "") === "COMMANDE_WEB";

    // Libérer l'ancienne réservation avant de modifier les lignes / statut
    if (isWeb) {
      await releaseVenteReservations(tx, ex);
    }

    await tx.ligneVente.deleteMany({ where: { venteId: ex.id } });

    const updated = await tx.vente.update({
      where: { id: ex.id },
      data: {
        ...(clean.reference != null && String(clean.reference).trim() !== ""
          ? { reference: normalizeCode(clean.reference) }
          : {}),
        clientId: client.id,
        depotId: depId,
        ...(dateVente ? { dateVente: new Date(dateVente) } : {}),
        ...(dateLivraison !== undefined
          ? { dateLivraison: dateLivraison ? new Date(dateLivraison) : null }
          : {}),
        modePaiement: modePaiement != null ? modePaiement : ex.modePaiement,
        statut: nextStatut,
        totalHT,
        totalTVA,
        totalTTC,
        remise: remGlob,
        lignes: { create: ligneData },
      },
      include: {
        client: { select: { nom: true, code: true } },
        depot: { select: { code: true, libelle: true } },
        lignes: { include: { article: { select: { code: true, libelle: true } } } },
        reglements: true,
      },
    });

    // Re-réserver si la vente web reste active en brouillon
    if (isWeb && nextStatut !== "ANNULE") {
      await reserveVenteLignes(tx, { depotId: depId, lignes: updated.lignes });
    }

    return updated;
  });
}

async function deleteVente(user, venteId) {
  const { societeId: sid } = getSocieteWhere(user);
  const id = Number(venteId);

  return prisma.$transaction(async (tx) => {
    const ex = await tx.vente.findFirst({
      where: { id, societeId: sid },
      include: { lignes: true },
    });
    if (!ex) {
      const err = new Error("Vente introuvable");
      err.status = 404;
      throw err;
    }
    if (ex.statut !== "BROUILLON") {
      const err = new Error("Suppression reservee aux ventes en brouillon");
      err.status = 400;
      throw err;
    }
    if (String(ex.typeVente || "") === "COMMANDE_WEB") {
      await releaseVenteReservations(tx, ex);
    }
    await tx.commandeClient.updateMany({
      where: { venteId: ex.id },
      data: { venteId: null, statut: "ANNULEE" },
    });
    await tx.reglement.deleteMany({ where: { venteId: ex.id } });
    await tx.ligneVente.deleteMany({ where: { venteId: ex.id } });
    await tx.vente.delete({ where: { id: ex.id } });
    return { deleted: true };
  });
}

async function addReglement(user, venteId, { montant, mode, reference, statut = "VALIDE" }) {
  const { societeId: sid } = getSocieteWhere(user);
  const m = Number(montant);
  if (!m || m <= 0) {
    const err = new Error("Montant invalide");
    err.status = 400;
    throw err;
  }

  const reglementsService = require("../reglements/reglements.service");

  return prisma.$transaction(async (tx) => {
    const vente = await tx.vente.findFirst({
      where: { id: Number(venteId), societeId: sid },
      include: { reglements: true },
    });
    if (!vente) {
      const err = new Error("Vente introuvable");
      err.status = 404;
      throw err;
    }
    const reg = await tx.reglement.create({
      data: {
        venteId: vente.id,
        montant: m,
        mode: mode || "VIREMENT",
        reference: reference || null,
        statut,
      },
    });
    const sync = await reglementsService.syncVentePaiement(tx, vente.id, sid);
    await syncClientEncours(tx, vente.clientId);
    const solde = round2(Number(vente.totalTTC) - Number(sync.totalRegle || 0));
    return { reglement: reg, venteSolde: solde, statutPaiement: sync.statutPaiement, statutFacture: sync.statutFacture };
  });
}

function endPdfBuffer(doc, finishFootersAndHeaders) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    finishFootersAndHeaders();
    doc.end();
  });
}

async function getFacturePdf(user, venteId) {
  const v = await getVente(user, venteId);
  try {
    if (v.facture?.id) {
      return factureService.generateFacturePDF(v.facture.id, user);
    }

    const societe = v.societe || {};
    const accent = societe.accentHex || ACCENT;
    const title = `Document vente ${v.reference}`;
    const ctx = createBaseDoc(title, societe, { refPrefix: "VTE" });
    const {
      doc,
      contentTop,
      contentLeft,
      contentWidth,
      finishFootersAndHeaders,
      absText: t,
      ensureSpace,
    } = ctx;
    let y = contentTop;
    const cl = v.client || {};

    y = drawDocTitle(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      label: "DOCUMENT DE VENTE",
      reference: v.reference,
      accentHex: accent,
    });

    y = drawMetaStrip(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      accentHex: accent,
      items: [
        { label: "Date vente", value: fmtDate(v.dateVente) },
        { label: "Livraison", value: fmtDate(v.dateLivraison) },
        { label: "Paiement", value: v.modePaiement || "—" },
        { label: "Statut", value: v.statut || "—" },
      ],
    });

    y = drawPartyCards(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      accentHex: accent,
      left: {
        title: "Émetteur",
        name: societe.nom,
        lines: [societe.adresse, societe.ville, societe.email].filter(Boolean),
      },
      right: {
        title: "Client",
        name: cl.nom,
        lines: [cl.adresse, cl.telephone, cl.email].filter(Boolean),
      },
    });

    const rows = (v.lignes || []).map((l) => [
      l.article?.code || "",
      l.article?.libelle || "",
      String(l.quantite),
      fmtMoney(l.prixUnit),
      fmtMoney(l.remise),
      fmtMoney(l.totalHT),
    ]);
    y = drawTable(doc, {
      headers: ["Article", "Désignation", "Qté", "Prix HT", "Remise", "Total HT"],
      rows,
      startY: y,
      accentHex: accent,
      contentLeft,
      contentWidth,
      ensureSpace,
      colWidths: [55, 165, 35, 62, 50, contentWidth - 55 - 165 - 35 - 62 - 50],
    });

    const totalRegle = (v.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
    const htBrut = round2(Number(v.totalHT) + Number(v.remise || 0));
    y += 8;
    y = drawTotalsBlock(doc, {
      startY: y,
      accentHex: accent,
      contentLeft,
      contentWidth,
      entries: [
        { label: "Total HT", value: fmtMoney(htBrut) },
        { label: "Remise globale", value: fmtMoney(v.remise || 0) },
        { label: "Net HT", value: fmtMoney(v.totalHT) },
        { label: buildTvaLabelFromLignes(v.lignes), value: fmtMoney(v.totalTVA) },
        { label: "Total TTC", value: fmtMoney(v.totalTTC), highlight: true },
      ],
    });

    const solde = round2(Number(v.totalTTC) - totalRegle);
    y = ensureSpace(40, y);
    doc.fillColor(solde > 0.009 ? DANGER : SUCCESS).font("Helvetica-Bold").fontSize(10);
    t(`Solde restant dû : ${fmtMoney(solde)}`, contentLeft, y, { width: contentWidth });
    y += 18;
    doc.fillColor("#64748b").font("Helvetica").fontSize(8);
    t("Document provisoire — générez la facture officielle depuis le détail vente.", contentLeft, y, {
      width: contentWidth,
    });

    return endPdfBuffer(doc, finishFootersAndHeaders);
  } catch (e) {
    if (e.status) throw e;
    const err = new Error(e?.message || "Erreur PDF");
    err.status = 500;
    throw err;
  }
}

async function getRelancePdf(user, venteId) {
  const v = await getVente(user, venteId);
  const totalRegle = (v.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
  const montantRestant = round2(Number(v.totalTTC) - totalRegle);
  if (montantRestant <= 0.009) {
    throw new AppError("Cette vente est deja reglee", "VALIDATION_ERROR", 400);
  }

  const baseDate = v.dateVente ? new Date(v.dateVente) : new Date();
  const echeance = new Date(baseDate);
  echeance.setDate(echeance.getDate() + 30);
  const now = new Date();
  const joursRetard = Math.max(0, Math.ceil((now - echeance) / 86400000));

  const societe = v.societe || {};
  const accent = societe.accentHex || ACCENT;
  const cl = v.client || {};
  const title = `Lettre de relance — ${v.reference}`;
  const ctx = createBaseDoc(title, societe, { refPrefix: "REL" });
  const { doc, contentTop, contentLeft, contentWidth, finishFootersAndHeaders, absText: t, ensureSpace } = ctx;
  let y = contentTop;

  y = drawDocTitle(doc, {
    x: contentLeft,
    y,
    width: contentWidth,
    label: "LETTRE DE RELANCE",
    reference: v.facture?.numero || v.reference,
    accentHex: accent,
    badge: { label: `${joursRetard} J RETARD`, bg: "#fee2e2", color: DANGER },
  });

  y = drawMetaStrip(doc, {
    x: contentLeft,
    y,
    width: contentWidth,
    accentHex: accent,
    items: [
      { label: "Date", value: fmtDate(now) },
      { label: "Échéance", value: fmtDate(echeance) },
      { label: "Réglé", value: fmtMoney(totalRegle), color: SUCCESS },
      { label: "Reste dû", value: fmtMoney(montantRestant), color: DANGER },
    ],
  });

  y = drawPartyCards(doc, {
    x: contentLeft,
    y,
    width: contentWidth,
    accentHex: accent,
    left: {
      title: "Émetteur",
      name: societe.nom,
      lines: [societe.adresse, societe.telephones, societe.email].filter(Boolean),
    },
    right: {
      title: "Destinataire",
      name: cl.nom,
      lines: [cl.adresse, cl.telephone, cl.email].filter(Boolean),
    },
  });

  y = ensureSpace(120, y);
  doc.fillColor("#111827").font("Helvetica").fontSize(10);
  t(
    `Madame, Monsieur,\n\nSauf erreur de notre part, nous constatons que la facture ci-dessus demeure impayée depuis ${joursRetard} jour(s) après l'échéance.\n\nNous vous remercions de bien vouloir procéder au règlement du montant restant dans les meilleurs délais.`,
    contentLeft,
    y,
    { width: contentWidth, height: 90 }
  );
  y += 100;

  doc.fillColor(DANGER).font("Helvetica-Bold").fontSize(12);
  t(`Montant restant dû : ${fmtMoney(montantRestant)}`, contentLeft, y, { width: contentWidth });
  y += 28;

  y = drawSignatureRow(doc, {
    x: contentLeft,
    y,
    width: contentWidth,
    leftLabel: "SERVICE COMPTABILITÉ",
    rightLabel: "ACCUSÉ DE RÉCEPTION",
  });

  return endPdfBuffer(doc, finishFootersAndHeaders);
}

async function getBonLivraisonPdf(user, venteId) {
  try {
    const v = await getVente(user, venteId);
    if (!["CONFIRME", "VALIDE", "LIVRE"].includes(v.statut)) {
      const err = new Error("Bon de livraison disponible uniquement pour une vente confirmée ou livrée");
      err.status = 400;
      throw err;
    }
    const societe = v.societe || {};
    const accent = societe.accentHex || ACCENT;
    const cl = v.client || {};
    const title = `Bon de livraison — ${v.reference}`;
    const ctx = createBaseDoc(title, societe, { refPrefix: "BL" });
    const {
      doc,
      contentTop,
      contentLeft,
      contentWidth,
      finishFootersAndHeaders,
      ensureSpace,
    } = ctx;
    let y = contentTop;

    y = drawDocTitle(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      label: "BON DE LIVRAISON",
      reference: v.reference,
      accentHex: accent,
      badge: { label: String(v.statut || "LIVRAISON"), bg: SOFT_ACCENT, color: accent },
    });

    y = drawMetaStrip(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      accentHex: accent,
      items: [
        { label: "Date livraison", value: fmtDate(v.dateLivraison || v.dateVente) },
        { label: "Dépôt", value: v.depot ? `${v.depot.code}` : "—" },
        { label: "Lignes", value: String((v.lignes || []).length) },
        { label: "Client", value: cl.nom || "—" },
      ],
    });

    y = drawPartyCards(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      accentHex: accent,
      left: {
        title: "Expéditeur",
        name: societe.nom,
        lines: [societe.adresse, societe.ville, societe.telephones].filter(Boolean),
      },
      right: {
        title: "Destinataire",
        name: cl.nom,
        lines: [cl.adresse, cl.ville, cl.telephone].filter(Boolean),
      },
    });

    const rows = (v.lignes || []).map((l) => [
      l.article?.code || "",
      l.article?.libelle || "",
      String(l.quantite),
      l.article?.unite || "UN",
      "",
    ]);
    y = drawTable(doc, {
      headers: ["Article", "Désignation", "Qté livrée", "Unité", "Observations"],
      rows,
      startY: y,
      accentHex: accent,
      contentLeft,
      contentWidth,
      ensureSpace,
      colWidths: [65, 175, 55, 45, contentWidth - 65 - 175 - 55 - 45],
    });

    y = ensureSpace(80, y + 20);
    y = drawSignatureRow(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      leftLabel: "PRÉPARATEUR / LIVREUR",
      rightLabel: "CLIENT (SIGNATURE + CACHET)",
    });

    return endPdfBuffer(doc, finishFootersAndHeaders);
  } catch (e) {
    if (e.status) throw e;
    const err = new Error(e?.message || "Erreur PDF");
    err.status = 500;
    throw err;
  }
}

async function exportVentesCsv(user, filters = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  const { statut, clientId, search, dateDebut, dateFin, modePaiement } = filters;
  const searchStr = search ? String(search).trim() : "";
  let dateFilter = {};
  if (dateDebut || dateFin) {
    dateFilter = {
      dateVente: {
        ...(dateDebut ? { gte: new Date(String(dateDebut)) } : {}),
        ...(dateFin
          ? {
              lte: (() => {
                const d = new Date(String(dateFin));
                d.setHours(23, 59, 59, 999);
                return d;
              })(),
            }
          : {}),
      },
    };
  }
  const where = {
    societeId: sid,
    ...(statut ? { statut: String(statut) } : {}),
    ...(clientId ? { clientId: Number(clientId) } : {}),
    ...(modePaiement ? { modePaiement: String(modePaiement) } : {}),
    ...(searchStr
      ? {
          OR: [
            { reference: { contains: searchStr } },
            { client: { nom: { contains: searchStr } } },
            { client: { code: { contains: searchStr } } },
          ],
        }
      : {}),
    ...dateFilter,
  };

  const items = await prisma.vente.findMany({
    where,
    take: 5000,
    orderBy: { id: "desc" },
    include: {
      client: { select: { nom: true } },
      depot: { select: { libelle: true } },
      lignes: true,
      reglements: true,
    },
  });

  return items.map((v) => {
    const nbLignes = (v.lignes || []).length;
    const totalRegle = (v.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
    const solde = round2(Number(v.totalTTC) - totalRegle);
    return {
      Référence: v.reference,
      "Date vente": v.dateVente,
      Client: v.client?.nom || "",
      Dépôt: v.depot?.libelle || "",
      Statut: v.statut,
      "Mode paiement": v.modePaiement || "",
      "Total HT": v.totalHT,
      TVA: v.totalTVA,
      "Total TTC": v.totalTTC,
      "Montant réglé": totalRegle,
      "Solde restant": solde,
      "Date livraison": v.dateLivraison,
      "Nb lignes": nbLignes,
    };
  });
}

async function livrerVente(user, venteId) {
  const { societeId: sid } = getSocieteWhere(user);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM Vente WHERE id = ${Number(venteId)} FOR UPDATE`;

    const v = await tx.vente.findFirst({ where: { id: Number(venteId), societeId: sid } });
    if (!v) {
      const err = new Error("Vente introuvable");
      err.status = 404;
      throw err;
    }
    if (!isVenteConfirmee(v.statut) || v.statut === "LIVRE" || v.livree) {
      const err = new Error("Seule une vente confirmee non livree peut etre marquee livree");
      err.status = 400;
      throw err;
    }
    if (v.typeVente === "AVOIR") {
      const err = new Error("Un avoir ne peut pas etre marque livre");
      err.status = 400;
      throw err;
    }
    const updated = await tx.vente.update({
      where: { id: v.id },
      data: { statut: "LIVRE", livree: true, dateLivraison: v.dateLivraison || new Date() },
      include: {
        client: { select: { nom: true, code: true } },
        depot: { select: { code: true, libelle: true } },
        lignes: { include: { article: { select: { code: true, libelle: true } } } },
        reglements: true,
      },
    });
    return updated;
  }).then(async (updated) => {
    try {
      const cmdSvc = require("../commandesClient/commandesClient.service");
      await cmdSvc.setCommandeStatutByVenteId(updated.id, "LIVREE", sid);
    } catch {
      /* ignore */
    }
    return updated;
  });
}

/** COMMANDE_WEB : EN_PREPARATION */
async function preparerVente(user, venteId) {
  const { societeId: sid } = getSocieteWhere(user);
  const v = await prisma.vente.findFirst({ where: { id: Number(venteId), societeId: sid } });
  if (!v) {
    const err = new Error("Vente introuvable");
    err.status = 404;
    throw err;
  }
  if (!isVenteConfirmee(v.statut)) {
    const err = new Error("La vente doit être confirmée avant préparation");
    err.status = 400;
    throw err;
  }
  await require("../commandesClient/commandesClient.service").setCommandeStatutByVenteId(
    v.id,
    "EN_PREPARATION",
    sid
  );
  return getVente(user, venteId);
}

/** COMMANDE_WEB : EXPEDIEE */
async function expedierVente(user, venteId) {
  const { societeId: sid } = getSocieteWhere(user);
  const v = await prisma.vente.findFirst({ where: { id: Number(venteId), societeId: sid } });
  if (!v) {
    const err = new Error("Vente introuvable");
    err.status = 404;
    throw err;
  }
  if (!isVenteConfirmee(v.statut)) {
    const err = new Error("La vente doit être confirmée avant expédition");
    err.status = 400;
    throw err;
  }
  await require("../commandesClient/commandesClient.service").setCommandeStatutByVenteId(
    v.id,
    "EXPEDIEE",
    sid
  );
  return getVente(user, venteId);
}

async function getStatsVentes(user) {
  try {
    const { societeId: sid } = getSocieteWhere(user);
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const startYear = new Date(now.getFullYear(), 0, 1);
    const endYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    // CA réalisé : uniquement ventes confirmées — ANNULEE / brouillons / avoirs exclus
    const valideStatuts = STATUTS_CONFIRMES;

    const [itemsAll, caMoisAgg, caAnneeAgg, nbBrouillons, nbConfirmes, ventesPay] = await Promise.all([
      prisma.vente.findMany({
        where: { societeId: sid },
        select: { id: true, statut: true, totalTTC: true, clientId: true, dateVente: true },
      }),
      prisma.vente.aggregate({
        where: {
          societeId: sid,
          statut: { in: valideStatuts },
          typeVente: { not: "AVOIR" },
          dateVente: { gte: startMonth, lte: endMonth },
        },
        _sum: { totalTTC: true },
      }),
      prisma.vente.aggregate({
        where: {
          societeId: sid,
          statut: { in: valideStatuts },
          typeVente: { not: "AVOIR" },
          dateVente: { gte: startYear, lte: endYear },
        },
        _sum: { totalTTC: true },
      }),
      prisma.vente.count({ where: { societeId: sid, statut: "BROUILLON" } }),
      prisma.vente.count({ where: { societeId: sid, statut: { in: valideStatuts }, typeVente: { not: "AVOIR" } } }),
      prisma.vente.findMany({
        where: {
          societeId: sid,
          statut: { in: valideStatuts },
          typeVente: { not: "AVOIR" },
        },
        include: { reglements: true, client: { select: { nom: true } } },
      }),
    ]);

    let montantImpaye = 0;
    for (const v of ventesPay) {
      const reg = (v.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
      const solde = Number(v.totalTTC) - reg;
      if (solde > 0.009) montantImpaye += solde;
    }
    montantImpaye = round2(montantImpaye);

    const caByClient = new Map();
    for (const v of ventesPay) {
      if (!v.dateVente || v.dateVente < startYear || v.dateVente > endYear) continue;
      const cid = v.clientId;
      const cur = caByClient.get(cid) || { nom: v.client?.nom || "", ca: 0, nb: 0 };
      cur.ca += Number(v.totalTTC || 0);
      cur.nb += 1;
      caByClient.set(cid, cur);
    }
    const topClients = [...caByClient.values()]
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 5)
      .map((x) => ({ nom: x.nom, ca: round2(x.ca), nb: x.nb }));

    const evolutionCA = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const agg = await prisma.vente.aggregate({
        where: {
          societeId: sid,
          statut: { in: valideStatuts },
          typeVente: { not: "AVOIR" },
          dateVente: { gte: mStart, lte: mEnd },
        },
        _sum: { totalTTC: true },
      });
      evolutionCA.push({ mois, ca: round2(Number(agg._sum.totalTTC || 0)) });
    }

    const nbDevis = itemsAll.filter((v) => v.statut === "BROUILLON").length;
    const nbConverties = itemsAll.filter((v) => isVenteConfirmee(v.statut)).length;
    const tauxTransformation =
      nbDevis + nbConverties > 0 ? round2((nbConverties / (nbDevis + nbConverties)) * 100) : 0;

    let totalVentesHT = 0;
    let totalCoutRevient = 0;
    const ventesValides = await prisma.vente.findMany({
      where: {
        societeId: sid,
        statut: { in: valideStatuts },
        typeVente: { not: "AVOIR" },
        dateVente: { gte: startYear, lte: endYear },
      },
      include: { lignes: { include: { article: { select: { prixAchat: true } } } } },
    });
    for (const v of ventesValides) {
      totalVentesHT += Number(v.totalHT);
      for (const l of v.lignes || []) {
        totalCoutRevient += Number(l.quantite) * Number(l.article?.prixAchat ?? 0);
      }
    }
    const margeGlobale =
      totalVentesHT > 0 ? round2(((totalVentesHT - totalCoutRevient) / totalVentesHT) * 100) : 0;

    const evolutionMensuelle = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const [agg, lignesM] = await Promise.all([
        prisma.vente.aggregate({
          where: {
            societeId: sid,
            statut: { in: valideStatuts },
            typeVente: { not: "AVOIR" },
            dateVente: { gte: mStart, lte: mEnd },
          },
          _sum: { totalHT: true, totalTTC: true },
          _count: true,
        }),
        prisma.ligneVente.findMany({
          where: {
            vente: {
              societeId: sid,
              statut: { in: valideStatuts },
              typeVente: { not: "AVOIR" },
              dateVente: { gte: mStart, lte: mEnd },
            },
          },
          include: { article: { select: { prixAchat: true } } },
        }),
      ]);
      let cout = 0;
      for (const l of lignesM) {
        cout += Number(l.quantite) * Number(l.article?.prixAchat ?? 0);
      }
      const ht = Number(agg._sum.totalHT || 0);
      evolutionMensuelle.push({
        mois,
        totalHT: round2(ht),
        totalTTC: round2(Number(agg._sum.totalTTC || 0)),
        nbVentes: agg._count,
        marge: round2(ht - cout),
      });
    }

    const ventesEnAttente = ventesPay.filter((v) => {
      const reg = (v.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
      return Number(v.totalTTC) - reg > 0.009;
    });

    const nbValidesOnly = nbConfirmes;

    return {
      caMois: round2(Number(caMoisAgg._sum.totalTTC || 0)),
      caAnnee: round2(Number(caAnneeAgg._sum.totalTTC || 0)),
      nbVentes: itemsAll.length,
      nbEnAttente: 0,
      nbValides: nbConfirmes,
      nbBrouillons,
      nbLivres: 0,
      nbAnnules: 0,
      nbConfirmes,
      countsWorkflow: {
        BROUILLON: nbBrouillons,
        CONFIRME: nbConfirmes,
      },
      montantImpaye,
      montantNonRegle: montantImpaye,
      topClients,
      evolutionCA,
      margeGlobale,
      evolutionMensuelle,
      tauxTransformation,
      ventesEnAttente: {
        nb: ventesEnAttente.length,
        montant: round2(
          ventesEnAttente.reduce((s, v) => {
            const reg = (v.reglements || []).reduce((a, r) => a + Number(r.montant || 0), 0);
            return s + Number(v.totalTTC) - reg;
          }, 0)
        ),
      },
    };
  } catch (e) {
    const err = new Error(e?.message || "Erreur stats ventes");
    err.status = 500;
    throw err;
  }
}

/**
 * KPIs dashboard ventes — GET /ventes/kpis?periode=mois|semaine|annee|30j|jour
 */
function resolvePeriodeRange(periode = "mois") {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const p = String(periode || "mois").toLowerCase();
  if (p === "jour" || p === "day" || p === "1j") {
    // start = today 00:00
  } else if (p === "semaine" || p === "week" || p === "7j") {
    start.setDate(start.getDate() - 6);
  } else if (p === "annee" || p === "year" || p === "365j") {
    start.setMonth(0, 1);
  } else if (p === "30j" || p === "30d") {
    start.setDate(start.getDate() - 29);
  } else {
    // mois courant (défaut)
    start.setDate(1);
  }
  return { start, end, periode: p };
}

async function getVentesKpis(user, { periode = "mois" } = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  const { start, end, periode: periodeNorm } = resolvePeriodeRange(periode);

  // CA / KPIs : hors ANNULEE (non présent dans STATUTS_CONFIRMES), brouillons et avoirs
  const baseWhere = {
    societeId: sid,
    statut: { in: STATUTS_CONFIRMES },
    typeVente: { not: "AVOIR" },
    dateVente: { gte: start, lte: end },
  };

  const [agg, ventesPeriode, ventesImpayees, nbBrouillons, nbConfirmesAll, evolutionRaw] = await Promise.all([
    prisma.vente.aggregate({
      where: baseWhere,
      _sum: { totalTTC: true },
      _count: true,
    }),
    prisma.vente.findMany({
      where: baseWhere,
      select: {
        id: true,
        clientId: true,
        totalTTC: true,
        client: { select: { id: true, nom: true, code: true } },
      },
    }),
    prisma.vente.findMany({
      where: {
        societeId: sid,
        statut: { in: STATUTS_CONFIRMES },
        typeVente: { not: "AVOIR" },
        statutPaiement: { in: ["NON_REGLE", "PARTIEL"] },
      },
      include: { reglements: { where: { statut: { in: ["VALIDE", "EN_ATTENTE"] } } } },
    }),
    prisma.vente.count({ where: { societeId: sid, statut: "BROUILLON", typeVente: { not: "AVOIR" } } }),
    prisma.vente.count({
      where: { societeId: sid, statut: { in: STATUTS_CONFIRMES }, typeVente: { not: "AVOIR" } },
    }),
    prisma.vente.findMany({
      where: {
        societeId: sid,
        statut: { in: STATUTS_CONFIRMES },
        typeVente: { not: "AVOIR" },
        dateVente: {
          gte: (() => {
            const d = new Date();
            d.setDate(d.getDate() - 29);
            d.setHours(0, 0, 0, 0);
            return d;
          })(),
          lte: end,
        },
      },
      select: { dateVente: true, totalTTC: true },
    }),
  ]);

  const caTTC = round2(Number(agg._sum.totalTTC || 0));
  const nbVentes = agg._count || 0;
  const panierMoyen = nbVentes > 0 ? round2(caTTC / nbVentes) : 0;

  const tauxTransformation =
    nbBrouillons + nbConfirmesAll > 0
      ? round2((nbConfirmesAll / (nbBrouillons + nbConfirmesAll)) * 100)
      : 0;

  let montantEnAttente = 0;
  for (const v of ventesImpayees) {
    const reg = (v.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
    const solde = Number(v.totalTTC) - reg;
    if (solde > 0.009) montantEnAttente += solde;
  }
  montantEnAttente = round2(montantEnAttente);

  const caByClient = new Map();
  for (const v of ventesPeriode) {
    const cid = v.clientId;
    const cur = caByClient.get(cid) || {
      clientId: cid,
      nom: v.client?.nom || "",
      code: v.client?.code || "",
      ca: 0,
      nb: 0,
    };
    cur.ca += Number(v.totalTTC || 0);
    cur.nb += 1;
    caByClient.set(cid, cur);
  }
  const topClients = [...caByClient.values()]
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 5)
    .map((x) => ({ ...x, ca: round2(x.ca) }));

  // Évolution CA journalière sur 30 jours (pour AreaChart frontend)
  const byDay = new Map();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, 0);
  }
  for (const v of evolutionRaw) {
    if (!v.dateVente) continue;
    const key = new Date(v.dateVente).toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, byDay.get(key) + Number(v.totalTTC || 0));
  }
  const evolutionCA30j = [...byDay.entries()].map(([date, ca]) => ({
    date,
    ca: round2(ca),
  }));

  return {
    periode: periodeNorm,
    dateDebut: start.toISOString(),
    dateFin: end.toISOString(),
    caTTC,
    nbVentes,
    panierMoyen,
    tauxTransformation,
    montantEnAttente,
    topClients,
    evolutionCA30j,
  };
}

async function restoreLotsFromLigne(tx, ligne, depId) {
  if (!ligne.lotsConsumed) return;
  let parsed = [];
  try {
    parsed = JSON.parse(ligne.lotsConsumed);
  } catch {
    return;
  }
  for (const item of parsed) {
    if (!item.lotId) continue;
    const lot = await tx.lot.findUnique({ where: { id: item.lotId } });
    if (!lot) continue;
    const newQ = round2(Number(lot.quantiteRestante) + Number(item.quantite || 0));
    await tx.lot.update({
      where: { id: lot.id },
      data: { quantiteRestante: newQ, statut: newQ > 0 ? "ACTIF" : lot.statut },
    });
  }
}

async function creerAvoir(user, venteId, { lignes: lignesReq, motif } = {}) {
  const { societeId: sid } = getSocieteWhere(user);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM Vente WHERE id = ${Number(venteId)} FOR UPDATE`;

    const vente = await tx.vente.findFirst({
      where: { id: Number(venteId), societeId: sid },
      include: { lignes: { include: { article: true } }, facture: true, reglements: true },
    });
    if (!vente) {
      const err = new Error("Vente introuvable");
      err.status = 404;
      throw err;
    }
    if (!isVenteConfirmee(vente.statut)) {
      const err = new Error("Avoir possible uniquement sur une vente confirmee");
      err.status = 400;
      throw err;
    }
    const avoirsExistants = await tx.vente.findMany({
      where: { venteOrigineId: vente.id },
      include: { lignes: true },
    });
    const dejaRetourneParArticle = new Map();
    for (const av of avoirsExistants) {
      for (const l of av.lignes) {
        const qte = Math.abs(Number(l.quantite));
        dejaRetourneParArticle.set(
          l.articleId,
          (dejaRetourneParArticle.get(l.articleId) || 0) + qte
        );
      }
    }

    const depId = vente.depotId ?? (await resolveDepot(tx, sid, null));
    const ligneCreates = [];
    let totalHT = 0;
    let totalTVA = 0;

    const targets =
      Array.isArray(lignesReq) && lignesReq.length > 0
        ? lignesReq.map((req) => {
            const orig = vente.lignes.find((l) => l.id === Number(req.ligneId));
            if (!orig) {
              const err = new Error(`Ligne ${req.ligneId} introuvable`);
              err.status = 400;
              throw err;
            }
            const qRet = Number(req.quantite);
            if (!(qRet > 0) || qRet > Number(orig.quantite) + 1e-9) {
              const err = new Error("Quantite retour invalide");
              err.status = 400;
              throw err;
            }
            const dejaRetourne = dejaRetourneParArticle.get(orig.articleId) || 0;
            const reliquat = Number(orig.quantite) - dejaRetourne;
            if (qRet > reliquat + 1e-9) {
              const err = new Error(
                `Quantite retour invalide — il ne reste que ${reliquat} unite(s) retournable(s) pour cet article (deja retourne : ${dejaRetourne})`
              );
              err.status = 400;
              throw err;
            }
            return { orig, qRet };
          })
        : vente.lignes
            .map((orig) => ({
              orig,
              qRet: Number(orig.quantite) - (dejaRetourneParArticle.get(orig.articleId) || 0),
            }))
            .filter((t) => t.qRet > 1e-9);

    if (targets.length === 0) {
      const err = new Error("Aucun article retournable restant pour cette vente");
      err.status = 400;
      throw err;
    }

    for (const { orig, qRet } of targets) {
      await assertArticleActif(orig.articleId, sid);
      const unitHt =
        Number(orig.quantite) > 0 ? Number(orig.totalHT) / Number(orig.quantite) : Number(orig.prixUnit) || 0;
      const lineHT = -round2(qRet * unitHt);
      const tauxTva = Number(orig.tauxTva ?? 19);
      const montantTva = -round2(Math.abs(lineHT) * (tauxTva / 100));
      totalHT += lineHT;
      totalTVA += montantTva;
      ligneCreates.push({
        articleId: orig.articleId,
        quantite: -qRet,
        prixUnit: orig.prixUnit,
        remise: 0,
        totalHT: lineHT,
        tauxTva,
        montantTva,
        lotsConsumed: orig.lotsConsumed,
        strategieAppliquee: orig.strategieAppliquee || orig.strategie,
        strategie: orig.strategieAppliquee || orig.strategie,
      });
    }

    totalHT = round2(totalHT);
    totalTVA = round2(totalTVA);
    const totalTTC = round2(totalHT + totalTVA);
    const reference = await nextAvoirReference(tx, sid);

    const avoir = await tx.vente.create({
      data: {
        reference,
        clientId: vente.clientId,
        societeId: sid,
        depotId: depId,
        dateVente: new Date(),
        statut: "CONFIRME",
        typeVente: "AVOIR",
        venteOrigineId: vente.id,
        confirmedAt: new Date(),
        confirmedBy: user.id,
        totalHT,
        totalTVA,
        totalTTC,
        remise: 0,
        modePaiement: vente.modePaiement,
        lignes: { create: ligneCreates },
      },
      include: {
        client: true,
        depot: true,
        lignes: { include: { article: true } },
      },
    });

    for (const created of avoir.lignes) {
      const q = Math.abs(Number(created.quantite));
      const origLigne = vente.lignes.find((l) => l.articleId === created.articleId);
      if (origLigne?.lotsConsumed) {
        await restoreLotsFromLigne(tx, origLigne, depId);
      }

      await adjustStock(tx, {
        societeId: sid,
        articleId: created.articleId,
        depotId: depId,
        emplacementId: null,
        delta: q,
      });

      await insertMouvement(tx, {
        reference: `AVO-${avoir.reference}-${created.articleId}-${created.id}`,
        type: MOUVEMENT_TYPES.ENTREE_RETOUR_CLIENT,
        articleId: created.articleId,
        depotId: depId,
        quantite: q,
        valeur: Math.abs(Number(created.totalHT)),
        utilisateurId: user.id,
        commentaire: `Avoir ${motif || ""} — origine ${vente.reference}`.trim(),
      });
    }

    // Vérifier si l'avoir couvre 100% de chaque ligne d'origine (annulation totale)
    const dejaRetourneApres = new Map(dejaRetourneParArticle);
    for (const t of targets) {
      dejaRetourneApres.set(
        t.orig.articleId,
        (dejaRetourneApres.get(t.orig.articleId) || 0) + t.qRet
      );
    }
    const entierementRetournee = vente.lignes.every((l) => {
      const total = dejaRetourneApres.get(l.articleId) || 0;
      return total >= Number(l.quantite) - 1e-9;
    });

    if (entierementRetournee) {
      await tx.vente.update({
        where: { id: vente.id },
        data: { statut: "ANNULEE" },
      });
    }

    await factureService.createFactureForVente(tx, avoir, { statut: "AVOIR", prefix: "AVO" });
    await syncClientEncours(tx, vente.clientId);

    const totalDejaEncaisse = (vente.reglements || [])
      .filter((r) => (r.type || "ENCAISSEMENT") === "ENCAISSEMENT")
      .reduce((s, r) => s + Number(r.montant || 0), 0);
    const montantARembourser = Math.min(totalDejaEncaisse, Math.abs(totalTTC));

    if (montantARembourser > 0.001) {
      await tx.reglement.create({
        data: {
          venteId: avoir.id,
          montant: -round2(montantARembourser),
          type: "REMBOURSEMENT",
          mode: vente.modePaiement || "AUTRE",
          statut: "A_TRAITER",
          commentaire: `Remboursement suite à avoir sur ${vente.reference}${motif ? " — " + motif : ""}`,
        },
      });
    }

    return tx.vente.findUnique({
      where: { id: avoir.id },
      include: {
        client: true,
        depot: true,
        facture: true,
        venteOrigine: { select: { id: true, reference: true } },
        lignes: { include: { article: true } },
        reglements: true,
      },
    });
  });
}

module.exports = {
  listVentes,
  getVente,
  createVente,
  updateVente,
  deleteVente,
  confirmerVente,
  validateVente,
  livrerVente,
  getFactureJson,
  buildFacturePayload,
  addReglement,
  TVA_DEFAULT,
  getFacturePdf,
  getRelancePdf,
  getBonLivraisonPdf,
  exportVentesCsv,
  getStatsVentes,
  getVentesKpis,
  creerAvoir,
  preparerVente,
  expedierVente,
  syncClientEncours,
  isVenteConfirmee,
  STATUTS_CONFIRMES,
};
