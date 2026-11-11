const { loginUser, registerUser, changePassword: changePasswordService, requestPasswordReset: requestPasswordResetService, resetPasswordWithToken: resetPasswordWithTokenService } = require("./auth.service");
const prisma = require("../../config/database");

async function login(req, res, next) {
  try {
    const PHOTO_MAX_BYTES = 500 * 1024;
    let photoBase64 = req.body?.photoBase64 || null;
    if (typeof photoBase64 === "string") {
      try {
        const raw = photoBase64.includes(",")
          ? photoBase64.split(",").pop()
          : photoBase64;
        const approxBytes = Math.floor((String(raw || "").length * 3) / 4);
        if (approxBytes > PHOTO_MAX_BYTES) {
          photoBase64 = null;
        }
      } catch {
        photoBase64 = null;
      }
    } else {
      photoBase64 = null;
    }

    const result = await loginUser(
      {
        email: req.body?.email,
        motDePasse: req.body?.motDePasse,
        photoBase64,
      },
      req
    );
    return res.json(result);
  } catch (error) {
    if (error.code === "P1000") {
      return res.status(500).json({ message: "Configuration MySQL invalide. Verifie DATABASE_URL dans .env." });
    }
    if (error.code === "P1001") {
      return res.status(503).json({ message: "Base de donnees indisponible. Demarre MySQL." });
    }
    if (error.code === "P2021") {
      return res.status(500).json({ message: "Tables absentes. Execute les migrations Prisma." });
    }
    if (error.code === "P2022") {
      return res.status(500).json({
        message:
          "Colonne SQL absente : la base n'est pas a jour avec le schema Prisma. Executez depuis back/: npx prisma migrate deploy puis redemarrez le serveur.",
        ...(process.env.NODE_ENV !== "production" && error.meta ? { prismaMeta: error.meta } : {}),
      });
    }
    return next(error);
  }
}

async function register(req, res, next) {
  try {
    const result = await registerUser(req.body);
    return res.status(201).json(result);
  } catch (error) {
    if (error.code === "P1000") {
      return res.status(500).json({ message: "Configuration MySQL invalide. Verifie DATABASE_URL dans .env." });
    }
    if (error.code === "P1001") {
      return res.status(503).json({ message: "Base de donnees indisponible. Demarre MySQL." });
    }
    if (error.code === "P2021") {
      return res.status(500).json({ message: "Tables absentes. Execute les migrations Prisma." });
    }
    if (error.code === "P2022") {
      return res.status(500).json({
        message:
          "Colonne SQL absente : la base n'est pas a jour avec le schema Prisma. Executez depuis back/: npx prisma migrate deploy puis redemarrez le serveur.",
        ...(process.env.NODE_ENV !== "production" && error.meta ? { prismaMeta: error.meta } : {}),
      });
    }
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await prisma.utilisateur.findUnique({
      where: { id: req.user.id },
      include: { societe: true },
    });
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    const { motDePasse: _, ...safeUser } = user;
    return res.json(safeUser);
  } catch (error) {
    return next(error);
  }
}

function refresh(req, res) {
  return res.status(501).json({ message: "Endpoint refresh a implementer" });
}

async function changePassword(req, res, next) {
  try {
    const result = await changePasswordService({
      userId: req.user.id,
      ancienMotDePasse: req.body.ancienMotDePasse,
      nouveauMotDePasse: req.body.nouveauMotDePasse,
    }, req);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const result = await requestPasswordResetService({ email: req.body.email }, req);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const result = await resetPasswordWithTokenService({
      token: req.body.token,
      motDePasse: req.body.motDePasse,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { login, register, me, refresh, changePassword, forgotPassword, resetPassword };
