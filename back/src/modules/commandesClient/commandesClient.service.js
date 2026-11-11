const prisma = require("../../config/database");
const { resolveClientForUser } = require("../panier/clientResolver");
const panierService = require("../panier/panier.service");
const {
  sumStockDisponible,
  reserveVenteLignes,
  releaseVenteReservations,
} = require("../mouvements/mouvements.service");
const { normalizeCode } = require("../../utils/codeUtils");

const TVA_RATE = 0.19;

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function generateReference(societeId) {
  const year = new Date().getFullYear();
  const prefix = `CMD-${year}-`;
  const last = await prisma.commandeClient.findFirst({
    where: {
      societeId,
      reference: { startsWith: prefix },
    },
    orderBy: { id: "desc" },
    select: { reference: true },
  });
  let seq = 1;
  if (last?.reference) {
    const part = last.reference.slice(prefix.length);
    const n = parseInt(part, 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(6, "0")}`;
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

/**
 * Dépôt qui peut servir TOUTES les lignes, ou null si aucun.
 */
async function findCoveringDepot(tx, societeId, lignes) {
  const sid = Number(societeId);
  const depots = await tx.depot.findMany({
    where: { societeId: sid },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!depots.length) return null;

  const needs = (lignes || []).map((l) => ({
    articleId: Number(l.articleId),
    quantite: Number(l.quantite) || 0,
    libelle: l.article?.libelle || l.libelle || `#${l.articleId}`,
  }));

  let best = null;
  for (const d of depots) {
    let coversAll = true;
    let minSlack = Infinity;
    const shortages = [];
    for (const need of needs) {
      const dispo = await sumStockDisponible(tx, need.articleId, d.id);
      if (dispo + 1e-6 < need.quantite) {
        coversAll = false;
        shortages.push({
          articleId: need.articleId,
          libelle: need.libelle,
          disponible: dispo,
          demande: need.quantite,
        });
      } else {
        minSlack = Math.min(minSlack, dispo - need.quantite);
      }
    }
    if (coversAll && (!best || minSlack > best.slack)) {
      best = { id: d.id, slack: minSlack };
    }
  }
  return best?.id ?? null;
}

/**
 * Choisit uniquement un dépôt qui peut servir TOUTES les lignes (stock libre).
 * Plus de fallback partiel : évite de confirmer sur un dépôt incomplet.
 */
async function resolveBestDepotForLignes(tx, societeId, lignes) {
  return findCoveringDepot(tx, societeId, lignes);
}

async function assertCommandeFulfillable(tx, societeId, lignes) {
  const covering = await findCoveringDepot(tx, societeId, lignes);
  if (covering) return covering;

  const sid = Number(societeId);
  const depots = await tx.depot.findMany({
    where: { societeId: sid },
    select: { id: true },
  });
  const details = [];
  for (const l of lignes) {
    let maxDispo = 0;
    for (const d of depots) {
      const dispo = await sumStockDisponible(tx, l.articleId, d.id);
      if (dispo > maxDispo) maxDispo = dispo;
    }
    const demande = Number(l.quantite) || 0;
    if (maxDispo + 1e-6 < demande) {
      details.push({
        articleId: l.articleId,
        libelle: l.article?.libelle || `#${l.articleId}`,
        disponible: maxDispo,
        demande,
      });
    }
  }
  const first = details[0];
  const err = new Error(
    first
      ? `Stock insuffisant pour « ${first.libelle} » (dispo : ${first.disponible}, demandé : ${first.demande})`
      : "Aucun dépôt ne peut honorer cette commande en une seule livraison"
  );
  err.status = 409;
  err.code = "STOCK_INSUFFISANT";
  err.details = details;
  throw err;
}

/**
 * Crée une Vente BROUILLON liée à la commande web — visible dans /ventes
 * pour ADMIN / SUPER_ADMIN / MAGASINIER, confirmable via confirmerVente.
 */
