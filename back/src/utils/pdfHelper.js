const PDFDocument = require("pdfkit");
const { drawPdfKitLogo } = require("./logoLoader");

/** Palette documentaire — alignée facture / UI Stokify */
const ACCENT = "#6d28d9";
const ACCENT_DARK = "#5b21b6";
const ACCENT_RGB = [109, 40, 217];
const INK = "#111827";
const SLATE = "#6b7280";
const BORDER = "#e5e7eb";
const LIGHT_BG = "#f3f4f6";
const SOFT_ACCENT = "#f5f3ff";
const WHITE = "#ffffff";
const SUCCESS = "#166534";
const DANGER = "#b91c1c";

function fmtDate(d) {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtMoney(n) {
  return `${Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`;
}

function buildReportRef(prefix, code) {
  const c = String(code || "DOC")
    .replace(/\s+/g, "")
    .slice(0, 8)
    .toUpperCase();
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}-${c}-${stamp}`;
}

function societeAccent(societe) {
  return societe?.accentHex || ACCENT;
}

function drawRoundedRect(doc, x, y, w, h, r, fill, stroke) {
  doc.save();
  if (fill && stroke) {
    doc.roundedRect(x, y, w, h, r).fillColor(fill).strokeColor(stroke).lineWidth(0.8).fillAndStroke();
  } else if (fill) {
    doc.roundedRect(x, y, w, h, r).fill(fill);
  } else if (stroke) {
    doc.roundedRect(x, y, w, h, r).strokeColor(stroke).lineWidth(0.8).stroke();
  }
  doc.restore();
}

/**
 * Texte absolu sans pages vides : PDFKit crée une page si un texte avec `width`
 * dépasse maxY — on impose toujours `height` pour bloquer ça.
 */
function absText(doc, str, x, yPos, opts = {}) {
  const o = { ...opts };
  if (o.width != null && o.height == null) o.height = 16;
  doc.text(String(str ?? ""), x, yPos, o);
}

function endPdfBuffer(doc, finishFootersAndHeaders) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    if (typeof finishFootersAndHeaders === "function") finishFootersAndHeaders();
    doc.end();
  });
}

/**
 * Document de base professionnel (tous les exports PDF).
 * @returns {{ doc, contentTop, contentLeft, contentWidth, pageW, pageH, margin, footerH, accent, reportId, absText: Function, ensureSpace: Function, finishFootersAndHeaders: Function }}
 */
function createBaseDoc(title, societe, options = {}) {
  const margin = options.margin ?? 36;
  const footerH = options.footerH ?? 40;
  const accent = societeAccent(societe);
  const company = String(societe?.nom || "—");
  const reportId = options.reportId || buildReportRef(options.refPrefix || "DOC", societe?.code);
  const docTitle = String(title || "");

  const doc = new PDFDocument({
    size: "A4",
    layout: options.layout || "portrait",
    margins: { top: 0, left: 0, right: 0, bottom: 0 },
    bufferPages: true,
    info: { Title: docTitle, Author: company },
  });
  doc.font("Helvetica");

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const innerW = pageW - margin * 2;
  const headerH = options.compactHeader ? 48 : 58;
  const bottomLimit = pageH - footerH - 8;

  function t(str, x, yPos, opts) {
    absText(doc, str, x, yPos, opts);
  }

  function ensureSpace(needed, yPos) {
    if (yPos + needed <= bottomLimit) return yPos;
    doc.addPage();
    // L'en-tête des pages suivantes est dessiné dans finishFootersAndHeaders
    return margin + headerH + 10;
  }

  function drawHeaderBand() {
    doc.save();
    doc.rect(0, 0, pageW, 7).fill(accent);
    doc.rect(0, 7, pageW, 2).fill(ACCENT_DARK);

    const hy = margin + 4;
    drawPdfKitLogo(doc, societe, margin, hy, 36, 36, { accent, bordered: true });

    const brandX = margin + 48;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(13);
    t(company, brandX, hy + 2, { width: innerW * 0.45 });
    doc.fillColor(SLATE).font("Helvetica").fontSize(8);
    t(docTitle, brandX, hy + 18, { width: innerW * 0.45 });

    const rightW = 180;
    const rightX = margin + innerW - rightW;
    doc.fillColor(accent).font("Helvetica-Bold").fontSize(8);
    t(`Réf. ${reportId}`, rightX, hy + 4, { width: rightW, align: "right" });
    doc.fillColor(SLATE).font("Helvetica").fontSize(8);
    t(fmtDate(new Date()), rightX, hy + 16, { width: rightW, align: "right" });

    doc.moveTo(margin, hy + headerH - 10)
      .lineTo(margin + innerW, hy + headerH - 10)
      .strokeColor(accent)
      .lineWidth(1.2)
      .stroke();
    doc.restore();
  }

  drawHeaderBand();
  const contentTop = margin + headerH + 4;

  function finishFootersAndHeaders() {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(i);
      if (i > 0) drawHeaderBand();

      const footY = pageH - 28;
      doc.rect(0, footY - 6, pageW, 1).fill(accent);
      doc.fillColor(SLATE).font("Helvetica").fontSize(7);
      t(`${company} · Document confidentiel`, margin, footY, {
        width: innerW * 0.38,
        align: "left",
        height: 12,
      });
      doc.fillColor(accent).font("Helvetica-Bold").fontSize(7);
      t(`Réf. ${reportId}`, margin, footY, { width: innerW, align: "center", height: 12 });
      doc.fillColor(SLATE).font("Helvetica").fontSize(7);
      t(`Page ${i + 1} / ${range.count}`, margin, footY, {
        width: innerW,
        align: "right",
        height: 12,
      });
    }
  }

  return {
    doc,
    contentTop,
    contentLeft: margin,
    contentWidth: innerW,
    pageW,
    pageH,
    margin,
    footerH,
    accent,
    reportId,
    bottomLimit,
    absText: t,
    ensureSpace,
    finishFootersAndHeaders,
  };
}

/** Bandeau titre document (BON DE LIVRAISON, RELANCE, etc.) */
function drawDocTitle(doc, { x, y, width, label, reference, accentHex, badge }) {
  const accent = accentHex || ACCENT;
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(16);
  absText(doc, label, x, y, { width: width * 0.55 });
  if (reference) {
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11);
    absText(doc, String(reference), x, y + 2, { width, align: "right" });
  }
  if (badge) {
    doc.font("Helvetica-Bold").fontSize(7);
    const tw = doc.widthOfString(String(badge.label));
    const bw = tw + 16;
    const bx = x + width - bw;
    drawRoundedRect(doc, bx, y + 18, bw, 15, 4, badge.bg || SOFT_ACCENT);
    doc.fillColor(badge.color || accent);
    absText(doc, badge.label, bx, y + 22, { width: bw, align: "center", height: 12 });
  }
  return y + (badge ? 40 : 28);
}

/** Bandeau méta (4 colonnes) */
function drawMetaStrip(doc, { x, y, width, items, accentHex }) {
  const accent = accentHex || ACCENT;
  const h = 44;
  drawRoundedRect(doc, x, y, width, h, 8, LIGHT_BG);
  const colW = width / Math.max(items.length, 1);
  items.forEach((item, i) => {
    const mx = x + i * colW + 10;
    doc.fillColor(SLATE).font("Helvetica-Bold").fontSize(7);
    absText(doc, String(item.label || "").toUpperCase(), mx, y + 10, { width: colW - 16, height: 10 });
    doc.fillColor(item.color || INK).font("Helvetica-Bold").fontSize(10);
    absText(doc, String(item.value ?? "—"), mx, y + 24, { width: colW - 16, height: 14 });
    if (i > 0) {
      doc.moveTo(x + i * colW, y + 10)
        .lineTo(x + i * colW, y + h - 10)
        .strokeColor(BORDER)
        .lineWidth(0.5)
        .stroke();
    }
  });
  void accent;
  return y + h + 12;
}

/** Cartes émetteur / contrepartie */
function drawPartyCards(doc, { x, y, width, left, right, accentHex }) {
  const accent = accentHex || ACCENT;
  const gap = 12;
  const cardW = (width - gap) / 2;
  const cardH = Math.max(78, 28 + Math.max(left.lines?.length || 0, right.lines?.length || 0) * 11);

  drawRoundedRect(doc, x, y, cardW, cardH, 8, LIGHT_BG, BORDER);
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(7);
  absText(doc, String(left.title || "ÉMETTEUR").toUpperCase(), x + 12, y + 10, { width: cardW - 24, height: 10 });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11);
  absText(doc, String(left.name || "—"), x + 12, y + 24, { width: cardW - 24, height: 14 });
  doc.fillColor(SLATE).font("Helvetica").fontSize(8);
  let ly = y + 42;
  (left.lines || []).forEach((line) => {
    absText(doc, String(line), x + 12, ly, { width: cardW - 24, height: 11 });
    ly += 11;
  });

  const rx = x + cardW + gap;
  drawRoundedRect(doc, rx, y, cardW, cardH, 8, WHITE, accent);
  doc.rect(rx, y, 4, cardH).fill(accent);
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(7);
  absText(doc, String(right.title || "CLIENT").toUpperCase(), rx + 14, y + 10, { width: cardW - 28, height: 10 });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11);
  absText(doc, String(right.name || "—"), rx + 14, y + 24, { width: cardW - 28, height: 14 });
  doc.fillColor(SLATE).font("Helvetica").fontSize(8);
  let ry = y + 42;
  (right.lines || []).forEach((line) => {
    absText(doc, String(line), rx + 14, ry, { width: cardW - 28, height: 11 });
    ry += 11;
  });

  return y + cardH + 14;
}

/** Zones signature */
function drawSignatureRow(doc, { x, y, width, leftLabel, rightLabel }) {
  const gap = 14;
  const sigW = (width - gap) / 2;
  const h = 64;
  [
    { label: leftLabel || "CACHET & SIGNATURE", ox: x },
    { label: rightLabel || "ACCUSÉ RÉCEPTION", ox: x + sigW + gap },
  ].forEach((box) => {
    drawRoundedRect(doc, box.ox, y, sigW, h, 8, WHITE, BORDER);
    doc.fillColor(SLATE).font("Helvetica-Bold").fontSize(7);
    absText(doc, box.label, box.ox + 12, y + 10, { width: sigW - 24, height: 10 });
    doc
      .moveTo(box.ox + 12, y + 48)
      .lineTo(box.ox + sigW - 12, y + 48)
      .strokeColor(BORDER)
      .lineWidth(0.6)
      .stroke();
  });
  return y + h + 8;
}

/**
 * Tableau professionnel
 */
function drawTable(doc, { headers, rows, startY, colWidths, accentHex, contentLeft, contentWidth, ensureSpace }) {
  const margin = contentLeft ?? 36;
  const pageW = doc.page.width;
  const innerW = contentWidth ?? pageW - margin * 2;
  const headColor = accentHex || ACCENT;
  const widths = colWidths && colWidths.length ? colWidths : headers.map(() => innerW / headers.length);
  let y = startY;
  const x0 = margin;
  const pageBottom = doc.page.height - 48;

  function space(h) {
    if (typeof ensureSpace === "function") {
      y = ensureSpace(h, y);
      return;
    }
    if (y + h > pageBottom) {
      doc.addPage();
      y = margin + 68;
    }
  }

  function drawHeader() {
    space(24);
    drawRoundedRect(doc, x0, y, innerW, 22, 4, headColor);
    let cx = x0 + 6;
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(7.5);
    headers.forEach((h, i) => {
      absText(doc, String(h).toUpperCase(), cx, y + 7, {
        width: widths[i] - 10,
        align: "left",
        height: 12,
      });
      cx += widths[i];
    });
    y += 22;
  }

  drawHeader();

  if (!rows.length) {
    space(28);
    drawRoundedRect(doc, x0, y, innerW, 28, 0, LIGHT_BG, BORDER);
    doc.fillColor(SLATE).font("Helvetica").fontSize(9);
    absText(doc, "Aucune ligne", x0, y + 9, { width: innerW, align: "center", height: 12 });
    return y + 28;
  }

  rows.forEach((row, ri) => {
    const cells = row.map((c) => String(c ?? ""));
    doc.font("Helvetica").fontSize(8);
    let rowH = 20;
    cells.forEach((text, i) => {
      const h = doc.heightOfString(text, { width: Math.max(widths[i] - 10, 20), height: 80 });
      rowH = Math.max(rowH, Math.min(h + 10, 56));
    });
    space(rowH + 2);
    if (y <= margin + 70 && ri > 0) drawHeader();

    const bg = ri % 2 === 0 ? WHITE : "#fafafa";
    doc.rect(x0, y, innerW, rowH).fill(bg);
    doc
      .moveTo(x0, y + rowH)
      .lineTo(x0 + innerW, y + rowH)
      .strokeColor(BORDER)
      .lineWidth(0.4)
      .stroke();

    let cxi = x0 + 6;
    cells.forEach((text, i) => {
      doc.font("Helvetica").fontSize(8).fillColor(INK);
      absText(doc, text, cxi, y + 5, {
        width: widths[i] - 10,
        align: "left",
        height: rowH - 6,
      });
      cxi += widths[i];
    });
    y += rowH;
  });

  return y;
}

function drawTotalsBlock(doc, opts) {
  const { ht, tva, ttc, remise, startY, lines, labelTva, entries, accentHex, contentLeft, contentWidth } =
    opts;
  const margin = contentLeft ?? 36;
  const innerW = contentWidth ?? doc.page.width - margin * 2;
  const accent = accentHex || ACCENT;
  const blockW = 220;
  const x = margin + innerW - blockW;
  let y = startY;

  let items;
  if (Array.isArray(entries) && entries.length > 0) {
    items = entries;
  } else {
    const extra = Array.isArray(lines) ? lines : [];
    items = [
      ...extra,
      ...(remise != null && Number(remise) !== 0 ? [{ label: "Remise globale", value: fmtMoney(remise) }] : []),
      { label: "Total HT", value: fmtMoney(ht) },
      { label: labelTva || "TVA (19%)", value: fmtMoney(tva) },
      { label: "Total TTC", value: fmtMoney(ttc), highlight: true },
    ];
  }

  const bodyItems = items.filter((r) => !r.highlight);
  const highlight = items.find((r) => r.highlight) || bodyItems[bodyItems.length - 1];
  const normal = highlight && items.includes(highlight) ? items.filter((r) => r !== highlight) : bodyItems;

  const boxH = 10 + normal.length * 18 + 34;
  drawRoundedRect(doc, x, y, blockW, boxH, 8, WHITE, BORDER);
  let ty = y + 10;
  normal.forEach((row) => {
    doc.fillColor(SLATE).font("Helvetica").fontSize(8);
    absText(doc, row.label, x + 12, ty, { width: blockW * 0.48, height: 12 });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(9);
    absText(doc, row.value, x + 12, ty, { width: blockW - 24, align: "right", height: 12 });
    ty += 18;
  });

  if (highlight) {
    doc.roundedRect(x + 4, ty, blockW - 8, 28, 5).fill(accent);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(8);
    absText(doc, String(highlight.label).toUpperCase(), x + 14, ty + 9, { width: 80, height: 12 });
    doc.fontSize(11);
    absText(doc, highlight.value, x + 14, ty + 8, { width: blockW - 28, align: "right", height: 14 });
    ty += 32;
  }

  return Math.max(y + boxH, ty) + 8;
}

function drawKpiRow(doc, { startY, contentLeft, contentWidth, items, accentHex }) {
  const accent = accentHex || ACCENT;
  const colW = contentWidth / items.length;
  let y = startY;
  const h = 42;

  items.forEach((item, i) => {
    const x = contentLeft + i * colW;
    drawRoundedRect(doc, x + 2, y, colW - 4, h, 6, WHITE, BORDER);
    doc.rect(x + 2, y, colW - 4, 3).fill(accent);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK);
    absText(doc, String(item.value), x + 10, y + 12, { width: colW - 20, height: 14 });
    doc.font("Helvetica").fontSize(7.5).fillColor(SLATE);
    absText(doc, String(item.label), x + 10, y + 28, { width: colW - 20, height: 10 });
  });

  return y + h + 14;
}

async function generateInventairePdf(inventaire, lignes, societe) {
  const title = `Inventaire ${inventaire.reference || ""}`;
  const accent = societeAccent(societe);
  const ctx = createBaseDoc(title, societe, {
    refPrefix: "INV",
    reportId: buildReportRef("INV", inventaire.reference),
  });
  const { doc, contentTop, contentLeft, contentWidth, finishFootersAndHeaders, absText: t, ensureSpace } = ctx;

  let y = contentTop;
  y = drawDocTitle(doc, {
    x: contentLeft,
    y,
    width: contentWidth,
    label: "INVENTAIRE",
    reference: inventaire.reference,
    accentHex: accent,
  });

  if (inventaire.depot) {
    doc.fillColor(SLATE).font("Helvetica").fontSize(9);
    t(`Dépôt : ${inventaire.depot.code} — ${inventaire.depot.libelle}`, contentLeft, y, {
      width: contentWidth,
    });
    y += 16;
  }

  let saisis = 0;
  let ecartsPos = 0;
  let ecartsNeg = 0;
  let valeurEcart = 0;
  for (const l of lignes) {
    if (l.qteReelle != null) {
      saisis += 1;
      const ec = Number(l.qteReelle) - Number(l.qteTheorique);
      if (Math.abs(ec) >= 1e-9) {
        if (ec > 0) ecartsPos += 1;
        else ecartsNeg += 1;
        valeurEcart += Number(l.valeurEcart ?? 0);
      }
    }
  }

  y = drawKpiRow(doc, {
    startY: y,
    contentLeft,
    contentWidth,
    accentHex: accent,
    items: [
      { label: "Articles comptés", value: saisis },
      { label: "Écarts +", value: ecartsPos },
      { label: "Écarts −", value: ecartsNeg },
      { label: "Valeur ajustement", value: fmtMoney(valeurEcart) },
    ],
  });

  const tableRows = lignes.map((l) => [
    l.article ? `${l.article.code} — ${l.article.libelle}` : "—",
    String(Number(l.qteTheorique ?? 0)),
    l.qteReelle != null ? String(Number(l.qteReelle)) : "—",
    l.ecart != null ? String(Number(l.ecart)) : "—",
    l.valeurEcart != null ? fmtMoney(l.valeurEcart) : "—",
  ]);

  y = drawTable(doc, {
    headers: ["Article", "Stock th.", "Stock réel", "Écart", "Val. écart"],
    rows: tableRows,
    startY: y,
    accentHex: accent,
    contentLeft,
    contentWidth,
    ensureSpace,
    colWidths: [
      contentWidth * 0.34,
      contentWidth * 0.14,
      contentWidth * 0.14,
      contentWidth * 0.12,
      contentWidth * 0.26,
    ],
  });

  y = ensureSpace(80, y + 20);
  y = drawSignatureRow(doc, {
    x: contentLeft,
    y,
    width: contentWidth,
    leftLabel: "RESPONSABLE INVENTAIRE",
    rightLabel: "CONTRÔLEUR",
  });

  return endPdfBuffer(doc, finishFootersAndHeaders);
}

async function generateRapportPdf({ societe, dashboard }) {
  const d = dashboard || {};
  const periode = d.periode || {};
  const debut = fmtDate(periode.debut);
  const fin = fmtDate(periode.fin);
  const title = `Synthèse comptable ${debut} — ${fin}`;
  const accent = societeAccent(societe);
  const ctx = createBaseDoc(title, societe, { refPrefix: "FIN" });
  const { doc, contentTop, contentLeft, contentWidth, finishFootersAndHeaders, absText: t, ensureSpace } = ctx;

  let y = contentTop;
  y = drawDocTitle(doc, {
    x: contentLeft,
    y,
    width: contentWidth,
    label: "SYNTHÈSE COMPTABLE",
    accentHex: accent,
  });

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(10);
  t("Indicateurs financiers", contentLeft, y, { width: contentWidth });
  y += 14;

  y = drawKpiRow(doc, {
    startY: y,
    contentLeft,
    contentWidth,
    accentHex: accent,
    items: [
      { label: "Ventes (TTC)", value: fmtMoney(d.ventesMois) },
      { label: "Achats (TTC)", value: fmtMoney(d.achatsMois) },
      { label: "Solde", value: fmtMoney(d.solde) },
      { label: "Marge brute", value: `${Number(d.margePct ?? 0).toFixed(1)} %` },
    ],
  });

  y = drawTable(doc, {
    headers: ["Indicateur", "Valeur"],
    rows: [
      ["Montant encaissé", fmtMoney(d.encaisse)],
      ["Taux recouvrement", `${Number(d.tauxRecouvrement ?? 0).toFixed(1)} %`],
      ["Créances clients", fmtMoney(d.impayesClients)],
      ["Dettes fournisseurs", fmtMoney(d.dettesFournisseurs)],
      ["Payé fournisseurs", fmtMoney(d.paye)],
    ],
    startY: y,
    accentHex: accent,
    contentLeft,
    contentWidth,
    ensureSpace,
    colWidths: [contentWidth * 0.55, contentWidth * 0.45],
  });

  doc.addPage();
  y = contentTop;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(10);
  t("Évolution 6 mois", contentLeft, y, { width: contentWidth });
  y += 12;
  const evoRows = (d.chartData || []).map((row) => [
    row.mois || "—",
    fmtMoney(row.achats),
    fmtMoney(row.ventes),
    fmtMoney(row.solde),
  ]);
  y = drawTable(doc, {
    headers: ["Mois", "Achats", "Ventes", "Solde"],
    rows: evoRows.length ? evoRows : [["—", "—", "—", "—"]],
    startY: y,
    accentHex: accent,
    contentLeft,
    contentWidth,
    ensureSpace,
    colWidths: [contentWidth * 0.22, contentWidth * 0.26, contentWidth * 0.26, contentWidth * 0.26],
  });
  y += 16;

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(10);
  t("Top clients", contentLeft, y, { width: contentWidth });
  y += 12;
  const cliRows = [...(d.topClients || [])]
    .sort((a, b) => Number(b.ca || 0) - Number(a.ca || 0))
    .slice(0, 10)
    .map((c) => [c.nom || "—", fmtMoney(c.ca)]);
  y = drawTable(doc, {
    headers: ["Client", "CA (TND)"],
    rows: cliRows.length ? cliRows : [["—", "—"]],
    startY: y,
    accentHex: accent,
    contentLeft,
    contentWidth,
    ensureSpace,
    colWidths: [contentWidth * 0.6, contentWidth * 0.4],
  });
  y += 16;

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(10);
  t("Top fournisseurs", contentLeft, y, { width: contentWidth });
  y += 12;
  const fourRows = [...(d.topFournisseurs || [])]
    .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
    .slice(0, 10)
    .map((f) => [f.nom || "—", fmtMoney(f.total)]);
  drawTable(doc, {
    headers: ["Fournisseur", "Total (TND)"],
    rows: fourRows.length ? fourRows : [["—", "—"]],
    startY: y,
    accentHex: accent,
    contentLeft,
    contentWidth,
    ensureSpace,
    colWidths: [contentWidth * 0.6, contentWidth * 0.4],
  });

  doc.addPage();
  y = contentTop;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(10);
  t("Impayés clients", contentLeft, y, { width: contentWidth });
  y += 12;
  const impVentesRows = (d.impayesVentes || []).map((v) => [
    v.client?.nom || "—",
    v.reference || "—",
    fmtMoney(v.montantDu),
    v.dateLivraison ? fmtDate(v.dateLivraison) : "—",
  ]);
  y = drawTable(doc, {
    headers: ["Client", "Facture", "Montant dû", "Date livraison"],
    rows: impVentesRows.length ? impVentesRows : [["—", "—", "—", "—"]],
    startY: y,
    accentHex: accent,
    contentLeft,
    contentWidth,
    ensureSpace,
    colWidths: [contentWidth * 0.3, contentWidth * 0.22, contentWidth * 0.24, contentWidth * 0.24],
  });
  y += 16;

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(10);
  t("Impayés fournisseurs", contentLeft, y, { width: contentWidth });
  y += 12;
  const impAchatsRows = (d.impayesAchats || []).map((a) => [
    a.fournisseur?.nom || "—",
    a.reference || "—",
    fmtMoney(a.montantDu),
    a.echeance ? fmtDate(a.echeance) : "—",
  ]);
  drawTable(doc, {
    headers: ["Fournisseur", "Facture", "Montant dû", "Date d'échéance"],
    rows: impAchatsRows.length ? impAchatsRows : [["—", "—", "—", "—"]],
    startY: y,
    accentHex: accent,
    contentLeft,
    contentWidth,
    ensureSpace,
    colWidths: [contentWidth * 0.3, contentWidth * 0.22, contentWidth * 0.24, contentWidth * 0.24],
  });

  return endPdfBuffer(doc, finishFootersAndHeaders);
}

async function generateTabularExportPdf({ title, societe, headers, rows, refPrefix = "EXP", layout = "landscape" }) {
  const accent = societeAccent(societe);
  const ctx = createBaseDoc(title, societe, { refPrefix, layout });
  const { doc, contentTop, contentLeft, contentWidth, finishFootersAndHeaders, ensureSpace } = ctx;

  let y = contentTop;
  y = drawDocTitle(doc, {
    x: contentLeft,
    y,
    width: contentWidth,
    label: String(title || "EXPORT").toUpperCase(),
    accentHex: accent,
  });

  const colW = headers.map(() => contentWidth / headers.length);
  drawTable(doc, {
    headers,
    rows: rows.length ? rows : [headers.map(() => "—")],
    startY: y,
    colWidths: colW,
    accentHex: accent,
    contentLeft,
    contentWidth,
    ensureSpace,
  });

  return endPdfBuffer(doc, finishFootersAndHeaders);
}

module.exports = {
  createBaseDoc,
  drawTable,
  drawTotalsBlock,
  drawKpiRow,
  drawDocTitle,
  drawMetaStrip,
  drawPartyCards,
  drawSignatureRow,
  drawRoundedRect,
  absText,
  endPdfBuffer,
  fmtDate,
  fmtMoney,
  buildReportRef,
  generateInventairePdf,
  generateRapportPdf,
  generateTabularExportPdf,
  societeAccent,
  ACCENT,
  ACCENT_RGB,
  INK,
  SLATE,
  BORDER,
  LIGHT_BG,
  WHITE,
  SUCCESS,
  DANGER,
  SOFT_ACCENT,
};
