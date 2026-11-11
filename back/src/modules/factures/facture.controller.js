const factureService = require("./facture.service");

async function pdf(req, res, next) {
  try {
    const buf = await factureService.generateFacturePDF(req.params.id, req.user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="facture-${req.params.id}.pdf"`);
    return res.send(buf);
  } catch (error) {
    return next(error);
  }
}

async function apercu(req, res, next) {
  try {
    const data = await factureService.getApercuFacture(req.user, req.params.id);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

async function envoyerEmail(req, res, next) {
  try {
    const row = await factureService.envoyerEmailFacture(req.user, req.params.id, req.body);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function byVente(req, res, next) {
  try {
    const row = await factureService.getFactureByVente(req.user, req.params.venteId);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function listRelances(req, res, next) {
  try {
    const items = await factureService.listFacturesEnRetard(req.user);
    return res.json({ items, total: items.length });
  } catch (error) {
    return next(error);
  }
}

async function relancer(req, res, next) {
  try {
    const envoyerEmail = req.body?.envoyerEmail !== false;
    const row = await factureService.creerRelanceManuelle(req.user, req.params.id, { envoyerEmail });
    return res.status(201).json(row);
  } catch (error) {
    return next(error);
  }
}

module.exports = { pdf, apercu, envoyerEmail, byVente, listRelances, relancer };
