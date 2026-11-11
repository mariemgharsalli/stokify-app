const ExcelJS = require("exceljs");
const { resolveLogoAsset } = require("./logoLoader");

const DEFAULT_ACCENT = "1D9E75";
const ZEBRA_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
const RED_FONT = { color: { argb: "FFE24B4A" } };
const GREEN_FONT = { color: { argb: "FF1D9E75" } };

const VALUATION_METHOD_COLORS = {
  CMP: "1D9E75",
  FIFO: "378ADD",
  LIFO: "BA7517",
  DERNIER_PRIX_ACHAT: "7F77DD",
  COUT_STOCKAGE: "378ADD",
  PAHT: "64748B",
  PVHT: "64748B",
};

const NUM_FMT_QTY = "#,##0.000";
const NUM_FMT_MONEY = '#,##0.000 "TND"';
const NUM_FMT_PCT = "#,##0.0";
const NUM_FMT_PCT_DISPLAY = '0.00"\u00A0%"';
const NUM_FMT_PCT_ROTATION = '0.0"\u00A0%"';
const FINANCIAL_ACCENT = "378ADD";
const COUT_ACCENT = "378ADD";
const LOGO_WIDTH = 48;
const LOGO_HEIGHT = 48;
const LOGO_BANNER_ROW_HEIGHT = 54;
const NUM_FMT_PART_PCT = "0.0%";

const LIGHT_RED_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEAEA" } };
const AMBER_FONT = { color: { argb: "FFBA7517" } };

const TRANCHE_COLORS = {
  ">90j": RED_FONT,
  "60-90j": AMBER_FONT,
  "30-60j": GREEN_FONT,
};

const DATA_BORDER = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

function hexToArgb(hex) {
  const h = String(hex || DEFAULT_ACCENT).replace("#", "");
  return h.length === 8 ? h : `FF${h.slice(0, 6)}`;
}

