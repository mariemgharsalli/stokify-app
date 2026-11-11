import {
  MARGIN,
  INK,
  SLATE,
  LIGHT_BG,
  BORDER,
  buildReportRef,
  resolveBranding,
  paletteFromBranding,
  PDF_PROFILE,
  drawCoverPage,
  drawContentHeader,
  applyPageFooters,
  drawSectionTitle,
  drawStatCard,
  drawStackedBarChart,
  drawDonutChart,
  drawLegendBox,
  tableHeadStyles,
  tableBaseStyles,
} from "../../../utils/corporatePdf";

const OCC_COLORS = {
  empty: [226, 232, 240],
  normal: [42, 157, 143],
  warning: [230, 168, 35],
  critical: [220, 53, 69],
};

function classifyCell(rate, qty) {
  if (qty === 0) return "empty";
  if (rate > 80) return "critical";
  if (rate > 50) return "warning";
  return "normal";
}

function occupancyStats(cells) {
  const counts = { empty: 0, normal: 0, warning: 0, critical: 0 };
  cells.forEach(({ rate, stockInfo }) => {
    counts[classifyCell(rate, stockInfo.qty)] += 1;
  });
  const avgRate = cells.reduce((s, c) => s + c.rate, 0) / (cells.length || 1);
  return { counts, avgRate };
}

function drawWarehouseGrid(doc, cells, startY, pageW, pageH, onNewPage) {
  const cols = Math.max(...cells.map((c) => c.col), 0) + 1;
  const maxRow = Math.max(...cells.map((c) => c.row), 0);
  const maxCellSize = Math.min(18, (pageW - MARGIN * 2) / cols);
  const bottomMargin = 50;
  const rowsPerPage = Math.floor((pageH - startY - bottomMargin) / (maxCellSize + 1)) || 1;

  let rowOffset = 0;
  let currentY = startY;
  let legendY = startY;

  while (rowOffset <= maxRow) {
    if (rowOffset > 0) {
      doc.addPage();
      currentY = onNewPage() + 6;
    }

    const rowEnd = Math.min(rowOffset + rowsPerPage, maxRow + 1);
    let maxLocalRow = 0;

    cells.forEach(({ em, rate, stockInfo, col, row }) => {
      if (row < rowOffset || row >= rowEnd) return;
      const localRow = row - rowOffset;
      maxLocalRow = Math.max(maxLocalRow, localRow);
      const x = MARGIN + col * (maxCellSize + 1);
      const y = currentY + localRow * (maxCellSize + 1);

      const kind = classifyCell(rate, stockInfo.qty);
      doc.setFillColor(...OCC_COLORS[kind]);
      doc.roundedRect(x, y, maxCellSize - 0.5, maxCellSize - 0.5, 1, 1, "F");

      doc.setFontSize(5);
      doc.setFont("helvetica", "bold");
      const isEmpty = kind === "empty";
      doc.setTextColor(isEmpty ? 150 : 255, isEmpty ? 150 : 255, isEmpty ? 150 : 255);
      doc.text(
        (em.code || "").slice(0, 6),
        x + (maxCellSize - 0.5) / 2,
        y + (maxCellSize - 0.5) / 2 + 1,
        { align: "center" }
      );
    });

    legendY = currentY + (maxLocalRow + 1) * (maxCellSize + 1) + 6;
    rowOffset += rowsPerPage;
  }

  return legendY;
}

