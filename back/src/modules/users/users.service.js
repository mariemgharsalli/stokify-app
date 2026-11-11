const bcrypt = require("bcryptjs");
const prisma = require("../../config/database");
const { requireActiveSocieteId } = require("../../utils/societeScope");
const { ensureClientLinked } = require("../panier/clientResolver");
const { createSmtpTransporter, getSmtpFrom } = require("../../utils/smtp");
const { getUserInviteMailOptions } = require("../../utils/emailTemplates");
const { auditFromReq, createAudit } = require("../../utils/auditHelper");

/** Audit users : auditFromReq si req présent, sinon createAudit. */
async function auditUsers(req, data) {
  if (req) return auditFromReq(req, data);
  return createAudit(data);
}

const ALLOWED_ROLES_ADMIN = ["ADMIN", "RESPONSABLE", "MAGASINIER", "COMPTABLE", "CLIENT"];
const ALLOWED_ROLES_SUPER = ["SUPER_ADMIN", "ADMIN", "RESPONSABLE", "MAGASINIER", "COMPTABLE", "CLIENT"];
const ROLE_RANK = {
  CLIENT: 1,
  MAGASINIER: 2,
  COMPTABLE: 2,
  RESPONSABLE: 3,
  ADMIN: 4,
  SUPER_ADMIN: 5,
};

function roleAuDessusDeLappelant(callerRole, role) {
  const demande = ROLE_RANK[String(role || "").trim().toUpperCase()] || 0;
  const appelant = ROLE_RANK[callerRole] || 0;
  return demande > appelant;
}

async function trouverUtilisateurPourAppelant({ id, callerRole, callerSocieteId, select }) {
  const where =
    callerRole === "SUPER_ADMIN"
      ? { id: Number(id) }
      : { id: Number(id), societeId: Number(callerSocieteId) };
  const query = select ? { where, select } : { where };
  const user =
    callerRole === "SUPER_ADMIN"
      ? await prisma.utilisateur.findUnique(query)
      : await prisma.utilisateur.findFirst(query);
  if (!user) {
    const error = new Error("Utilisateur introuvable");
    error.status = 404;
    throw error;
  }
  return user;
}

function generateTemporaryPassword() {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  /** Pas de `$` : confusion avec les hash bcrypt et copier-coller. */
  const special = "!@#&*?";
  const all = upper + lower + digits + special;

  let newPassword =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)] +
    special[Math.floor(Math.random() * special.length)];
  for (let i = 0; i < 6; i += 1) {
    newPassword += all[Math.floor(Math.random() * all.length)];
  }
  return newPassword
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

function getLoginUrl() {
  const base = String(process.env.FRONTEND_URL || "http://localhost:5173").trim().replace(/\/$/, "");
  return `${base}/login`;
}

async function sendUserInviteEmail({ user, motDePasse, societe, forceChangeOnFirstLogin }) {
  const transporter = createSmtpTransporter();
  if (!transporter) {
    const error = new Error("Configuration SMTP manquante (SMTP_USER / SMTP_PASS dans .env)");
    error.status = 400;
    throw error;
  }

  const loginUrl = getLoginUrl();
  const from = getSmtpFrom(societe);
  const mailOptions = getUserInviteMailOptions({
    user,
    motDePasse,
    societe,
    forceChangeOnFirstLogin,
    loginUrl,
    from,
  });

  try {
    await transporter.sendMail(mailOptions);
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes("BadCredentials") || msg.includes("535")) {
      const error = new Error(
        "Connexion Gmail refusée — vérifiez SMTP_USER et SMTP_PASS (mot de passe d'application) dans .env"
      );
      error.status = 502;
      throw error;
    }
    const error = new Error(msg || "Erreur lors de l'envoi de l'email");
    error.status = 502;
    throw error;
  }

  return { sent: true, email: user.email };
}

const baseSelect = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  role: true,
  actif: true,
  societeId: true,
  statutCompte: true,
  createdAt: true,
};

