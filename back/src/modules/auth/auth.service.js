const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../../config/database");
const { auditFromReq, createAudit } = require("../../utils/auditHelper");
const PUBLIC_REGISTRATION_ROLES = ["MAGASINIER", "RESPONSABLE", "COMPTABLE", "CLIENT"];

function buildToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, societeId: user.societeId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

/** Audit auth : auditFromReq si req présent, sinon createAudit (login sans req.user). */
async function auditAuth(req, data) {
  if (req) {
    return auditFromReq(req, data);
  }
  return createAudit(data);
}

const LOCKOUT_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 3;
const PHOTO_MAX_BYTES = 500 * 1024;

function extractClientIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).trim();
  }
  return req?.ip || null;
}

function sanitizePhotoBase64(photoBase64) {
  if (!photoBase64 || typeof photoBase64 !== "string") return null;
  try {
    const raw = photoBase64.includes(",")
      ? photoBase64.split(",").pop()
      : photoBase64;
    const cleaned = String(raw || "").replace(/\s+/g, "");
    if (!cleaned) return null;
    const approxBytes = Math.floor((cleaned.length * 3) / 4);
    if (approxBytes > PHOTO_MAX_BYTES) return null;
    return cleaned;
  } catch {
    return null;
  }
}

async function notifyAdminsTentativeSuspecte({ user, ip, userAgent, photoBase64 }) {
  try {
    const { createSmtpTransporter, getSmtpFrom } = require("../../utils/smtp");
    const { getTentativeSuspecteMailOptions } = require("../../utils/emailTemplates");
    const transporter = createSmtpTransporter();
    if (!transporter) {
      console.warn(
        "[auth] Alerte tentative suspecte non envoyée : SMTP_USER / SMTP_PASS manquants"
      );
      return;
    }

    const admins = await prisma.utilisateur.findMany({
      where: {
        actif: true,
        OR: [
          { societeId: user.societeId, role: "ADMIN" },
          { role: "SUPER_ADMIN" },
        ],
      },
      select: { id: true, email: true, nom: true, prenom: true },
    });
    if (!admins.length) {
      console.warn(
        `[auth] Alerte tentative suspecte non envoyée : aucun ADMIN/SUPER_ADMIN actif (société ${user.societeId})`
      );
      return;
    }

    const from = getSmtpFrom(user.societe);
    const dateHeure = new Date().toLocaleString("fr-FR", {
      dateStyle: "full",
      timeStyle: "medium",
    });
    const mailOptions = getTentativeSuspecteMailOptions({
      user,
      ip,
      userAgent,
      dateHeure,
      photoBase64,
      from,
      societe: user.societe,
    });

    const results = await Promise.allSettled(
      admins.map((admin) =>
        transporter.sendMail({
          ...mailOptions,
          to: admin.email,
        })
      )
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected");
    console.info(
      `[auth] Alerte tentative suspecte : ${sent}/${admins.length} e-mail(s) envoyé(s) pour ${user.email}` +
        (photoBase64 ? " (avec photo)" : " (sans photo)")
    );
    for (const r of failed) {
      console.error(
        "[auth] Échec envoi alerte admin:",
        r.reason?.message || r.reason
      );
    }
  } catch (e) {
    console.error("[auth] Échec notification admin tentative suspecte:", e?.message || e);
  }
}

async function loginUser({ email, motDePasse, photoBase64 }, req) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const plainPassword = String(motDePasse || "").trim();
  const safePhoto = sanitizePhotoBase64(photoBase64);
  const clientIp = extractClientIp(req);
  const userAgent = req?.headers?.["user-agent"] || null;

  const user = await prisma.utilisateur.findUnique({
    where: { email: normalizedEmail },
    include: { societe: true },
  });

  if (!user) {
    // Compte inconnu : Audit exige utilisateurId (FK) — impossible de persister sans acteur.
    // L'échec "mauvais mot de passe" / compte existant est bien tracé ci-dessous.
    const error = new Error("Identifiants invalides");
    error.status = 401;
    throw error;
  }

  if (user.verrouilleJusqua && new Date(user.verrouilleJusqua) > new Date()) {
    const msLeft = new Date(user.verrouilleJusqua).getTime() - Date.now();
    const minutesLeft = Math.max(1, Math.ceil(msLeft / 60000));
    await auditAuth(req, {
      userId: user.id,
      societeId: user.societeId,
      action: "LOGIN_FAIL",
      entite: "Auth",
      module: "auth",
      description: `Connexion refusée — compte verrouillé (${user.email}, ${minutesLeft} min restantes)`,
      ip: clientIp,
    }).catch(() => {});
    const error = new Error(
      `Compte temporairement verrouillé, réessayez dans ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}`
    );
    error.status = 423;
    error.code = "COMPTE_VERROUILLE";
    error.minutesRestantes = minutesLeft;
    throw error;
  }

  if (!user.actif) {
    await auditAuth(req, {
      userId: user.id,
      societeId: user.societeId,
      action: "LOGIN_FAIL",
      entite: "Auth",
      module: "auth",
      description: `Connexion échouée — compte désactivé (${user.email})`,
      ip: clientIp,
    }).catch(() => {});
    const error = new Error("Ce compte est desactive. Contactez votre administrateur.");
    error.status = 401;
    throw error;
  }

  if (
    user.statutCompte === "EN_ATTENTE_VALIDATION" ||
    user.statutCompte === "EN_ATTENTE_RATTACHEMENT"
  ) {
    await auditAuth(req, {
      userId: user.id,
      societeId: user.societeId,
      action: "LOGIN_FAIL",
      entite: "Auth",
      module: "auth",
      description: `Connexion échouée — compte en attente de validation (${user.email}, ${user.statutCompte})`,
      ip: clientIp,
    }).catch(() => {});
    const error = new Error(
      "Votre compte est en attente de validation par un administrateur. Vous serez notifié par e-mail dès qu'il sera activé."
    );
    error.status = 403;
    error.code = "EN_ATTENTE_VALIDATION";
    throw error;
  }

  if (user.statutCompte === "REJETE") {
    await auditAuth(req, {
      userId: user.id,
      societeId: user.societeId,
      action: "LOGIN_FAIL",
      entite: "Auth",
      module: "auth",
      description: `Connexion échouée — compte rejeté (${user.email})`,
      ip: clientIp,
    }).catch(() => {});
    const error = new Error(
      "Votre demande d'inscription a été refusée. Contactez l'administrateur de la société."
    );
    error.status = 403;
    error.code = "COMPTE_REJETE";
    throw error;
  }

  if (
    user.role !== "SUPER_ADMIN" &&
    user.societe &&
    user.societe.actif === false
  ) {
    await auditAuth(req, {
      userId: user.id,
      societeId: user.societeId,
      action: "LOGIN_FAIL",
      entite: "Auth",
      module: "auth",
      description: `Connexion échouée — société désactivée (${user.email})`,
      ip: clientIp,
    }).catch(() => {});
    const error = new Error(
      "Ce compte est temporairement désactivé. Contactez votre administrateur."
    );
    error.status = 401;
    throw error;
  }

  let valid = false;
  try {
    valid = await bcrypt.compare(plainPassword, user.motDePasse);
  } catch {
    valid = false;
  }

  // Compatibilite legacy: certains comptes peuvent avoir un mot de passe non hache.
  if (!valid && user.motDePasse === plainPassword) {
    valid = true;
    await prisma.utilisateur.update({
      where: { id: user.id },
      data: { motDePasse: await bcrypt.hash(plainPassword, 10) },
    });
  }

  if (!valid) {
    const nextAttempts = (user.tentativesEchouees || 0) + 1;
    const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
    const verrouilleJusqua = shouldLock
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
      : null;

    await prisma.utilisateur.update({
      where: { id: user.id },
      data: shouldLock
        ? { tentativesEchouees: 0, verrouilleJusqua }
        : { tentativesEchouees: nextAttempts },
    });

    await auditAuth(req, {
      userId: user.id,
      societeId: user.societeId,
      action: "LOGIN_FAIL",
      entite: "Auth",
      module: "auth",
      description: shouldLock
        ? `Connexion échouée — compte verrouillé 15 min après ${MAX_FAILED_ATTEMPTS} échecs (${user.email})`
        : `Connexion échouée — mauvais mot de passe (${user.email}, tentative ${nextAttempts}/${MAX_FAILED_ATTEMPTS})`,
      ip: clientIp,
    }).catch(() => {});

    if (shouldLock) {
      // Attendre l'envoi pour ne pas perdre l'alerte si le process d'erreur coupe trop tôt
      await notifyAdminsTentativeSuspecte({
        user,
        ip: clientIp,
        userAgent,
        photoBase64: safePhoto,
      });
      const error = new Error(
        `Compte temporairement verrouillé, réessayez dans ${LOCKOUT_MINUTES} minutes`
      );
      error.status = 423;
      error.code = "COMPTE_VERROUILLE";
      error.minutesRestantes = LOCKOUT_MINUTES;
      throw error;
    }

    const error = new Error("Identifiants invalides");
    error.status = 401;
    throw error;
  }

  const updatedUser = await prisma.utilisateur.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      loginCount: { increment: 1 },
      tentativesEchouees: 0,
      verrouilleJusqua: null,
    },
    include: { societe: true },
  });

  const token = buildToken(updatedUser);

  await auditAuth(req, {
    userId: updatedUser.id,
    societeId: updatedUser.societeId,
    action: "LOGIN",
    entite: "Auth",
    module: "auth",
    description: `Connexion réussie (${updatedUser.email})`,
    ip: clientIp,
  }).catch(() => {});

  const { motDePasse: _, ...safeUser } = updatedUser;
  return { token, user: safeUser };
}

