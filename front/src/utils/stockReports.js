import autoTable from "jspdf-autotable";
import { downloadBlob } from "./exportHelpers";
import {
  MARGIN,
  LIGHT_BG,
  PDF_PROFILE,
  initAnalyticsReport,
  drawContentHeader,
  drawSectionTitle,
  drawKpiStrip,
  drawStackedBarChart,
  applyPageFooters,
  tableHeadStyles,
  tableBaseStyles,
  fmtMoneyTnd,
} from "./corporatePdf";

const CHART_COLORS = {
  blue: [55, 138, 221],
  teal: [29, 158, 117],
  amber: [186, 117, 23],
  red: [226, 75, 74],
  violet: [127, 119, 221],
};

const CATEGORY_LABELS = {
  STOCKAGE: "Stockage",
  LOGISTIQUE: "Logistique",
  MANUTENTION: "Manutention",
  AUTRE: "Autre",
};

function fmtNum(v, digits = 3) {
  return Number(v || 0)
    .toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .replace(/[\u202F\u00A0]/g, " ");
}

function clientBrandingFromArgs({ societeName, societeLogo, societeCode }) {
  return { nom: societeName, logo: societeLogo, code: societeCode };
}

function groupEntriesByCategory(entries = []) {
  const totals = { STOCKAGE: 0, LOGISTIQUE: 0, MANUTENTION: 0, AUTRE: 0 };
  for (const row of entries) {
    const cat = row.categorie && totals[row.categorie] !== undefined ? row.categorie : "AUTRE";
    totals[cat] += Number(row.montant || 0);
  }
  return Object.entries(CATEGORY_LABELS).map(([key, label]) => [label, fmtNum(totals[key])]);
}

function groupEntriesByNom(entries = []) {
  const map = new Map();
  for (const row of entries) {
    const nom = String(row.nom || "Autre").trim() || "Autre";
    map.set(nom, (map.get(nom) || 0) + Number(row.montant || 0));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([nom, total]) => [nom, fmtNum(total)]);
}

/**
 * Export PDF rapport coûts de stockage.
 */
