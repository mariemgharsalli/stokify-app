const prisma = require("../config/database");
const { levelToPermissions } = require("./moduleRegistry");

const PERMISSIONS = {
  SUPER_ADMIN: ["*"],
  ADMIN: [
    "users:read",
    "users:manage",
    "companies:read",
    "stock:read",
    "stock:write",
    "stock:delete",
    "rapports:read",
    "ai:read",
    "ventes:read",
    "ventes:write",
    "ventes:validate",
    "clients:write",
    "achats:read",
    "achats:write",
    "valorisation:read",
    "mouvements:read",
    "mouvements:write",
    "mouvements:validate",
    "accounting:read",
    "reglements:write",
    "encours:read",
  ],
  RESPONSABLE: [
    "stock:read",
    "stock:write",
    "rapports:read",
    "ai:read",
    "users:read",
    "mouvements:read",
    "mouvements:write",
    "mouvements:validate",
    "ventes:read",
    "ventes:write",
    "clients:write",
    "achats:read",
    "achats:write",
    "valorisation:read",
    "reglements:write",
    "encours:read",
  ],
  MAGASINIER: [
    "stock:read",
    "stock:write",
    "mouvements:read",
    "mouvements:write",
    "ventes:read",
    "ventes:write",
    "clients:write",
    "achats:read",
    "achats:write",
    "ai:read",
  ],
  COMPTABLE: [
    "ventes:read",
    "achats:read",
    "valorisation:read",
    "accounting:read",
    "reglements:*",
    "stock:read",
    "encours:read",
  ],
  CLIENT: ["stock:read", "orders:read", "orders:write"],
};

function hasPermission(perms, permission) {
  if (perms.includes("*") || perms.includes(permission)) return true;
  const [moduleName] = permission.split(":");
  return perms.includes(`${moduleName}:*`);
}

async function getEffectivePermissions(user) {
  const rolePerms = PERMISSIONS[user.role] || [];
  if (rolePerms.includes("*")) return rolePerms;

  const overrides = await prisma.permissionOverride.findMany({
    where: { utilisateurId: user.id },
  });

  if (overrides.length === 0) return rolePerms;

  const overriddenModules = new Set(overrides.map((o) => o.module));
  const base = rolePerms.filter((p) => {
    const [moduleName] = p.split(":");
    return !overriddenModules.has(moduleName);
  });

  const overrideForPerms = overrides.flatMap((o) => levelToPermissions(o.module, o.niveau));
  return [...base, ...overrideForPerms];
}

async function resolveRequestPermissions(req) {
  if (!req._effectivePermissions) {
    req._effectivePermissions = await getEffectivePermissions(req.user);
  }
  return req._effectivePermissions;
}

function can(permission) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Non authentifié" });
    try {
      const perms = await resolveRequestPermissions(req);
      if (hasPermission(perms, permission)) return next();
      return res.status(403).json({ message: "Acces refuse" });
    } catch (err) {
      return next(err);
    }
  };
}

/** Au moins une permission requise (OU logique). */
function canAny(...permissions) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Non authentifié" });
    try {
      const perms = await resolveRequestPermissions(req);
      if (permissions.some((p) => hasPermission(perms, p))) return next();
      return res.status(403).json({ message: "Acces refuse" });
    } catch (err) {
      return next(err);
    }
  };
}

function superAdminOnly(req, res, next) {
  if (req.user?.role === "SUPER_ADMIN") {
    return next();
  }
  return res.status(403).json({ message: "Access reserved for Super Administrator" });
}

/** Données métier par société : super-admin sans société (ni en-tête) ne doit pas lire/écrire ces routes. */
function requireSociete(req, res, next) {
  if (req.user?.role === "SUPER_ADMIN" && (req.user.societeId == null || req.user.societeId === "")) {
    return res.status(403).json({
      message:
        "Super Admin doit sélectionner une société active avant d'accéder aux données métier.",
    });
  }
  return next();
}

module.exports = {
  can,
  canAny,
  PERMISSIONS,
  hasPermission,
  superAdminOnly,
  requireSociete,
  getEffectivePermissions,
};
