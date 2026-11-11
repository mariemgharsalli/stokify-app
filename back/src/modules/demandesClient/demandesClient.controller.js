const service = require("./demandesClient.service");

async function count(req, res, next) {
  try {
    return res.json(await service.countUnread(req.user));
  } catch (e) {
    return next(e);
  }
}

async function list(req, res, next) {
  try {
    return res.json(await service.listDemandes(req.user));
  } catch (e) {
    return next(e);
  }
}

async function sujet(req, res, next) {
  try {
    return res.json(
      await service.findOpenBySubject(req.user, {
        articleId: req.query.articleId,
        commandeId: req.query.commandeId,
      })
    );
  } catch (e) {
    return next(e);
  }
}

async function getOne(req, res, next) {
  try {
    return res.json(await service.getOne(req.user, req.params.id));
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    return res.status(201).json(await service.createDemande(req.user, req.body));
  } catch (e) {
    return next(e);
  }
}

async function reply(req, res, next) {
  try {
    return res.status(201).json(await service.reply(req.user, req.params.id, req.body?.message));
  } catch (e) {
    return next(e);
  }
}

async function close(req, res, next) {
  try {
    return res.json(await service.closeDemande(req.user, req.params.id));
  } catch (e) {
    return next(e);
  }
}

module.exports = { count, list, sujet, getOne, create, reply, close };
