const mouvementsService = require("../mouvements/mouvements.service");
const lotsService = require("../lots/lots.service");
const valuationService = require("../valuation/valuation.service");
const { resolveModeTracage, tracksLot, tracksSerie, assertIntegerQuantite } = require("../../utils/tracage");
const { getSocieteWhere } = require("../../utils/societeScope");
const {
  createBaseDoc,
  drawTable,
  drawTotalsBlock,
  drawDocTitle,
  drawMetaStrip,
  drawPartyCards,
  drawSignatureRow,
  drawRoundedRect,
  absText,
  endPdfBuffer,
  fmtDate,
  fmtMoney,
  ACCENT,
  INK,
  SLATE,
} = require("../../utils/pdfHelper");

const MOTIF_LABEL = {
  NON_CONFORME: "Non-conforme",
  ABIME: "Abîmé",
  ERREUR_REFERENCE: "Erreur de référence",
  DATE_PEREMPTION_COURTE: "Date de péremption courte",
  SURPLUS: "Surplus",
  QUALITE_INSUFFISANTE: "Qualité insuffisante",
  AUTRE: "Autre",
};

const STATUT_BADGE = {
  EN_ATTENTE: { label: "EN ATTENTE", bg: "#fef3c7", color: "#92400e" },
  ACCEPTE: { label: "ACCEPTÉ", bg: "#dcfce7", color: "#166534" },
  REFUSE: { label: "REFUSÉ", bg: "#fee2e2", color: "#b91c1c" },
  REMPLACEMENT_DEMANDE: { label: "REMPLACEMENT", bg: "#e0e7ff", color: "#3730a3" },
  AVOIR_EMIS: { label: "AVOIR ÉMIS", bg: "#dcfce7", color: "#166534" },
};

const STATUT_LABEL = {
  EN_ATTENTE: "En attente d'accord",
  ACCEPTE: "Accepté",
  REFUSE: "Refusé",
  REMPLACEMENT_DEMANDE: "Remplacement demandé",
  AVOIR_EMIS: "Avoir émis",
};

function pdfNumber(n, options) {
  return Number(n || 0)
    .toLocaleString("fr-FR", options)
    .replace(/[\u202f\u00a0]/g, " ");
}

function fmtQty(n, unite) {
  const q = pdfNumber(n, { maximumFractionDigits: 3 });
  return unite ? `${q} ${unite}` : q;
}

function money(n) {
  return fmtMoney(n).replace(/[\u202f\u00a0]/g, " ");
}

