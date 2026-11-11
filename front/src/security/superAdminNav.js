/** Routes « console » accessibles au super-admin sans société active. */
export const SUPER_ADMIN_CONSOLE_PATHS = new Set(["/dashboard", "/admin", "/superadmin", "/rapports"]);

/** Alias pratiques (redirigent vers /admin et /superadmin). */
const SUPER_ADMIN_CONSOLE_ALIASES = new Set(["/users", "/companies"]);

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isSuperConsolePath(pathname) {
  const p = String(pathname || "").split("?")[0];
  if (SUPER_ADMIN_CONSOLE_PATHS.has(p) || SUPER_ADMIN_CONSOLE_ALIASES.has(p)) return true;
  if (p.startsWith("/admin/") || p.startsWith("/superadmin/")) return true;
  return false;
}

/**
 * @param {string} to — `item.to` de la sidebar
 */
export function isSuperConsoleNavTo(to) {
  return SUPER_ADMIN_CONSOLE_PATHS.has(to);
}