async function registerUser({ nom, prenom, email, motDePasse, role, societeCode }) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const normalizedSocieteCode = String(societeCode || "SOC001").trim();

  const existing = await prisma.utilisateur.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    const error = new Error("Cet email est deja utilise");
    error.status = 409;
    throw error;
  }

  const normalizedRole = (role || "MAGASINIER").toUpperCase();
  if (!PUBLIC_REGISTRATION_ROLES.includes(normalizedRole)) {
    const error = new Error("Role non autorise pour une inscription publique");
    error.status = 403;
    throw error;
  }

  const societe = await prisma.societe.findUnique({
    where: { code: normalizedSocieteCode },
  });
  if (!societe || societe.actif === false) {
    const error = new Error("Societe introuvable");
    error.status = 404;
    throw error;
  }

  const isClientRole = normalizedRole === "CLIENT";

  const user = await prisma.utilisateur.create({
    data: {
      nom,
      prenom,
      email: normalizedEmail,
      motDePasse: await bcrypt.hash(motDePasse, 10),
      role: normalizedRole,
      societeId: societe.id,
      ...(isClientRole
        ? { clientId: null, statutCompte: "EN_ATTENTE_RATTACHEMENT" }
        : { statutCompte: "EN_ATTENTE_VALIDATION" }),
    },
    include: { societe: true },
  });

  const { motDePasse: _, ...safeUser } = user;

  const admins = await prisma.utilisateur.findMany({
    where: { societeId: societe.id, role: "ADMIN", actif: true },
    select: { id: true, email: true, nom: true, prenom: true },
  });

  try {
    const { createSmtpTransporter, getSmtpFrom } = require("../../utils/smtp");
    const { getNouvelleInscriptionMailOptions } = require("../../utils/emailTemplates");
    const transporter = createSmtpTransporter();
    if (transporter && admins.length > 0) {
      const frontendBase = String(process.env.FRONTEND_URL || "http://localhost:5173")
        .trim()
        .replace(/\/$/, "");
      const adminUrl = `${frontendBase}/admin`;
      const from = getSmtpFrom(societe);
      await Promise.allSettled(
        admins.map((admin) =>
          transporter.sendMail(
            getNouvelleInscriptionMailOptions({
              user,
              societe,
              admin,
              adminUrl,
              from,
            })
          )
        )
      );
    }
  } catch (e) {
    console.error("[auth] Échec notification admin nouvelle inscription:", e?.message || e);
  }

  const message = isClientRole
    ? "Compte créé, en attente de validation par le fournisseur. Un administrateur doit rattacher votre compte à une fiche client."
    : "Compte créé, en attente de validation par un administrateur. Vous serez notifié par e-mail dès que votre compte sera activé.";

  return {
    status: "EN_ATTENTE_VALIDATION",
    message,
    user: safeUser,
  };
}