async function nextRetourReference(tx, societeId) {
  const year = new Date().getFullYear();
  const prefix = `RET-${year}-`;
  const rows = await tx.retourFournisseur.findMany({
    where: { societeId, reference: { startsWith: prefix } },
    select: { reference: true },
  });
  let max = 0;
  for (const row of rows) {
    const n = Number(String(row.reference).slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function fmtShortDate(d) {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toLocaleDateString("fr-FR");
}

function parseLotsDetail(mouvement) {
  if (!mouvement?.lotsDetail) return [];
  try {
    const raw = JSON.parse(mouvement.lotsDetail);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

const MOTIFS_RETOUR = new Set([
  "NON_CONFORME",
  "ABIME",
  "ERREUR_REFERENCE",
  "DATE_PEREMPTION_COURTE",
  "SURPLUS",
  "QUALITE_INSUFFISANTE",
  "AUTRE",
]);

function resolveMotif(motifRaw) {
  const text = String(motifRaw || "").trim();
  const upper = text.toUpperCase().replace(/\s+/g, "_");
  if (MOTIFS_RETOUR.has(upper)) {
    return { motif: upper, notes: null };
  }
  return { motif: "AUTRE", notes: text || null };
}

async function creerRetourFournisseur(
  prisma,
  { societeId, fournisseurId, articleId, depotId, quantite, motif, userId, achatId }
) {
  return prisma.$transaction(async (tx) => {
    const sid = Number(societeId);
    const q = Number(quantite);
    if (!(q > 0)) {
      const err = new Error("Quantite invalide");
      err.status = 400;
      throw err;
    }
    const fournisseur = await tx.fournisseur.findFirst({
      where: { id: Number(fournisseurId), societeId: sid },
    });
    if (!fournisseur) {
      const err = new Error("Fournisseur introuvable");
      err.status = 404;
      throw err;
    }
    const article = await tx.article.findFirst({
      where: { id: Number(articleId), societeId: sid },
    });
    if (!article) {
      const err = new Error("Article introuvable");
      err.status = 404;
      throw err;
    }
    const depot = await tx.depot.findFirst({
      where: { id: Number(depotId), societeId: sid },
    });
    if (!depot) {
      const err = new Error("Depot introuvable");
      err.status = 404;
      throw err;
    }
    if (!motif || !String(motif).trim()) {
      const err = new Error("Motif obligatoire pour un retour fournisseur");
      err.status = 400;
      throw err;
    }

    let achat = null;
    let quantiteAchetee = null;
    if (achatId != null && achatId !== "") {
      achat = await tx.achat.findFirst({
        where: { id: Number(achatId), societeId: sid, fournisseurId: fournisseur.id },
        include: { lignes: { where: { articleId: article.id } } },
      });
      if (!achat) {
        const err = new Error("Achat introuvable pour ce fournisseur");
        err.status = 404;
        throw err;
      }
      quantiteAchetee = achat.lignes.reduce(
        (s, l) => s + Number(l.quantiteRecue || l.quantite || 0),
        0
      );
    }

    const { lotsConsumed } = await lotsService.consumeLotsInTransaction(tx, {
      articleId: article.id,
      depotId: depot.id,
      societeId: sid,
      quantite: q,
      strategie: article.strategieSortie,
    });

    const mode = String(article.strategieSortie || "FIFO").toUpperCase();
    const methode = mode === "FEFO" || mode === "FIFO" || mode === "STANDARD" ? "FIFO" : "CMP";
    const modeTracage = resolveModeTracage(article);
    const trackedByLot = tracksLot(modeTracage);
    if (tracksSerie(modeTracage)) {
      let n;
      try {
        n = assertIntegerQuantite(q, "La quantité retournée doit être un entier pour un article en numéro de série");
      } catch (e) {
        const err = new Error(e.message);
        err.status = 422;
        throw err;
      }
      const lotIds = lotsConsumed.map((l) => l.lotId).filter(Boolean);
      const disponibles = await tx.numeroSerie.findMany({
        where: {
          articleId: article.id,
          depotId: depot.id,
          statut: "DISPONIBLE",
          ...(lotIds.length ? { lotId: { in: lotIds } } : {}),
        },
        orderBy: { createdAt: "asc" },
        take: n,
      });
      if (disponibles.length < n) {
        const err = new Error(
          `Stock de numéros de série insuffisant pour le retour (${disponibles.length}/${n})`
        );
        err.status = 409;
        throw err;
      }
      await tx.numeroSerie.updateMany({
        where: { id: { in: disponibles.map((s) => s.id) } },
        data: { statut: "RETOURNE" },
      });
    }
    let valeur = null;
    try {
      const valuation = await valuationService.onSortieStock(tx, {
        societeId: sid,
        articleId: article.id,
        depotId: depot.id,
        quantite: q,
        methode,
        // Articles non tracés par lot : ne pas lier le coût au lot, orderIndex inchangé.
        ...(trackedByLot ? { lotsConsumed } : {}),
      });
      valeur = valuation?.coutTotal ?? null;
    } catch (e) {
      if (e.message?.includes("FIFO insuffisantes") || e.message?.includes("insuffisant")) {
        const err = new Error("Stock insuffisant (couches de valorisation)");
        err.status = 409;
        err.code = "STOCK_INSUFFISANT";
        throw err;
      }
      throw e;
    }

    await mouvementsService.adjustStock(tx, {
      societeId: sid,
      articleId: article.id,
      depotId: depot.id,
      emplacementId: null,
      delta: -q,
    });

    const motifResolved = resolveMotif(motif);
    const commentaireMotif = motifResolved.notes || motifResolved.motif;

    const mouvement = await mouvementsService.insertMouvement(tx, {
      reference: mouvementsService.genRef("MVT-RETFOUR"),
      type: mouvementsService.MOUVEMENT_TYPES.SORTIE_RETOUR_FOURNISSEUR,
      articleId: article.id,
      depotId: depot.id,
      emplacementId: null,
      quantite: q,
      valeur,
      utilisateurId: userId,
      commentaire: `Retour fournisseur ${fournisseur.nom} — ${commentaireMotif}`,
      lotId: lotsConsumed[0]?.lotId || null,
      lotsDetail: lotsConsumed.length ? JSON.stringify(lotsConsumed) : null,
    });

    const retour = await tx.retourFournisseur.create({
      data: {
        reference: await nextRetourReference(tx, sid),
        mouvementId: mouvement.id,
        fournisseurId: fournisseur.id,
        articleId: article.id,
        achatId: achat?.id ?? null,
        lotId: lotsConsumed[0]?.lotId || null,
        quantiteRetournee: q,
        quantiteAchetee,
        motif: motifResolved.motif,
        notes: motifResolved.notes,
        statut: "EN_ATTENTE",
        societeId: sid,
      },
    });

    return { retour, mouvement, lotsConsumed };
  });
}

async function listRetoursFournisseur(prisma, { societeId, fournisseurId, achatId }) {
  const sid = Number(societeId);
  return prisma.retourFournisseur.findMany({
    where: {
      societeId: sid,
      ...(fournisseurId ? { fournisseurId: Number(fournisseurId) } : {}),
      ...(achatId ? { achatId: Number(achatId) } : {}),
    },
    include: {
      mouvement: { include: { article: true, depot: true } },
      fournisseur: true,
      article: true,
      achat: { select: { id: true, reference: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

function renderBonRetourPdf(retour) {
  const societe = retour.societe || {};
  const accent = societe.accentHex || ACCENT;
  const fournisseur = retour.fournisseur || {};
  const article = retour.article || {};
  const depot = retour.mouvement?.depot;
  const unite = article.unite || "";
  const q = Number(retour.quantiteRetournee || 0);
  const motifCourt = MOTIF_LABEL[retour.motif] || retour.motif || "—";
  const raison = String(retour.notes || motifCourt).trim() || "—";
  const statut = STATUT_BADGE[retour.statut] || STATUT_BADGE.EN_ATTENTE;
  const ligne = (retour.achat?.lignes || []).find((l) => Number(l.articleId) === Number(retour.articleId));
  const prix = ligne ? Number(ligne.prixUnit) : null;
  const remise = ligne ? Number(ligne.remise || 0) : 0;
  const montant = prix != null ? q * prix * (1 - remise / 100) : null;
  const lots = parseLotsDetail(retour.mouvement);
  const emetteur = retour.mouvement?.utilisateur;
  const emetteurNom = emetteur ? `${emetteur.prenom || ""} ${emetteur.nom || ""}`.trim() : "";

  const title = `Bon de retour — ${retour.reference}`;
  const ctx = createBaseDoc(title, societe, { refPrefix: "BRT", reportId: retour.reference });
  const { doc, contentTop, contentLeft, contentWidth, finishFootersAndHeaders, ensureSpace } = ctx;
  let y = contentTop;

  y = drawDocTitle(doc, {
    x: contentLeft,
    y,
    width: contentWidth,
    label: "BON DE RETOUR",
    reference: retour.reference,
    accentHex: accent,
    badge: statut,
  });

  y = drawMetaStrip(doc, {
    x: contentLeft,
    y,
    width: contentWidth,
    accentHex: accent,
    items: [
      { label: "Date du retour", value: fmtDate(retour.createdAt) },
      { label: "Commande d'origine", value: retour.achat?.reference || "—" },
      { label: "Dépôt de sortie", value: depot ? `${depot.code}` : "—" },
      { label: "Statut", value: STATUT_LABEL[retour.statut] || "En attente", color: statut.color },
    ],
  });

  const fournisseurLines = [
    fournisseur.adresse,
    [fournisseur.ville, fournisseur.pays].filter(Boolean).join(", "),
    fournisseur.email || fournisseur.telephone,
  ].filter(Boolean);
  const societeLines = [societe.adresse, societe.ville, societe.email || societe.telephones].filter(Boolean);

  y = drawPartyCards(doc, {
    x: contentLeft,
    y,
    width: contentWidth,
    accentHex: accent,
    left: { title: "Émetteur", name: societe.nom || "—", lines: societeLines },
    right: { title: "Fournisseur destinataire", name: fournisseur.nom || "—", lines: fournisseurLines },
  });

  y = ensureSpace(52, y);
  drawRoundedRect(doc, contentLeft, y, contentWidth, 44, 6, "#fff7ed", "#fdba74");
  doc.fillColor("#9a3412").font("Helvetica-Bold").fontSize(7.5);
  absText(doc, "À JOINDRE AU COLIS", contentLeft + 12, y + 7, { width: contentWidth - 24, height: 10 });
  doc.fillColor("#7c2d12").font("Helvetica").fontSize(8);
  absText(
    doc,
    "Ce bon vaut avis de retour. Le fournisseur accuse réception et indique le traitement retenu : avoir, remplacement ou refus.",
    contentLeft + 12,
    y + 19,
    { width: contentWidth - 24, height: 20 }
  );
  y += 56;

  y = drawTable(doc, {
    headers: ["Réf. article", "Désignation", "Unité", "Qté retour", "Motif"],
    rows: [[article.code || "—", article.libelle || "—", unite || "—", fmtQty(q), motifCourt]],
    startY: y,
    accentHex: accent,
    contentLeft,
    contentWidth,
    ensureSpace,
    colWidths: [78, 190, 52, 70, contentWidth - 78 - 190 - 52 - 70],
  });

  if (lots.length) {
    y += 12;
    y = drawTable(doc, {
      headers: ["N° de lot", "Quantité sortie", "Date de péremption"],
      rows: lots.map((l) => [
        l.lotNumero || l.numero || (l.lotId ? `#${l.lotId}` : "—"),
        fmtQty(l.quantite, unite),
        fmtShortDate(l.dateExpiration),
      ]),
      startY: y,
      accentHex: accent,
      contentLeft,
      contentWidth,
      ensureSpace,
      colWidths: [180, 150, contentWidth - 330],
    });
  }

  const motifW = contentWidth - 232;
  doc.font("Helvetica").fontSize(9);
  const motifTextH = Math.min(36, Math.max(14, doc.heightOfString(raison, { width: motifW - 24 })));
  const motifBoxH = 18 + motifTextH + 10;
  y = ensureSpace(motifBoxH, y + 12);
  drawRoundedRect(doc, contentLeft, y, motifW, motifBoxH, 8, "#f9fafb", "#e5e7eb");
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(7);
  absText(doc, "MOTIF DÉCLARÉ", contentLeft + 12, y + 8, { width: motifW - 24, height: 10 });
  doc.fillColor(INK).font("Helvetica").fontSize(9);
  absText(doc, raison, contentLeft + 12, y + 20, { width: motifW - 24, height: motifTextH });

  const entries = [];
  if (prix != null) entries.push({ label: "Prix unitaire HT", value: money(prix) });
  if (retour.quantiteAchetee != null) {
    entries.push({ label: "Qté reçue", value: fmtQty(retour.quantiteAchetee, unite) });
  }
  if (retour.mouvement?.valeur != null) {
    entries.push({ label: "Coût de sortie", value: money(retour.mouvement.valeur) });
  }
  entries.push({
    label: montant != null ? "Montant retour HT" : "Quantité retournée",
    value: montant != null ? money(montant) : fmtQty(q, unite),
    highlight: true,
  });

  const totalsBottom = drawTotalsBlock(doc, {
    startY: y,
    accentHex: accent,
    contentLeft,
    contentWidth,
    entries,
  });
  y = Math.max(y + motifBoxH + 8, totalsBottom);

  const trace = [
    retour.mouvement?.reference ? `Mouvement de stock : ${retour.mouvement.reference}` : null,
    emetteurNom ? `Émis par ${emetteurNom}` : null,
    depot?.libelle ? `Dépôt ${depot.libelle}` : null,
  ].filter(Boolean);
  if (trace.length) {
    y = ensureSpace(16, y + 4);
    doc.fillColor(SLATE).font("Helvetica").fontSize(8);
    absText(doc, trace.join("  ·  "), contentLeft, y, { width: contentWidth, height: 12 });
    y += 16;
  }

  y = ensureSpace(80, y + 8);
  drawSignatureRow(doc, {
    x: contentLeft,
    y,
    width: contentWidth,
    leftLabel: "MAGASIN — ÉMETTEUR",
    rightLabel: "FOURNISSEUR — ACCUSÉ",
  });

  return endPdfBuffer(doc, finishFootersAndHeaders);
}

async function getBonRetourPdf(prisma, user, retourId) {
  const { societeId: sid } = getSocieteWhere(user);
  const retour = await prisma.retourFournisseur.findFirst({
    where: { id: Number(retourId), societeId: sid },
    include: {
      fournisseur: true,
      article: true,
      societe: true,
      lot: true,
      achat: { include: { lignes: true } },
      mouvement: {
        include: {
          depot: true,
          utilisateur: { select: { nom: true, prenom: true } },
        },
      },
    },
  });
  if (!retour) {
    const err = new Error("Retour fournisseur introuvable");
    err.status = 404;
    throw err;
  }
  const buffer = await renderBonRetourPdf(retour);
  return { buffer, reference: retour.reference };
}

module.exports = { creerRetourFournisseur, listRetoursFournisseur, getBonRetourPdf, renderBonRetourPdf };
