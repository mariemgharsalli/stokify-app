const prisma = require("../../config/database");
const stockService = require("../stock/stock.service");
const valuationService = require("../valuation/valuation.service");
const lotsService = require("../lots/lots.service");
const numeroserieService = require("../numeroserie/numeroserie.service");
const {
  adjustStock,
  insertMouvement,
  resolveDepot,
  MOUVEMENT_TYPES,
} = require("../mouvements/mouvements.service");
const { getSocieteWhere, stripSocieteFromBody } = require("../../utils/societeScope");
const { assertArticleActif } = require("../articles/articles.service");
const { syncAlerteStockAfterQtyChange } = require("../../utils/stockAlertUtils");
const { createBaseDoc, drawTable, drawTotalsBlock, drawDocTitle, drawMetaStrip, drawPartyCards, drawSignatureRow, fmtDate, fmtMoney, ACCENT, SOFT_ACCENT } = require("../../utils/pdfHelper");
const AppError = require("../../utils/AppError");
const { normalizeCode, createWithAutoCode, resolveAutoCode } = require("../../utils/codeUtils");
const { resolveModeTracage, isTracageAuto, tracksLot, tracksSerie, assertIntegerQuantite } = require("../../utils/tracage");

function buildTvaLabelFromLignes(lignes) {
  const taux = [...new Set((lignes || []).map((l) => l.tauxTva))].filter((t) => t != null);
  if (taux.length === 0) return "TVA";
  if (taux.length === 1) return `TVA (${taux[0]}%)`;
  return `TVA (taux multiples : ${taux.join("% / ")}%)`;
}

/** @deprecated Conservé pour compat tests / exports — préférer tauxTva par ligne */
const TVA_DEFAULT = 0.19;

const STATUTS_ACHAT_ACTIFS = ["BROUILLON", "CONFIRME"];
const STATUTS_CONFIRMES = ["CONFIRME", "COMMANDE", "RECU", "RECEPTIONNE"];

function isAchatConfirme(statut) {
  return STATUTS_CONFIRMES.includes(String(statut || "").toUpperCase());
}