async function createVenteBrouillonFromCommande(tx, { societeId, clientId, referenceCmd, lignes, modePaiement }) {
  const ligneData = [];
  let totalHTBrut = 0;
  for (const l of lignes) {
    const quantite = Number(l.quantite);
    const prixUnit = Number(l.prixUnitaire) || 0;
    const lineHT = round2(quantite * prixUnit);
    totalHTBrut += lineHT;
    ligneData.push({
      articleId: Number(l.articleId),
      quantite,
      prixUnit,
      remise: 0,
      totalHT: lineHT,
    });
  }
  const totalHT = round2(totalHTBrut);
  const totalTVA = round2(totalHT * TVA_RATE);
  const totalTTC = round2(totalHT + totalTVA);
  const depotId = await assertCommandeFulfillable(tx, societeId, lignes);
  const venteRef = await nextVenteReference(tx, societeId);

  const vente = await tx.vente.create({
    data: {
      reference: normalizeCode(venteRef),
      clientId: Number(clientId),
      societeId: Number(societeId),
      depotId,
      statut: "BROUILLON",
      typeVente: "COMMANDE_WEB",
      totalHT,
      totalTVA,
      totalTTC,
      remise: 0,
      modePaiement: modePaiement || null,
      lignes: { create: ligneData },
    },
    include: { lignes: true },
  });

  // Réserve le stock libre jusqu'à confirmation / annulation
  await reserveVenteLignes(tx, { depotId, lignes: vente.lignes });

  return vente;
}

/**
 * Réassigne le dépôt des ventes web brouillon si le dépôt actuel
 * n'a pas assez de stock (cas des commandes créées avant le fix).
 */
async function realignWebVenteDepots(societeId) {
  const sid = Number(societeId);
  if (!Number.isFinite(sid)) return { updated: 0 };

  const ventes = await prisma.vente.findMany({
    where: {
      societeId: sid,
      typeVente: "COMMANDE_WEB",
      statut: { in: ["BROUILLON", "EN_ATTENTE"] },
    },
    include: { lignes: true },
    take: 50,
  });

  let updated = 0;
  for (const v of ventes) {
    if (!v.lignes?.length) continue;
    try {
      await prisma.$transaction(async (tx) => {
        // Libérer l'ancienne réservation avant de tester le stock libre
        await releaseVenteReservations(tx, v);
        const bestId = await findCoveringDepot(tx, sid, v.lignes);
        if (!bestId) {
          // Reposer la réservation sur l'ancien dépôt si toujours possible
          try {
            await reserveVenteLignes(tx, { depotId: v.depotId, lignes: v.lignes });
          } catch {
            // stock déjà parti — vente restera non confirmable
          }
          return;
        }
        if (bestId !== v.depotId) {
          await tx.vente.update({
            where: { id: v.id },
            data: { depotId: bestId },
          });
          updated += 1;
        }
        await reserveVenteLignes(tx, { depotId: bestId, lignes: v.lignes });
      });
    } catch {
      // ignore
    }
  }
  return { updated };
}

async function resolveLignesFromBodyOrPanier(user, bodyLignes) {
  const { client, societeId } = await resolveClientForUser(user);

  let rawLignes = Array.isArray(bodyLignes) ? bodyLignes : null;

  if (!rawLignes || rawLignes.length === 0) {
    const panier = await panierService.getOrCreatePanier(client.id, societeId);
    const mapped = panierService.mapPanier(panier);
    rawLignes = mapped.lignes.map((l) => ({
      articleId: l.articleId,
      quantite: l.quantite,
    }));
  }

  if (!rawLignes.length) {
    const err = new Error("Le panier est vide");
    err.status = 400;
    throw err;
  }

  const MAX_QTY = 999999;
  const lignes = [];
  for (const row of rawLignes) {
    const articleId = Number(row.articleId);
    const quantite = Math.floor(Number(row.quantite));
    if (
      !Number.isFinite(articleId) ||
      !Number.isFinite(quantite) ||
      quantite <= 0 ||
      quantite > MAX_QTY
    ) {
      const err = new Error(
        quantite > MAX_QTY
          ? `Quantité trop élevée (max ${MAX_QTY.toLocaleString("fr-FR")})`
          : "Ligne de commande invalide"
      );
      err.status = 400;
      throw err;
    }
    const article = await prisma.article.findFirst({
      where: {
        id: articleId,
        societeId,
        actif: true,
        statut: "ACTIF",
      },
    });
    if (!article) {
      const err = new Error(`Article #${articleId} introuvable ou indisponible`);
      err.status = 404;
      throw err;
    }
    lignes.push({
      articleId,
      quantite,
      prixUnitaire: Number(article.prixVente) || 0,
      article,
    });
  }

  return { client, societeId, lignes };
}

const MODES_PAIEMENT_OK = new Set([
  "ESPECES",
  "VIREMENT",
  "CHEQUE",
  "CARTE",
  "A_LA_LIVRAISON",
  "AUTRE",
]);