function tintArgb(argb, factor = 0.92) {
  const hex = argb.replace(/^FF/i, "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const mix = (c) => Math.round(c + (255 - c) * factor);
  const toHex = (n) => n.toString(16).padStart(2, "0").toUpperCase();
  return `FF${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

function colToLetter(col) {
  let n = col;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || "A";
}

function accentForMethode(methode) {
  return VALUATION_METHOD_COLORS[String(methode || "CMP").toUpperCase()] || DEFAULT_ACCENT;
}

function fontForMethode(methode) {
  const hex = accentForMethode(methode);
  return { color: { argb: hexToArgb(hex) } };
}

function fontForTranche(tranche) {
  return TRANCHE_COLORS[String(tranche || "")] || null;
}

function rotationTauxRules() {
  return [
    { columnKey: "taux", test: (v) => Number(v) < 20, font: RED_FONT },
    { columnKey: "taux", test: (v) => Number(v) > 100, font: GREEN_FONT },
  ];
}

function styleHeaderRow(row, accentColor = DEFAULT_ACCENT) {
  const fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: hexToArgb(accentColor) },
  };
  row.eachCell((cell) => {
    cell.fill = fill;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  row.height = 22;
}

function resolveRowValues(rowData, columns) {
  return columns.map((col, i) => {
    if (Array.isArray(rowData)) return rowData[i] ?? "";
    if (rowData && typeof rowData === "object") return rowData[col.key] ?? "";
    return "";
  });
}

function applyColumnFormats(row, columns, rowData) {
  columns.forEach((col, i) => {
    const cell = row.getCell(i + 1);
    const rowFmt = rowData?.cellFormats?.[col.key];
    const fmt = rowFmt || col.numFmt;
    if (fmt && typeof cell.value === "number") {
      cell.numFmt = fmt;
    }
    if (col.alignment) {
      cell.alignment = col.alignment;
    }
  });
}

function applyDataBorders(row, colCount) {
  for (let i = 1; i <= colCount; i += 1) {
    row.getCell(i).border = DATA_BORDER;
  }
}

function applyConditionalRules(row, columns, rowData, rules) {
  for (const rule of rules) {
    let colIdx = rule.col;
    if (!colIdx && rule.columnKey) {
      colIdx = columns.findIndex((c) => c.key === rule.columnKey) + 1;
    }
    if (!colIdx || colIdx < 1) continue;
    const cell = row.getCell(colIdx);
    const testFn = rule.test || rule.when;
    if (typeof testFn === "function" && testFn(cell.value, rowData, cell)) {
      if (rule.applyToRow) {
        row.eachCell((c) => {
          if (rule.font) c.font = { ...(c.font || {}), ...rule.font };
          if (rule.fill) c.fill = rule.fill;
        });
      } else {
        if (rule.font) cell.font = { ...(cell.font || {}), ...rule.font };
        if (rule.fill) cell.fill = rule.fill;
      }
    }
  }
}

function autoFitColumns(ws, columns, headerRowNum) {
  columns.forEach((col, i) => {
    let maxLen = String(col.header || "").length;
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber < headerRowNum) return;
      const val = row.getCell(i + 1).value;
      if (val == null || val === "") return;
      maxLen = Math.max(maxLen, String(val).length);
    });
    ws.getColumn(i + 1).width = Math.min(48, Math.max(col.minWidth || 10, maxLen + 2));
  });
}

function applyRowStyles(row, columns, rowData) {
  if (!rowData?.rowStyles) return;
  for (const [key, style] of Object.entries(rowData.rowStyles)) {
    const idx = columns.findIndex((c) => c.key === key) + 1;
    if (idx < 1) continue;
    const cell = row.getCell(idx);
    if (style.font) cell.font = { ...(cell.font || {}), ...style.font };
    if (style.fill) cell.fill = style.fill;
  }
}

function addReportHeader(wb, ws, { societeName, societeLogo, title, subtitle, accentColor, colCount }) {
  const accentArgb = hexToArgb(accentColor || DEFAULT_ACCENT);
  const endLetter = colToLetter(Math.max(colCount, 2));
  const bannerText = societeName ? `${societeName} — ${title}` : title;
  const textStartCol = "A";
  const textEndLetter = endLetter;

  ws.getRow(1).height = LOGO_BANNER_ROW_HEIGHT;
  const hasLogo = tryAddLogo(wb, ws, societeLogo);

  if (hasLogo && colCount > 1) {
    ws.mergeCells(`B1:${endLetter}1`);
    const bannerCell = ws.getCell("B1");
    bannerCell.value = bannerText;
    bannerCell.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
    bannerCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  } else {
    ws.mergeCells(`${textStartCol}1:${textEndLetter}1`);
    const bannerCell = ws.getCell(`${textStartCol}1`);
    bannerCell.value = bannerText;
    bannerCell.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
    bannerCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    if (!hasLogo) {
      bannerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tintArgb(accentArgb, 0.95) } };
    }
  }

  let headerRowNum = 2;
  if (subtitle) {
    if (hasLogo && colCount > 1) {
      ws.mergeCells(`B2:${endLetter}2`);
      const subCell = ws.getCell("B2");
      subCell.value = subtitle;
      subCell.font = { size: 10, color: { argb: "FF64748B" } };
      subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    } else {
      ws.mergeCells(`A2:${endLetter}2`);
      const subCell = ws.getCell("A2");
      subCell.value = subtitle;
      subCell.font = { size: 10, color: { argb: "FF64748B" } };
      subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    }
    headerRowNum = 3;
  }

  return { headerRowNum, endLetter, accentArgb, hasLogo };
}

function tryAddLogo(wb, ws, societeLogo) {
  const asset = resolveLogoAsset(societeLogo);
  if (!asset?.path && !asset?.buffer) return false;
  try {
    const extension =
      asset.extension ||
      (asset.buffer ? extensionFromBuffer(asset.buffer) : "png");
    const imageOpts = asset.path
      ? { filename: asset.path, extension }
      : { buffer: asset.buffer, extension };
    const imageId = wb.addImage(imageOpts);
    ws.addImage(imageId, {
      tl: { col: 0.1, row: 0.08 },
      ext: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
      editAs: "oneCell",
    });
    ws.getColumn(1).width = 9;
    ws.getRow(1).height = LOGO_BANNER_ROW_HEIGHT;
    if (ws.getRow(2)) ws.getRow(2).height = 20;
    return true;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[excelHelper] logo ignoré:", err.message);
    }
    return false;
  }
}

function extensionFromBuffer(buf) {
  if (!buf || buf.length < 4) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  return "png";
}

function fmtExcelDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}

function periodeLabelFrom(periode) {
  if (!periode?.debut || !periode?.fin) return "—";
  return `${new Date(periode.debut).toLocaleDateString("fr-FR")} — ${new Date(periode.fin).toLocaleDateString("fr-FR")}`;
}

function moneySynthRow(label, value, numFmt = NUM_FMT_MONEY) {
  return { label, value: Number(value || 0), cellFormats: { value: numFmt } };
}

function pctSynthRow(label, value) {
  return { label, value: Number(value || 0), cellFormats: { value: NUM_FMT_PCT_DISPLAY } };
}

const EMPTY_PERIOD_MSG = "Aucune donnée sur cette période";

function emptySheetRow(columns, message = EMPTY_PERIOD_MSG) {
  const row = {};
  columns.forEach((col, i) => {
    row[col.key] = i === 0 ? message : "";
  });
  return row;
}

function applyColumnDataBar(ws, columnIndex, headerRowNum, colorArgb = "FF378ADD") {
  const lastRow = ws.lastRow?.number || headerRowNum;
  if (lastRow <= headerRowNum || columnIndex < 1) return;
  const colLetter = colToLetter(columnIndex);
  ws.addConditionalFormatting({
    ref: `${colLetter}${headerRowNum + 1}:${colLetter}${lastRow}`,
    rules: [
      {
        type: "dataBar",
        priority: 1,
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: colorArgb },
      },
    ],
  });
}

/**
 * Construit un classeur Excel stylisé (titre, en-têtes colorés, zebra, filtres, formats numériques).
 * @param {object} options
 * @param {ExcelJS.Workbook} [existingWb]
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function buildStyledWorkbook(options, existingWb = null) {
  const {
    title,
    subtitle,
    societeName,
    societeLogo,
    accentColor = DEFAULT_ACCENT,
    sheetName = "Export",
    columns,
    rows = [],
    summaryRows = [],
    conditionalRules = [],
    dataBorders = false,
  } = options;

  const wb = existingWb || new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  const colCount = Math.max(columns.length, 1);
  const accentArgb = hexToArgb(accentColor);
  const summaryFill = { type: "pattern", pattern: "solid", fgColor: { argb: tintArgb(accentArgb) } };

  addReportHeader(wb, ws, {
    societeName,
    societeLogo,
    title,
    subtitle,
    accentColor,
    colCount,
  });

  ws.addRow([]);
  const headerRow = ws.addRow(columns.map((c) => c.header));
  const headerRowNum = headerRow.number;
  styleHeaderRow(headerRow, accentColor);
  if (dataBorders) applyDataBorders(headerRow, colCount);

  ws.columns = columns.map((col, i) => ({
    key: col.key || `col${i}`,
    width: col.width || 14,
  }));

  let dataRowIndex = 0;
  for (const rowData of rows) {
    const row = ws.addRow(resolveRowValues(rowData, columns));
    applyColumnFormats(row, columns, rowData);

    if (dataRowIndex % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = ZEBRA_FILL;
      });
    }

    if (dataBorders) applyDataBorders(row, colCount);
    applyConditionalRules(row, columns, rowData, conditionalRules);
    applyRowStyles(row, columns, rowData);
    dataRowIndex += 1;
  }

  if (summaryRows.length) {
    ws.addRow([]);
    for (const sumRow of summaryRows) {
      const values = Array.isArray(sumRow)
        ? sumRow
        : columns.map((col, i) => {
            if (i === 0) return sumRow.label ?? "";
            return sumRow.values?.[col.key] ?? sumRow.values?.[i - 1] ?? "";
          });
      const row = ws.addRow(values);
      row.eachCell((cell) => {
        cell.font = { bold: true, ...(cell.font || {}) };
        cell.fill = summaryFill;
      });
      applyColumnFormats(row, columns, sumRow);
      applyRowStyles(row, columns, sumRow);
      if (dataBorders) applyDataBorders(row, colCount);
    }
  }

  const lastRowNum = ws.lastRow.number;
  ws.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: lastRowNum, column: colCount },
  };
  ws.views = [{ state: "frozen", ySplit: headerRowNum, activeCell: `A${headerRowNum + 1}` }];
  ws.__headerRowNum = headerRowNum;

  autoFitColumns(ws, columns, headerRowNum);
  return wb;
}

/**
 * @param {{ reference: string, date: Date|string, depot?: { code?: string, libelle?: string }, summary?: object, societe?: { nom?: string, logo?: string } }} inventaire
 * @param {Array} lignes
 */
async function generateInventaireExcel(inventaire, lignes) {
  const columns = [
    { header: "Article", key: "article", minWidth: 32 },
    { header: "Stock théorique", key: "stockTheorique", numFmt: NUM_FMT_QTY, alignment: { horizontal: "right" } },
    { header: "Stock réel", key: "stockReel", numFmt: NUM_FMT_QTY, alignment: { horizontal: "right" } },
    { header: "Écart", key: "ecart", numFmt: NUM_FMT_QTY, alignment: { horizontal: "right" } },
    { header: "Valeur écart (TND)", key: "valeurEcart", numFmt: NUM_FMT_MONEY, alignment: { horizontal: "right" } },
  ];

  const rows = lignes.map((l) => {
    const ecart = l.ecart != null ? Number(l.ecart) : null;
    return {
      article: l.article ? `${l.article.code} — ${l.article.libelle}` : "—",
      stockTheorique: Number(l.qteTheorique ?? 0),
      stockReel: l.qteReelle != null ? Number(l.qteReelle) : "",
      ecart: ecart != null ? ecart : "",
      valeurEcart: l.valeurEcart != null ? Number(l.valeurEcart) : "",
    };
  });

  const summaryRows = inventaire.summary
    ? [
        { label: "Récap", values: {} },
        { label: "Articles comptés", values: { article: inventaire.summary.saisis ?? inventaire.summary.totalLignes ?? "" } },
        { label: "Écarts positifs/négatifs", values: { article: inventaire.summary.ecarts ?? "" } },
        {
          label: "Valeur ajustement (TND)",
          values: { article: inventaire.summary.valeurEcart != null ? Number(inventaire.summary.valeurEcart) : "" },
        },
      ]
    : [];

  const dateStr = new Date(inventaire.date).toLocaleDateString("fr-FR");
  const depotStr = inventaire.depot
    ? `Dépôt : ${inventaire.depot.code || ""} — ${inventaire.depot.libelle || ""}`
    : null;

  const wb = await buildStyledWorkbook({
    title: `Inventaire ${inventaire.reference} — ${dateStr}`,
    subtitle: depotStr || undefined,
    societeName: inventaire.societe?.nom,
    societeLogo: inventaire.societe?.logo,
    accentColor: DEFAULT_ACCENT,
    sheetName: "Inventaire",
    columns,
    rows,
    summaryRows,
    conditionalRules: [
      {
        columnKey: "ecart",
        test: (v) => v !== "" && v != null && Math.abs(Number(v)) >= 1e-9,
        font: RED_FONT,
      },
    ],
  });

  return wb.xlsx.writeBuffer();
}

async function generateInventairesListExcel(items) {
  const columns = [
    { header: "Référence", key: "reference", minWidth: 22 },
    { header: "Date", key: "date", minWidth: 14 },
    { header: "Dépôt", key: "depot", minWidth: 16 },
    { header: "Statut", key: "statut", minWidth: 12 },
    { header: "Lignes", key: "lignes", minWidth: 10, alignment: { horizontal: "right" } },
    { header: "Écarts", key: "ecarts", minWidth: 10, alignment: { horizontal: "right" } },
    { header: "Valeur écart (TND)", key: "valeurEcart", numFmt: NUM_FMT_MONEY, minWidth: 18, alignment: { horizontal: "right" } },
  ];

  const rows = (items || []).map((inv) => ({
    reference: inv.reference,
    date: new Date(inv.date).toLocaleDateString("fr-FR"),
    depot: inv.depot?.code || "",
    statut: inv.statut,
    lignes: inv.summary?.totalLignes ?? inv._count?.lignes ?? "",
    ecarts: inv.summary?.ecarts ?? "",
    valeurEcart: inv.summary?.valeurEcart != null ? Number(inv.summary.valeurEcart) : "",
  }));

  const wb = await buildStyledWorkbook({
    title: "Liste des inventaires",
    accentColor: DEFAULT_ACCENT,
    sheetName: "Inventaires",
    columns,
    rows,
  });

  return wb.xlsx.writeBuffer();
}

async function generateRapportExcel({ societe, dashboard }) {
  const d = dashboard || {};
  const periodeLabel = periodeLabelFrom(d.periode);
  const branding = {
    societeName: societe?.nom,
    societeLogo: societe?.logo,
    accentColor: FINANCIAL_ACCENT,
    dataBorders: true,
  };

  const synthColumns = [
    { header: "Indicateur", key: "label", minWidth: 32 },
    { header: "Valeur", key: "value", minWidth: 22, alignment: { horizontal: "right" } },
  ];
  const synthRows = [
    moneySynthRow("Ventes du mois (TTC)", d.ventesMois),
    moneySynthRow("Achats du mois (TTC)", d.achatsMois),
    moneySynthRow("Solde (Ventes − Achats)", d.solde),
    pctSynthRow("Marge brute (%)", d.margePct),
    moneySynthRow("Montant encaissé", d.encaisse),
    pctSynthRow("Taux de recouvrement (%)", d.tauxRecouvrement),
    moneySynthRow("Total créances clients", d.impayesClients),
    moneySynthRow("Total dettes fournisseurs", d.dettesFournisseurs),
    moneySynthRow("Payé fournisseurs", d.paye),
  ];

  const evolutionColumns = [
    { header: "Mois", key: "mois", minWidth: 16 },
    { header: "Achats", key: "achats", numFmt: NUM_FMT_MONEY, minWidth: 16, alignment: { horizontal: "right" } },
    { header: "Ventes", key: "ventes", numFmt: NUM_FMT_MONEY, minWidth: 16, alignment: { horizontal: "right" } },
    { header: "Solde", key: "solde", numFmt: NUM_FMT_MONEY, minWidth: 16, alignment: { horizontal: "right" } },
  ];
  const evolutionRows = (d.chartData || []).map((row) => {
    const solde = Number(row.solde ?? 0);
    return {
      mois: row.mois || "—",
      achats: Number(row.achats ?? 0),
      ventes: Number(row.ventes ?? 0),
      solde,
      cellFormats: { achats: NUM_FMT_MONEY, ventes: NUM_FMT_MONEY, solde: NUM_FMT_MONEY },
      rowStyles: { solde: { font: solde >= 0 ? GREEN_FONT : RED_FONT } },
    };
  });

  const topClientColumns = [
    { header: "Client", key: "nom", minWidth: 34 },
    { header: "CA (TND)", key: "ca", numFmt: NUM_FMT_MONEY, minWidth: 18, alignment: { horizontal: "right" } },
  ];
  const topClientRows = [...(d.topClients || [])]
    .sort((a, b) => Number(b.ca || 0) - Number(a.ca || 0))
    .map((c) => ({
      nom: c.nom || "—",
      ca: Number(c.ca ?? 0),
      cellFormats: { ca: NUM_FMT_MONEY },
    }));

  const topFournisseurColumns = [
    { header: "Fournisseur", key: "nom", minWidth: 34 },
    { header: "Total (TND)", key: "total", numFmt: NUM_FMT_MONEY, minWidth: 18, alignment: { horizontal: "right" } },
  ];
  const topFournisseurRows = [...(d.topFournisseurs || [])]
    .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
    .map((f) => ({
      nom: f.nom || "—",
      total: Number(f.total ?? 0),
      cellFormats: { total: NUM_FMT_MONEY },
    }));

  const impayeClientColumns = [
    { header: "Client", key: "client", minWidth: 28 },
    { header: "Facture", key: "facture", minWidth: 18 },
    { header: "Montant dû", key: "montantDu", numFmt: NUM_FMT_MONEY, minWidth: 16, alignment: { horizontal: "right" } },
    { header: "Date livraison", key: "dateLivraison", minWidth: 16 },
  ];
  const impayeClientRows = (d.impayesVentes || []).map((v) => ({
    client: v.client?.nom || "—",
    facture: v.reference || "—",
    montantDu: Number(v.montantDu ?? 0),
    dateLivraison: fmtExcelDate(v.dateLivraison),
    cellFormats: { montantDu: NUM_FMT_MONEY },
  }));

  const impayeFournisseurColumns = [
    { header: "Fournisseur", key: "fournisseur", minWidth: 28 },
    { header: "Facture", key: "facture", minWidth: 18 },
    { header: "Montant dû", key: "montantDu", numFmt: NUM_FMT_MONEY, minWidth: 16, alignment: { horizontal: "right" } },
    { header: "Date d'échéance", key: "dateEcheance", minWidth: 16 },
  ];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const impayeFournisseurRows = (d.impayesAchats || []).map((a) => {
    const echeance = a.echeance ? new Date(a.echeance) : null;
    const enRetard = Boolean(echeance && echeance < today);
    return {
      fournisseur: a.fournisseur?.nom || "—",
      facture: a.reference || "—",
      montantDu: Number(a.montantDu ?? 0),
      dateEcheance: fmtExcelDate(a.echeance),
      cellFormats: { montantDu: NUM_FMT_MONEY },
      __enRetard: enRetard,
    };
  });

  let wb = await buildStyledWorkbook({
    title: "Synthèse comptable",
    subtitle: `Période : ${periodeLabel}`,
    ...branding,
    sheetName: "Synthèse",
    columns: synthColumns,
    rows: synthRows,
  });

  wb = await buildStyledWorkbook(
    {
      title: "Évolution 6 mois",
      subtitle: `Flux achats / ventes — ${periodeLabel}`,
      ...branding,
      sheetName: "Évolution 6 mois",
      columns: evolutionColumns,
      rows: evolutionRows.length ? evolutionRows : [emptySheetRow(evolutionColumns)],
    },
    wb
  );

  wb = await buildStyledWorkbook(
    {
      title: "Top clients",
      subtitle: `Classement CA — ${topClientRows.length} client(s)`,
      ...branding,
      sheetName: "Top clients",
      columns: topClientColumns,
      rows: topClientRows.length ? topClientRows : [emptySheetRow(topClientColumns)],
    },
    wb
  );

  wb = await buildStyledWorkbook(
    {
      title: "Top fournisseurs",
      subtitle: `Classement achats — ${topFournisseurRows.length} fournisseur(s)`,
      ...branding,
      sheetName: "Top fournisseurs",
      columns: topFournisseurColumns,
      rows: topFournisseurRows.length ? topFournisseurRows : [emptySheetRow(topFournisseurColumns)],
    },
    wb
  );

  wb = await buildStyledWorkbook(
    {
      title: "Impayés clients",
      subtitle: `${impayeClientRows.length} créance(s) en attente`,
      ...branding,
      sheetName: "Impayés clients",
      columns: impayeClientColumns,
      rows: impayeClientRows.length ? impayeClientRows : [emptySheetRow(impayeClientColumns)],
    },
    wb
  );

  wb = await buildStyledWorkbook(
    {
      title: "Impayés fournisseurs",
      subtitle: `${impayeFournisseurRows.length} dette(s) en attente`,
      ...branding,
      sheetName: "Impayés fournisseurs",
      columns: impayeFournisseurColumns,
      rows: impayeFournisseurRows.length ? impayeFournisseurRows : [emptySheetRow(impayeFournisseurColumns)],
      conditionalRules: [
        {
          applyToRow: true,
          test: (_v, rowData) => Boolean(rowData.__enRetard),
          fill: LIGHT_RED_FILL,
        },
      ],
    },
    wb
  );

  return wb.xlsx.writeBuffer();
}

/**
 * Export valorisation multi-feuilles.
 */
async function generateValuationExcel({ societe, methode, depotLabel, lignes, valeurTotale, methodTotals }) {
  const accent = accentForMethode(methode);
  const subtitle = `Dépôt : ${depotLabel || "Tous"} — Méthode : ${methode}`;
  const branding = {
    societeName: societe?.nom,
    societeLogo: societe?.logo,
    accentColor: accent,
    dataBorders: true,
  };

  let wb = await buildStyledWorkbook({
    title: "Rapport de valorisation",
    subtitle,
    ...branding,
    sheetName: "Valorisation",
    columns: [
      { header: "Article", key: "articleLibelle", minWidth: 28 },
      { header: "Code", key: "articleCode", minWidth: 14 },
      { header: "Dépôt", key: "depotCode", minWidth: 12 },
      { header: "Quantité", key: "quantite", numFmt: NUM_FMT_QTY, alignment: { horizontal: "right" } },
      { header: "Prix unitaire", key: "prixUnitaire", numFmt: NUM_FMT_MONEY, alignment: { horizontal: "right" } },
      { header: "Valeur", key: "valeur", numFmt: NUM_FMT_MONEY, alignment: { horizontal: "right" } },
    ],
    rows: lignes,
    summaryRows: [
      {
        label: "Total",
        values: { valeur: Number(valeurTotale || 0) },
      },
    ],
  });

  const byCat = {};
  for (const l of lignes) {
    const key = l.articleCode?.slice(0, 2) || "XX";
    byCat[key] = (byCat[key] || 0) + Number(l.valeur || 0);
  }
  wb = await buildStyledWorkbook(
    {
      title: "Résumé par catégorie",
      subtitle,
      ...branding,
      sheetName: "Résumé catégories",
      columns: [
        { header: "Catégorie", key: "categorie", minWidth: 16 },
        { header: "Valeur totale", key: "valeur", numFmt: NUM_FMT_MONEY, alignment: { horizontal: "right" } },
      ],
      rows: Object.entries(byCat).map(([cat, val]) => ({ categorie: cat, valeur: Number(val) })),
    },
    wb
  );

  wb = await buildStyledWorkbook(
    {
      title: "Comparaison des méthodes",
      subtitle,
      ...branding,
      sheetName: "Comparaison méthodes",
      columns: [
        { header: "Méthode", key: "methode", minWidth: 22 },
        { header: "Valeur totale", key: "valeurTotale", numFmt: NUM_FMT_MONEY, minWidth: 18, alignment: { horizontal: "right" } },
      ],
      rows: (methodTotals || []).map((m) => {
        const methodeKey = String(m.methode || "");
        const methodFont = fontForMethode(methodeKey);
        return {
          methode: methodeKey,
          valeurTotale: Number(m.valeurTotale || 0),
          rowStyles: {
            methode: { font: { bold: true, ...methodFont } },
            valeurTotale: { font: methodFont },
          },
        };
      }),
    },
    wb
  );

  return wb.xlsx.writeBuffer();
}

/**
 * Export rapport rotation stock (style de référence Stokify).
 * @param {object|*} reportOrOpts - Rapport ou { societe, report, depotLabel, periodeLabel }
 */
async function generateRotationExcel(reportOrOpts, depotLabel, periodeLabel, societeName, societeLogo) {
  let societe;
  let report;
  let depot;
  let periode;

  if (reportOrOpts && typeof reportOrOpts === "object" && reportOrOpts.report) {
    ({ societe, report, depotLabel: depot, periodeLabel: periode } = reportOrOpts);
  } else {
    report = reportOrOpts;
    depot = depotLabel ?? "Tous";
    periode = periodeLabel ?? "—";
    societe = { nom: societeName, logo: societeLogo };
  }

  const summary = report?.summary || {};
  const subtitle = `Dépôt : ${depot} — Période : ${periode}`;
  const branding = {
    societeName: societe?.nom || societeName,
    societeLogo: societe?.logo || societeLogo,
    accentColor: DEFAULT_ACCENT,
    dataBorders: true,
  };

  let wb = await buildStyledWorkbook({
    title: "Rapport de rotation",
    subtitle,
    ...branding,
    sheetName: "Rotation",
    columns: [
      { header: "Article", key: "article", minWidth: 32 },
      { header: "Code", key: "code", minWidth: 14 },
      { header: "Dépôt", key: "depot", minWidth: 14 },
      { header: "Stock moyen", key: "stockMoyen", numFmt: NUM_FMT_QTY, minWidth: 14, alignment: { horizontal: "right" } },
      { header: "Qté vendue", key: "qteVendue", numFmt: NUM_FMT_QTY, minWidth: 14, alignment: { horizontal: "right" } },
      { header: "Taux rotation (%)", key: "taux", numFmt: NUM_FMT_PCT_ROTATION, minWidth: 16, alignment: { horizontal: "right" } },
      { header: "Recommandation", key: "recommandation", minWidth: 32 },
    ],
    rows: (report?.items || []).map((r) => ({
      article: r.article?.libelle || "",
      code: r.article?.code || "",
      depot: r.depot?.code || "",
      stockMoyen: Number(r.stockMoyen || 0),
      qteVendue: Number(r.qteVendue || 0),
      taux: Number(r.taux || 0),
      recommandation: r.recommandation || "",
    })),
    conditionalRules: rotationTauxRules(),
  });

  wb = await buildStyledWorkbook(
    {
      title: "Résumé",
      subtitle,
      ...branding,
      sheetName: "Résumé",
      columns: [
        { header: "Indicateur", key: "label", minWidth: 28 },
        { header: "Valeur", key: "value", minWidth: 20, alignment: { horizontal: "right" } },
      ],
      rows: [
        { label: "Dépôt", value: depot },
        { label: "Période", value: periode },
        {
          label: "Rotation moyenne (%)",
          value: Number(summary.rotationMoyenne || 0),
          cellFormats: { value: NUM_FMT_PCT_ROTATION },
        },
        { label: "Articles forte rotation", value: Number(summary.articlesForteRotation || 0) },
        { label: "Articles faible rotation", value: Number(summary.articlesFaibleRotation || 0) },
      ],
    },
    wb
  );

  return wb.xlsx.writeBuffer();
}

/**
 * Export rapport stock dormant.
 */
async function generateDeadStockExcel({ societe, report, depotLabel }) {
  const s = report?.summary || {};
  const subtitle = `Dépôt : ${depotLabel || "Tous"} — Seuil : ${report?.seuil ?? 90} jours`;
  const brandingMain = {
    societeName: societe?.nom,
    societeLogo: societe?.logo,
    accentColor: "E24B4A",
    dataBorders: true,
  };

  let wb = await buildStyledWorkbook({
    title: "Rapport stock dormant",
    subtitle,
    ...brandingMain,
    sheetName: "Stock dormant",
    columns: [
      { header: "Article", key: "article", minWidth: 32 },
      { header: "Code", key: "code", minWidth: 14 },
      { header: "Famille", key: "famille", minWidth: 18 },
      { header: "Dépôt", key: "depot", minWidth: 14 },
      { header: "Quantité", key: "quantite", numFmt: NUM_FMT_QTY, minWidth: 12, alignment: { horizontal: "right" } },
      { header: "Dernier mouvement", key: "dateLastMvt", minWidth: 18 },
      { header: "Jours immobile", key: "jours", minWidth: 14, alignment: { horizontal: "right" } },
      { header: "Tranche", key: "tranche", minWidth: 12 },
      { header: "Valeur stock", key: "valeurStock", numFmt: NUM_FMT_MONEY, minWidth: 16, alignment: { horizontal: "right" } },
      { header: "Coût détention/mois", key: "coutDetentionMois", numFmt: NUM_FMT_MONEY, minWidth: 18, alignment: { horizontal: "right" } },
      { header: "Recommandation", key: "recommandation", minWidth: 32 },
    ],
    rows: (report?.items || []).map((r) => {
      const tranche = r.tranche || "";
      const trancheFont = fontForTranche(tranche);
      const rowStyles = trancheFont
        ? { jours: { font: trancheFont }, tranche: { font: { bold: true, ...trancheFont } } }
        : undefined;
      return {
        article: r.article?.libelle || "",
        code: r.code || r.article?.code || "",
        famille: r.famille || "—",
        depot: r.depot?.code || "",
        quantite: Number(r.quantite || 0),
        dateLastMvt: r.dateLastMvt ? new Date(r.dateLastMvt).toISOString().slice(0, 10) : "",
        jours: Number(r.joursImmobilise || 0),
        tranche,
        valeurStock: Number(r.valeurStock || 0),
        coutDetentionMois: Number(r.coutDetentionMois || 0),
        recommandation: r.recommandation || "",
        rowStyles,
      };
    }),
  });

  wb = await buildStyledWorkbook(
    {
      title: "Résumé",
      subtitle,
      societeName: societe?.nom,
      societeLogo: societe?.logo,
      accentColor: "BA7517",
      dataBorders: true,
      sheetName: "Résumé",
      columns: [
        { header: "Indicateur", key: "label", minWidth: 28 },
        { header: "Valeur", key: "value", minWidth: 20, alignment: { horizontal: "right" } },
      ],
      rows: [
        { label: "Dépôt", value: depotLabel || "Tous" },
        { label: "Seuil (jours)", value: Number(report?.seuil || 0) },
        {
          label: "Valeur immobilisée",
          value: Number(s.totalValeurImmobilisee || 0),
          cellFormats: { value: NUM_FMT_MONEY },
        },
        {
          label: "Coût mensuel total",
          value: Number(s.totalCoutMensuel || 0),
          cellFormats: { value: NUM_FMT_MONEY },
        },
        { label: "Nb articles", value: Number(s.nbArticles || 0) },
        { label: "> 90j", value: Number(s.tranches?.[">90j"] || 0), rowStyles: { value: { font: RED_FONT } } },
        { label: "60-90j", value: Number(s.tranches?.["60-90j"] || 0), rowStyles: { value: { font: AMBER_FONT } } },
        { label: "30-60j", value: Number(s.tranches?.["30-60j"] || 0), rowStyles: { value: { font: GREEN_FONT } } },
      ],
    },
    wb
  );

  return wb.xlsx.writeBuffer();
}

const CATEGORY_LABELS = {
  STOCKAGE: "Stockage",
  LOGISTIQUE: "Logistique",
  MANUTENTION: "Manutention",
  AUTRE: "Autre",
};

/**
 * Export coûts de stockage (feuilles détail + résumé).
 */
async function generateCoutStockageExcel({ societe, periodeLabel, depotLabel, entries, unitCosts, deadStock }) {
  const subtitle = `Dépôt : ${depotLabel || "Tous"} — Période : ${periodeLabel || "—"}`;
  const branding = {
    societeName: societe?.nom,
    societeLogo: societe?.logo,
    accentColor: COUT_ACCENT,
    dataBorders: true,
  };
  const entryRows = entries || [];
  const totalCouts = entryRows.reduce((s, e) => s + Number(e.montant || 0), 0);
  const deadItems = deadStock?.items || [];

  let wb = await buildStyledWorkbook({
    title: "Rapport des coûts de stockage",
    subtitle,
    ...branding,
    sheetName: "Coûts détaillés",
    columns: [
      { header: "Période", key: "periode", minWidth: 12 },
      { header: "Dépôt", key: "depot", minWidth: 14 },
      { header: "Libellé", key: "nom", minWidth: 28 },
      { header: "Catégorie", key: "categorie", minWidth: 16 },
      { header: "Montant (TND)", key: "montant", numFmt: NUM_FMT_MONEY, minWidth: 16, alignment: { horizontal: "right" } },
    ],
    rows: entryRows.map((r) => ({
      periode: r.periode || "—",
      depot: r.depot?.code || r.depotId || "—",
      nom: r.nom || "—",
      categorie: CATEGORY_LABELS[r.categorie] || r.categorie || "—",
      montant: Number(r.montant || 0),
    })),
    summaryRows: [{ label: "Total coûts", values: { montant: Number(totalCouts) }, cellFormats: { montant: NUM_FMT_MONEY } }],
  });

  wb = await buildStyledWorkbook(
    {
      title: "Coûts unitaires par article",
      subtitle,
      ...branding,
      sheetName: "Coûts unitaires",
      columns: [
        { header: "Article", key: "article", minWidth: 32 },
        { header: "Code", key: "code", minWidth: 14 },
        { header: "Dépôt", key: "depot", minWidth: 14 },
        { header: "Coût unitaire (TND)", key: "coutUnitaire", numFmt: NUM_FMT_MONEY, minWidth: 18, alignment: { horizontal: "right" } },
      ],
      rows: (unitCosts || []).map((c) => ({
        article: c.article?.libelle || "—",
        code: c.article?.code || "—",
        depot: c.depot?.code || "—",
        coutUnitaire: Number(c.coutUnitaire || 0),
      })),
    },
    wb
  );

  wb = await buildStyledWorkbook(
    {
      title: "Résumé",
      subtitle,
      ...branding,
      sheetName: "Résumé",
      columns: [
        { header: "Indicateur", key: "label", minWidth: 28 },
        { header: "Valeur", key: "value", minWidth: 20, alignment: { horizontal: "right" } },
      ],
      rows: [
        { label: "Dépôt", value: depotLabel || "Tous" },
        { label: "Période", value: periodeLabel || "—" },
        { label: "Total coûts", value: Number(totalCouts), cellFormats: { value: NUM_FMT_MONEY } },
        { label: "Lignes de coût", value: entryRows.length },
        { label: "Articles suivis", value: (unitCosts || []).length },
        {
          label: "Stock dormant (articles)",
          value: deadItems.length,
          rowStyles: deadItems.length > 5 ? { value: { font: RED_FONT } } : undefined,
        },
        {
          label: "Valeur immobilisée (dormant)",
          value: Number(deadStock?.totalValeurBloquee || 0),
          cellFormats: { value: NUM_FMT_MONEY },
        },
      ],
    },
    wb
  );

  return wb.xlsx.writeBuffer();
}

/**
 * Export liste plate stylisée (logo, en-tête coloré, filtres, nombres).
 */
async function generateFlatListExcel({
  societe,
  title,
  subtitle,
  sheetName = "Export",
  accentColor = FINANCIAL_ACCENT,
  columns,
  rows = [],
  conditionalRules = [],
}) {
  const wb = await buildStyledWorkbook({
    title,
    subtitle,
    societeName: societe?.nom,
    societeLogo: societe?.logo,
    accentColor,
    sheetName,
    columns,
    rows,
    conditionalRules,
    dataBorders: true,
  });
  return wb.xlsx.writeBuffer();
}

function articleExportRow(article) {
  const stock = Number(article.totalStock ?? 0);
  const stockMin = article.stockMin != null && article.stockMin !== "" ? Number(article.stockMin) : null;
  const lowStock = stockMin != null && Number.isFinite(stockMin) && stockMin > 0 && stock < stockMin;
  return {
    code: article.code ?? "",
    designation: article.libelle ?? "",
    famille: article.familleNom ?? article.famille?.nom ?? "",
    sousFamille: article.sousFamilleNom ?? article.sousFamille?.nom ?? "",
    marque: article.marque?.nom ?? "",
    fournisseur: article.fournisseur?.nom ?? "",
    prixUnitaire: Number(article.prixAchat ?? 0),
    prixCatalogue: Number(article.prixVente ?? 0),
    stockMin: stockMin != null ? stockMin : "",
    stock,
    rowStyles: lowStock ? { stock: { font: RED_FONT }, stockMin: { font: RED_FONT } } : undefined,
  };
}

const ARTICLE_EXPORT_COLUMNS = [
  { header: "Code", key: "code", minWidth: 14 },
  { header: "Désignation", key: "designation", minWidth: 32 },
  { header: "Famille", key: "famille", minWidth: 18 },
  { header: "Sous-famille", key: "sousFamille", minWidth: 18 },
  { header: "Marque", key: "marque", minWidth: 16 },
  { header: "Fournisseur", key: "fournisseur", minWidth: 22 },
  { header: "Prix unitaire (TND)", key: "prixUnitaire", numFmt: NUM_FMT_MONEY, minWidth: 18, alignment: { horizontal: "right" } },
  { header: "Prix catalogue (TND)", key: "prixCatalogue", numFmt: NUM_FMT_MONEY, minWidth: 18, alignment: { horizontal: "right" } },
  { header: "Stock minimum", key: "stockMin", numFmt: NUM_FMT_QTY, minWidth: 14, alignment: { horizontal: "right" } },
  { header: "Stock actuel", key: "stock", numFmt: NUM_FMT_QTY, minWidth: 14, alignment: { horizontal: "right" } },
];

async function generateArticlesExcel({ societe, items, exportedAt = new Date() }) {
  const rows = (items || []).map(articleExportRow);
  const dateStr = exportedAt.toLocaleDateString("fr-FR");
  return generateFlatListExcel({
    societe,
    title: "Export articles",
    subtitle: `Export du ${dateStr} — ${rows.length} article(s)`,
    sheetName: "Articles",
    accentColor: FINANCIAL_ACCENT,
    columns: ARTICLE_EXPORT_COLUMNS,
    rows,
    conditionalRules: [
      {
        applyToRow: true,
        test: (_v, rowData) => {
          const stock = Number(rowData.stock);
          const min = Number(rowData.stockMin);
          return Number.isFinite(min) && min > 0 && stock < min;
        },
        font: RED_FONT,
      },
    ],
  });
}

async function generateStockExcel({ societe, rows, exportedAt = new Date() }) {
  const dateStr = exportedAt.toLocaleDateString("fr-FR");
  const data = (rows || []).map((s) => ({
    articleCode: s.article?.code ?? s.articleCode ?? "",
    designation: s.article?.libelle ?? s.designation ?? "",
    unite: s.article?.unite ?? s.unite ?? "",
    depot: [s.depot?.code, s.depot?.libelle].filter(Boolean).join(" — ") || "—",
    quantite: Number(s.quantite ?? 0),
  }));
  return generateFlatListExcel({
    societe,
    title: "Export stock",
    subtitle: `Export du ${dateStr} — ${data.length} ligne(s)`,
    sheetName: "Stock",
    accentColor: FINANCIAL_ACCENT,
    columns: [
      { header: "Code article", key: "articleCode", minWidth: 14 },
      { header: "Désignation", key: "designation", minWidth: 32 },
      { header: "Unité", key: "unite", minWidth: 10 },
      { header: "Dépôt", key: "depot", minWidth: 22 },
      { header: "Quantité", key: "quantite", numFmt: NUM_FMT_QTY, minWidth: 14, alignment: { horizontal: "right" } },
    ],
    rows: data,
  });
}

function achatsColumns() {
  return [
    { header: "Référence", key: "Référence", minWidth: 16 },
    { header: "Date commande", key: "Date commande", minWidth: 16 },
    { header: "Fournisseur", key: "Fournisseur", minWidth: 22 },
    { header: "Dépôt", key: "Dépôt", minWidth: 18 },
    { header: "Statut", key: "Statut", minWidth: 12 },
    { header: "Total HT", key: "Total HT", numFmt: NUM_FMT_MONEY, minWidth: 14, alignment: { horizontal: "right" } },
    { header: "TVA", key: "TVA", numFmt: NUM_FMT_MONEY, minWidth: 12, alignment: { horizontal: "right" } },
    { header: "Total TTC", key: "Total TTC", numFmt: NUM_FMT_MONEY, minWidth: 14, alignment: { horizontal: "right" } },
    { header: "Montant réglé", key: "Montant réglé", numFmt: NUM_FMT_MONEY, minWidth: 14, alignment: { horizontal: "right" } },
    { header: "Statut paiement", key: "Statut paiement", minWidth: 16 },
    { header: "Date réception", key: "Date réception", minWidth: 16 },
    { header: "Nb lignes", key: "Nb lignes", minWidth: 10, alignment: { horizontal: "right" } },
  ];
}

async function generateAchatsExcel({ societe, rows, exportedAt = new Date() }) {
  const data = (rows || []).map((r) => ({
    ...r,
    "Total HT": Number(r["Total HT"] ?? 0),
    TVA: Number(r.TVA ?? 0),
    "Total TTC": Number(r["Total TTC"] ?? 0),
    "Montant réglé": Number(r["Montant réglé"] ?? 0),
    "Nb lignes": Number(r["Nb lignes"] ?? 0),
  }));
  return generateFlatListExcel({
    societe,
    title: "Export achats",
    subtitle: `Export du ${exportedAt.toLocaleDateString("fr-FR")} — ${data.length} achat(s)`,
    sheetName: "Achats",
    accentColor: FINANCIAL_ACCENT,
    columns: achatsColumns(),
    rows: data,
  });
}

function ventesColumns() {
  return [
    { header: "Référence", key: "Référence", minWidth: 16 },
    { header: "Date vente", key: "Date vente", minWidth: 16 },
    { header: "Client", key: "Client", minWidth: 22 },
    { header: "Dépôt", key: "Dépôt", minWidth: 18 },
    { header: "Statut", key: "Statut", minWidth: 12 },
    { header: "Mode paiement", key: "Mode paiement", minWidth: 14 },
    { header: "Total HT", key: "Total HT", numFmt: NUM_FMT_MONEY, minWidth: 14, alignment: { horizontal: "right" } },
    { header: "TVA", key: "TVA", numFmt: NUM_FMT_MONEY, minWidth: 12, alignment: { horizontal: "right" } },
    { header: "Total TTC", key: "Total TTC", numFmt: NUM_FMT_MONEY, minWidth: 14, alignment: { horizontal: "right" } },
    { header: "Montant réglé", key: "Montant réglé", numFmt: NUM_FMT_MONEY, minWidth: 14, alignment: { horizontal: "right" } },
    { header: "Solde restant", key: "Solde restant", numFmt: NUM_FMT_MONEY, minWidth: 14, alignment: { horizontal: "right" } },
    { header: "Date livraison", key: "Date livraison", minWidth: 16 },
    { header: "Nb lignes", key: "Nb lignes", minWidth: 10, alignment: { horizontal: "right" } },
  ];
}

async function generateVentesExcel({ societe, rows, exportedAt = new Date() }) {
  const data = (rows || []).map((r) => ({
    ...r,
    "Total HT": Number(r["Total HT"] ?? 0),
    TVA: Number(r.TVA ?? 0),
    "Total TTC": Number(r["Total TTC"] ?? 0),
    "Montant réglé": Number(r["Montant réglé"] ?? 0),
    "Solde restant": Number(r["Solde restant"] ?? 0),
    "Nb lignes": Number(r["Nb lignes"] ?? 0),
  }));
  return generateFlatListExcel({
    societe,
    title: "Export ventes",
    subtitle: `Export du ${exportedAt.toLocaleDateString("fr-FR")} — ${data.length} vente(s)`,
    sheetName: "Ventes",
    accentColor: FINANCIAL_ACCENT,
    columns: ventesColumns(),
    rows: data,
  });
}

async function generateMouvementsExcel({ societe, rows, exportedAt = new Date() }) {
  const data = (rows || []).map((m) => ({
    date: m.createdAt ? new Date(m.createdAt) : "",
    type: m.type || "",
    code: m.article?.code ?? "",
    designation: m.article?.libelle ?? "",
    depot: m.depot?.code ?? "",
    quantite: Number(m.quantite ?? 0),
    valeur: m.valeur != null ? Number(m.valeur) : "",
    commentaire: (m.commentaire || "").replace(/\r?\n/g, " ").slice(0, 200),
    utilisateur: m.utilisateur
      ? [m.utilisateur.prenom, m.utilisateur.nom].filter(Boolean).join(" ").trim()
      : "",
  }));
  return generateFlatListExcel({
    societe,
    title: "Export mouvements",
    subtitle: `Export du ${exportedAt.toLocaleDateString("fr-FR")} — ${data.length} mouvement(s)`,
    sheetName: "Mouvements",
    accentColor: FINANCIAL_ACCENT,
    columns: [
      { header: "Date", key: "date", minWidth: 18 },
      { header: "Type", key: "type", minWidth: 14 },
      { header: "Code", key: "code", minWidth: 12 },
      { header: "Désignation", key: "designation", minWidth: 28 },
      { header: "Dépôt", key: "depot", minWidth: 12 },
      { header: "Quantité", key: "quantite", numFmt: NUM_FMT_QTY, minWidth: 12, alignment: { horizontal: "right" } },
      { header: "Valeur (TND)", key: "valeur", numFmt: NUM_FMT_MONEY, minWidth: 14, alignment: { horizontal: "right" } },
      { header: "Commentaire", key: "commentaire", minWidth: 28 },
      { header: "Utilisateur", key: "utilisateur", minWidth: 18 },
    ],
    rows: data,
  });
}

async function generateLotsExcel({ societe, rows, exportedAt = new Date(), days = 30 }) {
  const data = (rows || []).map((l) => {
    const jours = l.dateExpiration
      ? Math.ceil(
          (Date.UTC(new Date(l.dateExpiration).getFullYear(), new Date(l.dateExpiration).getMonth(), new Date(l.dateExpiration).getDate()) -
            Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) /
            86400000
        )
      : "";
    return {
      numero: l.numero || "",
      code: l.article?.code || "",
      article: l.article?.libelle || "",
      depot: l.depot?.code || "",
      dateFabrication: l.dateFabrication ? new Date(l.dateFabrication).toISOString().slice(0, 10) : "",
      dlc: l.dateExpiration ? new Date(l.dateExpiration).toISOString().slice(0, 10) : "",
      quantite: Number(l.quantiteRestante ?? 0),
      statut: l.statut || "",
      joursRestants: jours !== "" ? Number(jours) : "",
    };
  });
  return generateFlatListExcel({
    societe,
    title: "Export lots expirant",
    subtitle: `Lots expirant sous ${days} jours — ${data.length} lot(s) — ${exportedAt.toLocaleDateString("fr-FR")}`,
    sheetName: "Lots",
    accentColor: FINANCIAL_ACCENT,
    columns: [
      { header: "N° lot", key: "numero", minWidth: 16 },
      { header: "Code", key: "code", minWidth: 12 },
      { header: "Article", key: "article", minWidth: 28 },
      { header: "Dépôt", key: "depot", minWidth: 12 },
      { header: "Date fabrication", key: "dateFabrication", minWidth: 16 },
      { header: "DLC", key: "dlc", minWidth: 14 },
      { header: "Qté restante", key: "quantite", numFmt: NUM_FMT_QTY, minWidth: 12, alignment: { horizontal: "right" } },
      { header: "Statut", key: "statut", minWidth: 12 },
      { header: "Jours restants", key: "joursRestants", minWidth: 14, alignment: { horizontal: "right" } },
    ],
    rows: data,
    conditionalRules: [
      { columnKey: "joursRestants", test: (v) => v !== "" && Number(v) <= 7, font: RED_FONT },
      { columnKey: "joursRestants", test: (v) => v !== "" && Number(v) > 7 && Number(v) <= 30, font: AMBER_FONT },
    ],
  });
}

module.exports = {
  buildStyledWorkbook,
  addReportHeader,
  generateFlatListExcel,
  accentForMethode,
  generateInventaireExcel,
  generateInventairesListExcel,
  generateRapportExcel,
  generateValuationExcel,
  generateRotationExcel,
  generateDeadStockExcel,
  generateCoutStockageExcel,
  generateArticlesExcel,
  generateStockExcel,
  generateAchatsExcel,
  generateVentesExcel,
  generateMouvementsExcel,
  generateLotsExcel,
};