async function changePassword({ userId, ancienMotDePasse, nouveauMotDePasse }, req) {
  const user = await prisma.utilisateur.findUnique({ where: { id: userId } });
  if (!user) {
    const error = new Error("Utilisateur introuvable");
    error.status = 404;
    throw error;
  }

  let valid = false;
  try {
    valid = await bcrypt.compare(String(ancienMotDePasse || ""), user.motDePasse);
  } catch {
    valid = false;
  }
  if (!valid && user.motDePasse === String(ancienMotDePasse || "")) {
    valid = true;
  }
  if (!valid) {
    const error = new Error("Ancien mot de passe incorrect");
    error.status = 400;
    throw error;
  }

  await prisma.utilisateur.update({
    where: { id: userId },
    data: {
      motDePasse: await bcrypt.hash(String(nouveauMotDePasse || ""), 10),
      mustChangePassword: false,
    },
  });

  await auditAuth(req, {
    userId: user.id,
    societeId: user.societeId,
    action: "PASSWORD_CHANGE",
    entite: "Auth",
    module: "auth",
    description: `Changement de mot de passe (${user.email})`,
    ip: req?.ip || req?.headers?.["x-forwarded-for"] || null,
  }).catch(() => {});

  return { success: true, message: "Mot de passe modifié avec succès" };
}