async function listUsers({ callerRole, callerSocieteId, page = 1, limit = 25 }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;

  if (callerRole === "SUPER_ADMIN") {
    if (callerSocieteId == null || callerSocieteId === "") {
      return { items: [], total: 0, page: pageNum, pages: 1, limit: limitNum };
    }
    const sid = Number(callerSocieteId);
    const where = {
      societeId: sid,
      statutCompte: { notIn: ["EN_ATTENTE_VALIDATION", "EN_ATTENTE_RATTACHEMENT"] },
    };
    const [items, total] = await Promise.all([
      prisma.utilisateur.findMany({
        where,
        skip,
        take: limitNum,
        select: {
          ...baseSelect,
          societe: { select: { nom: true, code: true } },
        },
        orderBy: [{ role: "asc" }, { id: "desc" }],
      }),
      prisma.utilisateur.count({ where }),
    ]);
    return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
  }

  const sid = requireActiveSocieteId(callerSocieteId);
  const where = {
    societeId: sid,
    statutCompte: { notIn: ["EN_ATTENTE_VALIDATION", "EN_ATTENTE_RATTACHEMENT"] },
  };
  const [items, total] = await Promise.all([
    prisma.utilisateur.findMany({
      where,
      skip,
      take: limitNum,
      select: { ...baseSelect },
      orderBy: [{ role: "asc" }, { id: "desc" }],
    }),
    prisma.utilisateur.count({ where }),
  ]);
  return { items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

async function changeUserRole({ callerRole, callerSocieteId, callerId, targetUserId, role, req }) {
  const allowed =
    callerRole === "SUPER_ADMIN" ? ALLOWED_ROLES_SUPER : callerRole === "ADMIN" ? ALLOWED_ROLES_ADMIN : [];
  if (!allowed.includes(role)) {
    const error = new Error("Role invalide");
    error.status = 400;
    throw error;
  }

  const where =
    callerRole === "SUPER_ADMIN"
      ? { id: Number(targetUserId), societeId: requireActiveSocieteId(callerSocieteId) }
      : { id: Number(targetUserId), societeId: Number(callerSocieteId) };

  const user = await prisma.utilisateur.findFirst({ where });
  if (!user) {
    const error = new Error("Utilisateur introuvable");
    error.status = 404;
    throw error;
  }

  if (callerRole === "ADMIN" && user.role === "SUPER_ADMIN") {
    const error = new Error("Action interdite sur ce compte");
    error.status = 403;
    throw error;
  }

  if (
    Number(callerId) === user.id &&
    user.role === "SUPER_ADMIN" &&
    role !== "SUPER_ADMIN"
  ) {
    const error = new Error("Vous ne pouvez pas retirer le role super administrateur sur votre propre compte");
    error.status = 400;
    throw error;
  }

  const updated = await prisma.utilisateur.update({
    where: { id: user.id },
    data: { role },
    select: { ...baseSelect },
  });

  if (role === "CLIENT") {
    await ensureClientLinked({
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      telephone: user.telephone,
      societeId: user.societeId,
      role: "CLIENT",
      clientId: user.clientId,
    });
  }

  await auditUsers(req, {
    userId: Number(callerId),
    societeId: user.societeId,
    action: "UPDATE_ROLE",
    entite: "Utilisateur",
    entiteId: user.id,
    module: "USERS",
    description: `Rôle modifié pour ${user.email} : ${user.role} → ${role}`,
    ancienneValeur: user.role,
    nouvelleValeur: role,
  }).catch(() => {});

  return updated;
}

async function changeUserStatus({ callerRole, callerSocieteId, callerId, targetUserId, actif, req }) {
  const where =
    callerRole === "SUPER_ADMIN"
      ? { id: Number(targetUserId), societeId: requireActiveSocieteId(callerSocieteId) }
      : { id: Number(targetUserId), societeId: Number(callerSocieteId) };

  const user = await prisma.utilisateur.findFirst({ where });
  if (!user) {
    const error = new Error("Utilisateur introuvable");
    error.status = 404;
    throw error;
  }

  if (callerRole === "ADMIN" && user.role === "SUPER_ADMIN") {
    const error = new Error("Action interdite sur ce compte");
    error.status = 403;
    throw error;
  }

  if (Number(callerId) === user.id && !actif) {
    const error = new Error("Vous ne pouvez pas desactiver votre propre compte");
    error.status = 400;
    throw error;
  }

  const nextActif = Boolean(actif);
  const updated = await prisma.utilisateur.update({
    where: { id: user.id },
    data: { actif: nextActif },
    select: { ...baseSelect },
  });

  await auditUsers(req, {
    userId: Number(callerId),
    societeId: user.societeId,
    action: nextActif ? "USER_ACTIVATE" : "USER_DEACTIVATE",
    entite: "Utilisateur",
    entiteId: user.id,
    module: "USERS",
    description: nextActif
      ? `Compte activé (${user.email})`
      : `Compte désactivé (${user.email})`,
    ancienneValeur: String(user.actif),
    nouvelleValeur: String(nextActif),
  }).catch(() => {});

  return updated;
}

async function resetUserPassword({ callerRole, callerSocieteId, callerId, targetUserId }) {
  const where =
    callerRole === "SUPER_ADMIN"
      ? { id: Number(targetUserId), societeId: requireActiveSocieteId(callerSocieteId) }
      : { id: Number(targetUserId), societeId: Number(callerSocieteId) };

  const user = await prisma.utilisateur.findFirst({ where });
  if (!user) {
    const error = new Error("Utilisateur introuvable");
    error.status = 404;
    throw error;
  }

  if (callerRole === "ADMIN" && user.role === "SUPER_ADMIN") {
    const error = new Error("Action interdite sur ce compte");
    error.status = 403;
    throw error;
  }

  const newPassword = generateTemporaryPassword();
  const hashed = await bcrypt.hash(newPassword, 10);

  await prisma.utilisateur.update({
    where: { id: user.id },
    data: { motDePasse: hashed },
  });

  const stored = await prisma.utilisateur.findUnique({
    where: { id: user.id },
    select: { motDePasse: true },
  });
  const verified = await bcrypt.compare(newPassword, stored.motDePasse);
  if (!verified) {
    const error = new Error("Échec de la réinitialisation du mot de passe");
    error.status = 500;
    throw error;
  }

  await prisma.audit.create({
    data: {
      utilisateurId: Number(callerId),
      action: "RESET_PASSWORD",
      module: "USERS",
      entite: user.email,
      societeId: user.societeId,
    },
  });

  return {
    success: true,
    newPassword,
    email: user.email,
    message: "Mot de passe réinitialisé avec succès",
  };
}

async function sendUserInvitation({ callerRole, callerSocieteId, callerId, targetUserId }) {
  const where =
    callerRole === "SUPER_ADMIN"
      ? { id: Number(targetUserId), societeId: requireActiveSocieteId(callerSocieteId) }
      : { id: Number(targetUserId), societeId: Number(callerSocieteId) };

  const user = await prisma.utilisateur.findFirst({ where });
  if (!user) {
    const error = new Error("Utilisateur introuvable");
    error.status = 404;
    throw error;
  }

  if (callerRole === "ADMIN" && user.role === "SUPER_ADMIN") {
    const error = new Error("Action interdite sur ce compte");
    error.status = 403;
    throw error;
  }

  const newPassword = generateTemporaryPassword();
  const hashed = await bcrypt.hash(newPassword, 10);
  const societe = await prisma.societe.findUnique({ where: { id: user.societeId } });

  await prisma.utilisateur.update({
    where: { id: user.id },
    data: {
      motDePasse: hashed,
      mustChangePassword: true,
      profileCompleted: false,
    },
  });

  await sendUserInviteEmail({
    user,
    motDePasse: newPassword,
    societe,
    forceChangeOnFirstLogin: true,
  });

  await prisma.audit.create({
    data: {
      utilisateurId: Number(callerId),
      action: "SEND_INVITE",
      module: "USERS",
      entite: user.email,
      societeId: user.societeId,
    },
  }).catch(() => {});

  return {
    success: true,
    email: user.email,
    temporaryPassword: newPassword,
    message: `Invitation envoyée à ${user.email}`,
  };
}

async function createUser({ callerRole, callerSocieteId, callerId, payload, req }) {
  const {
    nom,
    prenom,
    email,
    motDePasse,
    role: rawRole,
    telephone,
    forceChangeOnFirstLogin = true,
    sendInviteEmail = false,
  } = payload;
  const role = String(rawRole || "")
    .trim()
    .toUpperCase();
  const forceChange = Boolean(forceChangeOnFirstLogin);
  const sendInvite = Boolean(sendInviteEmail);

  let societeId;
  let societe = null;
  if (callerRole === "SUPER_ADMIN") {
    societeId = requireActiveSocieteId(callerSocieteId);
    if (!ALLOWED_ROLES_SUPER.includes(role)) {
      const error = new Error("Role invalide");
      error.status = 400;
      throw error;
    }
    societe = await prisma.societe.findUnique({ where: { id: societeId } });
    if (!societe) {
      const error = new Error("Societe introuvable");
      error.status = 400;
      throw error;
    }
  } else if (callerRole === "ADMIN") {
    societeId = Number(callerSocieteId);
    if (!ALLOWED_ROLES_ADMIN.includes(role)) {
      const error = new Error("Role invalide");
      error.status = 400;
      throw error;
    }
    societe = await prisma.societe.findUnique({ where: { id: societeId } });
  } else {
    const error = new Error("Acces refuse");
    error.status = 403;
    throw error;
  }

  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const existing = await prisma.utilisateur.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    const error = new Error("Cet email est deja utilise");
    error.status = 409;
    throw error;
  }

  const plainPassword = String(motDePasse || "");
  const hash = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.utilisateur.create({
    data: {
      nom: String(nom || "").trim(),
      prenom: String(prenom || "").trim(),
      email: normalizedEmail,
      motDePasse: hash,
      role,
      societeId,
      actif: true,
      statutCompte: "ACTIF",
      telephone: telephone ? String(telephone).trim() : null,
      profileCompleted: !forceChange,
      mustChangePassword: forceChange,
    },
    select: { ...baseSelect, telephone: true, profileCompleted: true, mustChangePassword: true, clientId: true },
  });

  if (role === "CLIENT") {
    await ensureClientLinked(user);
  }

  let inviteEmailSent = false;
  let inviteEmailError = null;
  if (sendInvite) {
    try {
      await sendUserInviteEmail({
        user,
        motDePasse: plainPassword,
        societe,
        forceChangeOnFirstLogin: forceChange,
      });
      inviteEmailSent = true;
    } catch (err) {
      inviteEmailError = err.message || "Erreur lors de l'envoi de l'invitation";
    }
  }

  await auditUsers(req, {
    userId: Number(callerId),
    societeId,
    action: "CREATE_USER",
    entite: "Utilisateur",
    entiteId: user.id,
    module: "USERS",
    description: `Utilisateur créé (${user.email}, rôle ${user.role})`,
    nouvelleValeur: JSON.stringify({
      role: user.role,
      forceChange,
      sendInvite,
      inviteEmailSent,
    }),
  }).catch(() => {});

  return {
    ...user,
    inviteEmailSent,
    ...(inviteEmailError ? { inviteEmailError } : {}),
  };
}

/**
 * Met à jour les overrides de permissions individuelles d'un utilisateur.
 */
async function updateUserPermissionOverrides({ targetUserId, overrides, callerId, callerRole, callerSocieteId, req }) {
  const id = Number(targetUserId);
  const user = await trouverUtilisateurPourAppelant({ id, callerRole, callerSocieteId });
  if (user.role === "SUPER_ADMIN") {
    const error = new Error("Les permissions du Super Admin ne peuvent pas être modifiées");
    error.status = 400;
    throw error;
  }
  if (!Array.isArray(overrides)) {
    const error = new Error("Format invalide: overrides doit être un tableau");
    error.status = 400;
    throw error;
  }

  const { permissionsToLevel } = require("../../middleware/moduleRegistry");
  const { PERMISSIONS } = require("../../middleware/rbac");
  const rolePerms = PERMISSIONS[user.role] || [];
  const ops = overrides.map((o) => {
    const niveauRole = permissionsToLevel(o.module, rolePerms);
    if (o.niveau === niveauRole) {
      return prisma.permissionOverride.deleteMany({
        where: { utilisateurId: id, module: o.module },
      });
    }
    return prisma.permissionOverride.upsert({
      where: { utilisateurId_module: { utilisateurId: id, module: o.module } },
      update: { niveau: o.niveau },
      create: { utilisateurId: id, module: o.module, niveau: o.niveau },
    });
  });

  await prisma.$transaction(ops);

  await auditUsers(req, {
    userId: Number(callerId),
    societeId: user.societeId,
    action: "UPDATE_PERMISSIONS",
    entite: "Utilisateur",
    entiteId: user.id,
    module: "USERS",
    description: `Permissions individuelles modifiées pour ${user.email} (${overrides.length} module(s))`,
    nouvelleValeur: JSON.stringify(overrides),
  }).catch(() => {});

  return { success: true };
}

/**
 * Met à jour le JSON permissions personnalisées sur l'utilisateur.
 */
async function patchUserPermissions({ targetUserId, permissions, callerId, callerRole, callerSocieteId, req }) {
  const id = Number(targetUserId);
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    const error = new Error("Format invalide: permissions doit être un objet");
    error.status = 400;
    throw error;
  }

  const user = await trouverUtilisateurPourAppelant({ id, callerRole, callerSocieteId });
  if (user.role === "SUPER_ADMIN") {
    const error = new Error("Les permissions du Super Admin ne peuvent pas être modifiées");
    error.status = 400;
    throw error;
  }

  await prisma.utilisateur.update({
    where: { id },
    data: { permissions },
  });

  await auditUsers(req, {
    userId: Number(callerId),
    societeId: user.societeId,
    action: "UPDATE_PERMISSIONS",
    entite: "Utilisateur",
    entiteId: user.id,
    module: "USERS",
    description: `Permissions personnalisées mises à jour pour ${user.email}`,
  }).catch(() => {});

  return { success: true, permissions };
}

