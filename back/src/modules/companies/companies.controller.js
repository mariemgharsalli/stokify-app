const companiesService = require("./companies.service");

async function publicList(req, res, next) {
  try {
    const data = await companiesService.listPublicCompanies();
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function adminList(req, res, next) {
  try {
    const data = await companiesService.listCompanies({
      callerRole: req.user.role,
      callerSocieteId: req.user.societeId,
    });
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const b = req.body;
    const actifRaw = b.actif;
    const actif =
      actifRaw === false || actifRaw === "false"
        ? false
        : actifRaw === true || actifRaw === "true"
          ? true
          : undefined;
    const data = {
      code: b.code,
      nom: b.nom,
      email: b.email,
      ...(actif !== undefined ? { actif } : {}),
      ...(b.adresse !== undefined ? { adresse: b.adresse } : {}),
      ...(b.ville !== undefined ? { ville: b.ville } : {}),
      ...(b.latitude !== undefined ? { latitude: b.latitude } : {}),
      ...(b.longitude !== undefined ? { longitude: b.longitude } : {}),
    };
    const company = await companiesService.createCompany(data);
    if (req.file) {
      const logoUrl = `/uploads/logos/${req.file.filename}`;
      const updated = await companiesService.updateCompanyLogo(company.id, logoUrl);
      return res.status(201).json(updated);
    }
    return res.status(201).json(company);
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const result = await companiesService.updateCompany(req.params.id, req.body, req);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function seuilValidation(req, res, next) {
  try {
    const result = await companiesService.definirSeuilValidationMouvement(
      req.user,
      req.params.id,
      req.body?.seuilValidationMouvement,
      req
    );
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    await companiesService.deleteCompany(req.params.id);
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
}

async function platformSummary(req, res, next) {
  try {
    const data = await companiesService.getPlatformSummary();
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function globalStats(req, res, next) {
  try {
    const data = await companiesService.getGlobalStats();
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function uploadLogo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Aucun fichier reçu" });
    }
    const id = Number(req.params.id);
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    const updated = await companiesService.updateCompanyLogo(id, logoUrl);
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  publicList,
  adminList,
  create,
  update,
  seuilValidation,
  remove,
  platformSummary,
  globalStats,
  uploadLogo,
};
