const { getSocieteWhere } = require("../../utils/societeScope");
const svc = require("./fournisseurs.service");

async function getNextCode(req, res, next) {
  try {
    const code = await svc.generateFournisseurCode(req.user.societeId);
    return res.json({ code });
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const result = await svc.listFournisseurs({
      user: req.user,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
      statut: req.query.statut,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await svc.getFournisseur(req.params.id, req.user.societeId);
    if (!row) return res.status(404).json({ message: "Fournisseur introuvable" });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const row = await svc.createFournisseur(req.body, req.user.societeId);
    return res.status(201).json(row);
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const body = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(req.body, "actif")) {
      const raw = req.body.actif;
      const parsed =
        raw === false || raw === "false" || raw === 0 || raw === "0"
          ? false
          : raw === true || raw === "true" || raw === 1 || raw === "1"
            ? true
            : undefined;
      if (parsed === undefined) {
        return res.status(400).json({ message: "actif doit etre true ou false" });
      }
      body.actif = parsed;
    }
    const row = await svc.updateFournisseur(req.params.id, body, req.user.societeId);
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    await svc.deleteFournisseur(req.params.id, req.user.societeId);
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
}

async function statsFournisseur(req, res, next) {
  try {
    const { societeId } = getSocieteWhere(req.user);
    const result = await svc.getStatsFournisseur(req.params.id, societeId);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function proximite(req, res, next) {
  try {
    const { societeId } = getSocieteWhere(req.user);
    const { lat, lng, rayonKm } = req.query;
    const result = await svc.getFournisseursByProximite(societeId, lat, lng, rayonKm);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function historiqueAchats(req, res, next) {
  try {
    const { societeId } = getSocieteWhere(req.user);
    const result = await svc.getHistoriqueAchatsFournisseur(req.params.id, societeId, req.query);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getOne, create, update, remove, statsFournisseur, proximite, historiqueAchats, getNextCode };
