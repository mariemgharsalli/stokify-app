const prisma = require("../../config/database");
const AppError = require("../../utils/AppError");
const { getSocieteWhere } = require("../../utils/societeScope");
const { resolveClientForUser } = require("../panier/clientResolver");

const auteurSelect = { id: true, prenom: true, nom: true, role: true };

const includeList = {
  client: { select: { id: true, nom: true, code: true } },
  article: { select: { id: true, code: true, libelle: true, imageUrl: true } },
  commande: { select: { id: true, reference: true, statut: true } },
  messages: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { auteur: { select: auteurSelect } },
  },
};

const includeDetail = {
  client: { select: { id: true, nom: true, code: true } },
  article: { select: { id: true, code: true, libelle: true, imageUrl: true } },
  commande: { select: { id: true, reference: true, statut: true } },
  messages: {
    orderBy: { createdAt: "asc" },
    include: { auteur: { select: auteurSelect } },
  },
};

function cleanMessage(raw) {
  const text = String(raw || "").trim();
  if (text.length < 2 || text.length > 2000) {
    throw new AppError("Le message doit contenir entre 2 et 2000 caractères.", "VALIDATION_ERROR", 400);
  }
  return text;
}

function present(demande, user) {
  if (!demande) return demande;
  const nonLu = user.role === "CLIENT" ? Boolean(demande.nonLuClient) : Boolean(demande.nonLuEquipe);
  const apercu = demande.messages?.[0]?.corps || "";
  return { ...demande, nonLu, apercu };
}

async function scopeWhere(user) {
  const { societeId } = getSocieteWhere(user);
  if (user.role === "CLIENT") {
    const { client } = await resolveClientForUser(user);
    return { societeId, clientId: client.id };
  }
  return { societeId };
}

async function findVisible(user, id) {
  const where = await scopeWhere(user);
  return prisma.demandeClient.findFirst({
    where: { ...where, id: Number(id) },
  });
}

async function countUnread(user) {
  const where = await scopeWhere(user);
  if (user.role === "CLIENT") where.nonLuClient = true;
  else where.nonLuEquipe = true;
  where.statut = "OUVERTE";
  const count = await prisma.demandeClient.count({ where });
  return { count };
}

async function listDemandes(user) {
  const where = await scopeWhere(user);
  const items = await prisma.demandeClient.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 40,
    include: includeList,
  });
  return { items: items.map((item) => present(item, user)) };
}

async function getOne(user, id) {
  const demande = await findVisible(user, id);
  if (!demande) throw new AppError("Demande introuvable", "NOT_FOUND", 404);

  const fromClient = user.role === "CLIENT";
  const unread = fromClient ? demande.nonLuClient : demande.nonLuEquipe;
  if (unread) {
    await prisma.demandeClient.update({
      where: { id: demande.id },
      data: fromClient ? { nonLuClient: false } : { nonLuEquipe: false },
    });
  }

  const full = await prisma.demandeClient.findUnique({
    where: { id: demande.id },
    include: includeDetail,
  });
  return present(full, user);
}

async function findOpenBySubject(user, { articleId, commandeId }) {
  if (!articleId && !commandeId) {
    throw new AppError("Indiquez un article ou une commande.", "VALIDATION_ERROR", 400);
  }
  const where = await scopeWhere(user);
  where.statut = "OUVERTE";
  if (articleId) where.articleId = Number(articleId);
  else where.commandeId = Number(commandeId);
  const demande = await prisma.demandeClient.findFirst({
    where,
    orderBy: { updatedAt: "desc" },
    include: includeDetail,
  });
  return { demande: demande ? present(demande, user) : null };
}

async function assertSubject(societeId, clientId, { articleId, commandeId }) {
  const hasArticle = articleId != null && articleId !== "";
  const hasCommande = commandeId != null && commandeId !== "";
  if (hasArticle === hasCommande) {
    throw new AppError("Indiquez un article ou une commande.", "VALIDATION_ERROR", 400);
  }

  if (hasArticle) {
    const article = await prisma.article.findFirst({
      where: { id: Number(articleId), societeId },
      select: { id: true },
    });
    if (!article) throw new AppError("Article introuvable", "NOT_FOUND", 404);
    return { articleId: article.id, commandeId: null, sujet: "ARTICLE" };
  }

  const commande = await prisma.commandeClient.findFirst({
    where: { id: Number(commandeId), societeId, clientId },
    select: { id: true },
  });
  if (!commande) throw new AppError("Commande introuvable", "NOT_FOUND", 404);
  return { articleId: null, commandeId: commande.id, sujet: "COMMANDE" };
}

async function createDemande(user, body) {
  if (user.role !== "CLIENT") {
    throw new AppError("Seul un client peut ouvrir une demande.", "FORBIDDEN", 403);
  }
  const text = cleanMessage(body?.message);
  const { client, societeId } = await resolveClientForUser(user);
  const subject = await assertSubject(societeId, client.id, body);

  const existing = await prisma.demandeClient.findFirst({
    where: {
      societeId,
      clientId: client.id,
      statut: "OUVERTE",
      sujet: subject.sujet,
      ...(subject.articleId ? { articleId: subject.articleId } : { commandeId: subject.commandeId }),
    },
  });

  if (existing) {
    return reply(user, existing.id, text);
  }

  const created = await prisma.demandeClient.create({
    data: {
      societeId,
      clientId: client.id,
      articleId: subject.articleId,
      commandeId: subject.commandeId,
      sujet: subject.sujet,
      statut: "OUVERTE",
      nonLuEquipe: true,
      nonLuClient: false,
      messages: { create: { auteurId: Number(user.id), corps: text } },
    },
    include: includeDetail,
  });
  return present(created, user);
}

async function reply(user, id, message) {
  const text = cleanMessage(message);
  const demande = await findVisible(user, id);
  if (!demande) throw new AppError("Demande introuvable", "NOT_FOUND", 404);
  if (demande.statut === "FERMEE") {
    throw new AppError("Cette demande est clôturée.", "CONFLICT", 409);
  }

  const fromClient = user.role === "CLIENT";
  await prisma.messageDemande.create({
    data: { demandeId: demande.id, auteurId: Number(user.id), corps: text },
  });
  const updated = await prisma.demandeClient.update({
    where: { id: demande.id },
    data: {
      nonLuEquipe: fromClient,
      nonLuClient: !fromClient,
    },
    include: includeDetail,
  });
  return present(updated, user);
}

async function closeDemande(user, id) {
  const demande = await findVisible(user, id);
  if (!demande) throw new AppError("Demande introuvable", "NOT_FOUND", 404);
  const updated = await prisma.demandeClient.update({
    where: { id: demande.id },
    data: { statut: "FERMEE", nonLuEquipe: false, nonLuClient: false },
    include: includeDetail,
  });
  return present(updated, user);
}

module.exports = {
  countUnread,
  listDemandes,
  getOne,
  findOpenBySubject,
  createDemande,
  reply,
  closeDemande,
};
