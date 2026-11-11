const prisma = require("../../config/database");
const svc = require("./reglements.service");
const { auditFromReq } = require("../../utils/auditHelper");

function pieceJointeFromReq(req) {
  if (req.file?.filename) return `/uploads/reglements/${req.file.filename}`;
  if (req.body?.pieceJointeUrl) return String(req.body.pieceJointeUrl).trim() || null;
  return null;
}

function parseBodyNumber(val) {
  if (val == null || val === "") return val;
  const n = Number(val);
  return Number.isFinite(n) ? n : val;
}

async function listVente(req, res, next) {
  try {
    const rows = await svc.listVenteReglements(req.params.venteId, req.user.societeId);
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
}

async function createVente(req, res, next) {
  try {
    const body = {
      ...req.body,
      montant: parseBodyNumber(req.body.montant),
      venteId: req.params.venteId,
      pieceJointeUrl: pieceJointeFromReq(req),
    };
    const row = await svc.createVenteReglement(body, req.user.societeId);
    await auditFromReq(req, {
      action: "CREATE_REGLEMENT",
      entite: "Reglement",
      entiteId: row.id,
      module: "reglements",
      description: `Encaissement vente #${req.params.venteId} — ${row.montant} TND (${row.mode}${row.reference ? ` / ${row.reference}` : ""})`,
      nouvelleValeur: JSON.stringify({
        venteId: Number(req.params.venteId),
        montant: row.montant,
        mode: row.mode,
        reference: row.reference,
      }),
    });
    return res.status(201).json(row);
  } catch (e) {
    return next(e);
  }
}

async function removeVente(req, res, next) {
  try {
    const before = await prisma.reglement.findFirst({
      where: { id: Number(req.params.id), vente: { societeId: Number(req.user.societeId) } },
    });
    await svc.deleteVenteReglement(req.params.id, req.user.societeId);
    await auditFromReq(req, {
      action: "DELETE_REGLEMENT",
      entite: "Reglement",
      entiteId: req.params.id,
      module: "reglements",
      description: before
        ? `Suppression encaissement #${before.id} — ${before.montant} TND (${before.mode}${before.reference ? ` / ${before.reference}` : ""})`
        : `Suppression règlement vente #${req.params.id}`,
      ancienneValeur: before
        ? JSON.stringify({
            venteId: before.venteId,
            montant: before.montant,
            mode: before.mode,
            reference: before.reference,
          })
        : null,
    });
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
}

async function listAchat(req, res, next) {
  try {
    const rows = await svc.listAchatReglements(req.params.achatId, req.user.societeId);
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
}

async function createAchat(req, res, next) {
  try {
    const body = {
      ...req.body,
      montant: parseBodyNumber(req.body.montant),
      achatId: req.params.achatId,
      pieceJointeUrl: pieceJointeFromReq(req),
    };
    const row = await svc.createAchatReglement(body, req.user.societeId);
    await auditFromReq(req, {
      action: "CREATE_REGLEMENT",
      entite: "ReglementAchat",
      entiteId: row.id,
      module: "reglements",
      description: `Règlement achat #${req.params.achatId} — ${row.montant} TND (${row.mode}${row.reference ? ` / ${row.reference}` : ""})`,
      nouvelleValeur: JSON.stringify({
        achatId: Number(req.params.achatId),
        montant: row.montant,
        mode: row.mode,
        reference: row.reference,
      }),
    });
    return res.status(201).json(row);
  } catch (e) {
    return next(e);
  }
}

async function removeAchat(req, res, next) {
  try {
    const before = await prisma.reglementAchat.findFirst({
      where: { id: Number(req.params.id), achat: { societeId: Number(req.user.societeId) } },
    });
    await svc.deleteAchatReglement(req.params.id, req.user.societeId);
    await auditFromReq(req, {
      action: "DELETE_REGLEMENT",
      entite: "ReglementAchat",
      entiteId: req.params.id,
      module: "reglements",
      description: before
        ? `Suppression règlement achat #${before.id} — ${before.montant} TND (${before.mode}${before.reference ? ` / ${before.reference}` : ""})`
        : `Suppression règlement achat #${req.params.id}`,
      ancienneValeur: before
        ? JSON.stringify({
            achatId: before.achatId,
            montant: before.montant,
            mode: before.mode,
            reference: before.reference,
          })
        : null,
    });
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
}

async function stats(req, res, next) {
  try {
    const data = await svc.getStatsReglements(req.user);
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function listAllVentes(req, res, next) {
  try {
    const rows = await svc.listAllVenteReglements(req.user, req.query);
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
}

async function listAllAchats(req, res, next) {
  try {
    const rows = await svc.listAllAchatReglements(req.user, req.query);
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  listVente,
  createVente,
  removeVente,
  listAchat,
  createAchat,
  removeAchat,
  stats,
  listAllVentes,
  listAllAchats,
};
