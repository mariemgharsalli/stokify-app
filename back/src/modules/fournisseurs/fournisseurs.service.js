const prisma = require("../../config/database");
const { getSocieteWhere, stripSocieteFromBody, requireActiveSocieteId } = require("../../utils/societeScope");
const { normalizeCode, resolveAutoCode, createWithAutoCode } = require("../../utils/codeUtils");

function actifWhere(statut) {
  const s = String(statut || "actifs").toLowerCase();
  if (s === "tous") return {};
  if (s === "inactifs") return { actif: false };
  return { actif: true };
}

async function listFournisseurs({ user, search, page = 1, limit = 25, statut }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;
  const where = {
    ...getSocieteWhere(user),
    ...actifWhere(statut),
    ...(search
      ? { OR: [{ nom: { contains: search } }, { code: { contains: search } }, { email: { contains: search } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.fournisseur.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { id: "desc" },
      include: { _count: { select: { achats: true } } },
    }),
    prisma.fournisseur.count({ where }),
  ]);
  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

async function getFournisseur(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  return prisma.fournisseur.findFirst({
    where: { id: Number(id), societeId: sid },
  });
}

async function generateFournisseurCode(societeId) {
  const sid = requireActiveSocieteId(societeId);
  const last = await prisma.fournisseur.findFirst({
    where: { societeId: sid, code: { startsWith: "FRS-" } },
    orderBy: { id: "desc" },
  });
  let nextNum = 1;
  if (last) {
    const match = last.code.match(/FRS-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  let code = `FRS-${String(nextNum).padStart(3, "0")}`;
  while (await prisma.fournisseur.findFirst({ where: { societeId: sid, code } })) {
    nextNum++;
    code = `FRS-${String(nextNum).padStart(3, "0")}`;
  }
  return code;
}

async function createFournisseur(data, societeId) {
  const clean = stripSocieteFromBody(data);
  const sid = requireActiveSocieteId(societeId);

  const persistFournisseur = async (payload) => {
    const d = stripSocieteFromBody(payload);
    return prisma.fournisseur.create({
      data: {
        code: normalizeCode(d.code),
        nom: String(d.nom).trim(),
        adresse: d.adresse || null,
        ville: d.ville != null && String(d.ville).trim() ? String(d.ville).trim() : null,
        pays: d.pays != null && String(d.pays).trim() ? String(d.pays).trim() : null,
        latitude: d.latitude != null && d.latitude !== "" ? Number(d.latitude) : null,
        longitude: d.longitude != null && d.longitude !== "" ? Number(d.longitude) : null,
        telephone: d.telephone || null,
        email: d.email || null,
        contact: d.contact || null,
        tauxRemise: d.tauxRemise != null ? Number(d.tauxRemise) : null,
        delaiPayment: d.delaiPayment != null ? Number(d.delaiPayment) : null,
        noteCredit: d.noteCredit != null ? Number(d.noteCredit) : null,
        actif: typeof d.actif === "boolean" ? d.actif : true,
        societeId: sid,
      },
    });
  };

  const { isAuto, code: resolvedCode } = await resolveAutoCode(sid, clean.code, generateFournisseurCode);
  if (isAuto) {
    return createWithAutoCode(
      sid,
      { ...clean, code: resolvedCode || undefined },
      generateFournisseurCode,
      persistFournisseur
    );
  }
  return persistFournisseur({ ...clean, code: resolvedCode });
}

async function updateFournisseur(id, data, societeId) {
  const clean = stripSocieteFromBody(data);
  const ex = await getFournisseur(id, societeId);
  if (!ex) {
    const err = new Error("Fournisseur introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.fournisseur.update({
    where: { id: ex.id },
    data: {
      ...(clean.code != null ? { code: normalizeCode(clean.code) } : {}),
      ...(clean.nom != null ? { nom: String(clean.nom).trim() } : {}),
      ...(clean.adresse !== undefined ? { adresse: clean.adresse || null } : {}),
      ...(clean.ville !== undefined
        ? { ville: clean.ville != null && String(clean.ville).trim() ? String(clean.ville).trim() : null }
        : {}),
      ...(clean.pays !== undefined
        ? { pays: clean.pays != null && String(clean.pays).trim() ? String(clean.pays).trim() : null }
        : {}),
      ...(clean.latitude !== undefined
        ? { latitude: clean.latitude != null && clean.latitude !== "" ? Number(clean.latitude) : null }
        : {}),
      ...(clean.longitude !== undefined
        ? { longitude: clean.longitude != null && clean.longitude !== "" ? Number(clean.longitude) : null }
        : {}),
      ...(clean.telephone !== undefined ? { telephone: clean.telephone || null } : {}),
      ...(clean.email !== undefined ? { email: clean.email || null } : {}),
      ...(clean.contact !== undefined ? { contact: clean.contact || null } : {}),
      ...(clean.tauxRemise !== undefined ? { tauxRemise: clean.tauxRemise != null ? Number(clean.tauxRemise) : null } : {}),
      ...(clean.delaiPayment !== undefined ? { delaiPayment: clean.delaiPayment != null ? Number(clean.delaiPayment) : null } : {}),
      ...(clean.noteCredit !== undefined ? { noteCredit: clean.noteCredit != null ? Number(clean.noteCredit) : null } : {}),
      ...(Object.prototype.hasOwnProperty.call(clean, "actif") ? { actif: Boolean(clean.actif) } : {}),
    },
  });
}

async function deleteFournisseur(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const ex = await prisma.fournisseur.findFirst({
    where: { id: Number(id), societeId: sid },
    include: { _count: { select: { achats: true } } },
  });
  if (!ex) {
    const err = new Error("Fournisseur introuvable");
    err.status = 404;
    throw err;
  }
  if (ex._count.achats > 0) {
    const err = new Error("Impossible de supprimer : achats lies");
    err.status = 409;
    throw err;
  }
  await prisma.fournisseur.delete({ where: { id: ex.id } });
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function getStatsFournisseur(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const fId = Number(id);
  const ex = await getFournisseur(id, sid);
  if (!ex) {
    const err = new Error("Fournisseur introuvable");
    err.status = 404;
    throw err;
  }

  const now = new Date();
  const startYear = new Date(now.getFullYear(), 0, 1);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalAnnee, totalMois, nbCommandes, nbRecus, nonRegle] = await Promise.all([
    prisma.achat.aggregate({
      where: { fournisseurId: fId, societeId: sid, dateCommande: { gte: startYear } },
      _sum: { totalTTC: true },
    }),
    prisma.achat.aggregate({
      where: { fournisseurId: fId, societeId: sid, dateCommande: { gte: startMonth } },
      _sum: { totalTTC: true },
    }),
    prisma.achat.count({ where: { fournisseurId: fId, societeId: sid } }),
    prisma.achat.count({
      where: { fournisseurId: fId, societeId: sid, statut: { in: ["CONFIRME", "RECU", "RECEPTIONNE"] } },
    }),
    prisma.achat.aggregate({
      where: { fournisseurId: fId, societeId: sid, statutPaiement: { not: "REGLE" } },
      _sum: { totalTTC: true, montantRegle: true },
    }),
  ]);

  const evolutionAchats = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const agg = await prisma.achat.aggregate({
      where: { fournisseurId: fId, societeId: sid, dateCommande: { gte: d, lt: end } },
      _sum: { totalTTC: true },
    });
    evolutionAchats.push({ mois: key, total: round2(agg._sum.totalTTC || 0) });
  }

  const lignes = await prisma.ligneAchat.findMany({
    where: { achat: { fournisseurId: fId, societeId: sid } },
    include: { article: { select: { id: true, code: true, libelle: true } } },
  });
  const articleMap = {};
  for (const l of lignes) {
    const aid = l.article?.id;
    if (!aid) continue;
    if (!articleMap[aid]) {
      articleMap[aid] = {
        libelle: l.article.libelle,
        code: l.article.code,
        totalQte: 0,
        totalHT: 0,
      };
    }
    articleMap[aid].totalQte += Number(l.quantite || 0);
    articleMap[aid].totalHT += Number(l.totalHT || 0);
  }
  const topArticles = Object.values(articleMap)
    .sort((a, b) => b.totalHT - a.totalHT)
    .slice(0, 5)
    .map((a) => ({
      ...a,
      totalQte: round2(a.totalQte),
      totalHT: round2(a.totalHT),
    }));

  const montantNonRegle = Math.max(
    0,
    round2((nonRegle._sum.totalTTC || 0) - (nonRegle._sum.montantRegle || 0))
  );

  const derniersAchats = await prisma.achat.findMany({
    where: { fournisseurId: fId, societeId: sid },
    orderBy: { dateCommande: "desc" },
    take: 5,
    select: {
      id: true,
      reference: true,
      dateCommande: true,
      totalTTC: true,
      statut: true,
    },
  });

  const achatsDelai = await prisma.achat.findMany({
    where: {
      fournisseurId: fId,
      societeId: sid,
      dateLivraisonPrevue: { not: null },
      dateReception: { not: null },
    },
    select: { dateLivraisonPrevue: true, dateReception: true },
  });
  const delais = achatsDelai.map((a) =>
    Math.round(
      (new Date(a.dateReception).getTime() - new Date(a.dateLivraisonPrevue).getTime()) / 86400000
    )
  );
  const delaiMoyenLivraison =
    delais.length > 0 ? Math.round(delais.reduce((s, d) => s + d, 0) / delais.length) : null;
  const tauxRespectDelai =
    delais.length > 0 ? Math.round((delais.filter((d) => d <= 0).length / delais.length) * 100) : null;

  const lignesPrix = await prisma.ligneAchat.findMany({
    where: { achat: { fournisseurId: fId, societeId: sid } },
    orderBy: { achat: { dateCommande: "desc" } },
    include: {
      article: { select: { id: true, libelle: true } },
      achat: { select: { dateCommande: true } },
    },
  });
  const articlesLiesMap = new Map();
  for (const l of lignesPrix) {
    const aid = l.articleId;
    if (!articlesLiesMap.has(aid)) {
      articlesLiesMap.set(aid, {
        articleId: aid,
        libelle: l.article?.libelle || "",
        dernierPrix: round2(l.prixUnit),
        dateAchat: l.achat?.dateCommande,
      });
    }
  }
  const articlesLies = [...articlesLiesMap.values()].slice(0, 20);

  return {
    nbAchats: nbCommandes,
    totalAchatsTTC: round2(totalAnnee._sum.totalTTC || 0),
    derniersAchats,
    delaiMoyenLivraison,
    tauxRespectDelai,
    articlesLies,
    totalAnnee: round2(totalAnnee._sum.totalTTC || 0),
    totalMois: round2(totalMois._sum.totalTTC || 0),
    nbCommandes,
    nbRecus,
    montantNonRegle,
    tauxReception: nbCommandes > 0 ? Math.round((nbRecus / nbCommandes) * 100) : 0,
    evolutionAchats,
    topArticles,
  };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getFournisseursByProximite(societeId, lat, lng, rayonKm = 50) {
  const sid = requireActiveSocieteId(societeId);
  const latitude = Number(lat);
  const longitude = Number(lng);
  const rayon = Number(rayonKm) || 50;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const err = new Error("lat et lng requis");
    err.status = 400;
    throw err;
  }

  const fournisseurs = await prisma.fournisseur.findMany({
    where: {
      societeId: sid,
      actif: true,
      latitude: { not: null },
      longitude: { not: null },
    },
  });

  return fournisseurs
    .map((f) => ({
      ...f,
      distanceKm: round2(haversineKm(latitude, longitude, Number(f.latitude), Number(f.longitude))),
    }))
    .filter((f) => f.distanceKm <= rayon)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

async function getHistoriqueAchatsFournisseur(id, societeId, { page = 1, limit = 20, dateDebut, dateFin } = {}) {
  const sid = requireActiveSocieteId(societeId);
  const fId = Number(id);
  const ex = await getFournisseur(id, sid);
  if (!ex) {
    const err = new Error("Fournisseur introuvable");
    err.status = 404;
    throw err;
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;
  let dateFilter = {};
  if (dateDebut || dateFin) {
    dateFilter = {
      dateCommande: {
        ...(dateDebut ? { gte: new Date(String(dateDebut)) } : {}),
        ...(dateFin
          ? {
              lte: (() => {
                const d = new Date(String(dateFin));
                d.setHours(23, 59, 59, 999);
                return d;
              })(),
            }
          : {}),
      },
    };
  }
  const where = { fournisseurId: fId, societeId: sid, ...dateFilter };
  const [items, total] = await Promise.all([
    prisma.achat.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { id: "desc" },
      include: {
        depot: { select: { code: true, libelle: true } },
        lignes: { include: { article: { select: { code: true, libelle: true, unite: true } } } },
      },
    }),
    prisma.achat.count({ where }),
  ]);
  return {
    items,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
    limit: limitNum,
  };
}

module.exports = {
  listFournisseurs,
  getFournisseur,
  createFournisseur,
  updateFournisseur,
  deleteFournisseur,
  getStatsFournisseur,
  getFournisseurStats: getStatsFournisseur,
  getFournisseursByProximite,
  getHistoriqueAchatsFournisseur,
  generateFournisseurCode,
};
