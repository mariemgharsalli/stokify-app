const { getSocieteWhere } = require("../../utils/societeScope");
const svc = require("./clients.service");

async function getNextCode(req, res, next) {
  try {
    const code = await svc.generateClientCode(req.user.societeId);
    return res.json({ code });
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const result = await svc.listClients({
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
    const row = await svc.getClient(req.params.id, req.user.societeId);
    if (!row) return res.status(404).json({ message: "Client introuvable" });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const row = await svc.createClient(req.body, req.user.societeId);
    return res.status(201).json(row);
  } catch (e) {
    return next(e);
  }
}

function parseActif(raw) {
  if (raw === false || raw === "false" || raw === 0 || raw === "0") return false;
  if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
  return undefined;
}

async function update(req, res, next) {
  try {
    const body = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(req.body, "actif")) {
      const parsed = parseActif(req.body.actif);
      if (parsed === undefined) {
        return res.status(400).json({ message: "actif doit etre true ou false" });
      }
      body.actif = parsed;
    }
    const row = await svc.updateClient(req.params.id, body, req.user.societeId);
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    await svc.deleteClient(req.params.id, req.user.societeId);
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
}

async function statsClient(req, res, next) {
  try {
    const { societeId } = getSocieteWhere(req.user);
    const result = await svc.getStatsClient(req.params.id, societeId);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function historiqueVentes(req, res, next) {
  try {
    const { societeId } = getSocieteWhere(req.user);
    const result = await svc.getHistoriqueVentesClient(req.params.id, societeId, req.query);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function encoursList(req, res, next) {
  try {
    const result = await svc.listEncoursClients(req.user);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function encoursClient(req, res, next) {
  try {
    const { societeId } = getSocieteWhere(req.user);
    const result = await svc.getEncoursClient(req.params.id, societeId);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function relancer(req, res, next) {
  try {
    const result = await svc.relancerClient(req.user, req.params.id, req.body);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function listUtilisateursEnAttente(req, res, next) {
  try {
    const rows = await svc.listUtilisateursEnAttente(req.user);
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
}

async function rattacherUtilisateur(req, res, next) {
  try {
    const utilisateurId = req.body?.utilisateurId;
    if (utilisateurId == null || utilisateurId === "") {
      return res.status(400).json({ message: "utilisateurId requis" });
    }
    const row = await svc.rattacherUtilisateur(req.params.clientId, utilisateurId, req.user);
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function getMe(req, res, next) {
  try {
    if (req.user?.role !== "CLIENT") {
      return res.status(403).json({ message: "Accès réservé aux clients" });
    }
    const row = await svc.getMyClient(req.user);
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function updateMe(req, res, next) {
  try {
    if (req.user?.role !== "CLIENT") {
      return res.status(403).json({ message: "Accès réservé aux clients" });
    }
    const row = await svc.updateMyClient(req.user, req.body || {});
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  statsClient,
  historiqueVentes,
  encoursList,
  encoursClient,
  relancer,
  getMe,
  updateMe,
  listUtilisateursEnAttente,
  rattacherUtilisateur,
  getNextCode,
};