async function resetUserPermissionOverrides({ targetUserId, callerId, callerRole, callerSocieteId, req }) {
  const id = Number(targetUserId);
  const user = await trouverUtilisateurPourAppelant({ id, callerRole, callerSocieteId });
  if (user.role === "SUPER_ADMIN") {
    const error = new Error("Les permissions du Super Admin ne peuvent pas être modifiées");
    error.status = 400;
    throw error;
  }

  await prisma.permissionOverride.deleteMany({ where: { utilisateurId: id } });

  await auditUsers(req, {
    userId: Number(callerId),
    societeId: user.societeId,
    action: "RESET_PERMISSIONS",
    entite: "Utilisateur",
    entiteId: user.id,
    module: "USERS",
    description: `Permissions individuelles réinitialisées pour ${user.email}`,
  }).catch(() => {});

  return { success: true };
}

async function listAuditLog({ societeId, userId, action, entite, from, to, search, page = 1, limit = 50 }) {
  const sid = requireActiveSocieteId(societeId);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const where = {
    OR: [{ societeId: sid }, { utilisateur: { societeId: sid } }],
    ...(userId ? { utilisateurId: Number(userId) } : {}),
    ...(action ? { action: { contains: String(action) } } : {}),
    ...(entite ? { OR: [{ entite: { contains: entite } }, { module: { contains: entite } }] } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search } },
            { module: { contains: search } },
            { entite: { contains: search } },
            { action: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.audit.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        utilisateur: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    }),
    prisma.audit.count({ where }),
  ]);

  return { items, total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1, limit: limitNum };
}

