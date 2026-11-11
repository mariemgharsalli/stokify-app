export function prefersTerrain(role) {
  if (role !== "MAGASINIER" || typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const phone = window.matchMedia?.("(max-width: 767px)")?.matches;
  return Boolean(standalone || phone);
}

/** Cible terrain d'un QR natif, ou null si le desktop / un autre rôle garde la page actuelle. */
export function terrainScanPath(role, kind, id) {
  if (!prefersTerrain(role) || id == null || id === "") return null;
  if (kind === "stock") return `/terrain/scan/stock/${id}`;
  if (kind === "lot") return `/terrain/scan/lot/${id}`;
  return null;
}

/** Cible de navigation après authentification réussie (hors routes métier). */
export function postAuthHomePath(role) {
  if (role === "CLIENT") return "/articles";
  if (role === "SUPER_ADMIN") return "/select-societe";
  if (prefersTerrain(role)) return "/terrain";
  return "/dashboard";
}

const AUTH_PATHS = new Set(["/login", "/register", "/reset-password"]);

export function safeInternalRedirect(from) {
  const pathname = from?.pathname;
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.startsWith("//")) {
    return null;
  }
  if (AUTH_PATHS.has(pathname)) return null;
  const search = typeof from.search === "string" ? from.search : "";
  return `${pathname}${search}`;
}

export function postAuthRedirectPath(role, from) {
  return safeInternalRedirect(from) || postAuthHomePath(role);
}
