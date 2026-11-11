import { getLineStockMin } from "../../hooks/useStockGroupes";
import {
  MARGIN,
  INK,
  SLATE,
  LIGHT_BG,
  PDF_PROFILE,
  buildReportRef,
  resolveBranding,
  paletteFromBranding,
  drawCoverPage,
  drawContentHeader,
  applyPageFooters,
  drawSectionTitle,
  drawStatCard,
  drawStackedBarChart,
  tableHeadStyles,
  tableBaseStyles,
} from "../../utils/corporatePdf";

const STATUS_COLORS = {
  normal: [42, 157, 143],
  critique: [230, 168, 35],
  rupture: [220, 53, 69],
};

export async function exportRapportInstantane(stocks, clientBranding = {}, kpis = {}) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const branding = await resolveBranding(clientBranding);
  const { accent } = paletteFromBranding(branding);
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  const reportId = buildReportRef("STK", branding?.code || "STOCK");
  const societeNom = branding?.nom || "—";

  const normalCount = stocks.filter((s) => {
    const seuil = getLineStockMin(s) ?? 0;
    const qty = Number(s.quantite);
    return qty > seuil;
  }).length;
  const critiqueCount = stocks.filter((s) => {
    const seuil = getLineStockMin(s) ?? 0;
    const qty = Number(s.quantite);
    return qty > 0 && qty <= seuil;
  }).length;
  const ruptureCount = stocks.filter((s) => Number(s.quantite) <= 0).length;

  /* ── Couverture ── */
  drawCoverPage(doc, branding, {
    reportTitle: "RAPPORT D'ÉTAT DU STOCK",
    reportSubtitle: "Analyse instantanée des niveaux et valorisation",
    entityLabel: "Société",
    entityName: societeNom,
    entityMeta: [
      { label: "Articles analysés", value: String(stocks.length) },
      { label: "Valeur totale (CMP)", value: `${(kpis.valeurTotale ?? 0).toLocaleString("fr-FR")} TND` },
    ],
    reportId,
    profile: PDF_PROFILE.WAREHOUSE,
  });

  /* ── Synthèse KPI ── */
  doc.addPage();
  let y = drawContentHeader(doc, branding, {
    sectionTitle: "Synthèse des indicateurs",
    reportId,
    modeLabel: "État instantané",
  });

  y = drawSectionTitle(doc, MARGIN, y + 4, "Indicateurs clés", accent) + 4;

  const kpiItems = [
    {
      label: "Articles en stock",
      value: String(kpis.totalArticles ?? stocks.length),
      icon: "box",
      hint: "Références actives",
    },
    {
      label: "Valeur totale (CMP)",
      value: `${(kpis.valeurTotale ?? 0).toLocaleString("fr-FR")}`,
      icon: "value",
      iconColor: accent,
      hint: "TND · Coût moyen pondéré",
    },
    {
      label: "Ruptures de stock",
      value: String(kpis.ruptures ?? ruptureCount),
      icon: "alert",
      iconColor: STATUS_COLORS.rupture,
      hint: "Qté nulle",
    },
    {
      label: "Stock critique",
      value: String(kpis.critiques ?? critiqueCount),
      icon: "gauge",
      iconColor: STATUS_COLORS.critique,
      hint: "Sous seuil d'alerte",
    },
  ];

  const kW = (pageW - MARGIN * 2 - 6) / 4;
  kpiItems.forEach((k, i) => {
    drawStatCard(doc, MARGIN + i * (kW + 2), y, kW, 26, k, accent);
  });
  y += 32;

  y = drawSectionTitle(doc, MARGIN, y, "Répartition par statut", accent) + 6;
  drawStackedBarChart(
    doc,
    MARGIN,
    y,
    pageW - MARGIN * 2,
    26,
    [
      { label: "Normal", value: normalCount, color: STATUS_COLORS.normal },
      { label: "Critique", value: critiqueCount, color: STATUS_COLORS.critique },
      { label: "Rupture", value: ruptureCount, color: STATUS_COLORS.rupture },
    ].filter((s) => s.value > 0),
    "Distribution des lignes de stock",
    accent
  );

  /* ── Tableau détaillé ── */
  doc.addPage();
  drawContentHeader(doc, branding, {
    sectionTitle: "État détaillé du stock",
    reportId,
    modeLabel: `${stocks.length} ligne(s)`,
  });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);
  doc.text("Inventaire valorisé au coût moyen pondéré (CMP)", MARGIN, 46);

  autoTable(doc, {
    startY: 50,
    head: [["Article", "Code", "Famille", "Dépôt", "Emplacement", "Qté", "Valeur CMP", "Statut"]],
    body: stocks.map((s) => {
      const seuil = getLineStockMin(s) ?? 0;
      const qty = Number(s.quantite);
      const statut = qty <= 0 ? "Rupture" : qty <= seuil ? "Critique" : "Normal";
      return [
        s.article?.libelle || "—",
        s.article?.code || "—",
        s.article?.famille?.nom || "—",
        s.depot?.libelle || s.depot?.code || "—",
        s.emplacement?.code || "—",
        `${qty.toLocaleString("fr-FR")} ${s.article?.unite || "UN"}`,
        `${(qty * (s.article?.prixAchat || 0)).toLocaleString("fr-FR")} TND`,
        statut,
      ];
    }),
    styles: tableBaseStyles(),
    headStyles: tableHeadStyles(accent),
    alternateRowStyles: { fillColor: LIGHT_BG },
    columnStyles: { 7: { halign: "center" } },
    didDrawCell: (data) => {
      if (data.column.index === 7 && data.section === "body") {
        const val = data.cell.text[0];
        if (val === "Rupture") {
          doc.setFillColor(254, 226, 226);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
          doc.setTextColor(185, 28, 28);
          doc.setFont("helvetica", "bold");
          doc.text("Rupture", data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, {
            align: "center",
          });
        } else if (val === "Critique") {
          doc.setFillColor(254, 243, 199);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
          doc.setTextColor(146, 64, 14);
          doc.setFont("helvetica", "bold");
          doc.text("Critique", data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, {
            align: "center",
          });
        }
      }
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
  });

  /* ── Page alertes ── */
  const alertItems = stocks.filter((s) => {
    const seuil = getLineStockMin(s) ?? 0;
    return Number(s.quantite) <= seuil;
  });

  if (alertItems.length > 0) {
    doc.addPage();
    drawContentHeader(doc, branding, {
      sectionTitle: "Articles en alerte",
      reportId,
      modeLabel: `${alertItems.length} alerte(s)`,
    });

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(185, 28, 28);
    doc.text(`Articles nécessitant une action (${alertItems.length})`, MARGIN, 46);

    autoTable(doc, {
      startY: 52,
      head: [["Article", "Code", "Dépôt", "Qté actuelle", "Seuil alerte", "Écart", "Priorité"]],
      body: alertItems.map((s) => {
        const qty = Number(s.quantite);
        const seuil = getLineStockMin(s) ?? 0;
        return [
          s.article?.libelle || "—",
          s.article?.code || "—",
          s.depot?.libelle || "—",
          `${qty.toLocaleString("fr-FR")} UN`,
          `${seuil.toLocaleString("fr-FR")} UN`,
          `${(qty - seuil).toLocaleString("fr-FR")} UN`,
          qty <= 0 ? "URGENT" : "ATTENTION",
        ];
      }),
      styles: tableBaseStyles(),
      headStyles: { ...tableHeadStyles(STATUS_COLORS.rupture), fillColor: STATUS_COLORS.rupture },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      columnStyles: { 6: { halign: "center", fontStyle: "bold" } },
      margin: { left: MARGIN, right: MARGIN, bottom: 16 },
    });
  }

  applyPageFooters(doc, branding, { reportId, skipCover: true, profile: PDF_PROFILE.WAREHOUSE });

  doc.save(`rapport-stock-${new Date().toISOString().slice(0, 10)}.pdf`);
}
