import { getApiOrigin } from "../services/api";

/** Pool Unsplash — usage marketing (ClientCatalog) uniquement. */
export const IMAGE_POOL = [
  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1605745341112-85968b19335b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?auto=format&fit=crop&w=800&q=80",
];

function stripApiBeforeUploads(pathname) {
  return String(pathname || "").replace(/^\/api(?=\/uploads\/)/i, "");
}

/**
 * En dev, les fichiers passent par le proxy Vite (`/uploads`) du même hôte que la page.
 * Sinon le téléphone demande `127.0.0.1`, qui est le téléphone lui-même, et le HTTPS bloque le HTTP.
 */
function apiFileOrigin() {
  if (import.meta.env.DEV && typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const apiEnv = String(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "").trim();
  if (apiEnv) {
    const origin = apiEnv.replace(/\/api\/?$/i, "").replace(/\/$/, "");
    if (origin.startsWith("http")) return origin;
  }
  return getApiOrigin();
}

/**
 * Réécrit les anciennes URL absolues pointant vers un mauvais host/port
 * (ex. http://localhost:5001/uploads/...) vers l'origine API courante.
 */
function rewriteUploadAbsoluteUrl(absoluteUrl) {
  try {
    const u = new URL(absoluteUrl);
    const p = stripApiBeforeUploads(u.pathname || "");
    if (!p.startsWith("/uploads/")) return absoluteUrl;
    const origin = apiFileOrigin();
    if (!origin) return absoluteUrl;
    return `${origin}${p}${u.search || ""}${u.hash || ""}`;
  } catch {
    return absoluteUrl;
  }
}

export function resolveArticleImageUrl(raw) {
  const s0 = String(raw || "").trim().replace(/\\/g, "/");
  if (!s0) return "";

  if (/^https?:\/\//i.test(s0)) {
    return rewriteUploadAbsoluteUrl(s0);
  }

  let path = "";
  try {
    const u = new URL(s0);
    const p = stripApiBeforeUploads(u.pathname || "");
    if (p.startsWith("/uploads/")) {
      path = p + (u.search || "") + (u.hash || "");
    } else {
      return s0;
    }
  } catch {
    let p = s0.startsWith("/") ? s0 : `/${s0}`;
    p = stripApiBeforeUploads(p.replace(/^\/+/, "/"));
    if (!p.startsWith("/uploads/")) return s0;
    path = p;
  }

  const origin = apiFileOrigin();
  if (origin) return `${origin}${path}`;
  return path;
}

/** Vraie image article uniquement — jamais le pool Unsplash. */
export function getArticleRealImageUrl(article) {
  if (article == null || typeof article !== "object") return null;
  const u = String(article.imageUrl || "").trim();
  return u ? resolveArticleImageUrl(u) : null;
}

/** Catalogue client : vraie image sinon fallback Unsplash. */
export function getArticleImageUrl(articleOrId) {
  if (articleOrId != null && typeof articleOrId === "object") {
    const real = getArticleRealImageUrl(articleOrId);
    if (real) return real;
    return IMAGE_POOL[Number(articleOrId.id) % IMAGE_POOL.length];
  }
  return IMAGE_POOL[Number(articleOrId) % IMAGE_POOL.length];
}
