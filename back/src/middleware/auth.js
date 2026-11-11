const jwt = require("jsonwebtoken");
const prisma = require("../config/database");

async function auth(req, res, next) {
  const header = req.headers.authorization;
  const rawToken = header && header.startsWith("Bearer ") ? header.split(" ")[1] : null;
  const token =
    rawToken && String(rawToken).startsWith('"') && String(rawToken).endsWith('"')
      ? String(rawToken).slice(1, -1)
      : rawToken;

  if (!token) {
    return res.status(401).json({ message: "Token manquant" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Token invalide" });
  }
  if (!payload?.id) {
    return res.status(401).json({ message: "Token invalide" });
  }
  try {
    const user = await prisma.utilisateur.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        role: true,
        societeId: true,
        actif: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        clientId: true,
        statutCompte: true,
      },
    });
    if (!user || !user.actif) {
      return res.status(401).json({ message: "Compte inactif ou introuvable" });
    }

    if (user.role !== "SUPER_ADMIN" && user.societeId) {
      const societe = await prisma.societe.findUnique({
        where: { id: user.societeId },
        select: { actif: true },
      });
      if (!societe || societe.actif === false) {
        return res.status(403).json({
          message: "Ce compte est temporairement désactivé. Contactez votre administrateur.",
        });
      }
    }

    const principal = { ...user };
    /** Super-admin : contexte société via en-tête `x-societe-id` (sélecteur front). */
    if (principal.role === "SUPER_ADMIN") {
      const raw = req.headers["x-societe-id"];
      if (raw != null && String(raw).trim() !== "") {
        const impersonatedId = parseInt(String(raw).trim(), 10);
        if (!Number.isNaN(impersonatedId) && impersonatedId > 0) {
          principal.societeId = impersonatedId;
        }
      }
    }

    req.user = principal;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { auth };
