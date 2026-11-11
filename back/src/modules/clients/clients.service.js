const prisma = require("../../config/database");
const { getSocieteWhere, stripSocieteFromBody, requireActiveSocieteId } = require("../../utils/societeScope");
const { normalizeCode, resolveAutoCode, createWithAutoCode } = require("../../utils/codeUtils");
const { createSmtpTransporter, getSmtpFrom } = require("../../utils/smtp");
const { resolveClientForUser } = require("../panier/clientResolver");

const STATUTS_CONFIRMES = ["CONFIRME", "VALIDE", "LIVRE"];

function actifWhere(statut) {
  const s = String(statut || "actifs").toLowerCase();
  if (s === "tous") return {};
  if (s === "inactifs") return { actif: false };
  return { actif: true };
}

async function listClients({ user, search, page = 1, limit = 25, statut }) {
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
    prisma.client.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { id: "desc" },
      include: { _count: { select: { ventes: true } } },
    }),
    prisma.client.count({ where }),
  ]);
  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

async function getClient(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  return prisma.client.findFirst({
    where: { id: Number(id), societeId: sid },
    include: {
      utilisateurs: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          role: true,
          statutCompte: true,
          actif: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });
}

async function listUtilisateursEnAttente(user) {
  const societeId = requireActiveSocieteId(user.societeId);
  return prisma.utilisateur.findMany({
    where: {
      societeId,
      role: "CLIENT",
      statutCompte: "EN_ATTENTE_RATTACHEMENT",
    },
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      role: true,
      statutCompte: true,
      createdAt: true,
      telephone: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

async function rattacherUtilisateur(clientId, utilisateurId, user) {
  const societeId = requireActiveSocieteId(user.societeId);
  const client = await prisma.client.findFirst({
    where: { id: Number(clientId), societeId },
  });
  if (!client) {
    const err = new Error("Client introuvable");
    err.status = 404;
    throw err;
  }

  const utilisateur = await prisma.utilisateur.findFirst({
    where: {
      id: Number(utilisateurId),
      societeId,
      role: "CLIENT",
    },
  });
  if (!utilisateur) {
    const err = new Error("Utilisateur introuvable ou non éligible");
    err.status = 404;
    throw err;
  }

  if (utilisateur.clientId != null && utilisateur.clientId !== client.id) {
    const err = new Error("Cet utilisateur est déjà rattaché à une autre fiche client");
    err.status = 409;
    err.code = "DEJA_RATTACHE";
    throw err;
  }

  const updated = await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: {
      clientId: client.id,
      statutCompte: "ACTIF",
    },
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      role: true,
      clientId: true,
      statutCompte: true,
      actif: true,
    },
  });

  try {
    const societe = await prisma.societe.findUnique({ where: { id: societeId } });
    const transporter = createSmtpTransporter();
    if (transporter) {
      const { getCompteActiveMailOptions } = require("../../utils/emailTemplates");
      const frontendBase = String(process.env.FRONTEND_URL || "http://localhost:5173")
        .trim()
        .replace(/\/$/, "");
      const loginUrl = `${frontendBase}/login`;
      await transporter.sendMail(
        getCompteActiveMailOptions({
          user: updated,
          societe,
          loginUrl,
          from: getSmtpFrom(societe),
        })
      );
    }
  } catch (e) {
    console.error("[clients] Échec email activation après rattachement:", e?.message || e);
  }

  return updated;
}

async function generateClientCode(societeId) {
  const sid = requireActiveSocieteId(societeId);
  const last = await prisma.client.findFirst({
    where: { societeId: sid, code: { startsWith: "CLI-" } },
    orderBy: { id: "desc" },
  });
  let nextNum = 1;
  if (last) {
    const match = last.code.match(/CLI-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  let code = `CLI-${String(nextNum).padStart(3, "0")}`;
  while (await prisma.client.findFirst({ where: { societeId: sid, code } })) {
    nextNum++;
    code = `CLI-${String(nextNum).padStart(3, "0")}`;
  }
  return code;
}

async function createClient(data, societeId) {
  const clean = stripSocieteFromBody(data);
  const sid = requireActiveSocieteId(societeId);

  const persistClient = async (payload) => {
    const d = stripSocieteFromBody(payload);
    return prisma.client.create({
      data: {
        code: normalizeCode(d.code),
        nom: String(d.nom).trim(),
        adresse: d.adresse || null,
        ville: d.ville || null,
        pays: d.pays || null,
        latitude: d.latitude != null && d.latitude !== "" ? Number(d.latitude) : null,
        longitude: d.longitude != null && d.longitude !== "" ? Number(d.longitude) : null,
        telephone: d.telephone || null,
        email: d.email || null,
        contact: d.contact || null,
        plafondCredit: d.plafondCredit != null ? Number(d.plafondCredit) : null,
        encours: d.encours != null ? Number(d.encours) : 0,
        tauxRemise: d.tauxRemise != null ? Number(d.tauxRemise) : null,
        modePaiement: d.modePaiement || null,
        actif: typeof d.actif === "boolean" ? d.actif : true,
        societeId: sid,
      },
    });
  };

  const { isAuto, code: resolvedCode } = await resolveAutoCode(sid, clean.code, generateClientCode);
  if (isAuto) {
    return createWithAutoCode(
      sid,
      { ...clean, code: resolvedCode || undefined },
      generateClientCode,
      persistClient
    );
  }
  return persistClient({ ...clean, code: resolvedCode });
}

async function updateClient(id, data, societeId) {
  const clean = stripSocieteFromBody(data);
  const ex = await getClient(id, societeId);
  if (!ex) {
    const err = new Error("Client introuvable");
    err.status = 404;
    throw err;
  }
  return prisma.client.update({
    where: { id: ex.id },
    data: {
      ...(clean.code != null ? { code: normalizeCode(clean.code) } : {}),
      ...(clean.nom != null ? { nom: String(clean.nom).trim() } : {}),
      ...(clean.adresse !== undefined ? { adresse: clean.adresse || null } : {}),
      ...(clean.ville !== undefined ? { ville: clean.ville || null } : {}),
      ...(clean.pays !== undefined ? { pays: clean.pays || null } : {}),
      ...(clean.latitude !== undefined
        ? { latitude: clean.latitude != null && clean.latitude !== "" ? Number(clean.latitude) : null }
        : {}),
      ...(clean.longitude !== undefined
        ? { longitude: clean.longitude != null && clean.longitude !== "" ? Number(clean.longitude) : null }
        : {}),
      ...(clean.telephone !== undefined ? { telephone: clean.telephone || null } : {}),
      ...(clean.email !== undefined ? { email: clean.email || null } : {}),
      ...(clean.contact !== undefined ? { contact: clean.contact || null } : {}),
      ...(clean.plafondCredit !== undefined ? { plafondCredit: clean.plafondCredit != null ? Number(clean.plafondCredit) : null } : {}),
      ...(clean.encours !== undefined ? { encours: Number(clean.encours) } : {}),
      ...(clean.tauxRemise !== undefined ? { tauxRemise: clean.tauxRemise != null ? Number(clean.tauxRemise) : null } : {}),
      ...(clean.modePaiement !== undefined ? { modePaiement: clean.modePaiement || null } : {}),
      ...(Object.prototype.hasOwnProperty.call(clean, "actif") ? { actif: Boolean(clean.actif) } : {}),
    },
  });
}

async function deleteClient(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const ex = await prisma.client.findFirst({
    where: { id: Number(id), societeId: sid },
    include: { _count: { select: { ventes: true } } },
  });
  if (!ex) {
    const err = new Error("Client introuvable");
    err.status = 404;
    throw err;
  }
  if (ex._count.ventes > 0) {
    const err = new Error("Impossible de supprimer : ventes liees");
    err.status = 409;
    throw err;
  }
  await prisma.client.delete({ where: { id: ex.id } });
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function getStatsClient(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const cId = Number(id);
  const ex = await getClient(id, sid);
  if (!ex) {
    const err = new Error("Client introuvable");
    err.status = 404;
    throw err;
  }

  const now = new Date();
  const startYear = new Date(now.getFullYear(), 0, 1);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const valideStatuts = { in: ["CONFIRME", "VALIDE", "LIVRE"] };

  const [totalAnnee, totalMois, nbVentes, nbLivres] = await Promise.all([
    prisma.vente.aggregate({
      where: { clientId: cId, societeId: sid, dateVente: { gte: startYear }, statut: valideStatuts },
      _sum: { totalTTC: true },
    }),
    prisma.vente.aggregate({
      where: { clientId: cId, societeId: sid, dateVente: { gte: startMonth }, statut: valideStatuts },
      _sum: { totalTTC: true },
    }),
    prisma.vente.count({ where: { clientId: cId, societeId: sid } }),
    prisma.vente.count({ where: { clientId: cId, societeId: sid, statut: "LIVRE" } }),
  ]);

  const ventesNonReglees = await prisma.vente.findMany({
    where: { clientId: cId, societeId: sid, statut: valideStatuts },
    include: { reglements: { select: { montant: true } } },
  });
  const montantImpaye = round2(
    ventesNonReglees.reduce((sum, v) => {
      const regle = v.reglements.reduce((s, r) => s + Number(r.montant || 0), 0);
      return sum + Math.max(0, Number(v.totalTTC || 0) - regle);
    }, 0)
  );

  const evolutionCA = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const agg = await prisma.vente.aggregate({
      where: { clientId: cId, societeId: sid, dateVente: { gte: d, lt: end }, statut: valideStatuts },
      _sum: { totalTTC: true },
    });
    evolutionCA.push({ mois: key, ca: round2(agg._sum.totalTTC || 0) });
  }

  const lignes = await prisma.ligneVente.findMany({
    where: { vente: { clientId: cId, societeId: sid, statut: valideStatuts } },
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

  return {
    caAnnee: round2(totalAnnee._sum.totalTTC || 0),
    caMois: round2(totalMois._sum.totalTTC || 0),
    nbVentes,
    nbLivres,
    montantImpaye,
    tauxLivraison: nbVentes > 0 ? Math.round((nbLivres / nbVentes) * 100) : 0,
    evolutionCA,
    topArticles,
  };
}

async function getHistoriqueVentesClient(id, societeId, { page = 1, limit = 10, dateDebut, dateFin } = {}) {
  const sid = requireActiveSocieteId(societeId);
  const cId = Number(id);
  const ex = await getClient(id, sid);
  if (!ex) {
    const err = new Error("Client introuvable");
    err.status = 404;
    throw err;
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
  const skip = (pageNum - 1) * limitNum;
  let dateFilter = {};
  if (dateDebut || dateFin) {
    dateFilter = {
      dateVente: {
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
  const where = { clientId: cId, societeId: sid, ...dateFilter };
  const [items, total] = await Promise.all([
    prisma.vente.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { id: "desc" },
      include: {
        depot: { select: { code: true, libelle: true } },
        reglements: { select: { montant: true } },
        lignes: { include: { article: { select: { code: true, libelle: true, unite: true } } } },
      },
    }),
    prisma.vente.count({ where }),
  ]);
  const itemsWithSolde = items.map((v) => {
    const regle = v.reglements.reduce((s, r) => s + Number(r.montant || 0), 0);
    const solde = Math.max(0, round2(Number(v.totalTTC || 0) - regle));
    return { ...v, solde };
  });
  return {
    items: itemsWithSolde,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
    limit: limitNum,
  };
}

async function computeEncours(clientId, societeId) {
  const ventes = await prisma.vente.findMany({
    where: {
      clientId: Number(clientId),
      societeId: Number(societeId),
      statut: { in: STATUTS_CONFIRMES },
      typeVente: { not: "AVOIR" },
    },
    include: { reglements: true, facture: { select: { numero: true, createdAt: true } } },
    orderBy: { dateVente: "asc" },
  });

  const unpaid = [];
  let total = 0;
  for (const v of ventes) {
    const reg = (v.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
    const solde = round2(Number(v.totalTTC) - reg);
    if (solde > 0.009) {
      total += solde;
      unpaid.push({
        id: v.id,
        reference: v.reference,
        factureNumero: v.facture?.numero || v.reference,
        dateVente: v.dateVente,
        totalTTC: v.totalTTC,
        solde,
        joursRetard: Math.max(
          0,
          Math.ceil((Date.now() - new Date(v.confirmedAt || v.dateVente).getTime()) / 86400000) - 30
        ),
      });
    }
  }
  return { total: round2(total), ventes: unpaid };
}

async function getEncoursClient(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const client = await getClient(id, sid);
  if (!client) {
    const err = new Error("Client introuvable");
    err.status = 404;
    throw err;
  }
  const { total, ventes } = await computeEncours(client.id, sid);
  const plafond = client.plafondCredit != null ? Number(client.plafondCredit) : null;
  return {
    total,
    ventes,
    plafondCredit: plafond,
    depassement: plafond != null && plafond > 0 && total > plafond,
    client: { id: client.id, nom: client.nom, code: client.code, email: client.email },
  };
}

async function listEncoursClients(user) {
  const { societeId: sid } = getSocieteWhere(user);
  const clients = await prisma.client.findMany({
    where: { societeId: sid },
    orderBy: { nom: "asc" },
  });

  const rows = [];
  for (const c of clients) {
    const { total, ventes } = await computeEncours(c.id, sid);
    if (total <= 0.009) continue;
    const oldest = ventes[0];
    const plafond = c.plafondCredit != null ? Number(c.plafondCredit) : null;
    const maxRetard = ventes.reduce((m, v) => Math.max(m, v.joursRetard || 0), 0);
    rows.push({
      clientId: c.id,
      client: { id: c.id, nom: c.nom, code: c.code, email: c.email },
      encours: total,
      plafondCredit: plafond,
      depassement: plafond != null && plafond > 0 && total > plafond,
      nbFacturesImpayees: ventes.length,
      plusAncienneFacture: oldest?.dateVente || null,
      joursRetardMax: maxRetard,
    });
  }
  rows.sort((a, b) => b.encours - a.encours);
  return { items: rows, total: rows.length };
}

async function relancerClient(user, clientId, { type = "MANUEL" } = {}) {
  const { societeId: sid } = getSocieteWhere(user);
  const encours = await getEncoursClient(clientId, sid);
  if (!encours.ventes.length) {
    const err = new Error("Aucune facture impayee pour ce client");
    err.status = 400;
    throw err;
  }
  const client = await prisma.client.findFirst({
    where: { id: Number(clientId), societeId: sid },
  });
  const societe = await prisma.societe.findUnique({ where: { id: sid } });
  const transporter = createSmtpTransporter();
  if (!transporter || !client?.email) {
    const err = new Error("Email ou SMTP non configure (SMTP_USER / SMTP_PASS)");
    err.status = 400;
    throw err;
  }

  const rowsHtml = encours.ventes
    .map(
      (v) =>
        `<tr><td>${v.factureNumero}</td><td style="text-align:right">${Number(v.solde).toFixed(3)} TND</td></tr>`
    )
    .join("");
  const from = getSmtpFrom(societe);
  await transporter.sendMail({
    from,
    to: client.email,
    subject: `Rappel de paiement — ${societe?.nom || ""}`,
    html: `<p>Bonjour ${client.nom},</p><p>Montant total dû : <strong>${encours.total.toFixed(3)} TND</strong></p>
      <table border="1" cellpadding="6"><tr><th>Facture</th><th>Montant</th></tr>${rowsHtml}</table>`,
  });

  for (const v of encours.ventes) {
    await prisma.relanceClient.create({
      data: { clientId: client.id, venteId: v.id, type, email: client.email },
    });
  }
  return { sent: true, email: client.email, nbFactures: encours.ventes.length };
}

/** Fiche Client liée à l'utilisateur connecté (role CLIENT). */
async function getMyClient(user) {
  const { client } = await resolveClientForUser(user);
  return {
    id: client.id,
    code: client.code,
    nom: client.nom,
    adresse: client.adresse,
    ville: client.ville,
    pays: client.pays,
    latitude: client.latitude,
    longitude: client.longitude,
    telephone: client.telephone,
    email: client.email,
  };
}

/** Met à jour adresse / coords (et optionnellement téléphone / nom) de la fiche Client. */
async function updateMyClient(user, data = {}) {
  const { client } = await resolveClientForUser(user);
  const patch = {};

  if (data.adresse !== undefined) patch.adresse = data.adresse ? String(data.adresse).trim() : null;
  if (data.ville !== undefined) patch.ville = data.ville ? String(data.ville).trim() : null;
  if (data.pays !== undefined) patch.pays = data.pays ? String(data.pays).trim() : null;
  if (data.latitude !== undefined) {
    patch.latitude =
      data.latitude != null && data.latitude !== "" && Number.isFinite(Number(data.latitude))
        ? Number(data.latitude)
        : null;
  }
  if (data.longitude !== undefined) {
    patch.longitude =
      data.longitude != null && data.longitude !== "" && Number.isFinite(Number(data.longitude))
        ? Number(data.longitude)
        : null;
  }
  if (data.telephone !== undefined) patch.telephone = data.telephone ? String(data.telephone).trim() : null;
  if (data.nom !== undefined && String(data.nom).trim()) patch.nom = String(data.nom).trim();

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: patch,
  });

  return {
    id: updated.id,
    code: updated.code,
    nom: updated.nom,
    adresse: updated.adresse,
    ville: updated.ville,
    pays: updated.pays,
    latitude: updated.latitude,
    longitude: updated.longitude,
    telephone: updated.telephone,
    email: updated.email,
  };
}

module.exports = {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getStatsClient,
  getHistoriqueVentesClient,
  getEncoursClient,
  listEncoursClients,
  relancerClient,
  computeEncours,
  getMyClient,
  updateMyClient,
  listUtilisateursEnAttente,
  rattacherUtilisateur,
  generateClientCode,
};
