const QRCode = require("qrcode");
const { toCsv } = require("../../utils/exportCsv");
const { createBaseDoc, drawTable, generateTabularExportPdf } = require("../../utils/pdfHelper");
const { generateLotsExcel } = require("../../utils/excelHelper");
const svc = require("./lots.service");
const peremptionRisk = require("./peremptionRisk.service");
const { auditFromReq } = require("../../utils/auditHelper");
const prisma = require("../../config/database");

function fmtDateIso(d) {
  if (!d) return "";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "" : x.toISOString().slice(0, 10);
}

function joursRestants(dateExpiration) {
  if (!dateExpiration) return "";
  const exp = new Date(dateExpiration);
  const now = new Date();
  if (Number.isNaN(exp.getTime())) return "";
  const j = Math.ceil(
    (Date.UTC(exp.getFullYear(), exp.getMonth(), exp.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86400000
  );
  return String(j);
}

async function exportExpiring(req, res, next) {
  try {
    const format = String(req.query.format || "csv").toLowerCase();
    const days = req.query.days;
    const depotId = req.query.depotId;
    const rows = await svc.exportLotsExpiring(req.user, { days, depotId });
    if (format === "pdf") {
      const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });
      const tableRows = rows.map((l) => [
        l.numero || "—",
        l.article?.code || "—",
        l.article?.libelle || "—",
        l.depot?.code || "—",
        fmtDateIso(l.dateFabrication) || "—",
        fmtDateIso(l.dateExpiration) || "—",
        String(l.quantiteRestante ?? ""),
        l.statut || "—",
        joursRestants(l.dateExpiration) || "—",
      ]);
      const buf = await generateTabularExportPdf({
        title: "Lots expirant — export",
        societe,
        refPrefix: "LOT",
        layout: "landscape",
        headers: ["N° lot", "Code", "Article", "Dépôt", "Fabrication", "DLC", "Qté", "Statut", "Jours restants"],
        rows: tableRows,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="lots-expiring.pdf"');
      return res.send(buf);
    }
    if (format === "excel") {
      const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });
      const buf = await generateLotsExcel({
        societe,
        rows,
        exportedAt: new Date(),
        days: Number(days) || 30,
      });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", 'attachment; filename="lots-expiring.xlsx"');
      return res.send(Buffer.from(buf));
    }
    const data = rows.map((l) => ({
      Numero_lot: l.numero,
      Article: l.article?.libelle || "",
      Code_article: l.article?.code || "",
      Depot: l.depot?.code || "",
      Date_fabrication: fmtDateIso(l.dateFabrication),
      DLC: fmtDateIso(l.dateExpiration),
      Qte_restante: l.quantiteRestante,
      Statut: l.statut || "",
      Jours_restants: joursRestants(l.dateExpiration),
    }));
    const fields = [
      "Numero_lot",
      "Article",
      "Code_article",
      "Depot",
      "Date_fabrication",
      "DLC",
      "Qte_restante",
      "Statut",
      "Jours_restants",
    ];
    return toCsv(res, data, fields, "lots-expiring.csv");
  } catch (e) {
    return next(e);
  }
}

async function historiqueMouvements(req, res, next) {
  try {
    const rows = await svc.getHistoriqueLot(req.user, req.params.id);
    return res.json({ items: rows });
  } catch (e) {
    return next(e);
  }
}

