import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { computeRecap, formatDate, formatTnd, STATUS_MAP } from "../pages/inventaires/inventaireUtils";
import {
  MARGIN,
  LIGHT_BG,
  INK,
  SLATE,
  WHITE,
  BORDER,
  PDF_PROFILE,
  buildReportRef,
  resolveBranding,
  drawLogo,
  drawKpiStrip,
  drawContentHeader,
  drawSectionTitle,
  applyPageFooters,
  tableHeadStyles,
  tableBaseStyles,
  fmtMoneyTnd,
  todayFr,
  initAnalyticsReport,
} from "./corporatePdf";

/** Accent bleu Stokify — inventaires (pas le violet branding générique) */
const INV_ACCENT = [55, 138, 221];
const INV_CYAN = [14, 165, 233];
const SUCCESS = [29, 158, 117];
const DANGER = [226, 75, 74];
const AMBER = [217, 119, 6];

function fmtQty(v) {
  if (v == null || v === "") return "—";
  return Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

function brandingFromInventaire(inv, clientBranding) {
  return clientBranding || {
    nom: inv?.societe?.nom || inv?.depot?.societe?.nom,
    code: inv?.societe?.code || inv?.depot?.code,
    logo: inv?.societe?.logo,
  };
}

/**
 * En-tête inventaire — bandeau pro compact (sans page de couverture).
 */
function drawInventaireHeader(doc, branding, inv, statut, reportId) {
  const pageW = doc.internal.pageSize.getWidth();
  const logoSize = 18;

  doc.setFillColor(...INV_ACCENT);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFillColor(...INV_CYAN);
  doc.rect(0, 28, pageW, 1.2, "F");

  drawLogo(doc, {
    logoDataUrl: branding?.logoDataUrl,
    societeName: branding?.nom,
    accentRgb: WHITE,
    x: MARGIN,
    y: 5,
    size: logoSize,
  });

  const textX = MARGIN + logoSize + 7;
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Fiche d'inventaire", textX, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(220, 235, 255);
  doc.text(String(branding?.nom || "Stokify"), textX, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(String(inv.reference || "—"), pageW - MARGIN, 11, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(200, 220, 245);
  doc.text(`${statut} · ${todayFr()}`, pageW - MARGIN, 17, { align: "right" });
  doc.text(`Réf. ${reportId}`, pageW - MARGIN, 22, { align: "right" });

  return 36;
}

function drawMetaBlock(doc, y, inv, statut) {
  const pageW = doc.internal.pageSize.getWidth();
  const boxW = pageW - MARGIN * 2;
  const boxH = 18;

  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, boxW, boxH, 2.5, 2.5, "FD");

  const cols = [
    { label: "Dépôt", value: `${inv.depot?.libelle ?? "—"} (${inv.depot?.code ?? "—"})` },
    { label: "Date", value: formatDate(inv.date) },
    { label: "Statut", value: statut },
    { label: "Responsable", value: inv.responsable || inv.createdBy?.nom || "—" },
  ];
  const colW = boxW / cols.length;
  cols.forEach((c, i) => {
    const cx = MARGIN + i * colW + 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...SLATE);
    doc.text(c.label.toUpperCase(), cx, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(String(c.value).slice(0, 28), cx, y + 12, { maxWidth: colW - 6 });
  });

  return y + boxH + 8;
}

/**
 * Export PDF inventaire — mise en page claire, professionnelle, sans couverture lourde.
 */
export async function exportInventairePdf(inv, clientBranding) {
  const lignes = inv?.lignes ?? [];
  const recap = computeRecap(lignes);
  const statut = STATUS_MAP[inv?.statut]?.label ?? inv?.statut ?? "—";
  const branding = await resolveBranding(brandingFromInventaire(inv, clientBranding));
  const reportId = buildReportRef("INV", inv?.reference || inv?.depot?.code);
  const orientation = lignes.length > 18 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  let y = drawInventaireHeader(doc, branding, inv, statut, reportId);
  y = drawMetaBlock(doc, y, inv, statut);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.setFillColor(...INV_ACCENT);
  doc.roundedRect(MARGIN, y - 3.5, 2.5, 8, 0.8, 0.8, "F");
  doc.text("Synthèse du comptage", MARGIN + 5, y + 2);
  y += 8;

  y = drawKpiStrip(
    doc,
    MARGIN,
    y,
    pageW - MARGIN * 2,
    [
      { label: "Articles", value: String(recap.total), icon: "box" },
      { label: "Saisis", value: String(recap.saisis), icon: "filled" },
      { label: "Conformes", value: String(recap.conformes), icon: "gauge" },
      { label: "Écarts", value: String(recap.ecarts), icon: "alert" },
      { label: "Valeur écarts", value: fmtMoneyTnd(recap.valeurEcart), icon: "value" },
    ],
    INV_ACCENT
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.setFillColor(...INV_CYAN);
  doc.roundedRect(MARGIN, y - 3.5, 2.5, 8, 0.8, 0.8, "F");
  doc.text("Détail des lignes", MARGIN + 5, y + 2);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Code", "Désignation", "Unité", "Théorique", "Réelle", "Écart", "Valeur", "OK"]],
    body: lignes.map((l) => {
      const ec = l.ecart != null ? Number(l.ecart) : null;
      return [
        l.article?.code ?? "",
        l.article?.libelle ?? "",
        l.article?.unite ?? "",
        fmtQty(l.qteTheorique),
        fmtQty(l.qteReelle),
        ec != null ? fmtQty(ec) : "—",
        l.valeurEcart != null ? formatTnd(l.valeurEcart) : "—",
        l.valide || (ec === 0 && l.qteReelle != null) ? "Oui" : "Non",
      ];
    }),
    styles: { ...tableBaseStyles(), fontSize: 7.5, cellPadding: 2.2 },
    headStyles: {
      ...tableHeadStyles(INV_ACCENT),
      fontSize: 7.5,
      cellPadding: 2.4,
    },
    alternateRowStyles: { fillColor: LIGHT_BG },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: "bold", textColor: INV_ACCENT },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
      6: { halign: "right" },
      7: { halign: "center", cellWidth: 12 },
    },
    didParseCell(data) {
      if (data.section !== "body" || data.column.index !== 5) return;
      const raw = data.row.raw?.[5];
      if (raw == null || raw === "—") return;
      const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
      if (Number.isNaN(n)) return;
      if (n > 0) {
        data.cell.styles.textColor = SUCCESS;
        data.cell.styles.fontStyle = "bold";
      } else if (n < 0) {
        data.cell.styles.textColor = DANGER;
        data.cell.styles.fontStyle = "bold";
      } else {
        data.cell.styles.textColor = SLATE;
      }
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 18 },
  });

  // Zone signatures
  let sigY = (doc.lastAutoTable?.finalY || y) + 12;
  const pageH = doc.internal.pageSize.getHeight();
  if (sigY > pageH - 40) {
    doc.addPage();
    sigY = 24;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("Validation", MARGIN, sigY);

  const sigW = (pageW - MARGIN * 2 - 8) / 2;
  [
    { title: "Contrôleur / Magasinier", x: MARGIN },
    { title: "Responsable / Validation", x: MARGIN + sigW + 8 },
  ].forEach((box) => {
    doc.setDrawColor(...BORDER);
    doc.setFillColor(...WHITE);
    doc.roundedRect(box.x, sigY + 3, sigW, 22, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SLATE);
    doc.text(box.title, box.x + 3, sigY + 8);
    doc.setDrawColor(...SLATE);
    doc.setLineWidth(0.2);
    doc.line(box.x + 3, sigY + 20, box.x + sigW - 3, sigY + 20);
    doc.text("Nom & signature", box.x + 3, sigY + 18);
  });

  applyPageFooters(doc, branding, {
    reportId,
    skipCover: false,
    allPages: true,
    profile: PDF_PROFILE.WAREHOUSE,
  });

  doc.save(`${inv.reference || "inventaire"}.pdf`);
}