function getFrontendUrl() {
  return String(process.env.FRONTEND_URL || "http://localhost:5173").trim().replace(/\/$/, "");
}

function buildPasswordResetToken(userId) {
  return jwt.sign(
    { sub: userId, purpose: "password-reset" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

async function requestPasswordReset({ email }, req) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const genericMessage =
    "Si un compte actif existe avec cet e-mail, un lien de réinitialisation vient d'être envoyé.";

  const user = await prisma.utilisateur.findUnique({
    where: { email: normalizedEmail },
    include: { societe: true },
  });

  if (!user || !user.actif) {
    return { success: true, message: genericMessage };
  }

  if (user.societe && user.societe.actif === false) {
    return { success: true, message: genericMessage };
  }

  const token = buildPasswordResetToken(user.id);
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  const { getPasswordResetMailOptions } = require("../../utils/emailTemplates");
  const { createSmtpTransporter, getSmtpFrom } = require("../../utils/smtp");
  const transporter = createSmtpTransporter();

  if (!transporter) {
    const error = new Error("Configuration SMTP manquante (SMTP_USER / SMTP_PASS dans .env)");
    error.status = 503;
    throw error;
  }

  const mailOptions = getPasswordResetMailOptions({
    user,
    resetUrl,
    from: getSmtpFrom(user.societe),
  });

  try {
    await transporter.sendMail(mailOptions);
  } catch (e) {
    const msg = String(e?.message || e);
    const error = new Error(msg || "Erreur lors de l'envoi de l'e-mail de réinitialisation");
    error.status = 502;
    throw error;
  }

  await auditAuth(req, {
    userId: user.id,
    societeId: user.societeId,
    action: "PASSWORD_RESET_REQUEST",
    entite: "Auth",
    module: "auth",
    description: `Demande de réinitialisation de mot de passe (${user.email})`,
    ip: req?.ip || req?.headers?.["x-forwarded-for"] || null,
  }).catch(() => {});

  return { success: true, message: genericMessage };
}

async function resetPasswordWithToken({ token, motDePasse }) {
  let payload;
  try {
    payload = jwt.verify(String(token || ""), process.env.JWT_SECRET);
  } catch {
    const error = new Error("Lien de réinitialisation invalide ou expiré");
    error.status = 400;
    throw error;
  }

  if (payload?.purpose !== "password-reset" || !payload?.sub) {
    const error = new Error("Lien de réinitialisation invalide");
    error.status = 400;
    throw error;
  }

  const user = await prisma.utilisateur.findUnique({ where: { id: Number(payload.sub) } });
  if (!user || !user.actif) {
    const error = new Error("Compte introuvable ou inactif");
    error.status = 400;
    throw error;
  }

  await prisma.utilisateur.update({
    where: { id: user.id },
    data: {
      motDePasse: await bcrypt.hash(String(motDePasse || ""), 10),
      mustChangePassword: false,
    },
  });

  return { success: true, message: "Mot de passe réinitialisé avec succès" };
}

module.exports = {
  loginUser,
  registerUser,
  PUBLIC_REGISTRATION_ROLES,
  changePassword,
  requestPasswordReset,
  resetPasswordWithToken,
};