async function list(req, res, next) {
  try {
    const result = await svc.listLots({
      user: req.user,
      articleId: req.query.articleId,
      statut: req.query.statut,
      depotId: req.query.depotId,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function expiringSoon(req, res, next) {
  try {
    const result = await svc.listLotsExpiringSoon(req.user, {
      days: req.query.days,
      depotId: req.query.depotId,
      limit: req.query.limit,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function peremptionRiskList(req, res, next) {
  try {
    const result = await peremptionRisk.listPeremptionRisk(req.user, {
      days: req.query.days,
      depotId: req.query.depotId,
      niveau: req.query.niveau,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function traceabilite(req, res, next) {
  try {
    const result = await svc.getLotTraceabilite(req.user, req.params.id);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await svc.getLot(req.params.id, req.user.societeId);
    if (!row) return res.status(404).json({ message: "Lot introuvable" });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const row = await svc.createLot(req.body, req.user.societeId);
    await auditFromReq(req, {
      action: "CREATE",
      entite: "Lot",
      entiteId: row.id,
      description: `Création lot ${row.numero}`,
    });
    return res.status(201).json(row);
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const row = await svc.updateLot(req.params.id, req.body, req.user.societeId);
    await auditFromReq(req, {
      action: "UPDATE",
      entite: "Lot",
      entiteId: row.id,
      description: `Modification lot ${row.numero}`,
    });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    const row = await svc.deactivateLot(req.params.id, req.user.societeId);
    await auditFromReq(req, {
      action: "DESACTIVER",
      entite: "Lot",
      entiteId: row.id,
      description: `Désactivation lot ${row.numero}`,
    });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function deactivateWarnings(req, res, next) {
  try {
    const data = await svc.getDeactivateWarnings(req.user, req.params.id);
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function previewPick(req, res, next) {
  try {
    const plan = await svc.previewPickAllocation(req.user, req.query);
    return res.json(plan);
  } catch (e) {
    return next(e);
  }
}

async function sortieLots(req, res, next) {
  try {
    const result = await svc.executeSortieLots(req.user, req.body);
    return res.status(201).json(result);
  } catch (e) {
    return next(e);
  }
}

async function listRappels(req, res, next) {
  try {
    const data = await svc.listRappels(req.user);
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function declencherRappel(req, res, next) {
  try {
    const row = await svc.declencherRappel(req.params.id, req.user, req);
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function notifierClients(req, res, next) {
  try {
    const data = await svc.notifierClientsLot(req.params.id, req.user, req);
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function generateNumero(req, res, next) {
  try {
    const articleId = req.query.articleId;
    if (!articleId) return res.status(400).json({ message: "articleId requis" });
    const result = await svc.previewNumeroLot(req.user, articleId);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

function fmtDateFr(d) {
  if (!d) return "—";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "—" : x.toLocaleDateString("fr-FR");
}

function fmtDateTimeFr(d) {
  if (!d) return "—";
  const x = new Date(d);
  return Number.isNaN(x.getTime())
    ? "—"
    : x.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

async function traceabilitePdf(req, res, next) {
  try {
    const { lot, mouvements } = await svc.getLotTraceabilite(req.user, req.params.id);
    const clients = await svc.getLotClientsTraceabilite(req.user, req.params.id);
    const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });

    const { doc, contentTop, contentLeft, contentWidth, finishFootersAndHeaders, absText: t, ensureSpace, accent } =
      createBaseDoc("Traçabilité lot → clients", societe, { refPrefix: "TRC" });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    let y = contentTop;
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(14);
    t(`Lot ${lot.numero}`, contentLeft, y, { width: contentWidth });
    y += 20;
    doc.fillColor("#374151").font("Helvetica").fontSize(9);
    const infoLines = [
      `Article : ${lot.article?.code || ""} — ${lot.article?.libelle || ""}`,
      `Dépôt d'origine : ${lot.depot?.code || ""} ${lot.depot?.libelle || ""}`,
      `Fabrication : ${fmtDateFr(lot.dateFabrication)} · Expiration : ${fmtDateFr(lot.dateExpiration)}`,
      `Statut : ${lot.statut || "—"} · Qté initiale : ${lot.quantiteInitiale} · Qté restante : ${lot.quantiteRestante}`,
    ];
    infoLines.forEach((line) => {
      t(line, contentLeft, y, { width: contentWidth });
      y += 14;
    });
    y += 8;

    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10);
    t("Historique des mouvements", contentLeft, y, { width: contentWidth });
    y += 16;

    const mvtRows = mouvements.map((m) => [
      fmtDateTimeFr(m.createdAt),
      m.type || "—",
      m.depot?.code || "—",
      String(m.quantite ?? ""),
      [m.utilisateur?.prenom, m.utilisateur?.nom].filter(Boolean).join(" ") || "—",
    ]);
    y = drawTable(doc, {
      headers: ["Date", "Type", "Dépôt", "Qté", "Utilisateur"],
      rows: mvtRows.length ? mvtRows : [["—", "Aucun mouvement", "—", "—", "—"]],
      startY: y,
      accentHex: accent,
      contentLeft,
      contentWidth,
      ensureSpace,
      colWidths: [90, 80, 60, 45, contentWidth - 275],
    });
    y += 16;

    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10);
    t("Clients ayant reçu ce lot", contentLeft, y, { width: contentWidth });
    y += 16;

    const clientRows = clients.map((c) => [
      c.clientNom || "—",
      c.referenceVente || "—",
      fmtDateFr(c.dateVente),
      String(c.quantite ?? ""),
      [c.clientEmail, c.clientTelephone].filter(Boolean).join(" / ") || "—",
    ]);
    drawTable(doc, {
      headers: ["Client", "Réf. vente", "Date", "Qté", "Contact"],
      rows: clientRows.length ? clientRows : [["—", "Aucun client identifié", "—", "—", "—"]],
      startY: y,
      accentHex: accent,
      contentLeft,
      contentWidth,
      ensureSpace,
      colWidths: [100, 80, 70, 40, contentWidth - 290],
    });

    finishFootersAndHeaders();
    doc.end();

    const buffer = await done;
    const safeName = String(lot.numero).replace(/[^\w.-]+/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="tracabilite-lot-${safeName}.pdf"`);
    await auditFromReq(req, {
      action: "EXPORT_PDF",
      entite: "Lot",
      entiteId: lot.id,
      module: "Lots",
      description: `Export PDF traçabilité lot ${lot.numero}`,
    });
    return res.send(buffer);
  } catch (e) {
    return next(e);
  }
}

async function qrcode(req, res, next) {
  try {
    const lot = await svc.getLot(req.params.id, req.user.societeId);
    if (!lot) return res.status(404).json({ message: "Lot introuvable" });

    const { frontendLanOrigin } = require("../../utils/lanOrigin");
    const frontUrl = frontendLanOrigin();
    const payload = `${frontUrl}/stock/lots/scan/${lot.id}`;

    const buffer = await QRCode.toBuffer(payload, {
      type: "png",
      width: 320,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    });

    await auditFromReq(req, {
      action: "GENERATE_QR",
      entite: "Lot",
      entiteId: lot.id,
      module: "Lots",
      description: `Génération QR code lot ${lot.numero}`,
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `inline; filename="qrcode-lot-${lot.numero}.png"`);
    return res.send(buffer);
  } catch (e) {
    return next(e);
  }
}

async function statutRappel(req, res, next) {
  try {
    const { statut } = req.body || {};
    if (!statut) return res.status(400).json({ message: "statut requis" });
    const row = await svc.updateStatutRappel(req.params.id, statut, req.user, req);
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  expiringSoon,
  peremptionRiskList,
  exportExpiring,
  generateNumero,
  historiqueMouvements,
  traceabilite,
  traceabilitePdf,
  qrcode,
  getOne,
  create,
  update,
  remove,
  deactivateWarnings,
  previewPick,
  sortieLots,
  listRappels,
  declencherRappel,
  notifierClients,
  statutRappel,
};
