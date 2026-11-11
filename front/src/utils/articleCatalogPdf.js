import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getApiOrigin } from "../services/api";
import { getArticleRealImageUrl } from "../pages/articles/ClientCatalog";
import { stockIsCritical } from "../pages/refs/components/refsUtils";
import {
  MARGIN,
  LIGHT_BG,
  SLATE,
  INK,
  PDF_PROFILE,
  buildReportRef,
  resolveBranding,
  paletteFromBranding,
  drawEditorialHeader,
  applyPageFooters,
  tableHeadStyles,
  tableBaseStyles,
  fmtMoneyTnd,
} from "./corporatePdf";
import { buildLogoUrl } from "./logoUrl";

const STATUS_COLORS = {
  ACTIF: [5, 150, 105],
  ARCHIVE: [217, 119, 6],
  BLOQUE: [220, 38, 38],
};

function statutLabel(statut) {
  const s = String(statut || "ACTIF").trim().toUpperCase();
  if (s === "ARCHIVE") return "Archivé";
  if (s === "BLOQUE") return "Bloqué";
  return "Actif";
}

function resolveLogoUrl(logoPath) {
  const raw = String(logoPath || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const origin = getApiOrigin();
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return origin ? `${origin}${path}` : path;
}

async function loadImageDataUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function buildFilterSummary({ search, statut, filters, selectedCount, totalExported }) {
  const parts = [`${totalExported} article(s)`];
  if (selectedCount > 0) parts.push("sélection active");
  if (search?.trim()) parts.push(`recherche « ${search.trim()} »`);
  if (statut) parts.push(`statut ${statutLabel(statut)}`);
  if (filters?.familleId) parts.push("famille filtrée");
  if (filters?.sousFamilleId) parts.push("sous-famille filtrée");
  if (filters?.fournisseur) parts.push("fournisseur filtré");
  if (filters?.marque) parts.push(`marque ${filters.marque}`);
  return parts.join(" · ");
}

function fmtQty(value) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

/**
 * Export PDF du catalogue produits (style éditorial corporate).
 */
export async function exportArticleCatalogPdf({
  articles,
  societe,
  clientBranding,
  userName,
  search = "",
  statut = "",
  filters = {},
  selectedCount = 0,
}) {
  if (!articles?.length) {
    throw new Error("Aucun article à exporter");
  }

  const branding = await resolveBranding(
    clientBranding || {
      ...societe,
      nom: societe?.nom,
      logo: societe?.logo,
      logoUrl: buildLogoUrl(societe?.logo),
      code: societe?.code,
    }
  );

  const imageCache = await Promise.all(
    articles.map(async (item) => loadImageDataUrl(getArticleRealImageUrl(item)))
  );

  const valeurStock = articles.reduce(
    (sum, item) => sum + Number(item.stock || 0) * Number(item.prixUnitaire || 0),
    0
  );
  const alertCount = articles.filter((item) => stockIsCritical(item.stock, item.stockMin)).length;
  const margeMoy =
    articles.length
      ? (articles.reduce((s, item) => s + Number(item.margePct || 0), 0) / articles.length).toFixed(1)
      : "0.0";

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const { accent } = paletteFromBranding(branding);
  const reportId = buildReportRef("CAT", branding?.code || societe?.code);
  const filterSummary = buildFilterSummary({ search, statut, filters, selectedCount, totalExported: articles.length });

  const startY = drawEditorialHeader(doc, branding, {
    documentTitle: "Catalogue Produits",
    reportId,
    subtitle: filterSummary,
    summaryItems: [
      { label: "Valeur stock exportée", value: fmtMoneyTnd(valeurStock) },
      { label: "Alertes stock", value: String(alertCount) },
      { label: "Marge moyenne", value: `${margeMoy} %` },
      { label: "Références actives", value: String(articles.filter((a) => a.statut === "ACTIF").length) },
    ],
  });

  const tableBody = articles.map((item) => [
    "",
    item.code || "—",
    item.designation || "—",
    [item.familleNom, item.sousFamilleNom].filter(Boolean).join(" / ") || "—",
    fmtMoneyTnd(item.prixUnitaire),
    fmtMoneyTnd(item.prixCatalogue),
    fmtQty(item.stock),
    item.emplacementNom || "—",
    "",
  ]);

  autoTable(doc, {
    startY,
    head: [["", "Code", "Désignation", "Famille", "P.U.", "Catalogue", "Stock", "Empl.", "Statut"]],
    body: tableBody,
    theme: "plain",
    styles: { ...tableBaseStyles(), fontSize: 7.5, cellPadding: 2.5, valign: "middle" },
    headStyles: { ...tableHeadStyles(accent), halign: "center" },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: 52 },
      3: { cellWidth: 38 },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 16, halign: "right" },
      7: { cellWidth: 28 },
      8: { cellWidth: 18, halign: "center" },
    },
    alternateRowStyles: { fillColor: LIGHT_BG },
    didDrawCell: (data) => {
      if (data.section !== "body") return;

      if (data.column.index === 0) {
        const img = imageCache[data.row.index];
        const { x, y, height, width } = data.cell;
        if (img) {
          try {
            doc.addImage(img, "JPEG", x + 1.5, y + 1.5, width - 3, height - 3);
            return;
          } catch {
            try {
              doc.addImage(img, "PNG", x + 1.5, y + 1.5, width - 3, height - 3);
              return;
            } catch {
              /* placeholder */
            }
          }
        }
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(x + 2, y + 2, width - 4, height - 4, 1, 1, "F");
        doc.setFontSize(6);
        doc.setTextColor(148, 163, 184);
        doc.text("N/A", x + width / 2, y + height / 2 + 1, { align: "center" });
      }

      if (data.column.index === 8) {
        const item = articles[data.row.index];
        const key = String(item?.statut || "ACTIF").trim().toUpperCase();
        const color = STATUS_COLORS[key] || STATUS_COLORS.ACTIF;
        doc.setFillColor(...color);
        const padX = 1.5;
        const badgeW = data.cell.width - padX * 2;
        const badgeH = 5;
        const badgeX = data.cell.x + padX;
        const badgeY = data.cell.y + (data.cell.height - badgeH) / 2;
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6.5);
        doc.text(statutLabel(item?.statut), badgeX + badgeW / 2, badgeY + 3.5, { align: "center" });
      }
    },
    margin: { top: 14, left: MARGIN, right: MARGIN, bottom: 20 },
    rowPageBreak: "avoid",
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawEditorialHeader(doc, branding, {
          documentTitle: "Catalogue Produits",
          reportId,
          subtitle: filterSummary,
        });
      }
    },
  });

  applyPageFooters(doc, branding, {
    reportId,
    skipCover: false,
    allPages: true,
    profile: PDF_PROFILE.EDITORIAL,
  });

  if (userName) {
    const pageH = doc.internal.pageSize.height;
    const pageW = doc.internal.pageSize.width;
    doc.setFontSize(6.5);
    doc.setTextColor(...SLATE);
    doc.text(`Édité par ${userName}`, pageW / 2, pageH - 14, { align: "center" });
  }

  doc.save(`catalogue-produits-${new Date().toISOString().slice(0, 10)}.pdf`);
}
