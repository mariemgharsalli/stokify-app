export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ["*"],

  /**
   * ADMIN = administrateur d'une société (utilisateurs de cette société uniquement).
   * La création / modification / suppression des sociétés est réservée au SUPER_ADMIN (wildcard "*").
   */
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

  /** Catalogue articles + portail commandes (pas de stock interne / dépôts). */
  CLIENT: ["stock:read", "orders:read", "orders:write"],
};

export function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role] || [];
  if (perms.includes("*") || perms.includes(permission)) return true;
  const [moduleName] = permission.split(":");
  return perms.includes(`${moduleName}:*`);
}