const profileSelect = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  role: true,
  telephone: true,
  poste: true,
  bio: true,
  avatar: true,
  theme: true,
  profileCompleted: true,
  mustChangePassword: true,
  loginCount: true,
  lastLoginAt: true,
  createdAt: true,
  societeId: true,
  societe: { select: { id: true, nom: true, code: true } },
};

async function getMe(userId) {
  const user = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: profileSelect,
  });
  if (!user) {
    const error = new Error("Utilisateur introuvable");
    error.status = 404;
    throw error;
  }
  return user;
}

async function updateMyProfile(userId, data) {
  const { nom, prenom, telephone, poste, bio, avatar, theme } = data;
  const patch = {
    ...(nom !== undefined ? { nom } : {}),
    ...(prenom !== undefined ? { prenom } : {}),
    ...(telephone !== undefined ? { telephone } : {}),
    ...(poste !== undefined ? { poste } : {}),
    ...(bio !== undefined ? { bio } : {}),
    ...(avatar !== undefined ? { avatar } : {}),
    ...(theme !== undefined ? { theme } : {}),
    profileCompleted: true,
    dateProfilCompletee: new Date(),
  };
  return prisma.utilisateur.update({
    where: { id: userId },
    data: patch,
    select: profileSelect,
  });
}

async function updateAvatar(userId, avatarUrl) {
  return prisma.utilisateur.update({
    where: { id: userId },
    data: { avatar: avatarUrl },
    select: profileSelect,
  });
}