async function createCommande(user, body = {}) {
  const { client, societeId, lignes } = await resolveLignesFromBodyOrPanier(user, body.lignes);

  const montantTTC = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
  const montantHT = Math.round((montantTTC / (1 + TVA_RATE)) * 1000) / 1000;
  const reference = await generateReference(societeId);

  const adresseLivraison =
    String(body.adresseLivraison || client.adresse || "").trim() || null;
  const notesLivraison = String(body.notesLivraison || "").trim() || null;
  let modePaiement = String(body.modePaiement || client.modePaiement || "A_LA_LIVRAISON")
    .trim()
    .toUpperCase();
  if (!MODES_PAIEMENT_OK.has(modePaiement)) modePaiement = "A_LA_LIVRAISON";

  const commande = await prisma.$transaction(async (tx) => {
    const vente = await createVenteBrouillonFromCommande(tx, {
      societeId,
      clientId: client.id,
      referenceCmd: reference,
      lignes,
      modePaiement,
    });

    const created = await tx.commandeClient.create({
      data: {
        reference,
        clientId: client.id,
        societeId,
        statut: "EN_ATTENTE",
        montantHT,
        montantTTC,
        adresseLivraison,
        notesLivraison,
        modePaiement,
        venteId: vente.id,
        lignes: {
          create: lignes.map((l) => ({
            articleId: l.articleId,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
          })),
        },
      },
      include: {
        lignes: {
          include: {
            article: {
              select: {
                id: true,
                code: true,
                libelle: true,
                imageUrl: true,
                unite: true,
              },
            },
          },
        },
        client: { select: { id: true, code: true, nom: true, email: true, adresse: true } },
        vente: { select: { id: true, reference: true, statut: true } },
      },
    });

    const panier = await tx.panier.findUnique({
      where: { clientId_societeId: { clientId: client.id, societeId } },
    });
    if (panier) {
      await tx.lignePanier.deleteMany({ where: { panierId: panier.id } });
    }

    return created;
  });

  // Email confirmation (non bloquant)
  try {
    const { sendCommandeStatusEmail } = require("../../utils/commandeEmail");
    const societe = await prisma.societe.findUnique({ where: { id: societeId } });
    await sendCommandeStatusEmail(commande, societe);
  } catch {
    /* ignore */
  }

  return mapCommande(commande);
}

/**
 * Met à jour le statut d'une commande liée à une vente + email client.
 */
async function setCommandeStatutByVenteId(venteId, statut, societeId) {
  const updated = await prisma.commandeClient.updateMany({
    where: { venteId: Number(venteId), societeId: Number(societeId) },
    data: { statut },
  });
  if (!updated.count) return null;

  const commande = await prisma.commandeClient.findFirst({
    where: { venteId: Number(venteId), societeId: Number(societeId) },
    include: {
      client: { select: { id: true, nom: true, email: true } },
    },
  });
  if (commande) {
    try {
      const { sendCommandeStatusEmail } = require("../../utils/commandeEmail");
      const societe = await prisma.societe.findUnique({ where: { id: Number(societeId) } });
      await sendCommandeStatusEmail(commande, societe);
    } catch {
      /* ignore */
    }
  }
  return commande;
}

/**
 * Annulation client — uniquement EN_ATTENTE ; libère la réservation stock.
 */
async function annulerCommande(user, commandeId) {
  const { client, societeId } = await resolveClientForUser(user);

  const result = await prisma.$transaction(async (tx) => {
    const commande = await tx.commandeClient.findFirst({
      where: { id: Number(commandeId), clientId: client.id, societeId },
      include: {
        vente: { include: { lignes: true } },
        client: { select: { id: true, nom: true, email: true } },
      },
    });
    if (!commande) {
      const err = new Error("Commande introuvable");
      err.status = 404;
      throw err;
    }
    if (commande.statut !== "EN_ATTENTE") {
      const err = new Error("Seule une commande en attente peut être annulée");
      err.status = 400;
      throw err;
    }

    if (commande.vente && ["BROUILLON", "EN_ATTENTE"].includes(commande.vente.statut)) {
      await releaseVenteReservations(tx, commande.vente);
      await tx.commandeClient.update({
        where: { id: commande.id },
        data: { statut: "ANNULEE", venteId: null },
      });
      await tx.ligneVente.deleteMany({ where: { venteId: commande.vente.id } });
      await tx.vente.delete({ where: { id: commande.vente.id } });
    } else {
      await tx.commandeClient.update({
        where: { id: commande.id },
        data: { statut: "ANNULEE" },
      });
    }

    return tx.commandeClient.findUnique({
      where: { id: commande.id },
      include: {
        lignes: {
          include: {
            article: {
              select: { id: true, code: true, libelle: true, imageUrl: true, unite: true },
            },
          },
        },
        client: { select: { id: true, code: true, nom: true, email: true } },
      },
    });
  });

  try {
    const { sendCommandeStatusEmail } = require("../../utils/commandeEmail");
    const societe = await prisma.societe.findUnique({ where: { id: societeId } });
    await sendCommandeStatusEmail(result, societe);
  } catch {
    /* ignore */
  }

  return mapCommande(result);
}

