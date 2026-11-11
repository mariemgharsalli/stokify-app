import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { clientContactLine, clientLocationLine } from "./clientBranding";
import {
  MARGIN,
  LIGHT_BG,
  BORDER,
  WHITE,
  INK,
  SLATE,
  PDF_PROFILE,
  buildReportRef,
  resolveBranding,
  paletteFromBranding,
  drawLogo,
  applyPageFooters,
  fmtMoneyTnd,
} from "./corporatePdf";

/** Chrome document — navy pro (indépendant du violet par défaut) */
const NAVY = [15, 37, 64];
const NAVY_SOFT = [232, 240, 248];
const CYAN = [14, 165, 233];

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

function brandingFromAchat(achat) {
  const societe = achat.societe || {};
  return {
    nom: societe.nom,
    code: societe.code,
    logo: societe.logo,
    adresse: societe.adresse,
    ville: societe.ville,
    email: societe.email,
    telephones: societe.telephones,
  };
}

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function drawInfoCard(doc, x, y, w, h, title, lines, accent) {
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");

  doc.setFillColor(...accent);
  doc.roundedRect(x, y, 2.2, h, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...accent);
  doc.text(String(title).toUpperCase(), x + 7, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  let ty = y + 12;
  lines.forEach((line) => {
    if (!line) return;
    const wrapped = doc.splitTextToSize(String(line), w - 12);
    wrapped.forEach((row) => {
      doc.text(row, x + 7, ty);
      ty += 4.2;
    });
  });
}

function drawMetaPill(doc, x, y, w, label, value, accent) {
  doc.setFillColor(...NAVY_SOFT);
  doc.roundedRect(x, y, w, 14, 2.5, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...accent);
  doc.text(String(label).toUpperCase(), x + 3.5, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  const v = doc.splitTextToSize(String(value || "—"), w - 7);
  doc.text(v[0], x + 3.5, y + 10.5);
}

function drawSignatureBox(doc, x, y, w, h, title) {
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text(title, x + 4, y + 6);

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.35);
  doc.line(x + 8, y + h - 10, x + w - 8, y + h - 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE);
  doc.text("Nom & signature", x + w / 2, y + h - 5, { align: "center" });
}

/**
 * Génère le PDF Bon de réception — mise en page premium type grand groupe.
 */
export async function generateBonReceptionPdf(achat, user, clientBranding) {
  const fournisseur = achat.fournisseur || {};
  const branding = await resolveBranding(clientBranding || brandingFromAchat(achat));
  const { accent: brandAccent } = paletteFromBranding(branding);
  // Accent document : bleu Stokify si la marque reste sur le violet par défaut
  const isDefaultPurple =
    brandAccent[0] === 109 && brandAccent[1] === 40 && brandAccent[2] === 217;
  const accent = isDefaultPurple ? [55, 138, 221] : brandAccent;
  const accentSoft = mixRgb(accent, WHITE, 0.88);

  const reportId = buildReportRef("BR", achat.reference);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN * 2;

  const receptionDate = fmtDate(achat.confirmedAt || achat.dateReception || achat.dateCommande);
  const receiver = achat.confirmateur
    ? `${achat.confirmateur.prenom || ""} ${achat.confirmateur.nom || ""}`.trim()
    : user?.prenom && user?.nom
      ? `${user.prenom} ${user.nom}`
      : "—";
  const depotLabel = achat.depot?.libelle || achat.depot?.code || "—";
  const nbLignes = (achat.lignes || []).length;

  /* ── Bandeau hero ── */
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 42, "F");

  // Accent diagonal
  doc.setFillColor(...accent);
  doc.triangle(pageW - 55, 0, pageW, 0, pageW, 42, "F");
  doc.setFillColor(...CYAN);
  doc.rect(0, 42, pageW, 1.6, "F");

  // Logo sur fond blanc
  drawLogo(doc, {
    logoDataUrl: branding?.logoDataUrl,
    societeName: branding?.nom,
    accentRgb: accent,
    x: MARGIN,
    y: 8,
    size: 26,
    bordered: true,
  });

  const leftX = MARGIN + 32;
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(String(branding?.nom || "—"), leftX, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  const location = clientLocationLine(branding);
  if (location && location !== "—") doc.text(location, leftX, 22);
  const contact = clientContactLine(branding);
  if (contact) doc.text(contact, leftX, 27);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...WHITE);
  doc.text("BON DE RÉCEPTION", pageW - MARGIN, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(186, 230, 253);
  doc.text("Document logistique · Réception marchandises", pageW - MARGIN, 22, {
    align: "right",
  });
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Réf. ${reportId}`, pageW - MARGIN, 28, { align: "right" });

  let y = 50;

  /* ── Méta pills ── */
  const pillGap = 3;
  const pillW = (contentW - pillGap * 3) / 4;
  drawMetaPill(doc, MARGIN, y, pillW, "Commande", achat.reference, accent);
  drawMetaPill(doc, MARGIN + pillW + pillGap, y, pillW, "Date réception", receptionDate, accent);
  drawMetaPill(doc, MARGIN + (pillW + pillGap) * 2, y, pillW, "Dépôt", depotLabel, accent);
  drawMetaPill(
    doc,
    MARGIN + (pillW + pillGap) * 3,
    y,
    pillW,
    "Lignes",
    `${nbLignes} article${nbLignes !== 1 ? "s" : ""}`,
    accent
  );
  y += 20;

  /* ── Cartes Fournisseur / Réception ── */
  const cardH = 34;
  const cardW = (contentW - 4) / 2;
  const fournisseurLines = [
    fournisseur.nom || "—",
    fournisseur.adresse,
    [fournisseur.ville, fournisseur.codePostal].filter(Boolean).join(" "),
    fournisseur.telephone,
    fournisseur.email,
  ].filter(Boolean);

  drawInfoCard(doc, MARGIN, y, cardW, cardH, "Fournisseur", fournisseurLines.slice(0, 5), accent);
  drawInfoCard(
    doc,
    MARGIN + cardW + 4,
    y,
    cardW,
    cardH,
    "Réception",
    [
      `Réceptionnaire : ${receiver || "—"}`,
      `Dépôt : ${depotLabel}`,
      `Date : ${receptionDate}`,
      `Réf. interne : ${reportId}`,
    ],
    CYAN
  );
  y += cardH + 8;

  /* ── Titre section articles ── */
  doc.setFillColor(...accent);
  doc.roundedRect(MARGIN, y, 3, 8, 0.8, 0.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text("Articles réceptionnés", MARGIN + 6, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text(`${nbLignes} ligne(s)`, pageW - MARGIN, y + 6, { align: "right" });
  y += 11;

  /* ── Tableau ── */
  const rows = (achat.lignes || []).map((l, i) => [
    String(i + 1).padStart(2, "0"),
    l.article?.code || "—",
    l.article?.libelle || "—",
    String(l.quantite ?? ""),
    fmtMoneyTnd(l.prixUnit),
    fmtMoneyTnd(l.totalHT),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Code", "Désignation", "Qté", "P.U. HT", "Total HT"]],
    body: rows.length
      ? rows
      : [["—", "—", "Aucune ligne", "—", "—", "—"]],
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: { top: 3.2, bottom: 3.2, left: 2.5, right: 2.5 },
      lineColor: BORDER,
      lineWidth: 0.12,
      textColor: INK,
      valign: "middle",
    },
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 3.8, bottom: 3.8, left: 2.5, right: 2.5 },
    },
    alternateRowStyles: { fillColor: accentSoft },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", textColor: SLATE },
      1: { cellWidth: 26, fontStyle: "bold", textColor: accent },
      2: { cellWidth: "auto" },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 28 },
    didDrawPage: (data) => {
      // Fine accent under header on each page table
      if (data.pageNumber >= 1 && data.cursor) {
        /* no-op — footers applied later */
      }
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  /* ── Totaux + note ── */
  const totalsW = 78;
  const totalsX = pageW - MARGIN - totalsW;
  const noteW = contentW - totalsW - 6;

  // Note / mention
  doc.setFillColor(...NAVY_SOFT);
  doc.roundedRect(MARGIN, y, noteW, 36, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...accent);
  doc.text("MENTION", MARGIN + 5, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK);
  const mention = doc.splitTextToSize(
    "Les marchandises ci-dessus ont été réceptionnées et contrôlées. Toute réclamation doit être signalée sous 48 h. Document généré automatiquement par Stokify.",
    noteW - 10
  );
  doc.text(mention, MARGIN + 5, y + 13);

  // Totaux
  const totalRows = [
    { label: "Total HT", value: fmtMoneyTnd(achat.totalHT) },
    { label: "TVA (19%)", value: fmtMoneyTnd(achat.totalTVA) },
    { label: "Total TTC", value: fmtMoneyTnd(achat.totalTTC), highlight: true },
  ];
  const boxH = 36;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(totalsX, y, totalsW, boxH, 3, 3, "FD");

  let ty = y + 7;
  totalRows.forEach((row) => {
    if (row.highlight) {
      doc.setFillColor(...accent);
      doc.roundedRect(totalsX + 2, ty - 3, totalsW - 4, 11, 2, 2, "F");
      doc.setTextColor(...WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("TOTAL TTC", totalsX + 6, ty + 4);
      doc.text(row.value, totalsX + totalsW - 6, ty + 4, { align: "right" });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SLATE);
      doc.text(row.label, totalsX + 6, ty + 1);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...INK);
      doc.text(row.value, totalsX + totalsW - 6, ty + 1, { align: "right" });
      ty += 8;
    }
  });

  y += boxH + 10;

  /* ── Signatures ── */
  const sigH = 28;
  const sigW = (contentW - 4) / 2;
  drawSignatureBox(doc, MARGIN, y, sigW, sigH, "Signature fournisseur");
  drawSignatureBox(doc, MARGIN + sigW + 4, y, sigW, sigH, "Signature réceptionnaire");
  y += sigH + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text(
    `Reçu le ${receptionDate} par ${receiver || "—"} · ${nbLignes} ligne(s) · ${depotLabel}`,
    MARGIN,
    y
  );

  applyPageFooters(doc, branding, {
    reportId,
    skipCover: false,
    allPages: true,
    profile: PDF_PROFILE.COMMERCIAL,
  });

  doc.save(`bon-reception-${achat.reference}.pdf`);
}
