const prisma = require("../../config/database");
const fs = require("fs");
const path = require("path");
const { auditFromReq, createAudit } = require("../../utils/auditHelper");

async function auditCompany(req, data) {
  if (req) return auditFromReq(req, data);
  return createAudit(data);
}

function optionalTrimmedString(v) {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

/**
 * Latitude / longitude ensemble : soit les deux présents et valides, soit les deux null.
 */
function normalizeLatLngPair(lat, lng) {
  const emptyLat = lat == null || (typeof lat === "string" && lat.trim() === "");
  const emptyLng = lng == null || (typeof lng === "string" && lng.trim() === "");
  if (emptyLat && emptyLng) return { latitude: null, longitude: null };
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const err = new Error("Latitude et longitude invalides");
    err.status = 400;
    throw err;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    const err = new Error("Coordonnees hors limites");
    err.status = 400;
    throw err;
  }
  return { latitude, longitude };
}

async function listPublicCompanies() {
  return prisma.societe.findMany({
    where: { actif: true },
    select: { id: true, code: true, nom: true, logo: true },
    orderBy: { nom: "asc" },
  });
}

const adminCompanySelect = {
  id: true,
  code: true,
  nom: true,
  email: true,
  adresse: true,
  ville: true,
  latitude: true,
  longitude: true,
  telephones: true,
  actif: true,
  logo: true,
  deadStockSeuil: true,
  joursRelanceClient: true,
};

/**
 * Liste des sociétés selon le rôle : SUPER_ADMIN voit tout ; ADMIN uniquement la sienne.
 */
async function listCompanies({ callerRole, callerSocieteId }) {
  if (callerRole === "SUPER_ADMIN") {
    return prisma.societe.findMany({
      select: {
        ...adminCompanySelect,
        _count: { select: { utilisateurs: true, articles: true, depots: true } },
      },
      orderBy: { nom: "asc" },
    });
  }

  if (callerRole === "ADMIN") {
    const sid = Number(callerSocieteId);
    if (!Number.isInteger(sid) || sid < 1) {
      return [];
    }
    return prisma.societe.findMany({
      where: { id: sid },
      select: {
        ...adminCompanySelect,
        _count: { select: { utilisateurs: true, articles: true, depots: true } },
      },
      orderBy: { id: "desc" },
    });
  }

  const err = new Error("Acces refuse");
  err.status = 403;
  throw err;
}

