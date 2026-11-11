const { toCsv } = require("../../utils/exportCsv");
const { generateTabularExportPdf } = require("../../utils/pdfHelper");
const { generateMouvementsExcel } = require("../../utils/excelHelper");
const mouvementsService = require("./mouvements.service");
const { auditFromReq } = require("../../utils/auditHelper");
const prisma = require("../../config/database");

function fmtUser(u) {
  if (!u) return "";
  return [u.prenom, u.nom].filter(Boolean).join(" ").trim();
}

async function list(req, res, next) {
  try {
    const result = await mouvementsService.listMouvements(req.user, req.query);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function exportList(req, res, next) {
  try {
    const format = String(req.query.format || "csv").toLowerCase();
    const rows = await mouvementsService.exportMouvements(req.user, req.query);
    if (format === "pdf") {
      const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });
      const tableRows = rows.map((m) => [
        m.createdAt ? new Date(m.createdAt).toLocaleString("fr-FR") : "—",
        m.type || "—",
        m.article?.code || "—",
        m.article?.libelle || "—",
        m.depot?.code || "—",
        String(m.quantite ?? ""),
        m.valeur != null ? String(m.valeur) : "—",
        (m.commentaire || "").replace(/\s+/g, " ").slice(0, 60),
        fmtUser(m.utilisateur) || "—",
      ]);
      const buf = await generateTabularExportPdf({
        title: "Export des mouvements de stock",
        societe,
        refPrefix: "MVT",
        layout: "landscape",
        headers: ["Date", "Type", "Code", "Article", "Dépôt", "Qté", "Valeur", "Commentaire", "Utilisateur"],
        rows: tableRows,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="mouvements-export.pdf"');
      return res.send(buf);
    }
    if (format === "excel") {
      const societe = await prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } });
      const buf = await generateMouvementsExcel({ societe, rows, exportedAt: new Date() });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", 'attachment; filename="mouvements-export.xlsx"');
      return res.send(Buffer.from(buf));
    }
    const data = rows.map((m) => ({
      Date: m.createdAt ? new Date(m.createdAt).toISOString() : "",
      Type: m.type,
      Article: m.article?.code ?? "",
      Libelle_article: m.article?.libelle ?? "",
      Depot: m.depot?.code ?? "",
      Emplacement: "",
      Quantite: m.quantite,
      Prix_unitaire: m.valeur ?? "",
      Commentaire: (m.commentaire || "").replace(/\r?\n/g, " "),
      Utilisateur: fmtUser(m.utilisateur),
    }));
    const fields = [
      "Date",
      "Type",
      "Article",
      "Libelle_article",
      "Depot",
      "Emplacement",
      "Quantite",
      "Prix_unitaire",
      "Commentaire",
      "Utilisateur",
    ];
    return toCsv(res, data, fields, "mouvements-export.csv");
  } catch (error) {
    return next(error);
  }
}

async function entree(req, res, next) {
  try {
    const row = await mouvementsService.createEntree(req.user, req.body);
    await auditFromReq(req, {
      action: "CREATE",
      entite: "Mouvement",
      entiteId: row?.id,
      description: `Entrée stock ${row?.reference || ""}`,
    });
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function sortie(req, res, next) {
  try {
    const row = await mouvementsService.createSortie(req.user, req.body);
    await auditFromReq(req, {
      action: "CREATE",
      entite: "Mouvement",
      entiteId: row?.id,
      description: `Sortie stock ${row?.reference || ""}`,
    });
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function transfert(req, res, next) {
  try {
    const row = await mouvementsService.createTransfert(req.user, req.body);
    await auditFromReq(req, {
      action: "TRANSFER",
      entite: "Mouvement",
      entiteId: row?.id,
      description: `Transfert stock ${row?.reference || ""}`,
    });
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function transfertEmplacement(req, res, next) {
  try {
    const row = await mouvementsService.createTransfertEmplacement(req.user, req.body);
    await auditFromReq(req, {
      action: "TRANSFER_EMPLACEMENT",
      entite: "Mouvement",
      entiteId: row?.id,
      description: `Transfert emplacement ${row?.reference || ""}`,
    });
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

async function valider(req, res, next) {
  try {
    const row = await mouvementsService.validerMouvement(req.user, req.params.id);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function rejeter(req, res, next) {
  try {
    const row = await mouvementsService.rejeterMouvement(req.user, req.params.id, req.body || {});
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, exportList, entree, sortie, transfert, transfertEmplacement, valider, rejeter };