/**
 * Export PDF rapport écarts inventaire (style analytics / contrôle qualité).
 */
export async function exportEcartsInventairePdf(rapport, clientBranding) {
  const inv = rapport?.inventaire || {};
  const s = rapport?.summary || {};
  const lignes = rapport?.items || [];
  const branding = await resolveBranding(brandingFromInventaire(inv, clientBranding));

  const { doc, accent, reportId } = await initAnalyticsReport(branding, {
    refPrefix: "ECR",
    reportTitle: "RAPPORT D'ÉCARTS D'INVENTAIRE",
    reportSubtitle: "Analyse des écarts stock théorique vs réel",
    entityLabel: "Inventaire",
    entityName: inv.reference || "—",
    entityMeta: [
      { label: "Dépôt", value: `${inv.depot?.libelle ?? "—"} (${inv.depot?.code ?? ""})` },
      { label: "Responsable", value: inv.responsable ?? "—" },
      { label: "Fiabilité", value: `${s.tauxFiabilite ?? 0} %` },
      { label: "Valeur totale écarts", value: formatTnd(s.valeurTotaleEcart) },
    ],
  });

  doc.addPage();
  let y = drawContentHeader(doc, branding, {
    sectionTitle: "Détail des écarts",
    reportId,
    modeLabel: `${lignes.length} ligne(s)`,
  });

  y = drawSectionTitle(doc, MARGIN, y + 4, "Indicateurs de fiabilité", accent) + 6;
  drawKpiStrip(doc, MARGIN, y, doc.internal.pageSize.getWidth() - MARGIN * 2, [
    { label: "Écarts +", value: fmtQty(s.totalEcartsPositifs), icon: "filled", iconColor: SUCCESS },
    { label: "Écarts −", value: fmtQty(s.totalEcartsNegatifs), icon: "alert", iconColor: DANGER },
    { label: "Valeur totale", value: formatTnd(s.valeurTotaleEcart), icon: "value" },
    { label: "Fiabilité", value: `${s.tauxFiabilite ?? 0} %`, icon: "gauge" },
  ], accent);

  autoTable(doc, {
    startY: y + 28,
    head: [["Code", "Article", "Stock théorique", "Stock réel", "Écart", "% écart", "Valeur écart"]],
    body: lignes.map((l) => [
      l.article?.code ?? "",
      l.article?.libelle ?? "",
      fmtQty(l.qteTheorique),
      fmtQty(l.qteReelle),
      fmtQty(l.ecart),
      l.pctEcart != null ? `${Number(l.pctEcart).toFixed(1)}%` : "—",
      formatTnd(l.valeurEcart),
    ]),
    foot: [
      [
        "",
        "TOTAUX",
        "",
        "",
        fmtQty((s.totalEcartsPositifs || 0) + (s.totalEcartsNegatifs || 0)),
        "",
        formatTnd(s.valeurTotaleEcart),
      ],
    ],
    styles: tableBaseStyles(),
    headStyles: tableHeadStyles(accent),
    alternateRowStyles: { fillColor: LIGHT_BG },
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
  });

  applyPageFooters(doc, branding, { reportId, skipCover: true, profile: PDF_PROFILE.ANALYTICS });
  doc.save(`ecarts-${inv.reference || "inventaire"}.pdf`);
}