async function createCompany(data) {
  try {
    const coords = normalizeLatLngPair(data.latitude, data.longitude);
    return await prisma.societe.create({
      data: {
        code: String(data.code).trim(),
        nom: String(data.nom).trim(),
        actif: typeof data.actif === "boolean" ? data.actif : true,
        email: data.email ? String(data.email).trim() : null,
        adresse: optionalTrimmedString(data.adresse),
        ville: optionalTrimmedString(data.ville),
        latitude: coords.latitude,
        longitude: coords.longitude,
        telephones: data.telephones || null,
        ...(data.deadStockSeuil != null && Number(data.deadStockSeuil) >= 0
          ? { deadStockSeuil: Math.floor(Number(data.deadStockSeuil)) }
          : {}),
        ...(data.joursRelanceClient != null && [15, 30, 60].includes(Number(data.joursRelanceClient))
          ? { joursRelanceClient: Number(data.joursRelanceClient) }
          : {}),
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      const err = new Error("Ce code societe existe deja");
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

async function updateCompany(id, data, req) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1) {
    const err = new Error("ID societe invalide");
    err.status = 400;
    throw err;
  }

  const existing = await prisma.societe.findUnique({
    where: { id: numericId },
    select: { id: true, code: true, nom: true, actif: true },
  });
  if (!existing) {
    const err = new Error("Societe introuvable");
    err.status = 404;
    throw err;
  }

  const payload = {
    nom: String(data.nom ?? "").trim(),
  };
  if (Object.prototype.hasOwnProperty.call(data, "email")) {
    const raw = data.email;
    payload.email =
      raw == null || String(raw).trim() === "" ? null : String(raw).trim();
  }
  if (data.adresse !== undefined) payload.adresse = optionalTrimmedString(data.adresse);
  if (data.telephones !== undefined) payload.telephones = data.telephones || null;
  if (Object.prototype.hasOwnProperty.call(data, "actif")) {
    payload.actif = Boolean(data.actif);
  }
  if (Object.prototype.hasOwnProperty.call(data, "ville")) {
    payload.ville = optionalTrimmedString(data.ville);
  }

  const hasLat = Object.prototype.hasOwnProperty.call(data, "latitude");
  const hasLng = Object.prototype.hasOwnProperty.call(data, "longitude");
  if (hasLat !== hasLng) {
    const err = new Error("Latitude et longitude doivent etre envoyees ensemble");
    err.status = 400;
    throw err;
  }
  if (hasLat) {
    const coords = normalizeLatLngPair(data.latitude, data.longitude);
    payload.latitude = coords.latitude;
    payload.longitude = coords.longitude;
  }
  if (Object.prototype.hasOwnProperty.call(data, "deadStockSeuil")) {
    const v = Number(data.deadStockSeuil);
    if (Number.isFinite(v) && v >= 0) {
      payload.deadStockSeuil = Math.floor(v);
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, "joursRelanceClient")) {
    const v = Number(data.joursRelanceClient);
    if ([15, 30, 60].includes(v)) {
      payload.joursRelanceClient = v;
    }
  }

  const updated = await prisma.societe.update({
    where: { id: numericId },
    data: payload,
  });

  if (
    Object.prototype.hasOwnProperty.call(payload, "actif") &&
    Boolean(existing.actif) !== Boolean(payload.actif)
  ) {
    const nextActif = Boolean(payload.actif);
    await auditCompany(req, {
      userId: req?.user?.id,
      societeId: updated.id,
      action: nextActif ? "SOCIETE_ACTIVATE" : "SOCIETE_DEACTIVATE",
      entite: "Societe",
      entiteId: updated.id,
      module: "companies",
      description: nextActif
        ? `Société activée (${updated.code} — ${updated.nom})`
        : `Société désactivée (${updated.code} — ${updated.nom})`,
      ancienneValeur: String(existing.actif),
      nouvelleValeur: String(nextActif),
    }).catch(() => {});
  }

  return updated;
}

async function deleteCompany(id) {
  try {
    await prisma.societe.delete({ where: { id: Number(id) } });
  } catch (error) {
    if (error.code === "P2003") {
      const err = new Error("Impossible de supprimer: des donnees sont liees a cette societe");
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

/**
 * Agrégats multi-sociétés (console super-admin, sans contexte société).
 */
/** Totaux plateforme (super-admin, sans filtre société). */
async function getGlobalStats() {
  const [totalSocietes, totalUsers, totalArticles, stockValRows] = await Promise.all([
    prisma.societe.count(),
    prisma.utilisateur.count(),
    prisma.article.count({ where: { actif: true } }),
    prisma.$queryRaw`SELECT COALESCE(SUM(s.quantite * COALESCE(a.prixAchat, 0)), 0) AS v FROM Stock s INNER JOIN Article a ON a.id = s.articleId`,
  ]);
  const rawV = stockValRows?.[0]?.v;
  const totalStockValue = typeof rawV === "bigint" ? Number(rawV) : Number(rawV ?? 0);
  return { totalSocietes, totalUsers, totalArticles, totalStockValue };
}

async function getPlatformSummary() {
  const [companiesCount, usersCount, articlesCount, societes, stockValRows] = await Promise.all([
    prisma.societe.count(),
    prisma.utilisateur.count(),
    prisma.article.count({ where: { actif: true } }),
    prisma.societe.findMany({
      select: {
        id: true,
        code: true,
        nom: true,
        logo: true,
        _count: { select: { utilisateurs: true, articles: true } },
      },
      orderBy: { nom: "asc" },
    }),
    prisma.$queryRaw`SELECT COALESCE(SUM(s.quantite * COALESCE(a.prixAchat, 0)), 0) AS v FROM Stock s INNER JOIN Article a ON a.id = s.articleId`,
  ]);
  const rawV = stockValRows?.[0]?.v;
  const stockValue = typeof rawV === "bigint" ? Number(rawV) : Number(rawV ?? 0);
  return {
    companiesCount,
    usersCount,
    articlesCount,
    stockValue,
    companies: societes.map((c) => ({
      id: c.id,
      code: c.code,
      nom: c.nom,
      logo: c.logo,
      usersCount: c._count.utilisateurs,
      articlesCount: c._count.articles,
    })),
  };
}

function normaliserSeuilValidation(valeur) {
  if (valeur == null || (typeof valeur === "string" && valeur.trim() === "")) return 0;
  const seuil = Number(valeur);
  if (!Number.isFinite(seuil) || seuil < 0) {
    const err = new Error("Le seuil doit être un nombre supérieur ou égal à 0");
    err.status = 400;
    throw err;
  }
  return seuil;
}

/**
 * 0 ou vide désactive la validation des mouvements.
 * Réservé à ADMIN et SUPER_ADMIN, sur la société de l'appelant.
 */
async function definirSeuilValidationMouvement(user, societeId, valeur, req) {
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    const err = new Error("Action non autorisée");
    err.status = 403;
    throw err;
  }
  const sid = Number(societeId);
  if (!Number.isInteger(sid) || sid < 1 || sid !== Number(user.societeId)) {
    const err = new Error("Société hors périmètre");
    err.status = 403;
    throw err;
  }
  const seuil = normaliserSeuilValidation(valeur);
  const existing = await prisma.societe.findUnique({
    where: { id: sid },
    select: { id: true, code: true, nom: true, seuilValidationMouvement: true },
  });
  if (!existing) {
    const err = new Error("Societe introuvable");
    err.status = 404;
    throw err;
  }
  const updated = await prisma.societe.update({
    where: { id: sid },
    data: { seuilValidationMouvement: seuil },
  });
  await auditCompany(req, {
    userId: user.id,
    societeId: sid,
    action: "UPDATE",
    entite: "Societe",
    entiteId: sid,
    module: "companies",
    description:
      seuil > 0
        ? `Seuil de validation des mouvements fixé à ${seuil} DT`
        : "Seuil de validation des mouvements désactivé (0)",
    ancienneValeur:
      existing.seuilValidationMouvement == null ? null : String(existing.seuilValidationMouvement),
    nouvelleValeur: String(seuil),
  }).catch(() => {});
  return updated;
}

async function updateCompanyLogo(id, logoUrl) {
  const numericId = Number(id);
  const existing = await prisma.societe.findUnique({
    where: { id: numericId },
    select: { logo: true },
  });
  if (existing.logo) {
    const oldPath = path.join(__dirname, "../../../public", existing.logo);
    fs.unlink(oldPath, () => {});
  }

  return prisma.societe.update({
    where: { id: numericId },
    data: { logo: logoUrl },
    select: { id: true, code: true, nom: true, email: true, actif: true, logo: true },
  });
}

module.exports = {
  listPublicCompanies,
  listCompanies,
  listAllCompanies: listCompanies,
  createCompany,
  updateCompany,
  definirSeuilValidationMouvement,
  deleteCompany,
  getGlobalStats,
  getPlatformSummary,
  updateCompanyLogo,
};