/**
 * Rattrapage : commandes web EN_ATTENTE sans vente liée → crée le brouillon.
 * Appelé à l'ouverture de la liste ventes staff.
 */
async function syncOrphanCommandesToVentes(societeId) {
  const sid = Number(societeId);
  if (!Number.isFinite(sid)) return { synced: 0 };

  const orphans = await prisma.commandeClient.findMany({
    where: {
      societeId: sid,
      venteId: null,
      statut: "EN_ATTENTE",
    },
    include: { lignes: true },
    take: 50,
    orderBy: { id: "asc" },
  });

  let synced = 0;
  for (const cmd of orphans) {
    if (!cmd.lignes?.length) continue;
    try {
      await prisma.$transaction(async (tx) => {
        const vente = await createVenteBrouillonFromCommande(tx, {
          societeId: sid,
          clientId: cmd.clientId,
          referenceCmd: cmd.reference,
          lignes: cmd.lignes.map((l) => ({
            articleId: l.articleId,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
          })),
        });
        await tx.commandeClient.update({
          where: { id: cmd.id },
          data: { venteId: vente.id },
        });
      });
      synced += 1;
    } catch {
      // Ne bloque pas la liste ventes si un orphelin échoue (ex. pas de dépôt)
    }
  }
  return { synced };
}

function mapCommande(c) {
  return {
    id: c.id,
    reference: c.reference,
    statut: c.statut,
    montantHT: Number(c.montantHT),
    montantTTC: Number(c.montantTTC),
    adresseLivraison: c.adresseLivraison || null,
    notesLivraison: c.notesLivraison || null,
    modePaiement: c.modePaiement || null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    client: c.client,
    venteId: c.venteId ?? c.vente?.id ?? null,
    vente: c.vente
      ? { id: c.vente.id, reference: c.vente.reference, statut: c.vente.statut }
      : undefined,
    lignes: (c.lignes || []).map((l) => ({
      id: l.id,
      articleId: l.articleId,
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.prixUnitaire),
      totalLigne: Number(l.quantite) * Number(l.prixUnitaire),
      article: l.article,
    })),
  };
}

async function listCommandes(user, { page = 1, limit = 20 } = {}) {
  const { client, societeId } = await resolveClientForUser(user);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;
  const where = { clientId: client.id, societeId };

  const [items, total] = await Promise.all([
    prisma.commandeClient.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        lignes: {
          include: {
            article: {
              select: { id: true, code: true, libelle: true, imageUrl: true, unite: true },
            },
          },
        },
        vente: { select: { id: true, reference: true, statut: true } },
      },
    }),
    prisma.commandeClient.count({ where }),
  ]);

  return {
    items: items.map(mapCommande),
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
    limit: limitNum,
  };
}

async function getCommande(user, id) {
  const { client, societeId } = await resolveClientForUser(user);
  const commande = await prisma.commandeClient.findFirst({
    where: { id: Number(id), clientId: client.id, societeId },
    include: {
      lignes: {
        include: {
          article: {
            select: { id: true, code: true, libelle: true, imageUrl: true, unite: true },
          },
        },
      },
      client: { select: { id: true, code: true, nom: true, email: true } },
      vente: { select: { id: true, reference: true, statut: true } },
    },
  });
  if (!commande) {
    const err = new Error("Commande introuvable");
    err.status = 404;
    throw err;
  }
  return mapCommande(commande);
}

module.exports = {
  createCommande,
  listCommandes,
  getCommande,
  annulerCommande,
  setCommandeStatutByVenteId,
  syncOrphanCommandesToVentes,
  realignWebVenteDepots,
  resolveBestDepotForLignes,
  findCoveringDepot,
};
