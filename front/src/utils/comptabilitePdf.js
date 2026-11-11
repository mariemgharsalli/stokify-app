import autoTable from "jspdf-autotable";
import {
  MARGIN,
  LIGHT_BG,
  PDF_PROFILE,
  initAnalyticsReport,
  drawContentHeader,
  drawSectionTitle,
  drawKpiStrip,
  applyPageFooters,
  tableHeadStyles,
  tableBaseStyles,
  fmtMoneyTnd,
} from "./corporatePdf";

/**
 * Export PDF synthèse comptabilité (style dashboard / analytics).
 */
export async function exportComptabilitePdf({ data, periodeLabel, clientBranding = {} }) {
  if (!data) throw new Error("Aucune donnée à exporter");

  const { doc, branding, accent, reportId } = await initAnalyticsReport(clientBranding, {
    refPrefix: "CPT",
    reportTitle: "SYNTHÈSE COMPTABLE",
    reportSubtitle: "Tableau de bord financier & indicateurs de performance",
    entityLabel: "Période analysée",
    entityName: periodeLabel || "—",
    entityMeta: [
      { label: "Achats", value: fmtMoneyTnd(data.achatsMois) },
      { label: "Ventes", value: fmtMoneyTnd(data.ventesMois) },
      { label: "Solde", value: fmtMoneyTnd(data.solde) },
    ],
  });

  doc.addPage();
  let y = drawContentHeader(doc, branding, {
    sectionTitle: "Indicateurs financiers",
    reportId,
    modeLabel: periodeLabel,
  });

  y = drawSectionTitle(doc, MARGIN, y + 4, "Vue d'ensemble", accent) + 6;

  drawKpiStrip(doc, MARGIN, y, doc.internal.pageSize.getWidth() - MARGIN * 2, [
    { label: "Achats", value: fmtMoneyTnd(data.achatsMois), icon: "box" },
    { label: "Ventes", value: fmtMoneyTnd(data.ventesMois), icon: "value" },
    { label: "Solde", value: fmtMoneyTnd(data.solde), icon: "gauge" },
    { label: "Marge brute", value: `${Number(data.margePct ?? 0).toFixed(1)} %`, icon: "filled" },
  ], accent);

  y += 30;

  autoTable(doc, {
    startY: y,
    head: [["Indicateur", "Valeur"]],
    body: [
      ["Achats", fmtMoneyTnd(data.achatsMois)],
      ["Ventes", fmtMoneyTnd(data.ventesMois)],
      ["Solde", fmtMoneyTnd(data.solde)],
      ["Marge brute", `${Number(data.margePct ?? 0).toFixed(1)} %`],
      ["Impayés clients", fmtMoneyTnd(data.impayesClients)],
      ["Dettes fournisseurs", fmtMoneyTnd(data.dettesFournisseurs)],
      ["Encaissé", fmtMoneyTnd(data.encaisse)],
      ["Taux recouvrement", `${Number(data.tauxRecouvrement ?? 0).toFixed(1)} %`],
    ],
    styles: tableBaseStyles(),
    headStyles: tableHeadStyles(accent),
    alternateRowStyles: { fillColor: LIGHT_BG },
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
  });

  applyPageFooters(doc, branding, { reportId, skipCover: true, profile: PDF_PROFILE.ANALYTICS });
  doc.save(`comptabilite-${new Date().toISOString().slice(0, 10)}.pdf`);
}
