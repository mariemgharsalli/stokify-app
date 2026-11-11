const prisma = require("../../config/database");
const { getSocieteWhere } = require("../../utils/societeScope");
const { activityFromReq } = require("../../services/activityLogger");
const svc = require("./retoursFournisseur.service");

async function list(req, res, next) {
  try {
    const { societeId } = getSocieteWhere(req.user);
    const items = await svc.listRetoursFournisseur(prisma, {
      societeId,
      fournisseurId: req.query.fournisseurId,
      achatId: req.query.achatId,
    });
    return res.json({ items });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const { societeId } = getSocieteWhere(req.user);
    const result = await svc.creerRetourFournisseur(prisma, {
      societeId,
      fournisseurId: req.body.fournisseurId,
      articleId: req.body.articleId,
      depotId: req.body.depotId,
      quantite: req.body.quantite,
      motif: req.body.motif,
      achatId: req.body.achatId,
      userId: req.user.id,
    });
    await activityFromReq(req, {
      action: "CREATE",
      module: "achats",
      entity: "RetourFournisseur",
      entityId: result.retour.id,
      entityLabel: `Retour fournisseur ${result.retour.reference}`,
    });
    return res.status(201).json(result);
  } catch (e) {
    return next(e);
  }
}

async function pdf(req, res, next) {
  try {
    const { buffer, reference } = await svc.getBonRetourPdf(prisma, req.user, req.params.id);
    const safeRef = String(reference || req.params.id).replace(/[^\w.-]+/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="bon-retour-${safeRef}.pdf"`);
    return res.send(buffer);
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, create, pdf };