async function getMyAudit(userId, limit = 10) {
  return prisma.audit.findMany({
    where: { utilisateurId: userId },
    orderBy: { createdAt: "desc" },
    take: Number(limit),
    select: {
      id: true,
      action: true,
      module: true,
      description: true,
      entite: true,
      createdAt: true,
    },
  });
}

async function getAuditKpis(societeId) {
  const sid = requireActiveSocieteId(societeId);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const baseWhere = { OR: [{ societeId: sid }, { utilisateur: { societeId: sid } }] };

  const [actionsToday, usersActive, criticalErrors, failedLogins] = await Promise.all([
    prisma.audit.count({ where: { ...baseWhere, createdAt: { gte: todayStart } } }),
    prisma.utilisateur.count({ where: { societeId: sid, actif: true } }),
    prisma.audit.count({
      where: {
        ...baseWhere,
        OR: [{ action: { contains: "DELETE" } }, { action: { contains: "ERROR" } }],
        createdAt: { gte: todayStart },
      },
    }),
    prisma.audit.count({
      where: {
        ...baseWhere,
        action: { contains: "LOGIN_FAIL" },
        createdAt: { gte: todayStart },
      },
    }),
  ]);

  return { actionsToday, usersActive, criticalErrors, failedLogins };
}

async function listPendingUsers({ callerRole, callerSocieteId }) {
  const sid =
    callerRole === "SUPER_ADMIN"
      ? requireActiveSocieteId(callerSocieteId)
      : Number(callerSocieteId);

  if (!sid || Number.isNaN(sid)) {
    const error = new Error("Aucune société active. Sélectionnez une société.");
    error.status = 403;
    throw error;
  }

  return prisma.utilisateur.findMany({
    where: {
      societeId: sid,
      statutCompte: "EN_ATTENTE_VALIDATION",
      role: { in: ["MAGASINIER", "RESPONSABLE", "COMPTABLE"] },
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

async function sendCompteActiveEmail({ user, societe }) {
  const transporter = createSmtpTransporter();
  if (!transporter) return { sent: false, reason: "smtp_missing" };

  const { getCompteActiveMailOptions } = require("../../utils/emailTemplates");
  const loginUrl = getLoginUrl();
  const from = getSmtpFrom(societe);
  try {
    await transporter.sendMail(
      getCompteActiveMailOptions({ user, societe, loginUrl, from })
    );
    return { sent: true };
  } catch (e) {
    console.error("[users] Échec email compte activé:", e?.message || e);
    return { sent: false, reason: e?.message || "send_failed" };
  }
}

async function sendCompteRejeteEmail({ user, societe }) {
  const transporter = createSmtpTransporter();
  if (!transporter) return { sent: false, reason: "smtp_missing" };

  const { getCompteRejeteMailOptions } = require("../../utils/emailTemplates");
  const from = getSmtpFrom(societe);
  try {
    await transporter.sendMail(getCompteRejeteMailOptions({ user, societe, from }));
    return { sent: true };
  } catch (e) {
    console.error("[users] Échec email compte rejeté:", e?.message || e);
    return { sent: false, reason: e?.message || "send_failed" };
  }
}

async function approveUser({ callerRole, callerSocieteId, callerId, targetUserId, req }) {
  const where =
    callerRole === "SUPER_ADMIN"
      ? { id: Number(targetUserId), societeId: requireActiveSocieteId(callerSocieteId) }
      : { id: Number(targetUserId), societeId: Number(callerSocieteId) };

  const user = await prisma.utilisateur.findFirst({ where });
  if (!user) {
    const error = new Error("Utilisateur introuvable");
    error.status = 404;
    throw error;
  }

  if (user.statutCompte !== "EN_ATTENTE_VALIDATION") {
    const error = new Error("Ce compte n'est pas en attente de validation");
    error.status = 400;
    throw error;
  }

  if (user.role === "CLIENT") {
    const error = new Error(
      "Les comptes clients s'activent via le rattachement à une fiche client"
    );
    error.status = 400;
    throw error;
  }

  const updated = await prisma.utilisateur.update({
    where: { id: user.id },
    data: { statutCompte: "ACTIF", actif: true },
    select: { ...baseSelect, statutCompte: true, createdAt: true },
  });

  const societe = await prisma.societe.findUnique({ where: { id: user.societeId } });
  const emailResult = await sendCompteActiveEmail({ user: updated, societe });

  await auditUsers(req, {
    userId: Number(callerId),
    societeId: user.societeId,
    action: "APPROVE_USER",
    entite: "Utilisateur",
    entiteId: user.id,
    module: "USERS",
    description: `Compte approuvé (${user.email}, rôle ${user.role})`,
    ancienneValeur: "EN_ATTENTE_VALIDATION",
    nouvelleValeur: "ACTIF",
  }).catch(() => {});

  return {
    ...updated,
    emailSent: Boolean(emailResult.sent),
    message: `Compte de ${user.prenom} ${user.nom} approuvé`,
  };
}

async function rejectUser({ callerRole, callerSocieteId, callerId, targetUserId, req }) {
  const where =
    callerRole === "SUPER_ADMIN"
      ? { id: Number(targetUserId), societeId: requireActiveSocieteId(callerSocieteId) }
      : { id: Number(targetUserId), societeId: Number(callerSocieteId) };

  const user = await prisma.utilisateur.findFirst({ where });
  if (!user) {
    const error = new Error("Utilisateur introuvable");
    error.status = 404;
    throw error;
  }

  if (user.statutCompte !== "EN_ATTENTE_VALIDATION") {
    const error = new Error("Ce compte n'est pas en attente de validation");
    error.status = 400;
    throw error;
  }

  if (user.role === "CLIENT") {
    const error = new Error(
      "Les comptes clients se gèrent via le rattachement à une fiche client"
    );
    error.status = 400;
    throw error;
  }

  const updated = await prisma.utilisateur.update({
    where: { id: user.id },
    data: { statutCompte: "REJETE", actif: false },
    select: { ...baseSelect, statutCompte: true, createdAt: true },
  });

  const societe = await prisma.societe.findUnique({ where: { id: user.societeId } });
  const emailResult = await sendCompteRejeteEmail({ user: updated, societe });

  await auditUsers(req, {
    userId: Number(callerId),
    societeId: user.societeId,
    action: "REJECT_USER",
    entite: "Utilisateur",
    entiteId: user.id,
    module: "USERS",
    description: `Compte rejeté (${user.email}, rôle ${user.role})`,
    ancienneValeur: "EN_ATTENTE_VALIDATION",
    nouvelleValeur: "REJETE",
  }).catch(() => {});

  return {
    ...updated,
    emailSent: Boolean(emailResult.sent),
    message: `Compte de ${user.prenom} ${user.nom} rejeté`,
  };
}

module.exports = {
  listUsers,
  listPendingUsers,
  approveUser,
  rejectUser,
  changeUserRole,
  changeUserStatus,
  resetUserPassword,
  sendUserInvitation,
  createUser,
  updateUserPermissionOverrides,
  patchUserPermissions,
  resetUserPermissionOverrides,
  trouverUtilisateurPourAppelant,
  roleAuDessusDeLappelant,
  listAuditLog,
  getAuditKpis,
  getMe,
  updateMyProfile,
  updateAvatar,
  getMyAudit,
  sendUserInviteEmail,
};