export async function exportWarehousePDF(depot, cells, capPerCell, viewMode, clientBranding = {}) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const branding = await resolveBranding(clientBranding);
  const { accent } = paletteFromBranding(branding);
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const modeLabel =
    viewMode === "articles" ? "Vue Articles" : viewMode === "3d" ? "Occupation 2D" : "Vue Occupation";

  const reportId = buildReportRef("WH", depot?.code);
  const { counts, avgRate } = occupancyStats(cells);

  /* ── Page 1 : Couverture ── */
  drawCoverPage(doc, branding, {
    reportTitle: "RAPPORT D'OCCUPATION",
    reportSubtitle: "Plan de dépôt & analyse des emplacements",
    entityLabel: "Dépôt / Entrepôt",
    entityName: String(depot?.libelle || "Dépôt"),
    entityMeta: [
      depot?.code ? { label: "Code dépôt", value: depot.code } : null,
      depot?.ville ? { label: "Localisation", value: depot.ville } : null,
      depot?.capacite
        ? { label: "Capacité", value: `${Number(depot.capacite).toLocaleString("fr-FR")} unités` }
        : null,
      { label: "Mode d'analyse", value: modeLabel },
    ].filter(Boolean),
    reportId,
    profile: PDF_PROFILE.WAREHOUSE,
  });

  /* ── Page 2 : Synthèse ── */
  doc.addPage();
  let y = drawContentHeader(doc, branding, {
    sectionTitle: "Synthèse opérationnelle",
    reportId,
    modeLabel,
  });

  y = drawSectionTitle(doc, MARGIN, y + 4, "Indicateurs clés de performance", accent) + 4;

  const stats = [
    {
      label: "Total emplacements",
      value: String(cells.length),
      icon: "grid",
      hint: "Capacité totale du plan",
    },
    {
      label: "Emplacements occupés",
      value: String(cells.filter((c) => c.stockInfo.qty > 0).length),
      icon: "filled",
      iconColor: OCC_COLORS.normal,
      hint: "Stock présent",
    },
    {
      label: "Emplacements vides",
      value: String(counts.empty),
      icon: "empty",
      iconColor: SLATE,
      hint: "Disponibles",
    },
    {
      label: "Occupation moyenne",
      value: `${avgRate.toFixed(0)}%`,
      icon: "gauge",
      iconColor: accent,
      hint: "Taux global",
    },
  ];

  const cardW = (pageW - MARGIN * 2 - 6) / 4;
  stats.forEach((s, i) => {
    drawStatCard(doc, MARGIN + i * (cardW + 2), y, cardW, 26, s, accent);
  });
  y += 32;

  y = drawSectionTitle(doc, MARGIN, y, "Répartition de l'occupation", accent) + 6;

  const chartSegments = [
    { label: "Vides", value: counts.empty, color: OCC_COLORS.empty },
    { label: "Normal (<50%)", value: counts.normal, color: OCC_COLORS.normal },
    { label: "Attention (50–80%)", value: counts.warning, color: OCC_COLORS.warning },
    { label: "Critique (>80%)", value: counts.critical, color: OCC_COLORS.critical },
  ].filter((s) => s.value > 0);

  const chartW = pageW * 0.45;
  drawStackedBarChart(doc, MARGIN, y, chartW, 28, chartSegments, "Distribution par statut", accent);

  drawDonutChart(
    doc,
    pageW - MARGIN - 35,
    y + 18,
    22,
    [
      { label: "Occupés", value: cells.length - counts.empty, color: OCC_COLORS.normal },
      { label: "Vides", value: counts.empty, color: OCC_COLORS.empty },
    ],
    "Taux d'occupation global"
  );

  y += 38;

  if (counts.critical > 0 || counts.warning > 0) {
    y = drawSectionTitle(doc, MARGIN, y, "Alertes de capacité", accent) + 4;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(252, 165, 165);
    doc.setLineWidth(0.2);
    doc.roundedRect(MARGIN, y, pageW - MARGIN * 2, 14, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28);
    doc.text(
      `${counts.critical} emplacement(s) en saturation critique · ${counts.warning} en zone d'attention`,
      MARGIN + 6,
      y + 9
    );
    y += 20;
  }

  /* ── Page 3+ : Plan visuel ── */
  doc.addPage();
  y = drawContentHeader(doc, branding, {
    sectionTitle: "Plan visuel du dépôt",
    reportId,
    modeLabel,
  });
  y = drawSectionTitle(doc, MARGIN, y + 4, "Cartographie des emplacements", accent) + 6;

  const gridEndY = drawWarehouseGrid(doc, cells, y, pageW, pageH, () =>
    drawContentHeader(doc, branding, {
      sectionTitle: "Plan visuel du dépôt (suite)",
      reportId,
      modeLabel,
    })
  );

  drawLegendBox(doc, MARGIN, gridEndY + 2, [
    { color: OCC_COLORS.empty, label: "Vide" },
    { color: OCC_COLORS.normal, label: "< 50%" },
    { color: OCC_COLORS.warning, label: "50–80%" },
    { color: OCC_COLORS.critical, label: "> 80%" },
  ], "Code couleur occupation");

  /* ── Dernière section : Tableau détaillé ── */
  doc.addPage();
  drawContentHeader(doc, branding, {
    sectionTitle: "Inventaire détaillé des emplacements",
    reportId,
    modeLabel: `${modeLabel} — Détail`,
  });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);
  doc.text(`${cells.length} emplacement(s) répertorié(s)`, MARGIN, 46);

  autoTable(doc, {
    startY: 50,
    head: [["Code", "Libellé", "Zone", "Rayon", "Étagère", "Qté totale", "Taux occup.", "Statut", "☐ Vérifié"]],
    body: cells.map(({ em, stockInfo, rate }) => {
      const kind = classifyCell(rate, stockInfo.qty);
      const statut =
        kind === "empty" ? "Vide" : kind === "critical" ? "Critique" : kind === "warning" ? "Attention" : "Normal";
      return [
        em.code || "—",
        em.libelle || "—",
        em.zone || "—",
        em.rayon || "—",
        em.etagere || "—",
        (stockInfo.qty || 0).toLocaleString("fr-FR"),
        `${rate.toFixed(0)}%`,
        statut,
        "",
      ];
    }),
    styles: tableBaseStyles(),
    headStyles: tableHeadStyles(accent),
    alternateRowStyles: { fillColor: LIGHT_BG },
    columnStyles: {
      0: { fontStyle: "bold" },
      6: { halign: "center" },
      7: { halign: "center" },
      8: { cellWidth: 18, halign: "center" },
    },
    didDrawCell: (data) => {
      if (data.column.index === 6 && data.section === "body") {
        const val = parseFloat(data.cell.text[0]) || 0;
        if (val > 80) {
          doc.setFillColor(254, 226, 226);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
          doc.setTextColor(185, 28, 28);
          doc.text(
            data.cell.text[0],
            data.cell.x + data.cell.width / 2,
            data.cell.y + data.cell.height / 2 + 1,
            { align: "center" }
          );
        } else if (val > 50) {
          doc.setFillColor(254, 243, 199);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
          doc.setTextColor(146, 64, 14);
          doc.text(
            data.cell.text[0],
            data.cell.x + data.cell.width / 2,
            data.cell.y + data.cell.height / 2 + 1,
            { align: "center" }
          );
        }
      }
      if (data.column.index === 7 && data.section === "body") {
        const val = data.cell.text[0];
        if (val === "Critique") {
          doc.setTextColor(185, 28, 28);
          doc.setFont("helvetica", "bold");
        } else if (val === "Attention") {
          doc.setTextColor(146, 64, 14);
          doc.setFont("helvetica", "bold");
        }
      }
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
    didDrawPage: () => {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
    },
  });

  applyPageFooters(doc, branding, { reportId, skipCover: true, profile: PDF_PROFILE.WAREHOUSE });

  const slug = String(depot?.code || "depot")
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`rapport-depot-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