export async function exportCoutStockagePdf({
  societeName,
  societeLogo,
  societeCode,
  clientBranding,
  depotLabel,
  periodeLabel,
  depotMensuels,
  unitCosts,
  deadStock,
  topArticles,
}) {
  const brandingInput = clientBranding || clientBrandingFromArgs({ societeName, societeLogo, societeCode });
  const entries = Array.isArray(depotMensuels) ? depotMensuels : [];
  const hasCategories = entries.some((e) => e.categorie);
  const totalCouts = entries.reduce((s, e) => s + Number(e.montant || 0), 0);

  const { doc, branding, accent, reportId } = await initAnalyticsReport(brandingInput, {
    refPrefix: "CST",
    reportTitle: "RAPPORT DES COÛTS DE STOCKAGE",
    reportSubtitle: "Analyse des charges logistiques & immobilisation",
    entityLabel: "Dépôt",
    entityName: depotLabel || "Tous",
    entityMeta: [
      { label: "Période", value: periodeLabel || "—" },
      { label: "Total coûts", value: fmtMoneyTnd(totalCouts) },
      { label: "Articles dormants", value: String(deadStock?.items?.length ?? 0) },
    ],
  });

  doc.addPage();
  let y = drawContentHeader(doc, branding, {
    sectionTitle: "Répartition des coûts",
    reportId,
    modeLabel: periodeLabel,
  });

  y = drawSectionTitle(doc, MARGIN, y + 4, "Synthèse", accent) + 6;
  const byCategory = hasCategories ? groupEntriesByCategory(entries) : groupEntriesByNom(entries);
  drawKpiStrip(doc, MARGIN, y, doc.internal.pageSize.getWidth() - MARGIN * 2, [
    { label: "Total coûts", value: fmtMoneyTnd(totalCouts), icon: "value" },
    { label: "Postes", value: String(byCategory.length), icon: "grid" },
    { label: "Lignes détaillées", value: String(Math.min(entries.length, 40)), icon: "box" },
    { label: "Stock dormant", value: String(deadStock?.items?.length ?? 0), icon: "alert", iconColor: CHART_COLORS.amber },
  ], accent);

  y += 30;
  autoTable(doc, {
    startY: y,
    head: [[hasCategories ? "Catégorie" : "Poste de coût", "Total (TND)"]],
    body: byCategory,
    styles: tableBaseStyles(),
    headStyles: tableHeadStyles(accent),
    alternateRowStyles: { fillColor: LIGHT_BG },
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [["Période", "Dépôt", "Libellé", "Catégorie", "Montant (TND)"]],
    body: entries.slice(0, 40).map((r) => [
      r.periode || "—",
      r.depot?.code || r.depotId || "—",
      r.nom || "—",
      CATEGORY_LABELS[r.categorie] || r.categorie || "—",
      fmtNum(r.montant),
    ]),
    styles: { ...tableBaseStyles(), fontSize: 8 },
    headStyles: tableHeadStyles(CHART_COLORS.teal),
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [["Article", "Qté", "Jours immobilisés", "Valeur bloquée (TND)"]],
    body: (deadStock?.items || []).slice(0, 15).map((r) => [
      r.article?.libelle || r.article?.code || "—",
      fmtNum(r.quantite, 2),
      String(r.joursImmobilise ?? "—"),
      fmtNum(r.valeurBloquee),
    ]),
    styles: { ...tableBaseStyles(), fontSize: 8 },
    headStyles: tableHeadStyles(CHART_COLORS.amber),
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [["Article", "Dépôt", "Coût unitaire (TND)"]],
    body: (topArticles || []).slice(0, 8).map((c) => [
      c.article?.libelle || c.article?.code || "—",
      c.depot?.code || "—",
      fmtNum(c.coutUnitaire),
    ]),
    styles: { ...tableBaseStyles(), fontSize: 8 },
    headStyles: tableHeadStyles(CHART_COLORS.violet),
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
  });

  applyPageFooters(doc, branding, { reportId, skipCover: true, profile: PDF_PROFILE.ANALYTICS });

  const slug = (depotLabel || "tous").replace(/\s+/g, "-").toLowerCase();
  doc.save(`rapport-couts-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Export PDF valorisation complète.
 */
export async function exportValuationPdf({ depotLabel, methode, lignes, valeurTotale, clientBranding }) {
  const { doc, branding, accent, reportId } = await initAnalyticsReport(clientBranding || {}, {
    refPrefix: "VAL",
    reportTitle: "RAPPORT DE VALORISATION",
    reportSubtitle: "Valorisation des stocks par méthode comptable",
    entityLabel: "Dépôt",
    entityName: depotLabel || "Tous",
    entityMeta: [
      { label: "Méthode", value: methode || "—" },
      { label: "Lignes", value: String(lignes.length) },
      { label: "Valeur totale", value: fmtMoneyTnd(valeurTotale) },
    ],
  });

  doc.addPage();
  drawContentHeader(doc, branding, {
    sectionTitle: "Détail de valorisation",
    reportId,
    modeLabel: methode,
  });

  autoTable(doc, {
    startY: 46,
    head: [["Article", "Code", "Dépôt", "Qté", "P.U.", "Valeur"]],
    body: lignes.map((l) => [
      l.articleLibelle,
      l.articleCode,
      l.depotCode,
      fmtNum(l.quantite, 2),
      fmtNum(l.prixUnitaire),
      fmtNum(l.valeur),
    ]),
    foot: [["", "", "", "", "Total", fmtNum(valeurTotale)]],
    styles: tableBaseStyles(),
    headStyles: tableHeadStyles(accent),
    alternateRowStyles: { fillColor: LIGHT_BG },
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
  });

  applyPageFooters(doc, branding, { reportId, skipCover: true, profile: PDF_PROFILE.ANALYTICS });
  doc.save(`valorisation-${(depotLabel || "tous").replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportDeadStockCsv(items) {
  const header = "Article;Code;Depot;Quantite;Jours;Valeur_bloquee;Dernier_mouvement\n";
  const rows = items
    .map((r) =>
      [
        `"${(r.article?.libelle || "").replace(/"/g, '""')}"`,
        r.article?.code,
        r.depot?.code,
        r.quantite,
        r.joursImmobilise,
        r.valeurBloquee,
        r.dateLastMvt ? new Date(r.dateLastMvt).toISOString().slice(0, 10) : "",
      ].join(";")
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `stock-dormant-${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Télécharge l'export mouvements (CSV ou PDF) depuis l'API.
 */
export async function downloadMouvementsExport(api, params, format) {
  const res = await api.get("mouvements/export", {
    params: { ...params, format },
    responseType: "blob",
  });
  const blob = res.data;
  const ext = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "csv";
  downloadBlob(blob, `mouvements-export-${new Date().toISOString().slice(0, 10)}.${ext}`);
}

/**
 * Export lots expirant bientôt.
 */
export async function downloadLotsExpiringExport(api, params, format) {
  const res = await api.get("lots/export/expiring", {
    params: { ...params, format },
    responseType: "blob",
  });
  const blob = res.data;
  const ext = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "csv";
  downloadBlob(blob, `lots-expiring-${new Date().toISOString().slice(0, 10)}.${ext}`);
}

export async function downloadLotTraceabilitePdf(api, lotId, numero) {
  const res = await api.get(`lots/${lotId}/traceabilite/pdf`, { responseType: "blob" });
  const blob = res.data;
  const safe = String(numero || lotId).replace(/[^\w.-]+/g, "_");
  downloadBlob(blob, `tracabilite-lot-${safe}.pdf`);
}

export async function fetchLotQrcodeBlob(api, lotId) {
  const res = await api.get(`lots/${lotId}/qrcode`, { responseType: "blob" });
  return res.data;
}

function recoColor(niveau) {
  if (niveau === "danger") return "#E24B4A";
  if (niveau === "warning") return "#BA7517";
  return "#1D9E75";
}

/**
 * Export PDF rapport rotation stock.
 */
export async function exportRotationPdf({
  report,
  depotLabel,
  periodeLabel,
  societeLogo,
  societeName,
  societeCode,
  clientBranding,
}) {
  const brandingInput = clientBranding || clientBrandingFromArgs({ societeName, societeLogo, societeCode });
  const summary = report?.summary || {};

  const { doc, branding, accent, reportId } = await initAnalyticsReport(brandingInput, {
    refPrefix: "ROT",
    reportTitle: "RAPPORT DE ROTATION",
    reportSubtitle: "Analyse des taux de rotation des stocks",
    entityLabel: "Dépôt",
    entityName: depotLabel || "Tous",
    entityMeta: [
      { label: "Période", value: periodeLabel || "—" },
      { label: "Rotation moyenne", value: `${fmtNum(summary.rotationMoyenne ?? 0, 1)} %` },
      { label: "Forte rotation", value: String(summary.articlesForteRotation ?? 0) },
      { label: "Faible rotation", value: String(summary.articlesFaibleRotation ?? 0) },
    ],
  });

  doc.addPage();
  let y = drawContentHeader(doc, branding, {
    sectionTitle: "Détail par article",
    reportId,
    modeLabel: periodeLabel,
  });

  y = drawSectionTitle(doc, MARGIN, y + 4, "Répartition", accent) + 6;
  drawStackedBarChart(
    doc,
    MARGIN,
    y,
    doc.internal.pageSize.getWidth() - MARGIN * 2,
    24,
    [
      { label: "Forte", value: summary.articlesForteRotation ?? 0, color: CHART_COLORS.teal },
      { label: "Faible", value: summary.articlesFaibleRotation ?? 0, color: CHART_COLORS.amber },
    ].filter((s) => s.value > 0),
    "Articles par niveau de rotation",
    accent
  );

  autoTable(doc, {
    startY: y + 30,
    head: [["Article", "Code", "Stock moyen", "Qté vendue", "Taux %", "Recommandation"]],
    body: (report?.items || []).map((r) => [
      r.article?.libelle || "",
      r.article?.code || "",
      fmtNum(r.stockMoyen, 2),
      fmtNum(r.qteVendue, 2),
      fmtNum(r.taux, 1),
      r.recommandation || "",
    ]),
    styles: { ...tableBaseStyles(), fontSize: 8 },
    headStyles: tableHeadStyles(accent),
    alternateRowStyles: { fillColor: LIGHT_BG },
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
  });

  applyPageFooters(doc, branding, { reportId, skipCover: true, profile: PDF_PROFILE.ANALYTICS });
  doc.save(`rapport-rotation-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Export PDF rapport stock dormant complet (groupé par tranche).
 */
export async function exportDeadStockReportPdf({
  report,
  depotLabel,
  societeLogo,
  societeName,
  societeCode,
  clientBranding,
}) {
  const brandingInput = clientBranding || clientBrandingFromArgs({ societeName, societeLogo, societeCode });
  const s = report?.summary || {};

  const { doc, branding, accent, reportId } = await initAnalyticsReport(brandingInput, {
    refPrefix: "DOR",
    reportTitle: "RAPPORT STOCK DORMANT",
    reportSubtitle: "Analyse de l'immobilisation & recommandations",
    entityLabel: "Dépôt",
    entityName: depotLabel || "Tous",
    entityMeta: [
      { label: "Seuil", value: `${report?.seuil ?? 90} jours` },
      { label: "Valeur immobilisée", value: fmtMoneyTnd(s.totalValeurImmobilisee) },
      { label: "Coût mensuel", value: fmtMoneyTnd(s.totalCoutMensuel) },
      { label: "Articles", value: String(s.nbArticles ?? 0) },
    ],
  });

  doc.addPage();
  let y = drawContentHeader(doc, branding, {
    sectionTitle: "Répartition par tranche",
    reportId,
    modeLabel: depotLabel,
  });

  const tranches = s.tranches || {};
  y = drawSectionTitle(doc, MARGIN, y + 4, "Synthèse par ancienneté", accent) + 6;
  drawKpiStrip(doc, MARGIN, y, doc.internal.pageSize.getWidth() - MARGIN * 2, [
    { label: "> 90 jours", value: String(tranches[">90j"] ?? 0), icon: "alert", iconColor: CHART_COLORS.red },
    { label: "60 – 90 j", value: String(tranches["60-90j"] ?? 0), icon: "gauge", iconColor: CHART_COLORS.amber },
    { label: "30 – 60 j", value: String(tranches["30-60j"] ?? 0), icon: "filled", iconColor: CHART_COLORS.teal },
    { label: "Valeur immob.", value: fmtMoneyTnd(s.totalValeurImmobilisee), icon: "value" },
  ], accent);

  autoTable(doc, {
    startY: y + 30,
    head: [["Tranche", "Nb articles"]],
    body: [
      ["> 90 jours", tranches[">90j"] ?? 0],
      ["60 – 90 jours", tranches["60-90j"] ?? 0],
      ["30 – 60 jours", tranches["30-60j"] ?? 0],
    ],
    styles: tableBaseStyles(),
    headStyles: tableHeadStyles(accent),
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
  });

  const groups = { ">90j": [], "60-90j": [], "30-60j": [] };
  for (const row of report?.items || []) {
    const t = row.tranche || ">90j";
    if (groups[t]) groups[t].push(row);
  }

  const sectionColors = {
    "> 90 jours": CHART_COLORS.red,
    "60 – 90 jours": CHART_COLORS.amber,
    "30 – 60 jours": CHART_COLORS.teal,
  };

  for (const [label, rows] of [
    ["> 90 jours", groups[">90j"]],
    ["60 – 90 jours", groups["60-90j"]],
    ["30 – 60 jours", groups["30-60j"]],
  ]) {
    if (!rows.length) continue;
    doc.addPage();
    drawContentHeader(doc, branding, { sectionTitle: label, reportId, modeLabel: `${rows.length} article(s)` });
    autoTable(doc, {
      startY: 46,
      head: [["Article", "Code", "Famille", "Dépôt", "Qté", "Dernier mvt", "Jours", "Valeur", "Coût/mois", "Recommandation"]],
      body: rows.map((r) => [
        r.article?.libelle || "",
        r.code || r.article?.code || "",
        r.famille || "—",
        r.depot?.code || "",
        fmtNum(r.quantite, 2),
        r.dateLastMvt ? new Date(r.dateLastMvt).toLocaleDateString("fr-FR") : "—",
        String(r.joursImmobilise),
        fmtNum(r.valeurStock),
        fmtNum(r.coutDetentionMois),
        r.recommandation || "",
      ]),
      styles: { ...tableBaseStyles(), fontSize: 7 },
      headStyles: tableHeadStyles(sectionColors[label] || accent),
      margin: { left: MARGIN, right: MARGIN, bottom: 16 },
    });
  }

  applyPageFooters(doc, branding, { reportId, skipCover: true, profile: PDF_PROFILE.ANALYTICS });
  doc.save(`rapport-stock-dormant-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export { recoColor };