function normalizeStatutAchat(statut) {
  const s = String(statut || "BROUILLON").toUpperCase();
  if (STATUTS_CONFIRMES.includes(s)) return "CONFIRME";
  if (s === "ANNULE") return "ANNULE";
  return "BROUILLON";
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function findOrCreateLot(tx, { numero, articleId, depotId, qRecue, dateExpiration, achatId, dateFabrication }) {
  let lot = await tx.lot.findFirst({
    where: { numero, articleId, depotId },
  });
  if (!lot) {
    lot = await tx.lot.create({
      data: {
        numero,
        articleId,
        depotId,
        ...(achatId ? { achatId } : {}),
        ...(dateFabrication ? { dateFabrication } : {}),
        dateExpiration: dateExpiration ? new Date(dateExpiration) : null,
        quantiteInitiale: qRecue,
        quantiteRestante: qRecue,
        statut: "ACTIF",
      },
    });
  } else {
    lot = await tx.lot.update({
      where: { id: lot.id },
      data: {
        quantiteRestante: { increment: qRecue },
        quantiteInitiale: { increment: qRecue },
        ...(dateExpiration ? { dateExpiration: new Date(dateExpiration) } : {}),
      },
    });
  }
  return lot;
}

async function createNumeroSerieSafe(tx, data) {
  try {
    return await tx.numeroSerie.create({ data });
  } catch (e) {
    if (e.code === "P2002") {
      throw new AppError(`Numéro de série déjà existant : ${data.numero}`, "VALIDATION_ERROR", 422);
    }
    throw e;
  }
}

/**
 * Crée le lot et/ou les n° de série à l'entrée de stock selon Article.modeTracage.
 * @param {{ autoFallback?: boolean }} opts — si true, génère quand même en mode manuel (confirmation globale)
 */
async function applyEntreeTracage(tx, { article, articleId, qRecue, sid, depId, body = {}, achatId, autoFallback = false }) {
  const modeTracage = resolveModeTracage(article);
  const tracageAuto = isTracageAuto(article);
  let lotId = null;
  const numerosSerieCreated = [];

  if (tracksLot(modeTracage)) {
    let numero;
    if (tracageAuto || (autoFallback && !body.numeroLot)) {
      numero = await lotsService.generateNumeroLot(articleId, sid, 0, tx);
    } else {
      if (!body.numeroLot) {
        throw new AppError("Numero de lot requis pour cet article (mode manuel)", "VALIDATION_ERROR", 422);
      }
      numero = String(body.numeroLot).trim();
    }
    const lot = await findOrCreateLot(tx, {
      numero,
      articleId,
      depotId: depId,
      qRecue,
      dateExpiration: body.dateExpiration,
      achatId,
      dateFabrication: new Date(),
    });
    lotId = lot.id;
  }

  if (tracksSerie(modeTracage)) {
    let n;
    try {
      n = assertIntegerQuantite(
        qRecue,
        "La quantité reçue doit être un entier pour un article en numéro de série"
      );
    } catch (e) {
      throw new AppError(e.message, "VALIDATION_ERROR", 422);
    }
    if (tracageAuto || (autoFallback && !Array.isArray(body.numerosSerie))) {
      for (let i = 0; i < n; i++) {
        const numero = await numeroserieService.generateNumeroSerie(sid, articleId, tx);
        const ns = await createNumeroSerieSafe(tx, {
            numero,
            articleId,
            societeId: sid,
            depotId: depId,
            statut: "DISPONIBLE",
            lotId,
        });
        numerosSerieCreated.push(ns);
      }
    } else {
      if (!Array.isArray(body.numerosSerie) || body.numerosSerie.length !== n) {
        throw new AppError(
          `Veuillez saisir exactement ${n} numéro(s) de série (mode manuel)`,
          "VALIDATION_ERROR",
          422
        );
      }
      for (const raw of body.numerosSerie) {
        const numero = String(raw || "").trim();
        if (!numero) {
          throw new AppError("Chaque numéro de série doit être renseigné", "VALIDATION_ERROR", 422);
        }
      }
      const unique = new Set(body.numerosSerie.map((x) => String(x || "").trim()).filter(Boolean));
      if (unique.size !== n) {
        throw new AppError("Les numéros de série doivent être uniques", "VALIDATION_ERROR", 422);
      }
      for (const raw of body.numerosSerie) {
        const numero = String(raw || "").trim();
        const ns = await createNumeroSerieSafe(tx, {
            numero,
            articleId,
            societeId: sid,
            depotId: depId,
            statut: "DISPONIBLE",
            lotId,
        });
        numerosSerieCreated.push(ns);
      }
    }
  }

  return { lotId, numerosSerieCreated, modeTracage };
}

/** Incrémente le stock en évitant les doublons article/dépôt à la confirmation achat. */
async function incrementStockOnConfirmation(tx, { societeId, articleId, depotId, quantite, dateLastMvt }) {
  const qte = round2(Number(quantite));
  const aid = Number(articleId);
  const did = Number(depotId);

  const existing =
    (await tx.stock.findFirst({
      where: { articleId: aid, depotId: did, emplacementId: null },
    })) ||
    (await tx.stock.findFirst({
      where: { articleId: aid, depotId: did },
    }));

  let row;
  if (existing) {
    row = await tx.stock.update({
      where: { id: existing.id },
      data: {
        quantite: round2(Number(existing.quantite) + qte),
        dateLastMvt: dateLastMvt || new Date(),
      },
    });
  } else {
    row = await tx.stock.create({
      data: {
        articleId: aid,
        depotId: did,
        emplacementId: null,
        quantite: qte,
        dateLastMvt: dateLastMvt || new Date(),
      },
    });
  }

  if (societeId) {
    await syncAlerteStockAfterQtyChange(tx, {
      societeId,
      articleId: aid,
      depotId: did,
    });
  }
  return row;
}

/** Société imposée par les articles des lignes (sans filtre société) — évite dépôt / fournisseur d’une autre société. */
async function societeIdFromLignesArticles(lignes) {
  if (!Array.isArray(lignes) || lignes.length === 0) return null;
  const ids = [
    ...new Set(
      lignes
        .map((l) => Number(l?.articleId))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  if (ids.length === 0) return null;
  const found = await prisma.article.findMany({
    where: { id: { in: ids } },
    select: { id: true, societeId: true },
  });
  if (found.length !== ids.length) return null;
  const sids = [...new Set(found.map((a) => Number(a.societeId)))];
  if (sids.length > 1) {
    const err = new Error("Les lignes contiennent des articles de societes differentes");
    err.status = 400;
    throw err;
  }
  return sids[0] ?? null;
}

/**
 * Société cible pour un achat : user.societeId ; sinon body ; sinon **articles des lignes**
 * (avant dépôt / fournisseur, pour ne pas prendre un dépôt d’une autre société que les articles).
 */
async function resolveAchatSocieteId(user, data) {
  const fromUser = user?.societeId;
  if (fromUser != null && fromUser !== "") {
    const n = Number(fromUser);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const fromLignes = await societeIdFromLignesArticles(data?.lignes);
  if (fromLignes) return fromLignes;
  if (data?.depotId != null && data.depotId !== "") {
    const depot = await prisma.depot.findFirst({ where: { id: Number(data.depotId) } });
    if (depot?.societeId) return Number(depot.societeId);
  }
  if (data?.fournisseurId != null && data.fournisseurId !== "") {
    const four = await prisma.fournisseur.findFirst({ where: { id: Number(data.fournisseurId) } });
    if (four?.societeId) return Number(four.societeId);
  }
  return null;
}

function statutFilter(statut) {
  if (!statut) return {};
  if (String(statut) === "CONFIRME") return { statut: { in: STATUTS_CONFIRMES } };
  return { statut: String(statut) };
}

async function listAchats(user, { statut, fournisseurId, search, dateDebut, dateFin, page = 1, limit = 25 } = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;

  const searchStr = search ? String(search).trim() : "";
  let dateFilter = {};
  if (dateDebut || dateFin) {
    dateFilter = {
      dateCommande: {
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
    ...(fournisseurId ? { fournisseurId: Number(fournisseurId) } : {}),
    ...(searchStr
      ? {
          OR: [
            { reference: { contains: searchStr } },
            { fournisseur: { nom: { contains: searchStr } } },
            { fournisseur: { code: { contains: searchStr } } },
          ],
        }
      : {}),
    ...dateFilter,
  };

  const [items, total] = await Promise.all([
    prisma.achat.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { id: "desc" },
      include: {
        fournisseur: { select: { id: true, code: true, nom: true } },
        depot: { select: { id: true, code: true, libelle: true } },
        lignes: { include: { article: { select: { code: true, libelle: true, unite: true } } } },
      },
    }),
    prisma.achat.count({ where }),
  ]);

  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

async function getAchat(user, id) {
  const { societeId: sid } = getSocieteWhere(user);
  const row = await prisma.achat.findFirst({
    where: { id: Number(id), societeId: sid },
    include: {
      fournisseur: true,
      depot: true,
      societe: { select: { nom: true, code: true, adresse: true, ville: true, telephones: true, email: true, logo: true } },
      confirmateur: { select: { id: true, nom: true, prenom: true } },
      lignes: { include: { article: { include: { famille: { select: { nom: true } } } } } },
      lots: {
        include: {
          article: { select: { id: true, code: true, libelle: true, unite: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!row) {
    const err = new Error("Achat introuvable");
    err.status = 404;
    throw err;
  }
  return lotsService.attachLotsToLignes(row);
}

/** Construit les lignes et les totaux HT / TVA bruts (avant remise globale). */
async function buildAchatLignePayload(sid, lignes) {
  const ligneData = [];
  let totalHT = 0;
  let totalTVA = 0;
  for (const l of lignes) {
    const articleId = Number(l.articleId);
    const quantite = Number(l.quantite);
    const prixUnit = Number(l.prixUnit);
    if (!articleId || quantite <= 0 || prixUnit < 0) {
      const err = new Error("Chaque ligne doit avoir articleId, quantite > 0 et prixUnit >= 0");
      err.status = 400;
      throw err;
    }
    if (!sid) {
      const err = new Error("Societe introuvable pour valider les articles");
      err.status = 400;
      throw err;
    }
    await assertArticleActif(articleId, sid);
    const article = await prisma.article.findFirst({
      where: { id: articleId, societeId: sid },
    });
    if (!article) {
      const err = new Error(`Article ${articleId} introuvable`);
      err.status = 404;
      throw err;
    }
    if (article.actif === false) {
      const err = new Error(`Article ${articleId} inactif : achat refuse`);
      err.status = 409;
      throw err;
    }
    const remise = Number(l.remise) || 0;
    const lineHT = round2(quantite * prixUnit - remise);
    if (lineHT < 0) {
      const err = new Error("Montant ligne invalide");
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
      ...(l.dateExpiration ? { dateExpiration: new Date(l.dateExpiration) } : {}),
    });
  }
  return { ligneData, totalHTBrut: totalHT, totalTVA: round2(totalTVA) };
}

async function createAchat(user, rawData) {
  const data = stripSocieteFromBody(rawData);
  const sid = await resolveAchatSocieteId(user, data);
  if (!sid) {
    const err = new Error(
      "Societe introuvable : renseignez societeId (super-admin) ou un depot / fournisseur valide"
    );
    err.status = 400;
    throw err;
  }
  const { fournisseurId, depotId, lignes, remiseGlobale = 0, statut = "BROUILLON" } = data;

  if (!Array.isArray(lignes) || lignes.length === 0) {
    const err = new Error("Au moins une ligne d'achat est requise");
    err.status = 400;
    throw err;
  }

  const four = await prisma.fournisseur.findFirst({
    where: { id: Number(fournisseurId), societeId: sid },
  });
  if (!four) {
    const err = new Error("Fournisseur introuvable");
    err.status = 404;
    throw err;
  }

  const { ligneData, totalHTBrut, totalTVA: totalTVABrut } = await buildAchatLignePayload(sid, lignes);
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

  const generateAchatRef = async () =>
    normalizeCode(`ACH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const { isAuto, code: resolvedRef } = await resolveAutoCode(sid, data.reference, generateAchatRef);

  const persistAchat = async ({ reference }) =>
    prisma.$transaction(async (tx) => {
      const depId = await resolveDepot(tx, sid, depotId);
      return tx.achat.create({
        data: {
          reference: normalizeCode(reference),
          fournisseurId: four.id,
          societeId: sid,
          depotId: depId,
          ...(data.dateCommande ? { dateCommande: new Date(data.dateCommande) } : {}),
          ...(data.dateLivraisonPrevue ? { dateLivraisonPrevue: new Date(data.dateLivraisonPrevue) } : {}),
          statut,
          totalHT,
          totalTVA,
          totalTTC,
          remise: remGlob,
          lignes: { create: ligneData },
        },
        include: {
          fournisseur: { select: { nom: true, code: true } },
          depot: { select: { code: true, libelle: true } },
          lignes: { include: { article: { select: { code: true, libelle: true } } } },
        },
      });
    });

  if (isAuto) {
    return createWithAutoCode(
      sid,
      { reference: resolvedRef || undefined },
      generateAchatRef,
      persistAchat,
      3,
      "reference"
    );
  }
  return persistAchat({ reference: resolvedRef });
}

async function receptionnerLigne(user, achatId, ligneId, body = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  const qRecue = Number(body.quantiteRecue);
  if (!Number.isFinite(qRecue) || qRecue <= 0) {
    throw new AppError("quantiteRecue invalide", "VALIDATION_ERROR", 422);
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM Achat WHERE id = ${Number(achatId)} FOR UPDATE`;

    const achat = await tx.achat.findFirst({
      where: { id: Number(achatId), societeId: sid },
      include: {
        lignes: {
          where: { id: Number(ligneId) },
          include: { article: true },
        },
      },
    });
    if (!achat || !achat.lignes.length) {
      throw new AppError("Achat ou ligne introuvable", "NOT_FOUND", 404);
    }
    if (achat.statut === "ANNULE") {
      throw new AppError("Achat annule", "VALIDATION_ERROR", 400);
    }

    const ligne = achat.lignes[0];
    const qCmd = Number(ligne.quantite);
    const deja = Number(ligne.quantiteRecue || 0);
    const restant = round2(qCmd - deja);
    if (qRecue > restant + 1e-6) {
      throw new AppError(
        `Quantite recue depasse le restant (${restant})`,
        "VALIDATION_ERROR",
        422
      );
    }

    const depId = achat.depotId ?? (await resolveDepot(tx, sid, null));
    const article = ligne.article;
    const modeTracage = resolveModeTracage(article);

    if (tracksLot(modeTracage)) {
      await lotsService.ensureStockCoveredByLots(tx, {
        articleId: ligne.articleId,
        depotId: depId,
      });
    }

    const { lotId } = await applyEntreeTracage(tx, {
      article,
      articleId: ligne.articleId,
      qRecue,
      sid,
      depId,
      body,
      achatId: achat.id,
    });

    const ref = `MVT-ACHAT-${achat.id}-L${ligne.id}-R${deja + qRecue}`;
    await adjustStock(tx, {
      societeId: sid,
      articleId: ligne.articleId,
      depotId: depId,
      emplacementId: body.emplacementId ? Number(body.emplacementId) : null,
      delta: qRecue,
    });

    await insertMouvement(tx, {
      reference: ref,
      type: MOUVEMENT_TYPES.ENTREE_ACHAT,
      articleId: ligne.articleId,
      depotId: depId,
      emplacementId: body.emplacementId ? Number(body.emplacementId) : null,
      quantite: qRecue,
      valeur: round2((Number(ligne.prixUnit) || 0) * qRecue),
      utilisateurId: user.id,
      commentaire: `Reception partielle achat ${achat.reference}`,
      lotId,
    });

    const prixUnitaire =
      Number(ligne.prixUnit) > 0
        ? Number(ligne.prixUnit)
        : Number(ligne.quantite) > 0
          ? Number(ligne.totalHT) / Number(ligne.quantite)
          : 0;

    await valuationService.onEntreeStock(tx, {
      societeId: sid,
      articleId: ligne.articleId,
      depotId: depId,
      quantite: qRecue,
      prixUnitaire,
      achatId: achat.id,
      lotId,
    });

    const newRecue = round2(deja + qRecue);
    await tx.ligneAchat.update({
      where: { id: ligne.id },
      data: { quantiteRecue: newRecue },
    });

    const allLignes = await tx.ligneAchat.findMany({ where: { achatId: achat.id } });
    const fullyReceived = allLignes.every(
      (l) => Number(l.quantiteRecue || 0) + 1e-6 >= Number(l.quantite)
    );

    const updateData = {};
    if (fullyReceived) {
      updateData.statut = "RECU";
      updateData.dateReception = new Date();
      updateData.dateLivraisonReelle = new Date();
    } else if (achat.statut === "BROUILLON") {
      updateData.statut = "COMMANDE";
    }

    return tx.achat.update({
      where: { id: achat.id },
      data: updateData,
      include: {
        fournisseur: true,
        depot: true,
        lignes: { include: { article: true } },
      },
    });
  });
}

async function recevoirAchat(user, achatId) {
  const { societeId: sid } = getSocieteWhere(user);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM Achat WHERE id = ${Number(achatId)} FOR UPDATE`;

    const achat = await tx.achat.findFirst({
      where: { id: Number(achatId), societeId: sid },
      include: { lignes: { include: { article: true } } },
    });
    if (!achat) {
      const err = new Error("Achat introuvable");
      err.status = 404;
      throw err;
    }
    if (achat.statut === "ANNULE") {
      const err = new Error("Achat annule");
      err.status = 400;
      throw err;
    }
    if (achat.statut === "RECU") {
      return lotsService.attachLotsToLignes(
        await tx.achat.findFirst({
          where: { id: achat.id },
          include: {
            fournisseur: true,
            depot: true,
            lignes: { include: { article: true } },
            lots: {
              include: {
                article: { select: { id: true, code: true, libelle: true, unite: true } },
              },
              orderBy: { id: "asc" },
            },
          },
        })
      );
    }

    const depId = achat.depotId ?? (await resolveDepot(tx, sid, null));

    const uniqueArticleIds = [...new Set(achat.lignes.map((l) => l.articleId))];
    for (const articleId of uniqueArticleIds) {
      const art = achat.lignes.find((l) => l.articleId === articleId)?.article;
      if (tracksLot(resolveModeTracage(art))) {
        await lotsService.ensureStockCoveredByLots(tx, { articleId, depotId: depId });
      }
    }

    for (const ligne of achat.lignes) {
      await assertArticleActif(ligne.articleId, sid);
      const ref = `MVT-ACHAT-${achat.id}-L${ligne.id}`;
      const dup = await tx.mouvement.findUnique({ where: { reference: ref } });
      if (dup) continue;

      const qte = Number(ligne.quantite);
      const { lotId } = await applyEntreeTracage(tx, {
        article: ligne.article,
        articleId: ligne.articleId,
        qRecue: qte,
        sid,
        depId,
        body: { dateExpiration: ligne.dateExpiration },
        achatId: achat.id,
        autoFallback: true,
      });

      await adjustStock(tx, {
        societeId: sid,
        articleId: ligne.articleId,
        depotId: depId,
        emplacementId: null,
        delta: qte,
      });

      await insertMouvement(tx, {
        reference: ref,
        type: MOUVEMENT_TYPES.ENTREE_ACHAT,
        articleId: ligne.articleId,
        depotId: depId,
        emplacementId: null,
        quantite: qte,
        valeur: ligne.totalHT,
        utilisateurId: user.id,
        commentaire: `Reception achat ${achat.reference}`,
        lotId,
      });

      const prixUnitaire =
        Number(ligne.prixUnit) > 0
          ? Number(ligne.prixUnit)
          : Number(ligne.quantite) > 0
            ? Number(ligne.totalHT) / Number(ligne.quantite)
            : 0;
      await valuationService.onEntreeStock(tx, {
        societeId: sid,
        articleId: ligne.articleId,
        depotId: depId,
        quantite: qte,
        prixUnitaire,
        achatId: achat.id,
        lotId,
      });
    }

    const receptionDate = new Date();
    let retardJours = null;
    if (achat.dateLivraisonPrevue) {
      const prevu = new Date(achat.dateLivraisonPrevue);
      retardJours = Math.round((receptionDate.getTime() - prevu.getTime()) / (1000 * 60 * 60 * 24));
    }

    return tx.achat.update({
      where: { id: achat.id },
      data: {
        statut: "RECU",
        dateReception: new Date(),
        dateLivraisonReelle: receptionDate,
        ...(retardJours != null ? { retardJours } : {}),
        depotId: depId,
      },
      include: {
        fournisseur: true,
        depot: true,
        lignes: { include: { article: true } },
        lots: {
          include: {
            article: { select: { id: true, code: true, libelle: true, unite: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    });
  }).then((row) => lotsService.attachLotsToLignes(row));
}

function statutPaiementFromMontants(totalTTC, montantRegle) {
  const ttc = Number(totalTTC);
  const reg = round2(Number(montantRegle));
  if (reg <= 0) return "NON_REGLE";
  if (reg + 1e-6 >= ttc) return "REGLE";
  return "PARTIEL";
}

async function updateAchat(user, achatId, rawData) {
  const data = stripSocieteFromBody(rawData);
  const id = Number(achatId);
  const {
    fournisseurId,
    depotId,
    dateCommande,
    dateLivraisonPrevue,
    remiseGlobale,
    remise,
    statut: statutIn,
    lignes,
  } = data;

  if (!Array.isArray(lignes) || lignes.length === 0) {
    const err = new Error("Au moins une ligne d'achat est requise");
    err.status = 400;
    throw err;
  }

  const sid = await resolveAchatSocieteId(user, data);
  if (!sid) {
    const err = new Error(
      "Societe introuvable : renseignez societeId (super-admin) ou un depot / fournisseur valide"
    );
    err.status = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const ex = await tx.achat.findFirst({ where: { id, societeId: sid } });
    if (!ex) {
      const err = new Error("Achat introuvable");
      err.status = 404;
      throw err;
    }
    if (ex.statut !== "BROUILLON") {
      const err = new Error("Modification reservee aux bons en brouillon");
      err.status = 400;
      throw err;
    }

    const four = await tx.fournisseur.findFirst({
      where: { id: Number(fournisseurId), societeId: sid },
    });
    if (!four) {
      const err = new Error("Fournisseur introuvable");
      err.status = 404;
      throw err;
    }

    const { ligneData, totalHTBrut, totalTVA: totalTVABrut } = await buildAchatLignePayload(sid, lignes);
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
      if (STATUTS_ACHAT_ACTIFS.includes(s)) nextStatut = s;
    }

    const depId = await resolveDepot(tx, sid, depotId ?? ex.depotId);

    await tx.ligneAchat.deleteMany({ where: { achatId: ex.id } });

    return tx.achat.update({
      where: { id: ex.id },
      data: {
        ...(data.reference != null && String(data.reference).trim() !== ""
          ? { reference: normalizeCode(data.reference) }
          : {}),
        fournisseurId: four.id,
        depotId: depId,
        ...(dateCommande ? { dateCommande: new Date(dateCommande) } : {}),
        ...(dateLivraisonPrevue !== undefined
          ? {
              dateLivraisonPrevue: dateLivraisonPrevue ? new Date(dateLivraisonPrevue) : null,
            }
          : {}),
        statut: nextStatut,
        totalHT,
        totalTVA,
        totalTTC,
        remise: remGlob,
        statutPaiement: statutPaiementFromMontants(totalTTC, ex.montantRegle),
        lignes: { create: ligneData },
      },
      include: {
        fournisseur: { select: { nom: true, code: true } },
        depot: { select: { code: true, libelle: true } },
        lignes: { include: { article: { select: { code: true, libelle: true } } } },
      },
    });
  });
}

async function deleteAchat(user, achatId) {
  const { societeId: sid } = getSocieteWhere(user);
  const id = Number(achatId);

  return prisma.$transaction(async (tx) => {
    const ex = await tx.achat.findFirst({ where: { id, societeId: sid } });
    if (!ex) {
      const err = new Error("Achat introuvable");
      err.status = 404;
      throw err;
    }
    if (ex.statut !== "BROUILLON") {
      const err = new Error("Suppression reservee aux bons en brouillon");
      err.status = 400;
      throw err;
    }
    await tx.reglementAchat.deleteMany({ where: { achatId: ex.id } });
    await tx.ligneAchat.deleteMany({ where: { achatId: ex.id } });
    await tx.achat.delete({ where: { id: ex.id } });
    return { deleted: true };
  });
}

async function enregistrerPaiementAchat(user, achatId, { montant }) {
  const { societeId: sid } = getSocieteWhere(user);
  const m = Number(montant);
  if (!m || m <= 0) {
    const err = new Error("Montant invalide");
    err.status = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const achat = await tx.achat.findFirst({
      where: { id: Number(achatId), societeId: sid },
    });
    if (!achat) {
      const err = new Error("Achat introuvable");
      err.status = 404;
      throw err;
    }
    const nouveauRegle = round2(Number(achat.montantRegle) + m);
    const statutPaiement = statutPaiementFromMontants(achat.totalTTC, nouveauRegle);
    return tx.achat.update({
      where: { id: achat.id },
      data: {
        montantRegle: nouveauRegle,
        statutPaiement,
      },
    });
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

async function getBonCommandePdf(user, achatId) {
  try {
    const { societeId: sid } = getSocieteWhere(user);
    const achat = await prisma.achat.findFirst({
      where: { id: Number(achatId), societeId: sid },
      include: {
        fournisseur: true,
        depot: true,
        societe: true,
        lignes: { include: { article: true } },
      },
    });
    if (!achat) {
      const err = new Error("Achat introuvable");
      err.status = 404;
      throw err;
    }
    const societe = achat.societe || {};
    const accent = societe.accentHex || ACCENT;
    const f = achat.fournisseur || {};
    const title = `Bon de commande — ${achat.reference}`;
    const ctx = createBaseDoc(title, societe, { refPrefix: "BC" });
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
      label: "BON DE COMMANDE",
      reference: achat.reference,
      accentHex: accent,
      badge: { label: String(achat.statut || "COMMANDE"), bg: SOFT_ACCENT, color: accent },
    });

    y = drawMetaStrip(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      accentHex: accent,
      items: [
        { label: "Date commande", value: fmtDate(achat.dateCommande) },
        { label: "Dépôt", value: achat.depot?.code || "—" },
        { label: "Paiement", value: achat.statutPaiement || "—" },
        { label: "Lignes", value: String((achat.lignes || []).length) },
      ],
    });

    y = drawPartyCards(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      accentHex: accent,
      left: {
        title: "Acheteur",
        name: societe.nom,
        lines: [societe.adresse, societe.ville, societe.email].filter(Boolean),
      },
      right: {
        title: "Fournisseur",
        name: f.nom,
        lines: [f.adresse, f.telephone, f.email].filter(Boolean),
      },
    });

    const rows = (achat.lignes || []).map((l) => [
      l.article?.code || "",
      l.article?.libelle || "",
      String(l.quantite),
      fmtMoney(l.prixUnit),
      fmtMoney(l.remise),
      fmtMoney(l.totalHT),
    ]);
    y = drawTable(doc, {
      headers: ["Réf article", "Désignation", "Qté", "Prix unit HT", "Remise", "Total HT"],
      rows,
      startY: y,
      accentHex: accent,
      contentLeft,
      contentWidth,
      ensureSpace,
      colWidths: [52, 150, 32, 60, 48, contentWidth - 52 - 150 - 32 - 60 - 48],
    });
    y += 8;
    y = drawTotalsBlock(doc, {
      startY: y,
      accentHex: accent,
      contentLeft,
      contentWidth,
      ht: achat.totalHT,
      tva: achat.totalTVA,
      ttc: achat.totalTTC,
      labelTva: buildTvaLabelFromLignes(achat.lignes),
    });

    y = ensureSpace(80, y + 12);
    drawSignatureRow(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      leftLabel: "SERVICE ACHATS",
      rightLabel: "FOURNISSEUR",
    });

    return endPdfBuffer(doc, finishFootersAndHeaders);
  } catch (e) {
    if (e.status) throw e;
    const err = new Error(e?.message || "Erreur PDF");
    err.status = 500;
    throw err;
  }
}

async function getBonReceptionPdf(user, achatId) {
  try {
    const { societeId: sid } = getSocieteWhere(user);
    const achat = await prisma.achat.findFirst({
      where: { id: Number(achatId), societeId: sid },
      include: {
        fournisseur: true,
        depot: true,
        societe: true,
        lignes: { include: { article: true } },
      },
    });
    if (!achat) {
      const err = new Error("Achat introuvable");
      err.status = 404;
      throw err;
    }
    if (!["RECU", "RECEPTIONNE", "CONFIRME"].includes(achat.statut)) {
      const err = new Error("Bon de réception disponible uniquement pour un achat confirmé");
      err.status = 400;
      throw err;
    }
    const societe = achat.societe || {};
    const accent = societe.accentHex || ACCENT;
    const f = achat.fournisseur || {};
    const title = `Bon de réception — ${achat.reference}`;
    const ctx = createBaseDoc(title, societe, { refPrefix: "BR" });
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

    y = drawDocTitle(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      label: "BON DE RÉCEPTION",
      reference: achat.reference,
      accentHex: accent,
      badge: { label: "RÉCEPTIONNÉ", bg: "#dcfce7", color: "#166534" },
    });

    y = drawMetaStrip(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      accentHex: accent,
      items: [
        { label: "Date réception", value: fmtDate(achat.dateReception) },
        { label: "Livraison prévue", value: fmtDate(achat.dateLivraisonPrevue) },
        { label: "Dépôt", value: achat.depot?.code || "—" },
        { label: "Paiement", value: achat.statutPaiement || "—" },
      ],
    });

    y = drawPartyCards(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      accentHex: accent,
      left: {
        title: "Réceptionnaire",
        name: societe.nom,
        lines: [societe.adresse, societe.ville].filter(Boolean),
      },
      right: {
        title: "Fournisseur",
        name: f.nom,
        lines: [f.adresse, f.telephone, f.email].filter(Boolean),
      },
    });

    const rows = (achat.lignes || []).map((l) => {
      const qc = String(l.quantite);
      return [l.article?.code || "", l.article?.libelle || "", qc, qc, "0", fmtMoney(l.prixUnit), fmtMoney(l.remise), fmtMoney(l.totalHT)];
    });
    y = drawTable(doc, {
      headers: ["Réf", "Désignation", "Cmd", "Reçu", "Écart", "P.U HT", "Remise", "Total HT"],
      rows,
      startY: y,
      accentHex: accent,
      contentLeft,
      contentWidth,
      ensureSpace,
      colWidths: [42, 110, 36, 36, 32, 48, 40, contentWidth - 42 - 110 - 36 - 36 - 32 - 48 - 40],
    });
    y += 8;
    y = drawTotalsBlock(doc, {
      startY: y,
      accentHex: accent,
      contentLeft,
      contentWidth,
      ht: achat.totalHT,
      tva: achat.totalTVA,
      ttc: achat.totalTTC,
      labelTva: buildTvaLabelFromLignes(achat.lignes),
    });
    y += 6;
    doc.fillColor("#374151").font("Helvetica").fontSize(9);
    t(`Statut paiement : ${achat.statutPaiement || "—"}`, contentLeft, y, { width: contentWidth });
    if (achat.retardJours != null) {
      y += 12;
      t(`Retard (jours) : ${achat.retardJours}`, contentLeft, y, { width: contentWidth });
    }

    y = ensureSpace(80, y + 16);
    drawSignatureRow(doc, {
      x: contentLeft,
      y,
      width: contentWidth,
      leftLabel: "MAGASINIER",
      rightLabel: "CONTRÔLE QUALITÉ",
    });

    return endPdfBuffer(doc, finishFootersAndHeaders);
  } catch (e) {
    if (e.status) throw e;
    const err = new Error(e?.message || "Erreur PDF");
    err.status = 500;
    throw err;
  }
}

async function exportAchatsCsv(user, filters = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  const { statut, fournisseurId, search, dateDebut, dateFin } = filters;
  const searchStr = search ? String(search).trim() : "";
  let dateFilter = {};
  if (dateDebut || dateFin) {
    dateFilter = {
      dateCommande: {
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
    ...(fournisseurId ? { fournisseurId: Number(fournisseurId) } : {}),
    ...(searchStr
      ? {
          OR: [
            { reference: { contains: searchStr } },
            { fournisseur: { nom: { contains: searchStr } } },
            { fournisseur: { code: { contains: searchStr } } },
          ],
        }
      : {}),
    ...dateFilter,
  };

  const items = await prisma.achat.findMany({
    where,
    take: 5000,
    orderBy: { id: "desc" },
    include: {
      fournisseur: { select: { nom: true } },
      depot: { select: { libelle: true } },
      lignes: true,
    },
  });

  return items.map((a) => ({
    Référence: a.reference,
    "Date commande": a.dateCommande,
    Fournisseur: a.fournisseur?.nom || "",
    Dépôt: a.depot?.libelle || "",
    Statut: a.statut,
    "Total HT": a.totalHT,
    TVA: a.totalTVA,
    "Total TTC": a.totalTTC,
    "Montant réglé": a.montantRegle,
    "Statut paiement": a.statutPaiement,
    "Date réception": a.dateReception,
    "Nb lignes": (a.lignes || []).length,
  }));
}

async function confirmerCommande(user, achatId) {
  const { societeId: sid } = getSocieteWhere(user);
  const id = Number(achatId);

  const achatPreview = await prisma.achat.findFirst({
    where: { id, societeId: sid },
    include: { lignes: { include: { article: true } } },
  });
  if (!achatPreview) {
    const err = new Error("Achat introuvable");
    err.status = 404;
    throw err;
  }
  if (achatPreview.statut !== "BROUILLON") {
    const err = new Error("Seul un brouillon peut etre confirme");
    err.status = 400;
    throw err;
  }
  if (!achatPreview.lignes?.length) {
    const err = new Error("Achat sans lignes");
    err.status = 400;
    throw err;
  }

  const depIdPreview = achatPreview.depotId ?? (await resolveDepot(prisma, sid, null));
  const warnings = [];

  for (const ligne of achatPreview.lignes) {
    const check = await stockService.checkDepotCapacity(
      depIdPreview,
      ligne.articleId,
      Number(ligne.quantite),
      sid
    );
    if (check.blocked) {
      const err = new Error(check.message || "Capacité dépôt dépassée");
      err.status = 409;
      err.code = "CAPACITE_DEPOT_DEPASSEE";
      throw err;
    }
    if (check.warning) warnings.push(check.message);
  }

  const result = await prisma.$transaction(async (tx) => {
    const achat = await tx.achat.findFirst({
      where: { id, societeId: sid },
      include: { lignes: { include: { article: true } } },
    });
    if (!achat) {
      const err = new Error("Achat introuvable");
      err.status = 404;
      throw err;
    }
    if (achat.statut !== "BROUILLON") {
      const err = new Error("Seul un brouillon peut etre confirme");
      err.status = 400;
      throw err;
    }
    if (!achat.lignes?.length) {
      const err = new Error("Achat sans lignes");
      err.status = 400;
      throw err;
    }

    const depId = achat.depotId ?? (await resolveDepot(tx, sid, null));
    const receptionDate = new Date();
    let retardJours = null;
    if (achat.dateLivraisonPrevue) {
      const prevu = new Date(achat.dateLivraisonPrevue);
      retardJours = Math.round((receptionDate.getTime() - prevu.getTime()) / (1000 * 60 * 60 * 24));
    }

    const uniqueArticleIds = [...new Set(achat.lignes.map((l) => l.articleId))];
    for (const articleId of uniqueArticleIds) {
      const art = achat.lignes.find((l) => l.articleId === articleId)?.article;
      if (tracksLot(resolveModeTracage(art))) {
        await lotsService.ensureStockCoveredByLots(tx, { articleId, depotId: depId });
      }
    }

    for (const ligne of achat.lignes) {
      await assertArticleActif(ligne.articleId, sid);
      const qte = Number(ligne.quantite);
      const { lotId } = await applyEntreeTracage(tx, {
        article: ligne.article,
        articleId: ligne.articleId,
        qRecue: qte,
        sid,
        depId,
        body: { dateExpiration: ligne.dateExpiration },
        achatId: achat.id,
        autoFallback: true,
      });

      await incrementStockOnConfirmation(tx, {
        societeId: sid,
        articleId: ligne.articleId,
        depotId: depId,
        quantite: qte,
        dateLastMvt: receptionDate,
      });

      const refMvt = `ENT-${achat.reference}-${ligne.articleId}-${ligne.id}`;
      await insertMouvement(tx, {
        reference: refMvt,
        type: MOUVEMENT_TYPES.ENTREE_ACHAT,
        articleId: ligne.articleId,
        depotId: depId,
        emplacementId: null,
        quantite: qte,
        valeur: ligne.totalHT,
        utilisateurId: user.id,
        commentaire: `Confirmation achat ${achat.reference}`,
        lotId,
      });

      const prixUnitaire =
        Number(ligne.prixUnit) > 0
          ? Number(ligne.prixUnit)
          : Number(ligne.quantite) > 0
            ? Number(ligne.totalHT) / Number(ligne.quantite)
            : 0;

      await valuationService.onEntreeStock(tx, {
        societeId: sid,
        articleId: ligne.articleId,
        depotId: depId,
        quantite: qte,
        prixUnitaire,
        achatId: achat.id,
        lotId,
      });

      await tx.ligneAchat.update({
        where: { id: ligne.id },
        data: { quantiteRecue: qte },
      });
    }

    return tx.achat.update({
      where: { id: achat.id },
      data: {
        statut: "CONFIRME",
        confirmedAt: receptionDate,
        confirmedBy: user.id,
        dateReception: receptionDate,
        dateLivraisonReelle: receptionDate,
        depotId: depId,
        ...(retardJours != null ? { retardJours } : {}),
      },
      include: {
        fournisseur: { select: { nom: true, code: true } },
        depot: { select: { code: true, libelle: true } },
        confirmateur: { select: { id: true, nom: true, prenom: true } },
        lignes: { include: { article: { select: { code: true, libelle: true, strategieSortie: true, modeGestion: true, modeTracage: true, tracageAuto: true } } } },
        lots: {
          include: { article: { select: { code: true, libelle: true } } },
        },
      },
    });
  });

  if (warnings.length) {
    return { ...lotsService.attachLotsToLignes(result), warnings };
  }
  return lotsService.attachLotsToLignes(result);
}

/** @deprecated alias — use confirmerCommande */
async function confirmerAchat(user, achatId) {
  return confirmerCommande(user, achatId);
}

async function annulerAchat(user, achatId) {
  const { societeId: sid } = getSocieteWhere(user);
  const ex = await prisma.achat.findFirst({ where: { id: Number(achatId), societeId: sid } });
  if (!ex) {
    const err = new Error("Achat introuvable");
    err.status = 404;
    throw err;
  }
  if (!["BROUILLON"].includes(ex.statut)) {
    const err = new Error("Annulation impossible pour ce statut");
    err.status = 400;
    throw err;
  }
  return prisma.achat.update({
    where: { id: ex.id },
    data: { statut: "ANNULE" },
    include: {
      fournisseur: { select: { nom: true, code: true } },
      depot: { select: { code: true, libelle: true } },
      lignes: { include: { article: { select: { code: true, libelle: true } } } },
    },
  });
}

async function getAchatsEnRetard(user) {
  const { societeId: sid } = getSocieteWhere(user);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const items = await prisma.achat.findMany({
    where: {
      societeId: sid,
      statut: "BROUILLON",
      dateLivraisonPrevue: { lt: today },
    },
    orderBy: { dateLivraisonPrevue: "asc" },
    include: {
      fournisseur: { select: { id: true, code: true, nom: true } },
      depot: { select: { id: true, code: true, libelle: true } },
    },
  });

  return { items, total: items.length };
}

async function getComparaisonFournisseurs(user, { familleId, dateDebut, dateFin } = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const start = dateDebut ? new Date(String(dateDebut)) : defaultStart;
  const end = dateFin
    ? (() => {
        const d = new Date(String(dateFin));
        d.setHours(23, 59, 59, 999);
        return d;
      })()
    : now;

  const lignes = await prisma.ligneAchat.findMany({
    where: {
      achat: {
        societeId: sid,
        statut: { in: STATUTS_CONFIRMES },
        dateCommande: { gte: start, lte: end },
      },
      ...(familleId ? { article: { familleId: Number(familleId) } } : {}),
    },
    include: {
      article: {
        select: {
          id: true,
          code: true,
          libelle: true,
          familleId: true,
          famille: { select: { id: true, nom: true } },
        },
      },
      achat: {
        select: {
          id: true,
          reference: true,
          dateCommande: true,
          fournisseurId: true,
          fournisseur: { select: { id: true, nom: true, code: true } },
        },
      },
    },
  });

  const byArticle = new Map();
  for (const l of lignes) {
    const artId = l.articleId;
    if (!byArticle.has(artId)) {
      byArticle.set(artId, {
        articleId: artId,
        articleCode: l.article?.code || "",
        articleLibelle: l.article?.libelle || "",
        famille: l.article?.famille?.nom || "",
        fournisseurs: new Map(),
      });
    }
    const row = byArticle.get(artId);
    const fid = l.achat.fournisseurId;
    const cur = row.fournisseurs.get(fid) || {
      fournisseurId: fid,
      nom: l.achat.fournisseur?.nom || "",
      code: l.achat.fournisseur?.code || "",
      prices: [],
      orders: new Set(),
      lastOrder: null,
    };
    const pu = Number(l.quantite) > 0 ? Number(l.totalHT) / Number(l.quantite) : Number(l.prixUnit);
    cur.prices.push(pu);
    cur.orders.add(l.achat.id);
    const dt = new Date(l.achat.dateCommande);
    if (!cur.lastOrder || dt > cur.lastOrder) cur.lastOrder = dt;
    row.fournisseurs.set(fid, cur);
  }

  const articles = [];
  const summaryRows = [];

  for (const [, art] of byArticle) {
    const suppliers = [];
    for (const [, f] of art.fournisseurs) {
      const prices = f.prices.filter((p) => Number.isFinite(p));
      const avg = prices.length ? round2(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
      const min = prices.length ? round2(Math.min(...prices)) : 0;
      const max = prices.length ? round2(Math.max(...prices)) : 0;
      suppliers.push({
        fournisseurId: f.fournisseurId,
        nom: f.nom,
        code: f.code,
        nbCommandes: f.orders.size,
        prixMoyen: avg,
        prixMin: min,
        prixMax: max,
        derniereCommande: f.lastOrder,
      });
      summaryRows.push({
        articleId: art.articleId,
        articleLibelle: art.articleLibelle,
        fournisseurId: f.fournisseurId,
        fournisseurNom: f.nom,
        nbCommandes: f.orders.size,
        prixMoyen: avg,
        prixMin: min,
        prixMax: max,
        derniereCommande: f.lastOrder,
      });
    }
    suppliers.sort((a, b) => a.prixMoyen - b.prixMoyen);
    const meilleur = suppliers[0] || null;
    articles.push({
      articleId: art.articleId,
      articleCode: art.articleCode,
      articleLibelle: art.articleLibelle,
      famille: art.famille,
      fournisseurs: suppliers.map((s) => ({
        ...s,
        meilleurPrix: meilleur && s.fournisseurId === meilleur.fournisseurId,
      })),
      meilleurFournisseurId: meilleur?.fournisseurId ?? null,
    });
  }

  articles.sort((a, b) => a.articleLibelle.localeCompare(b.articleLibelle, "fr"));
  summaryRows.sort((a, b) => a.fournisseurNom.localeCompare(b.fournisseurNom, "fr"));

  return { articles, summary: summaryRows, periode: { dateDebut: start, dateFin: end } };
}

async function getStatsAchats(user, query = {}) {
  try {
    const { societeId: sid } = getSocieteWhere(user);
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const startYear = new Date(now.getFullYear(), 0, 1);
    const endYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const [aggMois, aggAnnee, nbCommandes, nbConfirmes, nbBrouillons, nbEnRetard, allAchats, fournisseursYear] =
      await Promise.all([
      prisma.achat.aggregate({
        where: { societeId: sid, dateCommande: { gte: startMonth, lte: endMonth } },
        _sum: { totalTTC: true },
      }),
      prisma.achat.aggregate({
        where: { societeId: sid, dateCommande: { gte: startYear, lte: endYear } },
        _sum: { totalTTC: true },
      }),
      prisma.achat.count({ where: { societeId: sid } }),
      prisma.achat.count({ where: { societeId: sid, statut: { in: STATUTS_CONFIRMES } } }),
      prisma.achat.count({ where: { societeId: sid, statut: "BROUILLON" } }),
      prisma.achat.count({
        where: {
          societeId: sid,
          statut: "BROUILLON",
          dateLivraisonPrevue: { lt: now },
        },
      }),
      prisma.achat.findMany({
        where: { societeId: sid },
        select: { totalTTC: true, montantRegle: true, statutPaiement: true },
      }),
      prisma.achat.findMany({
        where: {
          societeId: sid,
          dateCommande: { gte: startYear, lte: endYear },
        },
        select: { totalTTC: true, fournisseurId: true, fournisseur: { select: { nom: true } } },
      }),
    ]);

    let montantNonRegle = 0;
    for (const a of allAchats) {
      if (a.statutPaiement === "REGLE") continue;
      montantNonRegle += Number(a.totalTTC) - Number(a.montantRegle || 0);
    }
    montantNonRegle = round2(montantNonRegle);

    const byFour = new Map();
    for (const a of fournisseursYear) {
      const id = a.fournisseurId;
      const cur = byFour.get(id) || { nom: a.fournisseur?.nom || "", total: 0, nb: 0 };
      cur.total += Number(a.totalTTC || 0);
      cur.nb += 1;
      byFour.set(id, cur);
    }
    const topFournisseurs = [...byFour.values()]
      .sort((x, y) => y.total - x.total)
      .slice(0, 5)
      .map((x) => ({ nom: x.nom, total: round2(x.total), nb: x.nb }));

    const evolutionMensuelle = [];
    const evolutionMois = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const agg = await prisma.achat.aggregate({
        where: { societeId: sid, dateCommande: { gte: mStart, lte: mEnd } },
        _sum: { totalHT: true, totalTTC: true },
        _count: true,
      });
      const row = {
        mois,
        totalHT: round2(Number(agg._sum.totalHT || 0)),
        totalTTC: round2(Number(agg._sum.totalTTC || 0)),
        nbAchats: agg._count,
        total: round2(Number(agg._sum.totalTTC || 0)),
      };
      evolutionMensuelle.push(row);
      evolutionMois.push({ mois, total: row.totalTTC });
    }

    const nbEnAttente = nbBrouillons;
    const nbRecus = nbConfirmes;
    const nbAnnules = 0;

    return {
      totalMois: round2(Number(aggMois._sum.totalTTC || 0)),
      totalAnnee: round2(Number(aggAnnee._sum.totalTTC || 0)),
      nbCommandes,
      nbEnAttente,
      nbRecus,
      nbBrouillons,
      nbConfirmes,
      nbEnRetard,
      nbAnnules,
      nbReceptionnes: nbConfirmes,
      countsWorkflow: {
        BROUILLON: nbBrouillons,
        CONFIRME: nbConfirmes,
      },
      montantNonRegle,
      montantEnAttente: round2(
        Number(
          (
            await prisma.achat.aggregate({
              where: { societeId: sid, statut: "BROUILLON" },
              _sum: { totalTTC: true },
            })
          )._sum.totalTTC || 0
        )
      ),
      tauxReception: nbConfirmes + nbBrouillons > 0 ? round2((nbConfirmes / (nbConfirmes + nbBrouillons)) * 100) : 0,
      topFournisseurs,
      evolutionMois,
      evolutionMensuelle,
    };
  } catch (e) {
    const err = new Error(e?.message || "Erreur stats achats");
    err.status = 500;
    throw err;
  }
}

module.exports = {
  listAchats,
  getAchat,
  createAchat,
  updateAchat,
  deleteAchat,
  recevoirAchat,
  receptionnerLigne,
  enregistrerPaiementAchat,
  statutPaiementFromMontants,
  TVA_DEFAULT,
  getBonCommandePdf,
  getBonReceptionPdf,
  exportAchatsCsv,
  getStatsAchats,
  confirmerCommande,
  confirmerAchat,
  annulerAchat,
  getAchatsEnRetard,
  getComparaisonFournisseurs,
  isAchatConfirme,
  normalizeStatutAchat,
  STATUTS_CONFIRMES,
};