/* ═══════════════════════════════════════════════════════════
 *  LISTE DE TOUS LES INVENTAIRES — PDF & Excel professionnels
 * ═══════════════════════════════════════════════════════════ */

function summarizeList(items = [], global = {}) {
  const enCours = items.filter((i) => i.statut === "EN_COURS").length;
  const valides = items.filter((i) => i.statut === "VALIDE").length;
  const annules = items.filter((i) => i.statut === "ANNULE").length;
  const totalEcarts = items.reduce((n, i) => n + Number(i.summary?.ecarts ?? 0), 0);
  const valeurEcarts = items.reduce((n, i) => n + Number(i.summary?.valeurEcart ?? 0), 0);
  return {
    total: global.nbInventaires ?? items.length,
    enCours: global.enCours ?? enCours,
    valides,
    annules,
    precision: global.precisionPct ?? 100,
    totalEcarts,
    valeurEcarts: global.valeurEcartsTnd ?? valeurEcarts,
  };
}

function listRow(inv) {
  const s = inv.summary || {};
  const total = s.totalLignes ?? inv._count?.lignes ?? 0;
  const saisis = s.saisis ?? 0;
  const pct = s.progressionPct ?? (total > 0 ? Math.round((saisis / total) * 100) : 0);
  return {
    reference: inv.reference || "—",
    statut: STATUS_MAP[inv.statut]?.label ?? inv.statut ?? "—",
    depot: inv.depot?.libelle || "—",
    depotCode: inv.depot?.code || "—",
    date: formatDate(inv.date),
    articles: total,
    saisis,
    progression: `${pct}%`,
    ecarts: s.ecarts ?? 0,
    valeurEcart: formatTnd(s.valeurEcart),
  };
}

