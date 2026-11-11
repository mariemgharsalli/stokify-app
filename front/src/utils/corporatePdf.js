import { imageFormatFromDataUrl, loadBrandingLogoDataUrl } from "./logoUrl";
import { clientContactLine, clientLocationLine } from "./clientBranding";

/* ── Palette neutre (complétée par accent société) ── */
export const SLATE = [100, 116, 139];
export const INK = [15, 23, 42];
export const LIGHT_BG = [248, 250, 252];
export const BORDER = [226, 232, 240];
export const WHITE = [255, 255, 255];
export const MARGIN = 14;

export function todayFr() {
  return new Date()
    .toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    .replace(/[\u202F\u00A0]/g, " ");
}

export function todayFrLong() {
  return new Date()
    .toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/[\u202F\u00A0]/g, " ");
}

export function buildReportRef(prefix, code) {
  const c = String(code || "DOC")
    .replace(/\s+/g, "")
    .slice(0, 8)
    .toUpperCase();
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}-${c}-${stamp}`;
}

export async function resolveBranding(clientBranding = {}) {
  const logoDataUrl = await loadBrandingLogoDataUrl(clientBranding);
  return {
    ...clientBranding,
    logoDataUrl,
  };
}

export function paletteFromBranding(branding) {
  const accent = branding?.accentRgb || [109, 40, 217];
  const accentHex = branding?.accentHex || "#6d28d9";
  const secondary = branding?.accentSecondaryHex || "#2A9D8F";
  const [r, g, b] = accent;
  const accentLight = [
    Math.min(255, r + 180),
    Math.min(255, g + 180),
    Math.min(255, b + 180),
  ];
  return { accent, accentHex, secondary, accentLight };
}

/** Profils de mise en page selon le type de document */
export const PDF_PROFILE = {
  WAREHOUSE: "warehouse",
  EDITORIAL: "editorial",
  ANALYTICS: "analytics",
  COMMERCIAL: "commercial",
  OPERATIONAL: "operational",
};

const PROFILE_FOOTER_LABEL = {
  [PDF_PROFILE.WAREHOUSE]: "Gestion d'entrepôt",
  [PDF_PROFILE.EDITORIAL]: "Catalogue & références",
  [PDF_PROFILE.ANALYTICS]: "Analyse & reporting",
  [PDF_PROFILE.COMMERCIAL]: "Document commercial",
  [PDF_PROFILE.OPERATIONAL]: "Opérations logistiques",
};

/**
 * Choisit le profil de mise en page le plus adapté au contexte.
 */
export function inferPdfProfile({
  kind,
  tags = [],
  hasCharts = false,
  hasKpis = false,
  isCatalog = false,
  isCommercial = false,
  isWarehouse = false,
} = {}) {
  if (kind && PROFILE_FOOTER_LABEL[kind]) return kind;
  if (isCommercial || tags.includes("commercial") || tags.includes("facture")) return PDF_PROFILE.COMMERCIAL;
  if (isCatalog || tags.includes("catalog") || tags.includes("article")) return PDF_PROFILE.EDITORIAL;
  if (isWarehouse || tags.includes("warehouse") || tags.includes("wms") || tags.includes("depot")) {
    return PDF_PROFILE.WAREHOUSE;
  }
  if (hasCharts || hasKpis || tags.includes("analytics") || tags.includes("kpi") || tags.includes("stats")) {
    return PDF_PROFILE.ANALYTICS;
  }
  return PDF_PROFILE.OPERATIONAL;
}

export function profileFooterLabel(profile, branding) {
  const company = String(branding?.nom || "").trim();
  const label = PROFILE_FOOTER_LABEL[profile] || PROFILE_FOOTER_LABEL[PDF_PROFILE.OPERATIONAL];
  return company ? `${company} · ${label}` : label;
}

export function fmtMoneyTnd(value, digits = 3) {
  return `${Number(value || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} TND`;
}

/**
 * Initialise un rapport analytique (couverture + métadonnées communes).
 */
export async function initAnalyticsReport(clientBranding, config = {}) {
  const { jsPDF } = await import("jspdf");
  const branding = await resolveBranding(clientBranding);
  const { accent } = paletteFromBranding(branding);
  const orientation = config.landscape !== false ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const reportId = buildReportRef(config.refPrefix || "RPT", branding?.code || config.entityCode);

  drawCoverPage(doc, branding, {
    reportTitle: config.reportTitle,
    reportSubtitle: config.reportSubtitle,
    entityLabel: config.entityLabel || "Périmètre",
    entityName: config.entityName || branding?.nom || "—",
    entityMeta: config.entityMeta || [],
    reportId,
    profile: PDF_PROFILE.ANALYTICS,
  });

  return { doc, branding, accent, reportId };
}

/* ── Logo ── */
export function drawLogo(doc, { logoDataUrl, societeName, accentRgb, x, y, size, bordered = true }) {
  if (bordered) {
    doc.setFillColor(...WHITE);
    doc.roundedRect(x - 0.5, y - 0.5, size + 1, size + 1, 4, 4, "F");
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(x - 0.5, y - 0.5, size + 1, size + 1, 4, 4, "S");
  }

  const pad = bordered ? 2 : 0;
  const inner = size - pad * 2;

  if (logoDataUrl) {
    const formats = ["PNG", imageFormatFromDataUrl(logoDataUrl), "JPEG", "WEBP"];
    const uniqueFormats = [...new Set(formats)];
    for (const fmt of uniqueFormats) {
      try {
        const props = doc.getImageProperties(logoDataUrl);
        const ratio = props.width / props.height;
        let w = inner;
        let h = inner;
        if (ratio > 1) h = inner / ratio;
        else w = inner * ratio;
        doc.addImage(logoDataUrl, fmt, x + (size - w) / 2, y + (size - h) / 2, w, h);
        return;
      } catch {
        /* format suivant */
      }
    }
  }

  doc.setFillColor(...accentRgb);
  doc.roundedRect(x + pad, y + pad, inner, inner, 3, 3, "F");
  const letter = (String(societeName || "L").trim()[0] || "L").toUpperCase();
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(Math.round(inner * 0.52));
  doc.text(letter, x + size / 2, y + size * 0.63, { align: "center" });
}

/* ── Éléments décoratifs ── */
function drawCoverDecorations(doc, pageW, pageH, accentRgb) {
  doc.setFillColor(...accentRgb);
  doc.rect(0, 0, pageW, 10, "F");

  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.triangle(pageW - 60, 0, pageW, 0, pageW, 50, "F");

  doc.setFillColor(
    Math.min(255, accentRgb[0] + 30),
    Math.min(255, accentRgb[1] + 30),
    Math.min(255, accentRgb[2] + 30)
  );
  doc.triangle(0, pageH - 18, 80, pageH, 0, pageH, "F");

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.15);
  for (let i = 0; i < 12; i += 1) {
    const ox = 20 + i * 22;
    doc.line(ox, pageH - 55, ox + 40, pageH - 95);
  }

  doc.setFillColor(...accentRgb);
  doc.rect(0, pageH - 14, pageW, 14, "F");
}

/* ── Page de couverture ── */
export function drawCoverPage(doc, branding, config) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const { accent, accentLight } = paletteFromBranding(branding);
  const {
    reportTitle,
    reportSubtitle,
    entityLabel,
    entityName,
    entityMeta = [],
    reportId,
    profile = PDF_PROFILE.WAREHOUSE,
  } = config;
  const footerLabel = profileFooterLabel(profile, branding);

  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 0, pageW, pageH, "F");
  drawCoverDecorations(doc, pageW, pageH, accent);

  const logoSize = 38;
  const logoX = (pageW - logoSize) / 2;
  drawLogo(doc, {
    logoDataUrl: branding?.logoDataUrl,
    societeName: branding?.nom,
    accentRgb: accent,
    x: logoX,
    y: 28,
    size: logoSize,
  });

  let y = 28 + logoSize + 14;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(String(branding?.nom || "—"), pageW / 2, y, { align: "center" });
  y += 8;

  if (branding?.tagline) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE);
    doc.text(String(branding.tagline), pageW / 2, y, { align: "center" });
    y += 6;
  }

  const location = clientLocationLine(branding);
  if (location !== "—") {
    doc.setFontSize(8);
    doc.text(location, pageW / 2, y, { align: "center" });
    y += 5;
  }

  const contact = clientContactLine(branding);
  if (contact) {
    doc.text(contact, pageW / 2, y, { align: "center" });
    y += 8;
  } else {
    y += 4;
  }

  doc.setDrawColor(...accent);
  doc.setLineWidth(0.6);
  doc.line(pageW / 2 - 40, y, pageW / 2 + 40, y);
  y += 14;

  doc.setTextColor(...accent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(reportTitle, pageW / 2, y, { align: "center" });
  y += 8;

  if (reportSubtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SLATE);
    doc.text(reportSubtitle, pageW / 2, y, { align: "center" });
    y += 12;
  } else {
    y += 6;
  }

  const boxW = Math.min(160, pageW - MARGIN * 2);
  const boxX = (pageW - boxW) / 2;
  const boxLines = [
    entityLabel && entityName ? { label: entityLabel, value: entityName } : null,
    ...entityMeta,
    { label: "Référence", value: reportId },
    { label: "Date de génération", value: todayFrLong() },
  ].filter(Boolean);

  const boxH = 10 + boxLines.length * 9;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, y, boxW, boxH, 3, 3, "FD");

  doc.setFillColor(...accentLight);
  doc.roundedRect(boxX, y, boxW, 8, 3, 3, "F");
  doc.rect(boxX, y + 4, boxW, 4, "F");

  let by = y + 14;
  boxLines.forEach((line) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(line.label, boxX + 8, by);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(String(line.value), boxX + boxW - 8, by, { align: "right" });
    by += 9;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  doc.text("DOCUMENT CONFIDENTIEL — USAGE INTERNE", pageW / 2, pageH - 6, { align: "center" });
  doc.text(footerLabel, pageW / 2, pageH - 11, { align: "center" });
}

/* ── En-tête pages de contenu ── */
export function drawContentHeader(doc, branding, config) {
  const pageW = doc.internal.pageSize.getWidth();
  const { accent } = paletteFromBranding(branding);
  const { sectionTitle, reportId, modeLabel } = config;
  const logoSize = 16;
  const headerTop = 10;

  doc.setFillColor(...WHITE);
  doc.rect(0, 0, pageW, 36, "F");

  drawLogo(doc, {
    logoDataUrl: branding?.logoDataUrl,
    societeName: branding?.nom,
    accentRgb: accent,
    x: MARGIN,
    y: headerTop,
    size: logoSize,
  });

  const textX = MARGIN + logoSize + 6;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(String(branding?.nom || "—"), textX, headerTop + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text(sectionTitle || "Rapport opérationnel", textX, headerTop + 11);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...accent);
  doc.text(`Réf. ${reportId}`, pageW - MARGIN, headerTop + 6, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);
  doc.text(todayFr(), pageW - MARGIN, headerTop + 11, { align: "right" });
  if (modeLabel) doc.text(modeLabel, pageW - MARGIN, headerTop + 16, { align: "right" });

  doc.setDrawColor(...accent);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 32, pageW - MARGIN, 32);

  return 38;
}

/* ── En-tête éditorial (catalogue, newsletter) ── */
export function drawEditorialHeader(doc, branding, config) {
  const pageW = doc.internal.pageSize.getWidth();
  const { accent, accentLight } = paletteFromBranding(branding);
  const { documentTitle, reportId, subtitle, summaryItems = [] } = config;
  const logoSize = 20;
  const top = 12;

  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 0, pageW, 8, "F");
  doc.setFillColor(...accent);
  doc.rect(0, 0, 5, 42, "F");

  drawLogo(doc, {
    logoDataUrl: branding?.logoDataUrl,
    societeName: branding?.nom,
    accentRgb: accent,
    x: MARGIN,
    y: top,
    size: logoSize,
  });

  const textX = MARGIN + logoSize + 8;
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(String(branding?.nom || "—").toUpperCase(), textX, top + 4);

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(documentTitle || "Catalogue Produits", textX, top + 13);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE);
    doc.text(subtitle, textX, top + 19, { maxWidth: pageW - textX - MARGIN - 50 });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...accent);
  doc.text(`Réf. ${reportId}`, pageW - MARGIN, top + 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);
  doc.text(todayFr(), pageW - MARGIN, top + 12, { align: "right" });

  let y = top + logoSize + 10;
  if (summaryItems.length) {
    const stripH = 14;
    doc.setFillColor(...accentLight);
    doc.roundedRect(MARGIN, y, pageW - MARGIN * 2, stripH, 2, 2, "F");
    const colW = (pageW - MARGIN * 2) / summaryItems.length;
    summaryItems.forEach((item, i) => {
      const cx = MARGIN + colW * i + colW / 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...SLATE);
      doc.text(item.label, cx, y + 5, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text(String(item.value), cx, y + 10, { align: "center" });
    });
    y += stripH + 6;
  }

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  return y + 4;
}

/* ── En-tête document commercial (facture, bon) ── */
export function drawCommercialHeader(doc, branding, config) {
  const pageW = doc.internal.pageSize.getWidth();
  const { accent } = paletteFromBranding(branding);
  const { documentTitle, reportId, reference, dateLabel, counterpartyLabel, counterpartyLines = [] } = config;
  const logoSize = 22;
  let y = 14;

  doc.setFillColor(...accent);
  doc.rect(0, 0, pageW, 3, "F");

  drawLogo(doc, {
    logoDataUrl: branding?.logoDataUrl,
    societeName: branding?.nom,
    accentRgb: accent,
    x: MARGIN,
    y: y + 2,
    size: logoSize,
  });

  const leftX = MARGIN + logoSize + 8;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(String(branding?.nom || "—"), leftX, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  let ly = y + 16;
  const location = clientLocationLine(branding);
  if (location !== "—") {
    doc.text(location, leftX, ly);
    ly += 4;
  }
  const contact = clientContactLine(branding);
  if (contact) {
    doc.text(contact, leftX, ly);
    ly += 4;
  }

  const rightX = pageW - MARGIN;
  doc.setTextColor(...accent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(documentTitle || "DOCUMENT", rightX, y + 10, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  if (reference) doc.text(reference, rightX, y + 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);
  if (dateLabel) doc.text(dateLabel, rightX, y + 24, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...accent);
  doc.text(`Réf. ${reportId}`, rightX, y + 30, { align: "right" });

  y = Math.max(ly, y + 36) + 6;
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 8;

  if (counterpartyLabel && counterpartyLines.length) {
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(MARGIN, y, pageW / 2 - MARGIN, 8 + counterpartyLines.length * 5, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...accent);
    doc.text(counterpartyLabel, MARGIN + 4, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    doc.setFontSize(8);
    counterpartyLines.forEach((line, i) => {
      doc.text(String(line), MARGIN + 4, y + 10 + i * 5);
    });
    y += 12 + counterpartyLines.length * 5;
  }

  return y;
}

/* ── Bandeau résumé KPI (analytics) ── */
export function drawKpiStrip(doc, x, y, w, items, accentRgb) {
  const cols = items.length || 1;
  const colW = w / cols;
  const h = 22;
  items.forEach((item, i) => {
    const cx = x + i * colW;
    drawStatCard(doc, cx + (i > 0 ? 1 : 0), y, colW - (i < cols - 1 ? 2 : 0), h, item, accentRgb);
  });
  return y + h + 6;
}

/* ── Pied de page ── */
export function applyPageFooters(doc, branding, config = {}) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const { accent } = paletteFromBranding(branding);
  const company = String(branding?.nom || "—");
  const {
    reportId,
    skipCover = true,
    profile = PDF_PROFILE.OPERATIONAL,
    allPages = false,
  } = config;
  const centerLabel = profileFooterLabel(profile, branding);

  for (let p = 1; p <= pageCount; p += 1) {
    if (!allPages && skipCover && p === 1) continue;
    doc.setPage(p);

    doc.setFillColor(...accent);
    doc.rect(0, pageH - 10, pageW, 1.2, "F");

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, pageH - 12, pageW - MARGIN, pageH - 12);

    doc.setFontSize(6.5);
    doc.setTextColor(...SLATE);
    doc.text(`${company} · Document confidentiel`, MARGIN, pageH - 7);

    const center = reportId ? `Réf. ${reportId}` : centerLabel;
    doc.text(center, pageW / 2, pageH - 7, { align: "center" });

    const displayPage = !allPages && skipCover ? p - 1 : p;
    const displayTotal = !allPages && skipCover ? pageCount - 1 : pageCount;
    doc.text(`Page ${displayPage} / ${displayTotal}`, pageW - MARGIN, pageH - 7, { align: "right" });
  }
}

/* ── Titre de section ── */
export function drawSectionTitle(doc, x, y, title, accentRgb) {
  doc.setFillColor(...accentRgb);
  doc.roundedRect(x, y - 4, 3, 10, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(title, x + 7, y + 3);
  return y + 10;
}

/* ── Icônes stat cards (formes vectorielles) ── */
function drawStatIcon(doc, type, x, y, size, color) {
  doc.setFillColor(...color);
  doc.setDrawColor(...color);
  const s = size;
  switch (type) {
    case "grid":
      for (let r = 0; r < 2; r += 1) {
        for (let c = 0; c < 2; c += 1) {
          doc.roundedRect(x + c * (s / 2 + 0.5), y + r * (s / 2 + 0.5), s / 2 - 0.5, s / 2 - 0.5, 0.5, 0.5, "F");
        }
      }
      break;
    case "filled":
      doc.roundedRect(x, y, s, s, 1.5, 1.5, "F");
      break;
    case "empty":
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, s, s, 1.5, 1.5, "S");
      break;
    case "gauge":
      doc.setLineWidth(0.6);
      doc.circle(x + s / 2, y + s / 2, s / 2, "S");
      doc.line(x + s / 2, y + s / 2, x + s / 2 + s / 3, y + s / 4);
      break;
    case "alert":
      doc.triangle(x + s / 2, y, x + s, y + s, x, y + s, "F");
      break;
    case "value":
      doc.setFont("helvetica", "bold");
      doc.setFontSize(s * 1.2);
      doc.text("TND", x + s / 2, y + s * 0.75, { align: "center" });
      break;
    case "box":
      doc.roundedRect(x, y + s * 0.2, s, s * 0.7, 1, 1, "F");
      doc.setFillColor(255, 255, 255);
      doc.rect(x + s * 0.15, y, s * 0.7, s * 0.25, "F");
      break;
    default:
      doc.circle(x + s / 2, y + s / 2, s / 2, "F");
  }
}

/* ── Carte statistique ── */
export function drawStatCard(doc, x, y, w, h, stat, accentRgb) {
  const iconColor = stat.iconColor || accentRgb;

  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");

  doc.setFillColor(...accentRgb);
  doc.roundedRect(x, y, w, 2.5, 3, 3, "F");
  doc.rect(x, y + 1.5, w, 1.5, "F");

  drawStatIcon(doc, stat.icon || "grid", x + 6, y + 8, 7, iconColor);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text(stat.value, x + 18, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text(stat.label, x + 18, y + 19);

  if (stat.hint) {
    doc.setFontSize(6);
    doc.setTextColor(...iconColor);
    doc.text(stat.hint, x + 18, y + 23);
  }
}

/* ── Graphique barres horizontales empilées ── */
export function drawStackedBarChart(doc, x, y, w, h, segments, title, accentRgb) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(title, x, y);

  const barY = y + 5;
  const barH = h - 14;
  let cx = x;

  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  segments.forEach((seg) => {
    const segW = (seg.value / total) * w;
    if (segW < 0.5) return;
    doc.setFillColor(...seg.color);
    doc.rect(cx, barY, segW, barH, "F");
    cx += segW;
  });

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.rect(x, barY, w, barH, "S");

  let lx = x;
  segments.forEach((seg) => {
    doc.setFillColor(...seg.color);
    doc.roundedRect(lx, y + h - 5, 4, 3, 0.5, 0.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...SLATE);
    const pct = ((seg.value / total) * 100).toFixed(0);
    doc.text(`${seg.label} (${pct}%)`, lx + 5.5, y + h - 2.5);
    lx += 38;
  });

  return y + h + 4;
}

/* ── Graphique donut ── */
export function drawDonutChart(doc, cx, cy, outerR, segments, title) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(title, cx - outerR, cy - outerR - 4);

  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let startAngle = -Math.PI / 2;

  segments.forEach((seg) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sweep;
    const steps = Math.max(8, Math.ceil(sweep * 20));

    doc.setFillColor(...seg.color);
    for (let i = 0; i < steps; i += 1) {
      const a1 = startAngle + (sweep * i) / steps;
      const a2 = startAngle + (sweep * (i + 1)) / steps;
      const x1 = cx + outerR * Math.cos(a1);
      const y1 = cy + outerR * Math.sin(a1);
      const x2 = cx + outerR * Math.cos(a2);
      const y2 = cy + outerR * Math.sin(a2);
      doc.triangle(cx, cy, x1, y1, x2, y2, "F");
    }
    startAngle = endAngle;
  });

  doc.setFillColor(...WHITE);
  doc.circle(cx, cy, outerR * 0.55, "F");

  const mainPct = segments.length
    ? ((segments[0].value / total) * 100).toFixed(0)
    : "0";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(`${mainPct}%`, cx, cy + 2, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...SLATE);
  doc.text(segments[0]?.label || "", cx, cy + 7, { align: "center" });

  return cy + outerR + 8;
}

/* ── Légende encadrée ── */
export function drawLegendBox(doc, x, y, items, title) {
  const boxW = items.length * 42 + 8;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, boxW, 14, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text(title || "Légende", x + 4, y + 4);

  items.forEach((item, i) => {
    const lx = x + 4 + i * 42;
    doc.setFillColor(...item.color);
    doc.roundedRect(lx, y + 7, 8, 5, 1, 1, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...INK);
    doc.text(item.label, lx + 10, y + 11);
  });

  return y + 18;
}

/* ── Styles tableau autoTable ── */
export function tableHeadStyles(accentRgb) {
  return {
    fillColor: accentRgb,
    textColor: [255, 255, 255],
    fontStyle: "bold",
    fontSize: 8,
    cellPadding: 4,
    halign: "left",
  };
}

export function tableBaseStyles() {
  return {
    fontSize: 8,
    cellPadding: 3.5,
    lineColor: BORDER,
    lineWidth: 0.15,
    textColor: INK,
    valign: "middle",
  };
}

/** Bloc totaux commercial (TTC mis en avant). */
export function drawCommercialTotals(doc, x, y, w, rows, accentRgb) {
  const boxH = 8 + rows.length * 7 + 12;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, boxH, 2, 2, "FD");

  let ty = y + 6;
  rows.forEach((row, i) => {
    const isLast = i === rows.length - 1;
    if (isLast) {
      doc.setFillColor(...accentRgb);
      doc.roundedRect(x + 2, ty - 2, w - 4, 10, 1.5, 1.5, "F");
      doc.setTextColor(...WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(String(row.label).toUpperCase(), x + 6, ty + 4);
      doc.text(String(row.value), x + w - 6, ty + 4, { align: "right" });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SLATE);
      doc.text(row.label, x + 6, ty + 2);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...INK);
      doc.text(String(row.value), x + w - 6, ty + 2, { align: "right" });
      ty += 7;
    }
  });
  return y + boxH + 4;
}
