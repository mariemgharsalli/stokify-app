const PDFDocument = require("pdfkit");
const prisma = require("../../config/database");
const { getSocieteWhere } = require("../../utils/societeScope");
const { fmtDate, fmtMoney } = require("../../utils/pdfHelper");
const { createSmtpTransporter, getSmtpFrom } = require("../../utils/smtp");
const { logoToDataUrl, drawPdfKitLogo } = require("../../utils/logoLoader");
const AppError = require("../../utils/AppError");
const { normalizeCode } = require("../../utils/codeUtils");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function nextNumero(tx, societeId, prefix, bump = 0) {
  const year = new Date().getFullYear();
  const head = `${prefix}-${year}-`;
  const last = await tx.facture.findFirst({
    where: { societeId: Number(societeId), numero: { startsWith: head } },
    orderBy: { numero: "desc" },
  });
  let seq = 1;
  if (last?.numero) {
    const m = String(last.numero).match(/-(\d{4})$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  return `${head}${String(seq + Number(bump || 0)).padStart(4, "0")}`;
}

async function createFactureForVente(tx, vente, { statut = "EMISE", prefix = "FAC" } = {}) {
  const existing = await tx.facture.findUnique({ where: { venteId: vente.id } });
  if (existing) return existing;

  const dateEcheance = new Date();
  dateEcheance.setDate(dateEcheance.getDate() + 30);

  // Anti-collision sans retry P2002 (appelé dans une transaction parente).
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const numero = normalizeCode(await nextNumero(tx, vente.societeId, prefix, attempt));
    const clash = await tx.facture.findFirst({
      where: { societeId: Number(vente.societeId), numero },
    });
    if (clash) continue;
    return tx.facture.create({
      data: {
        numero,
        venteId: vente.id,
        clientId: vente.clientId,
        societeId: vente.societeId,
        montantHT: vente.totalHT,
        tva: vente.totalTVA,
        montantTTC: vente.totalTTC,
        statut,
        dateEcheance,
      },
    });
  }

  const err = new Error("Impossible de generer un numero de facture unique");
  err.status = 409;
  throw err;
}

async function getFacture(user, factureId) {
  const { societeId: sid } = getSocieteWhere(user);
  const facture = await prisma.facture.findFirst({
    where: { id: Number(factureId), societeId: sid },
    include: {
      vente: {
        include: {
          client: true,
          depot: true,
          lignes: { include: { article: { include: { famille: true } } } },
          reglements: true,
          confirmateur: { select: { id: true, nom: true, prenom: true } },
        },
      },
      client: true,
      societe: true,
    },
  });
  if (!facture) {
    const err = new Error("Facture introuvable");
    err.status = 404;
    throw err;
  }
  return facture;
}

async function getFactureByVente(user, venteId) {
  const { societeId: sid } = getSocieteWhere(user);
  const facture = await prisma.facture.findFirst({
    where: { venteId: Number(venteId), societeId: sid },
    include: {
      vente: {
        include: {
          client: true,
          lignes: { include: { article: true } },
          reglements: true,
        },
      },
      client: true,
      societe: true,
    },
  });
  if (!facture) {
    const err = new Error("Facture introuvable pour cette vente");
    err.status = 404;
    throw err;
  }
  return facture;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Aperçu facture — document clair type papier (indépendant du dark mode).
 * Retourne un HTML complet pour affichage dans un iframe (srcDoc).
 */
function buildApercuHtml(facture) {
  const v = facture.vente;
  const soc = facture.societe || {};
  const cl = facture.client || v?.client || {};

  const accent = "#6d28d9";
  const ink = "#111827";
  const muted = "#4b5563";
  const line = "#d1d5db";
  const soft = "#f3f4f6";
  const white = "#ffffff";

  const statut = String(facture.statut || "EMISE").toUpperCase();
  const statutMeta = {
    EMISE: { label: "Émise", bg: "#ede9fe", color: accent },
    PARTIELLEMENT_PAYEE: { label: "Partiellement payée", bg: "#fef3c7", color: "#92400e" },
    PAYEE: { label: "Payée", bg: "#dcfce7", color: "#166534" },
    AVOIR: { label: "Avoir", bg: "#ffedd5", color: "#9a3412" },
  }[statut] || { label: statut, bg: soft, color: muted };

  const regle = (v?.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
  const reste = Math.max(0, Number(facture.montantTTC || 0) - regle);

  const lignes = (v?.lignes || [])
    .map((l, i) => {
      const bg = i % 2 === 0 ? white : "#f9fafb";
      return (
        "<tr>" +
        '<td style="padding:14px 16px;background:' +
        bg +
        ";border-bottom:1px solid " +
        line +
        ";color:" +
        muted +
        ';font-family:Consolas,monospace;font-size:13px;">' +
        escapeHtml(l.article?.code || "") +
        "</td>" +
        '<td style="padding:14px 16px;background:' +
        bg +
        ";border-bottom:1px solid " +
        line +
        ";color:" +
        ink +
        ';font-size:14px;font-weight:600;">' +
        escapeHtml(l.article?.libelle || "") +
        "</td>" +
        '<td style="padding:14px 16px;background:' +
        bg +
        ";border-bottom:1px solid " +
        line +
        ";color:" +
        ink +
        ';text-align:right;font-size:14px;">' +
        escapeHtml(l.quantite) +
        "</td>" +
        '<td style="padding:14px 16px;background:' +
        bg +
        ";border-bottom:1px solid " +
        line +
        ";color:" +
        ink +
        ';text-align:right;font-size:14px;">' +
        fmtMoney(l.prixUnit) +
        "</td>" +
        '<td style="padding:14px 16px;background:' +
        bg +
        ";border-bottom:1px solid " +
        line +
        ";color:" +
        (Number(l.remise) > 0 ? "#92400e" : muted) +
        ';text-align:right;font-size:14px;">' +
        fmtMoney(l.remise || 0) +
        "</td>" +
        '<td style="padding:14px 16px;background:' +
        bg +
        ";border-bottom:1px solid " +
        line +
        ";color:" +
        ink +
        ';text-align:right;font-size:14px;font-weight:700;">' +
        fmtMoney(l.totalHT) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  const initial = escapeHtml((soc.nom || "S").slice(0, 1).toUpperCase());
  const logoSrc = logoToDataUrl(soc.logo);
  const logoBlock = logoSrc
    ? '<img src="' +
      logoSrc +
      '" alt="" width="64" height="64" style="display:block;max-height:64px;max-width:160px;object-fit:contain;background:' +
      white +
      ';" />'
    : '<div style="width:56px;height:56px;border-radius:12px;background:' +
      accent +
      ";color:" +
      white +
      ';font-weight:800;font-size:22px;line-height:56px;text-align:center;">' +
      initial +
      "</div>";

  const socAdresse = [soc.adresse, soc.ville].filter(Boolean).join(" · ");
  const clAdresse = [cl.adresse, cl.ville, cl.pays].filter(Boolean).join(", ");

  return (
    "<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"utf-8\"/>" +
    '<meta name="color-scheme" content="light only"/>' +
    "<style>html,body{margin:0;padding:0;background:#e5e7eb;color-scheme:light only;}*{box-sizing:border-box;}</style>" +
    "</head><body style=\"margin:0;padding:24px 16px;background:#e5e7eb;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;\">" +
    '<div style="max-width:820px;margin:0 auto;background:' +
    white +
    ";border-radius:12px;overflow:hidden;border:1px solid " +
    line +
    ';box-shadow:0 10px 40px rgba(0,0,0,0.12);">' +
    '<div style="height:6px;background:' +
    accent +
    ';"></div>' +
    '<div style="padding:28px 32px 20px;background:' +
    white +
    ';display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;">' +
    '<div style="display:flex;gap:14px;align-items:center;">' +
    logoBlock +
    "<div>" +
    '<div style="font-size:22px;font-weight:800;color:' +
    ink +
    ';line-height:1.2;">' +
    escapeHtml(soc.nom || "Société") +
    "</div>" +
    '<div style="margin-top:6px;font-size:13px;color:' +
    muted +
    ';line-height:1.5;">' +
    (socAdresse ? escapeHtml(socAdresse) + "<br/>" : "") +
    (soc.telephones ? "Tél. " + escapeHtml(soc.telephones) : "") +
    (soc.telephones && soc.email ? " · " : "") +
    (soc.email ? escapeHtml(soc.email) : "") +
    "</div></div></div>" +
    '<div style="text-align:right;">' +
    '<div style="margin-bottom:8px;">' +
    '<span style="display:inline-block;padding:5px 12px;border-radius:6px;background:' +
    statutMeta.bg +
    ";color:" +
    statutMeta.color +
    ';font-size:12px;font-weight:700;">' +
    escapeHtml(statutMeta.label) +
    "</span>" +
    '<span style="display:inline-block;margin-left:6px;padding:5px 12px;border-radius:6px;background:#ede9fe;color:' +
    accent +
    ';font-size:12px;font-weight:700;">FACTURE</span>' +
    "</div>" +
    '<div style="font-size:24px;font-weight:800;color:' +
    accent +
    ';">' +
    escapeHtml(facture.numero) +
    "</div>" +
    '<div style="margin-top:6px;font-size:13px;color:' +
    muted +
    ';">Émise le <strong style="color:' +
    ink +
    ';">' +
    fmtDate(facture.createdAt) +
    "</strong></div>" +
    (facture.dateEcheance
      ? '<div style="font-size:13px;color:' +
        muted +
        ';">Échéance <strong style="color:' +
        ink +
        ';">' +
        fmtDate(facture.dateEcheance) +
        "</strong></div>"
      : "") +
    "</div></div>" +
    '<div style="margin:0 32px 20px;padding:14px 18px;background:' +
    soft +
    ";border:1px solid " +
    line +
    ';border-radius:10px;display:flex;flex-wrap:wrap;gap:20px;">' +
    "<div><div style=\"font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:" +
    muted +
    ';">Réf. vente</div><div style="margin-top:4px;font-size:14px;font-weight:700;color:' +
    ink +
    ';font-family:Consolas,monospace;">' +
    escapeHtml(v?.reference || "—") +
    "</div></div>" +
    "<div><div style=\"font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:" +
    muted +
    ';">Paiement</div><div style="margin-top:4px;font-size:14px;font-weight:700;color:' +
    ink +
    ';">' +
    escapeHtml(v?.modePaiement || "—") +
    "</div></div>" +
    "<div><div style=\"font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:" +
    muted +
    ';">Réglé</div><div style="margin-top:4px;font-size:14px;font-weight:700;color:#166534;">' +
    fmtMoney(regle) +
    "</div></div>" +
    "<div><div style=\"font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:" +
    muted +
    ';">Reste dû</div><div style="margin-top:4px;font-size:14px;font-weight:700;color:' +
    (reste > 0.009 ? "#b91c1c" : "#166534") +
    ';">' +
    fmtMoney(reste) +
    "</div></div></div>" +
    '<div style="padding:0 32px 22px;display:flex;gap:16px;flex-wrap:wrap;">' +
    '<div style="flex:1;min-width:240px;padding:16px;background:' +
    soft +
    ";border:1px solid " +
    line +
    ';border-radius:10px;">' +
    '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:' +
    accent +
    ';margin-bottom:8px;">Émetteur</div>' +
    '<div style="font-size:15px;font-weight:700;color:' +
    ink +
    ';">' +
    escapeHtml(soc.nom || "") +
    "</div>" +
    '<div style="margin-top:6px;font-size:13px;color:' +
    muted +
    ';line-height:1.55;">' +
    (soc.adresse ? escapeHtml(soc.adresse) + "<br/>" : "") +
    (soc.ville ? escapeHtml(soc.ville) + "<br/>" : "") +
    (soc.email ? escapeHtml(soc.email) : "") +
    "</div></div>" +
    '<div style="flex:1;min-width:240px;padding:16px;background:' +
    white +
    ";border:2px solid " +
    accent +
    ';border-radius:10px;">' +
    '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:' +
    accent +
    ';margin-bottom:8px;">Client</div>' +
    '<div style="font-size:16px;font-weight:800;color:' +
    ink +
    ';">' +
    escapeHtml(cl.nom || "") +
    "</div>" +
    (cl.code
      ? '<div style="margin-top:2px;font-size:12px;color:' +
        muted +
        ';font-family:Consolas,monospace;">' +
        escapeHtml(cl.code) +
        "</div>"
      : "") +
    '<div style="margin-top:8px;font-size:13px;color:' +
    muted +
    ';line-height:1.55;">' +
    (clAdresse ? escapeHtml(clAdresse) + "<br/>" : "") +
    (cl.telephone ? "Tél. " + escapeHtml(cl.telephone) + "<br/>" : "") +
    (cl.email ? escapeHtml(cl.email) : "") +
    "</div></div></div>" +
    '<div style="padding:0 32px 16px;">' +
    '<table style="width:100%;border-collapse:collapse;background:' +
    white +
    ";border:1px solid " +
    line +
    ';">' +
    "<thead><tr>" +
    '<th style="padding:12px 16px;background:' +
    accent +
    ";color:" +
    white +
    ';text-align:left;font-size:12px;font-weight:700;text-transform:uppercase;">Code</th>' +
    '<th style="padding:12px 16px;background:' +
    accent +
    ";color:" +
    white +
    ';text-align:left;font-size:12px;font-weight:700;text-transform:uppercase;">Désignation</th>' +
    '<th style="padding:12px 16px;background:' +
    accent +
    ";color:" +
    white +
    ';text-align:right;font-size:12px;font-weight:700;text-transform:uppercase;">Qté</th>' +
    '<th style="padding:12px 16px;background:' +
    accent +
    ";color:" +
    white +
    ';text-align:right;font-size:12px;font-weight:700;text-transform:uppercase;">Prix HT</th>' +
    '<th style="padding:12px 16px;background:' +
    accent +
    ";color:" +
    white +
    ';text-align:right;font-size:12px;font-weight:700;text-transform:uppercase;">Remise</th>' +
    '<th style="padding:12px 16px;background:' +
    accent +
    ";color:" +
    white +
    ';text-align:right;font-size:12px;font-weight:700;text-transform:uppercase;">Total HT</th>' +
    "</tr></thead><tbody>" +
    (lignes ||
      '<tr><td colspan="6" style="padding:24px;text-align:center;color:' +
        muted +
        ";background:" +
        white +
        ';">Aucune ligne</td></tr>') +
    "</tbody></table></div>" +
    '<div style="padding:8px 32px 28px;text-align:right;">' +
    '<div style="display:inline-block;width:300px;text-align:left;border:1px solid ' +
    line +
    ";border-radius:10px;overflow:hidden;background:" +
    white +
    ';">' +
    '<div style="padding:12px 16px;display:flex;justify-content:space-between;border-bottom:1px solid ' +
    line +
    ";background:" +
    white +
    ';"><span style="font-size:14px;color:' +
    muted +
    ';">Total HT</span><strong style="font-size:14px;color:' +
    ink +
    ';">' +
    fmtMoney(facture.montantHT) +
    "</strong></div>" +
    '<div style="padding:12px 16px;display:flex;justify-content:space-between;border-bottom:1px solid ' +
    line +
    ";background:" +
    white +
    ';"><span style="font-size:14px;color:' +
    muted +
    ';">' +
    escapeHtml(buildTvaLabel(facture)) +
    '</span><strong style="font-size:14px;color:' +
    ink +
    ';">' +
    fmtMoney(facture.tva) +
    "</strong></div>" +
    '<div style="padding:16px;display:flex;justify-content:space-between;align-items:center;background:' +
    accent +
    ';"><span style="font-size:13px;font-weight:700;color:' +
    white +
    ';text-transform:uppercase;">Total TTC</span><span style="font-size:22px;font-weight:800;color:' +
    white +
    ';">' +
    fmtMoney(facture.montantTTC) +
    "</span></div></div></div>" +
    '<div style="padding:16px 32px 22px;background:' +
    soft +
    ";border-top:1px solid " +
    line +
    ';display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
    '<div style="font-size:12px;color:' +
    muted +
    ';line-height:1.5;">Document généré par <strong style="color:' +
    accent +
    ';">Stokify</strong><br/>Facture conforme à la législation en vigueur.</div>' +
    '<div style="font-size:13px;font-weight:700;color:' +
    ink +
    ';">Merci pour votre confiance.</div>' +
    "</div></div></body></html>"
  );
}


function endPdfBuffer(doc, finishFooters) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    if (typeof finishFooters === "function") finishFooters();
    doc.end();
  });
}

/** Palette facture PDF — navy / bleu Stokify (style Bon de réception). */
const INV = {
  accent: "#378ADD",
  accentDark: "#0F2540",
  cyan: "#0EA5E9",
  navy: "#0F2540",
  navySoft: "#E8F0F8",
  ink: "#0F172A",
  muted: "#64748B",
  soft: "#F1F5F9",
  softAccent: "#E0F2FE",
  line: "#E2E8F0",
  white: "#FFFFFF",
  success: "#166534",
  successBg: "#DCFCE7",
  warn: "#92400E",
  warnBg: "#FEF3C7",
  danger: "#B91C1C",
  dangerBg: "#FEE2E2",
};

function resolveDocAccent(societeAccentHex) {
  const raw = String(societeAccentHex || "").trim().toLowerCase();
  // Remplacer le violet historique par le bleu Stokify
  if (!raw || raw === "#6d28d9" || raw === "#5b21b6" || raw === "#7f77dd") {
    return INV.accent;
  }
  return raw;
}

function statutFactureMeta(statut, accentHex) {
  const s = String(statut || "EMISE").toUpperCase();
  const accent = accentHex || INV.accent;
  const map = {
    EMISE: { label: "ÉMISE", bg: INV.softAccent, color: accent },
    PARTIELLEMENT_PAYEE: { label: "PARTIELLE", bg: INV.warnBg, color: INV.warn },
    PAYEE: { label: "PAYÉE", bg: INV.successBg, color: INV.success },
    AVOIR: { label: "AVOIR", bg: "#FFEDD5", color: "#9A3412" },
  };
  return map[s] || { label: s, bg: INV.soft, color: INV.muted };
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

function drawPill(doc, x, y, text, bg, color) {
  const padX = 8;
  const h = 16;
  doc.font("Helvetica-Bold").fontSize(7);
  const tw = doc.widthOfString(String(text));
  const w = tw + padX * 2;
  drawRoundedRect(doc, x, y, w, h, 4, bg);
  doc.fillColor(color).text(String(text), x, y + 4.5, { width: w, align: "center", height: 12 });
  return w;
}

function buildTvaLabel(facture) {
  const taux = [...new Set((facture.vente?.lignes || []).map((l) => l.tauxTva))].filter(
    (t) => t != null
  );
  if (taux.length === 0) return "TVA";
  if (taux.length === 1) return `TVA (${taux[0]}%)`;
  return `TVA (taux multiples : ${taux.join("% / ")}%)`;
}

/**
 * Facture PDF premium — même langage visuel que le Bon de réception.
 */
async function generateFacturePDF(factureId, user) {
  const facture = user
    ? await getFacture(user, factureId)
    : await prisma.facture.findUnique({
        where: { id: Number(factureId) },
        include: {
          vente: { include: { client: true, lignes: { include: { article: true } }, reglements: true } },
          societe: true,
          client: true,
        },
      });
  if (!facture) throw new AppError("Facture introuvable", "NOT_FOUND", 404);

  const v = facture.vente || {};
  const societe = facture.societe || {};
  const cl = facture.client || v.client || {};
  const accent = resolveDocAccent(societe.accentHex);
  const statutMeta = statutFactureMeta(facture.statut, accent);
  const totalRegle = (v.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
  const reste = Math.max(0, round2(Number(facture.montantTTC || 0) - totalRegle));
  const htBrut = round2(Number(v.totalHT || facture.montantHT || 0) + Number(v.remise || 0));
  const company = String(societe.nom || "Société");
  const nbLignes = (v.lignes || []).length;

  const margin = 36;
  const footerH = 40;
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 0, left: 0, right: 0, bottom: 0 },
    bufferPages: true,
    info: {
      Title: `Facture ${facture.numero}`,
      Author: company,
      Subject: `Facture ${facture.numero}`,
    },
  });

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const contentW = pageW - margin * 2;
  const bottomLimit = pageH - footerH - 8;

  function absText(str, x, yPos, opts = {}) {
    const o = { ...opts };
    if (o.width != null && o.height == null) o.height = 16;
    doc.text(String(str ?? ""), x, yPos, o);
  }

  function ensureSpace(needed, yPos) {
    if (yPos + needed <= bottomLimit) return yPos;
    doc.addPage();
    return margin + 16;
  }

  function drawInfoCard(x, yPos, w, h, title, titleColor, lines) {
    drawRoundedRect(doc, x, yPos, w, h, 8, INV.white, INV.line);
    doc.rect(x, yPos, 4, h).fill(titleColor);
    doc.fillColor(titleColor).font("Helvetica-Bold").fontSize(7);
    absText(String(title).toUpperCase(), x + 14, yPos + 10, { width: w - 28 });
    let ly = yPos + 26;
    lines.forEach((line, idx) => {
      if (!line) return;
      if (idx === 0) {
        doc.fillColor(INV.ink).font("Helvetica-Bold").fontSize(11);
      } else {
        doc.fillColor(INV.muted).font("Helvetica").fontSize(8);
      }
      absText(String(line), x + 14, ly, { width: w - 28, height: 14 });
      ly += idx === 0 ? 16 : 12;
    });
  }

  function drawMetaPill(x, yPos, w, label, value, valueColor) {
    drawRoundedRect(doc, x, yPos, w, 40, 7, INV.navySoft);
    doc.fillColor(accent).font("Helvetica-Bold").fontSize(6.5);
    absText(String(label).toUpperCase(), x + 10, yPos + 9, { width: w - 20 });
    doc.fillColor(valueColor || INV.ink).font("Helvetica-Bold").fontSize(9.5);
    absText(String(value || "—"), x + 10, yPos + 22, { width: w - 20, height: 14 });
  }

  /* ── Hero navy ── */
  doc.rect(0, 0, pageW, 118).fill(INV.navy);
  doc
    .save()
    .moveTo(pageW - 160, 0)
    .lineTo(pageW, 0)
    .lineTo(pageW, 118)
    .fill(accent)
    .restore();
  doc.rect(0, 118, pageW, 4).fill(INV.cyan);

  drawPdfKitLogo(doc, societe, margin, 22, 52, 52, { accent, bordered: true });

  const brandX = margin + 66;
  doc.fillColor(INV.white).font("Helvetica-Bold").fontSize(16);
  absText(company, brandX, 28, { width: contentW * 0.4 });
  doc.fillColor("#CBD5E1").font("Helvetica").fontSize(8);
  const socLines = [
    [societe.adresse, societe.ville].filter(Boolean).join(" · "),
    [societe.telephones ? `Tél. ${societe.telephones}` : "", societe.email || ""].filter(Boolean).join("  ·  "),
  ].filter(Boolean);
  let sy = 50;
  socLines.forEach((line) => {
    absText(line, brandX, sy, { width: contentW * 0.4 });
    sy += 11;
  });

  const rightW = 210;
  const rightX = margin + contentW - rightW;
  doc.fillColor(INV.white).font("Helvetica-Bold").fontSize(18);
  absText("FACTURE", rightX, 28, { width: rightW, align: "right" });
  doc.fillColor("#BAE6FD").font("Helvetica").fontSize(8);
  absText("Document commercial · Vente", rightX, 50, { width: rightW, align: "right" });
  doc.fillColor(INV.white).font("Helvetica-Bold").fontSize(13);
  absText(String(facture.numero), rightX, 66, { width: rightW, align: "right" });

  doc.font("Helvetica-Bold").fontSize(7);
  const statutLabel = String(statutMeta.label);
  const statutPillW = doc.widthOfString(statutLabel) + 16;
  drawPill(doc, rightX + rightW - statutPillW, 88, statutLabel, statutMeta.bg, statutMeta.color);

  let y = 136;

  /* ── Méta pills ── */
  y = ensureSpace(52, y);
  const pillGap = 8;
  const pillW = (contentW - pillGap * 3) / 4;
  drawMetaPill(margin, y, pillW, "Réf. vente", v.reference || "—");
  drawMetaPill(margin + pillW + pillGap, y, pillW, "Émise le", fmtDate(facture.createdAt));
  drawMetaPill(
    margin + (pillW + pillGap) * 2,
    y,
    pillW,
    "Échéance",
    facture.dateEcheance ? fmtDate(facture.dateEcheance) : "—"
  );
  drawMetaPill(
    margin + (pillW + pillGap) * 3,
    y,
    pillW,
    "Reste dû",
    fmtMoney(reste),
    reste > 0.009 ? INV.danger : INV.success
  );
  y += 52;

  /* ── Cartes Émetteur / Client ── */
  const cardH = 92;
  y = ensureSpace(cardH + 12, y);
  const gap = 10;
  const cardW = (contentW - gap) / 2;

  drawInfoCard(margin, y, cardW, cardH, "Émetteur", accent, [
    company,
    societe.adresse,
    societe.ville,
    societe.email,
    societe.telephones ? `Tél. ${societe.telephones}` : "",
  ].filter(Boolean));

  drawInfoCard(margin + cardW + gap, y, cardW, cardH, "Client", INV.cyan, [
    cl.nom || "—",
    cl.code ? `Code ${cl.code}` : "",
    [cl.adresse, cl.ville, cl.pays].filter(Boolean).join(", "),
    cl.telephone ? `Tél. ${cl.telephone}` : "",
    cl.email || "",
  ].filter(Boolean));
  y += cardH + 14;

  /* ── Section articles ── */
  y = ensureSpace(28, y);
  doc.roundedRect(margin, y, 4, 12, 1).fill(accent);
  doc.fillColor(INV.ink).font("Helvetica-Bold").fontSize(11);
  absText("Détail des articles", margin + 10, y + 1, { width: 200 });
  doc.fillColor(INV.muted).font("Helvetica").fontSize(8);
  absText(
    `${nbLignes} ligne${nbLignes !== 1 ? "s" : ""} · ${v.modePaiement || "Paiement —"} · Réglé ${fmtMoney(totalRegle)}`,
    margin,
    y + 2,
    { width: contentW, align: "right" }
  );
  y += 18;

  const cols = [
    { key: "n", label: "#", w: 22, align: "center" },
    { key: "code", label: "CODE", w: 54, align: "left" },
    { key: "lib", label: "DÉSIGNATION", w: 168, align: "left" },
    { key: "qty", label: "QTÉ", w: 36, align: "right" },
    { key: "prix", label: "PRIX HT", w: 68, align: "right" },
    { key: "rem", label: "REMISE", w: 54, align: "right" },
    { key: "tot", label: "TOTAL HT", w: contentW - 22 - 54 - 168 - 36 - 68 - 54, align: "right" },
  ];

  const lignes = (v.lignes || []).map((l, i) => ({
    n: String(i + 1).padStart(2, "0"),
    code: l.article?.code || "—",
    lib: l.article?.libelle || "—",
    qty: String(l.quantite ?? ""),
    prix: fmtMoney(l.prixUnit),
    rem: fmtMoney(l.remise || 0),
    tot: fmtMoney(l.totalHT),
    hasRemise: Number(l.remise || 0) > 0,
  }));

  function drawTableHeader(atY) {
    drawRoundedRect(doc, margin, atY, contentW, 24, 5, INV.navy);
    let cx = margin + 6;
    doc.fillColor(INV.white).font("Helvetica-Bold").fontSize(7);
    cols.forEach((c) => {
      absText(c.label, cx, atY + 8, { width: c.w - 8, align: c.align });
      cx += c.w;
    });
    return atY + 24;
  }

  y = ensureSpace(40, y);
  y = drawTableHeader(y);

  if (!lignes.length) {
    y = ensureSpace(28, y);
    drawRoundedRect(doc, margin, y, contentW, 28, 0, INV.soft, INV.line);
    doc.fillColor(INV.muted).font("Helvetica").fontSize(9);
    absText("Aucune ligne", margin, y + 9, { width: contentW, align: "center" });
    y += 28;
  } else {
    lignes.forEach((row, ri) => {
      doc.font("Helvetica").fontSize(8);
      const libH = Math.max(14, doc.heightOfString(row.lib, { width: cols[2].w - 10, lineGap: 1 }));
      const rowH = Math.max(24, libH + 10);
      y = ensureSpace(rowH + 4, y);
      if (y === margin + 16) y = drawTableHeader(y);

      const bg = ri % 2 === 0 ? INV.white : INV.navySoft;
      doc.rect(margin, y, contentW, rowH).fill(bg);
      doc
        .moveTo(margin, y + rowH)
        .lineTo(margin + contentW, y + rowH)
        .strokeColor(INV.line)
        .lineWidth(0.4)
        .stroke();

      let cx = margin + 6;
      const cells = [
        { text: row.n, color: INV.muted, font: "Helvetica", size: 7, wrap: false },
        { text: row.code, color: accent, font: "Helvetica-Bold", size: 7.5, wrap: false },
        { text: row.lib, color: INV.ink, font: "Helvetica-Bold", size: 8, wrap: true },
        { text: row.qty, color: INV.ink, font: "Helvetica", size: 8, wrap: false },
        { text: row.prix, color: INV.ink, font: "Helvetica", size: 8, wrap: false },
        { text: row.rem, color: row.hasRemise ? INV.warn : INV.muted, font: "Helvetica", size: 8, wrap: false },
        { text: row.tot, color: INV.ink, font: "Helvetica-Bold", size: 8, wrap: false },
      ];
      cells.forEach((cell, i) => {
        doc.font(cell.font).fontSize(cell.size).fillColor(cell.color);
        if (cell.wrap) {
          doc.text(cell.text, cx, y + 6, {
            width: cols[i].w - 8,
            align: cols[i].align,
            lineGap: 1,
            height: rowH - 8,
            ellipsis: true,
          });
        } else {
          absText(cell.text, cx, y + 7, { width: cols[i].w - 8, align: cols[i].align });
        }
        cx += cols[i].w;
      });
      y += rowH;
    });
  }

  y += 14;

  /* ── Mention + Totaux ── */
  const totW = 228;
  const totX = margin + contentW - totW;
  const totEntries = [
    { label: "Total HT brut", value: fmtMoney(htBrut) },
    ...(Number(v.remise || 0) > 0 ? [{ label: "Remise globale", value: `− ${fmtMoney(v.remise)}` }] : []),
    { label: "Net HT", value: fmtMoney(facture.montantHT) },
    { label: buildTvaLabel(facture), value: fmtMoney(facture.tva) },
  ];
  const totBodyH = 14 + totEntries.length * 18 + 38;
  y = ensureSpace(Math.max(totBodyH, 96), y);

  drawRoundedRect(doc, margin, y, contentW - totW - 12, Math.max(totBodyH, 88), 8, INV.navySoft);
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(8);
  absText("MENTION", margin + 14, y + 14, { width: contentW - totW - 40 });
  doc.fillColor(INV.ink).font("Helvetica-Bold").fontSize(9);
  absText("Merci pour votre confiance", margin + 14, y + 30, { width: contentW - totW - 40 });
  doc.fillColor(INV.muted).font("Helvetica").fontSize(7.5);
  doc.text(
    "Facture conforme à la législation en vigueur. En cas de retard de paiement, des pénalités pourront être appliquées selon les conditions convenues. Document généré automatiquement par Stokify.",
    margin + 14,
    y + 46,
    { width: contentW - totW - 40, lineGap: 2, height: 44, ellipsis: true }
  );

  drawRoundedRect(doc, totX, y, totW, totBodyH, 8, INV.white, INV.line);
  let ty = y + 12;
  totEntries.forEach((row) => {
    doc.fillColor(INV.muted).font("Helvetica").fontSize(8);
    absText(row.label, totX + 12, ty, { width: totW * 0.45 });
    doc.fillColor(INV.ink).font("Helvetica-Bold").fontSize(9);
    absText(row.value, totX + 12, ty, { width: totW - 24, align: "right" });
    ty += 18;
  });
  doc.roundedRect(totX + 5, ty, totW - 10, 30, 6).fill(accent);
  doc.fillColor(INV.white).font("Helvetica-Bold").fontSize(8);
  absText("TOTAL TTC", totX + 14, ty + 10, { width: 80 });
  doc.fontSize(12);
  absText(fmtMoney(facture.montantTTC), totX + 14, ty + 8, { width: totW - 28, align: "right" });

  y = Math.max(y + Math.max(totBodyH, 88), ty + 42) + 16;

  /* ── Signatures ── */
  y = ensureSpace(72, y);
  const sigW = (contentW - 12) / 2;
  drawRoundedRect(doc, margin, y, sigW, 66, 8, INV.white, INV.line);
  doc.fillColor(INV.muted).font("Helvetica-Bold").fontSize(7);
  absText("CACHET & SIGNATURE ÉMETTEUR", margin + 12, y + 12, { width: sigW - 24 });
  doc
    .moveTo(margin + 14, y + 50)
    .lineTo(margin + sigW - 14, y + 50)
    .strokeColor(INV.line)
    .lineWidth(0.7)
    .stroke();
  doc.fillColor(INV.muted).font("Helvetica").fontSize(6.5);
  absText("Nom & signature", margin, y + 54, { width: sigW, align: "center" });

  drawRoundedRect(doc, margin + sigW + 12, y, sigW, 66, 8, INV.white, INV.line);
  doc.fillColor(INV.muted).font("Helvetica-Bold").fontSize(7);
  absText("ACCUSÉ RÉCEPTION CLIENT", margin + sigW + 24, y + 12, { width: sigW - 24 });
  doc
    .moveTo(margin + sigW + 26, y + 50)
    .lineTo(margin + sigW * 2 - 2, y + 50)
    .strokeColor(INV.line)
    .lineWidth(0.7)
    .stroke();
  doc.fillColor(INV.muted).font("Helvetica").fontSize(6.5);
  absText("Nom & signature", margin + sigW + 12, y + 54, { width: sigW, align: "center" });

  function finishFooters() {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(i);
      const footY = pageH - 28;
      doc.rect(0, footY - 8, pageW, 1.4).fill(accent);
      doc.fillColor(INV.muted).font("Helvetica").fontSize(7);
      absText(`${company} · Document confidentiel`, margin, footY, {
        width: contentW * 0.38,
        align: "left",
        height: 12,
      });
      doc.fillColor(accent).font("Helvetica-Bold").fontSize(7);
      absText(String(facture.numero), margin, footY, { width: contentW, align: "center", height: 12 });
      doc.fillColor(INV.muted).font("Helvetica").fontSize(7);
      absText(`Page ${i + 1} / ${range.count}`, margin, footY, {
        width: contentW,
        align: "right",
        height: 12,
      });
    }
  }

  return endPdfBuffer(doc, finishFooters);
}

async function envoyerEmailFacture(user, factureId, { to, subject, message }) {
  const facture = await getFacture(user, factureId);
  const societe = facture.societe || {};
  const transporter = createSmtpTransporter();
  if (!transporter) {
    throw new AppError("Configuration SMTP manquante (SMTP_USER / SMTP_PASS)", "SMTP_ERROR", 400);
  }

  const pdfBuffer = await generateFacturePDF(facture.id);
  const toEmail = String(to || facture.client?.email || "").trim();
  if (!toEmail) {
    throw new AppError("Adresse email destinataire requise", "VALIDATION_ERROR", 400);
  }

  const subj = subject || `Facture ${facture.numero} — ${societe.nom || "Stokify"}`;
  const bodyHtml =
    message ||
    `<p>Bonjour,</p><p>Veuillez trouver ci-joint votre facture <strong>${facture.numero}</strong>.</p>
     <p>Total HT : ${fmtMoney(facture.montantHT)} — TVA : ${fmtMoney(facture.tva)} — Total TTC : <strong>${fmtMoney(facture.montantTTC)}</strong></p>
     <p>Cordialement,<br/>${societe.nom || ""}</p>`;

  const from = getSmtpFrom(societe);

  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: subj,
      html: `<div style="font-family:system-ui,sans-serif;">${bodyHtml}</div>`,
      attachments: [{ filename: `${facture.numero}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
    });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes("BadCredentials") || msg.includes("535")) {
      throw new AppError(
        "Connexion Gmail refusée — vérifiez SMTP_USER et SMTP_PASS (mot de passe d'application, sans espaces) dans .env",
        "SMTP_ERROR",
        502
      );
    }
    throw new AppError(msg || "Erreur lors de l'envoi de l'email", "SMTP_ERROR", 502);
  }

  return prisma.facture.update({
    where: { id: facture.id },
    data: { factureEmailSentAt: new Date(), factureEmailSentTo: toEmail },
  });
}

async function getApercuFacture(user, factureId) {
  const facture = await getFacture(user, factureId);
  return { facture, html: buildApercuHtml(facture) };
}

/**
 * Génère des RelanceClient (type AUTO) pour les factures EMISE / PARTIELLEMENT_PAYEE
 * dont la dateEcheance est dépassée et le règlement incomplet.
 * Évite les doublons le même jour pour une même vente.
 */
async function genererRelancesEnRetard() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const factures = await prisma.facture.findMany({
    where: {
      statut: { in: ["EMISE", "PARTIELLEMENT_PAYEE"] },
      dateEcheance: { lt: now },
      vente: { typeVente: { not: "AVOIR" } },
    },
    include: {
      vente: {
        include: {
          reglements: { where: { statut: { in: ["VALIDE", "EN_ATTENTE"] } } },
          client: true,
        },
      },
      client: true,
      societe: true,
    },
  });

  const created = [];
  for (const f of factures) {
    const regle = (f.vente?.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
    const reste = round2(Number(f.montantTTC) - regle);
    if (reste < 0.02) continue;

    const already = await prisma.relanceClient.findFirst({
      where: {
        venteId: f.venteId,
        type: "AUTO",
        sentAt: { gte: startOfDay },
      },
    });
    if (already) continue;

    const email = f.client?.email || f.vente?.client?.email || null;
    const row = await prisma.relanceClient.create({
      data: {
        clientId: f.clientId,
        venteId: f.venteId,
        type: "AUTO",
        email,
      },
    });
    created.push({
      ...row,
      factureId: f.id,
      numero: f.numero,
      montantDu: reste,
      dateEcheance: f.dateEcheance,
      joursRetard: Math.max(0, Math.ceil((now - new Date(f.dateEcheance)) / 86400000)),
    });
  }

  return { generated: created.length, items: created };
}

/**
 * Liste les factures en retard (échéance dépassée, non soldées) avec jours de retard.
 */
async function listFacturesEnRetard(user) {
  const { societeId: sid } = getSocieteWhere(user);
  const now = new Date();

  const factures = await prisma.facture.findMany({
    where: {
      societeId: sid,
      statut: { in: ["EMISE", "PARTIELLEMENT_PAYEE"] },
      dateEcheance: { lt: now },
      vente: { typeVente: { not: "AVOIR" } },
    },
    include: {
      client: { select: { id: true, code: true, nom: true, email: true, telephone: true } },
      vente: {
        select: {
          id: true,
          reference: true,
          totalTTC: true,
          montantRegle: true,
          statutPaiement: true,
          reglements: { where: { statut: { in: ["VALIDE", "EN_ATTENTE"] } }, select: { montant: true } },
          relances: { orderBy: { sentAt: "desc" }, take: 3 },
        },
      },
    },
    orderBy: { dateEcheance: "asc" },
  });

  return factures
    .map((f) => {
      const regle = (f.vente?.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
      const montantDu = round2(Number(f.montantTTC) - regle);
      const joursRetard = Math.max(0, Math.ceil((now - new Date(f.dateEcheance)) / 86400000));
      return {
        id: f.id,
        numero: f.numero,
        statut: f.statut,
        dateEcheance: f.dateEcheance,
        createdAt: f.createdAt,
        montantHT: f.montantHT,
        montantTTC: f.montantTTC,
        montantRegle: round2(regle),
        montantDu,
        joursRetard,
        client: f.client,
        vente: {
          id: f.vente?.id,
          reference: f.vente?.reference,
          statutPaiement: f.vente?.statutPaiement,
          relances: f.vente?.relances || [],
        },
      };
    })
    .filter((f) => f.montantDu >= 0.02);
}

/**
 * Relance manuelle (type MANUEL) pour une facture — utile depuis EncoursClients.
 */
async function creerRelanceManuelle(user, factureId, { envoyerEmail = false } = {}) {
  const facture = await getFacture(user, factureId);
  if (String(facture.statut).toUpperCase() === "AVOIR") {
    throw new AppError("Impossible de relancer une facture d'avoir", "VALIDATION_ERROR", 400);
  }
  if (String(facture.statut).toUpperCase() === "PAYEE") {
    throw new AppError("Cette facture est déjà payée", "VALIDATION_ERROR", 400);
  }

  const regle = (facture.vente?.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
  const montantDu = round2(Number(facture.montantTTC) - regle);
  if (montantDu < 0.02) {
    throw new AppError("Aucun solde restant à relancer", "VALIDATION_ERROR", 400);
  }

  const email = facture.client?.email || null;
  const now = new Date();
  const joursRetard = facture.dateEcheance
    ? Math.max(0, Math.ceil((now - new Date(facture.dateEcheance)) / 86400000))
    : 0;

  if (envoyerEmail && email) {
    const transporter = createSmtpTransporter();
    if (transporter) {
      const societe = facture.societe || {};
      const from = getSmtpFrom(societe);
      try {
        await transporter.sendMail({
          from,
          to: email,
          subject: `Rappel de paiement — ${facture.numero}`,
          html: `<div style="font-family:system-ui,sans-serif;">
            <p>Bonjour ${facture.client?.nom || ""},</p>
            <p>Nous vous rappelons que la facture <strong>${facture.numero}</strong>
            reste impayée${joursRetard > 0 ? ` depuis ${joursRetard} jour(s)` : ""}.</p>
            <p>Montant restant dû : <strong>${fmtMoney(montantDu)}</strong></p>
            <p>Merci de régulariser votre situation.</p>
            <p>Cordialement,<br/>${societe.nom || ""}</p>
          </div>`,
        });
      } catch (e) {
        throw new AppError(e?.message || "Erreur envoi email relance", "SMTP_ERROR", 502);
      }
    }
  }

  const row = await prisma.relanceClient.create({
    data: {
      clientId: facture.clientId,
      venteId: facture.venteId,
      type: "MANUEL",
      email,
    },
  });

  return {
    ...row,
    factureId: facture.id,
    numero: facture.numero,
    montantDu,
    joursRetard,
    emailEnvoye: Boolean(envoyerEmail && email),
  };
}

module.exports = {
  nextNumero,
  createFactureForVente,
  getFacture,
  getFactureByVente,
  generateFacturePDF,
  envoyerEmailFacture,
  getApercuFacture,
  buildApercuHtml,
  genererRelancesEnRetard,
  listFacturesEnRetard,
  creerRelanceManuelle,
};