/**
 * PDF — registre de tous les inventaires (filtres courants).
 */
export async function exportInventairesListPdf(items = [], global = {}, meta = {}, clientBranding) {
  const branding = await resolveBranding(clientBranding || {});
  const reportId = buildReportRef("INVL", branding?.code || "LIST");
  const stats = summarizeList(items, global);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Hero bandeau
  doc.setFillColor(...INV_ACCENT);
  doc.rect(0, 0, pageW, 32, "F");
  doc.setFillColor(...INV_CYAN);
  doc.rect(0, 32, pageW, 1.4, "F");

  drawLogo(doc, {
    logoDataUrl: branding?.logoDataUrl,
    societeName: branding?.nom,
    accentRgb: WHITE,
    x: MARGIN,
    y: 6,
    size: 20,
  });

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Registre des inventaires", MARGIN + 28, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(210, 230, 255);
  doc.text(
    `${branding?.nom || "Stokify"} · Contrôle stock théorique vs réel`,
    MARGIN + 28,
    21
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(`Réf. ${reportId}`, pageW - MARGIN, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 220, 245);
  doc.text(todayFr(), pageW - MARGIN, 18, { align: "right" });
  doc.text(`${items.length} inventaire(s)`, pageW - MARGIN, 24, { align: "right" });

  let y = 40;

  // Filtres appliqués
  const filterBits = [
    meta.search ? `Recherche : « ${meta.search} »` : null,
    meta.depotLabel ? `Dépôt : ${meta.depotLabel}` : null,
    meta.statutLabel ? `Statut : ${meta.statutLabel}` : null,
  ].filter(Boolean);
  if (filterBits.length) {
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(MARGIN, y, pageW - MARGIN * 2, 10, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE);
    doc.text(`Filtres actifs — ${filterBits.join("  ·  ")}`, MARGIN + 3, y + 6.5);
    y += 14;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.setFillColor(...INV_ACCENT);
  doc.roundedRect(MARGIN, y - 3.5, 2.5, 8, 0.8, 0.8, "F");
  doc.text("Vue d'ensemble", MARGIN + 5, y + 2);
  y += 8;

  y = drawKpiStrip(
    doc,
    MARGIN,
    y,
    pageW - MARGIN * 2,
    [
      { label: "Total", value: String(stats.total), icon: "box" },
      { label: "En cours", value: String(stats.enCours), icon: "filled" },
      { label: "Validés", value: String(stats.valides), icon: "gauge" },
      { label: "Annulés", value: String(stats.annules), icon: "alert" },
      { label: "Précision", value: `${Number(stats.precision).toFixed(1)}%`, icon: "value" },
      { label: "Valeur écarts", value: fmtMoneyTnd(stats.valeurEcarts), icon: "value" },
    ],
    INV_ACCENT
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.setFillColor(...INV_CYAN);
  doc.roundedRect(MARGIN, y - 3.5, 2.5, 8, 0.8, 0.8, "F");
  doc.text("Liste détaillée", MARGIN + 5, y + 2);
  y += 6;

  const rows = items.map(listRow);

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Référence",
        "Statut",
        "Dépôt",
        "Code",
        "Date",
        "Articles",
        "Saisis",
        "Progression",
        "Écarts",
        "Valeur écart",
      ],
    ],
    body: rows.map((r) => [
      r.reference,
      r.statut,
      r.depot,
      r.depotCode,
      r.date,
      r.articles,
      r.saisis,
      r.progression,
      r.ecarts,
      r.valeurEcart,
    ]),
    styles: { ...tableBaseStyles(), fontSize: 7.5, cellPadding: 2 },
    headStyles: { ...tableHeadStyles(INV_ACCENT), fontSize: 7.5 },
    alternateRowStyles: { fillColor: LIGHT_BG },
    columnStyles: {
      0: { fontStyle: "bold", textColor: INV_ACCENT, cellWidth: 28 },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "center" },
      8: { halign: "right", fontStyle: "bold" },
      9: { halign: "right" },
    },
    didParseCell(data) {
      if (data.section !== "body" || data.column.index !== 1) return;
      const s = String(data.cell.raw || "");
      if (s === "En cours") data.cell.styles.textColor = INV_CYAN;
      else if (s === "Validé") data.cell.styles.textColor = SUCCESS;
      else if (s === "Annulé") data.cell.styles.textColor = DANGER;
      else data.cell.styles.textColor = SLATE;
      data.cell.styles.fontStyle = "bold";
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
  });

  applyPageFooters(doc, branding, {
    reportId,
    skipCover: false,
    allPages: true,
    profile: PDF_PROFILE.WAREHOUSE,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`registre-inventaires-${stamp}.pdf`);
}

/**
 * Excel — registre multi-feuilles (Synthèse + Inventaires).
 */
export async function exportInventairesListExcelPro(items = [], global = {}, meta = {}, clientBranding) {
  const XLSX = await import("xlsx");
  const branding = clientBranding || {};
  const stats = summarizeList(items, global);
  const stamp = new Date().toISOString().slice(0, 10);
  const rows = items.map(listRow);

  const filterBits = [
    meta.search ? `Recherche: ${meta.search}` : null,
    meta.depotLabel ? `Dépôt: ${meta.depotLabel}` : null,
    meta.statutLabel ? `Statut: ${meta.statutLabel}` : null,
  ].filter(Boolean);

  const synthese = [
    ["REGISTRE DES INVENTAIRES — STOKIFY"],
    [branding.nom || "Société"],
    [`Export du ${todayFr()}`],
    filterBits.length ? [`Filtres: ${filterBits.join(" | ")}`] : ["Filtres: aucun"],
    [],
    ["INDICATEURS"],
    ["Indicateur", "Valeur"],
    ["Inventaires (filtre)", items.length],
    ["Total plateforme", stats.total],
    ["En cours", stats.enCours],
    ["Validés", stats.valides],
    ["Annulés", stats.annules],
    ["Précision stock (%)", Number(stats.precision).toFixed(1)],
    ["Écarts détectés", stats.totalEcarts],
    ["Valeur écarts (TND)", stats.valeurEcarts],
    [],
    ["Répartition par statut"],
    ["Statut", "Nombre"],
    ["En cours", stats.enCours],
    ["Validé", stats.valides],
    ["Annulé", stats.annules],
  ];

  const liste = [
    [
      "Référence",
      "Statut",
      "Dépôt",
      "Code dépôt",
      "Date",
      "Articles",
      "Saisis",
      "Progression",
      "Écarts",
      "Valeur écart",
    ],
    ...rows.map((r) => [
      r.reference,
      r.statut,
      r.depot,
      r.depotCode,
      r.date,
      r.articles,
      r.saisis,
      r.progression,
      r.ecarts,
      r.valeurEcart,
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const wsSynthese = XLSX.utils.aoa_to_sheet(synthese);
  wsSynthese["!cols"] = [{ wch: 28 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSynthese, "Synthèse");

  const wsListe = XLSX.utils.aoa_to_sheet(liste);
  wsListe["!cols"] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsListe, "Inventaires");

  // Feuille par statut
  for (const [key, label] of [
    ["EN_COURS", "En cours"],
    ["VALIDE", "Validés"],
    ["ANNULE", "Annulés"],
  ]) {
    const subset = items.filter((i) => i.statut === key).map(listRow);
    if (!subset.length) continue;
    const aoa = [
      ["Référence", "Dépôt", "Date", "Articles", "Saisis", "Progression", "Écarts", "Valeur écart"],
      ...subset.map((r) => [
        r.reference,
        r.depot,
        r.date,
        r.articles,
        r.saisis,
        r.progression,
        r.ecarts,
        r.valeurEcart,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 18 },
      { wch: 22 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31));
  }

  XLSX.writeFile(wb, `registre-inventaires-${stamp}.xlsx`);
}
