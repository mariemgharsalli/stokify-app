import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";

function extractResponseMessage(error) {
  const data = error.response?.data;
  if (data && typeof data.message === "string" && data.message.trim()) return data.message.trim();
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const first = data.errors[0];
    const msg = first?.msg || first?.message;
    if (msg && String(msg).trim()) return String(msg).trim();
  }
  return "";
}

const apiPort = import.meta.env.VITE_API_PORT || "5000";
const viteApiUrl = String(import.meta.env.VITE_API_URL || "").trim();
const explicitBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();

/** Absolute API roots should end with / so axios resolves paths like "companies" correctly. */
function normalizeApiBase(url) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url.endsWith("/") ? url : `${url}/`;
  }
  return url.endsWith("/") ? url : `${url}/`;
}

function isLoopbackHost(host) {
  const h = String(host || "").toLowerCase();
  return !h || h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

function resolveApiBase() {
  const fromEnv = normalizeApiBase(viteApiUrl) || normalizeApiBase(explicitBase);
  if (import.meta.env.PROD && !explicitBase) {
    console.error(
      "[Stokify] VITE_API_BASE_URL est absente du build de production. Définissez-la avant le build, par exemple https://<api>.up.railway.app/api."
    );
  }
  const onLan =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    !isLoopbackHost(window.location.hostname);

  /** Téléphone / autre PC : passer par le proxy Vite (même hôte que la page). */
  if (onLan) return "/api/";
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV && import.meta.env.VITE_API_USE_PROXY === "true") return "/api/";
  return `http://127.0.0.1:${apiPort}/api/`;
}

const baseURL = resolveApiBase();

const api = axios.create({
  baseURL,
});

/** Bust any intermediary cache when the active société changes (browser / proxy). */
let lastSocieteIdForRequest = null;

/** Origine du serveur API (host + port), alignée sur `baseURL` axios. */
export function getApiOrigin() {
  const base = String(api.defaults.baseURL || "").trim();
  if (base.startsWith("http://") || base.startsWith("https://")) {
    try {
      return new URL(base).origin;
    } catch {
      return typeof window !== "undefined" ? window.location.origin : "";
    }
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

api.interceptors.request.use((config) => {
  const { token, activeSocieteId } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const sid =
    activeSocieteId ??
    (typeof localStorage !== "undefined" ? localStorage.getItem("active_societe_id") : null);
  const sidNorm = sid != null && String(sid).trim() !== "" ? String(sid).trim() : null;
  if (sidNorm) {
    config.headers["x-societe-id"] = sidNorm;
  }
  if (sidNorm !== lastSocieteIdForRequest) {
    lastSocieteIdForRequest = sidNorm;
    config.headers["Cache-Control"] = "no-cache";
    config.headers.Pragma = "no-cache";
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      const path = String(error.config?.url || "");
      const isAuthPublic =
        path.includes("auth/login") || path.includes("auth/register");
      if (!isAuthPublic) {
        useAuthStore.getState().logout();
      }
    }
    if (status === 403) {
      const msg = extractResponseMessage(error);
      if (msg && /soci[eé]t/i.test(msg)) {
        useToastStore.getState().pushToast(msg, "error");
        useToastStore.getState().pulseSocieteSelector();
      }
    }
    return Promise.reject(error);
  }
);

/** Télécharge un CSV via l’instance axios configurée (Authorization + x-societe-id). */
export async function downloadAuthenticatedCsv(relPath, defaultFilename = "export.csv") {
  const path = String(relPath || "").replace(/^\//, "");
  const res = await api.get(path, { responseType: "blob" });
  let name = defaultFilename;
  const cd = res.headers?.["content-disposition"];
  if (cd && typeof cd === "string") {
    const q = cd.match(/filename="([^"]+)"/);
    const u = cd.match(/filename\*=UTF-8''([^;\s]+)/);
    const s = cd.match(/filename=([^;\s]+)/);
    name = decodeURIComponent((u?.[1] ?? q?.[1] ?? s?.[1] ?? name).trim().replace(/"/g, ""));
  }
  const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name || defaultFilename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Message lisible pour les erreurs axios (connexion, validation, réseau). */
export function getAxiosErrorMessage(error, fallback = "Une erreur est survenue") {
  const status = error.response?.status;
  const data = error.response?.data;

  const fieldLabels = {
    nom: "Nom",
    prenom: "Prénom",
    email: "Adresse e-mail",
    role: "Rôle",
    motDePasse: "Mot de passe",
    societeCode: "Société",
  };

  function formatValidationMessage(msg, path) {
    const text = String(msg || "").trim();
    if (!text) return "";
    if (text === "Invalid value" && path) {
      const label = fieldLabels[path] || path;
      return `${label} : valeur invalide`;
    }
    return text;
  }

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const first = data.errors[0];
    const field = first?.field || first?.path || first?.param;
    const formatted = formatValidationMessage(first?.message || first?.msg, field);
    if (formatted) return formatted;
  }

  if (data && typeof data.message === "string" && data.message.trim()) {
    const firstPath = Array.isArray(data?.errors)
      ? data.errors[0]?.field || data.errors[0]?.path
      : undefined;
    const formatted = formatValidationMessage(data.message, firstPath);
    if (formatted) return formatted;
  }

  if (status === 503) {
    return "Le serveur est indisponible (souvent : MySQL arrêté ou DATABASE_URL incorrect). Démarrez MySQL, vérifiez .env, puis GET http://localhost:5000/health .";
  }
  if (status === 502 || status === 504) {
    return "Passerelle ou délai dépassé entre le front et le backend. Vérifiez que le backend tourne sur le port attendu (proxy VITE_PROXY_TARGET / 5000).";
  }

  if (!error.response) {
    const code = error.code;
    if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
      return "Délai dépassé : le backend ou MySQL met trop longtemps à répondre. Vérifiez MySQL et allongez le timeout si besoin.";
    }
    if (code === "ECONNREFUSED") {
      return "Connexion refusée : aucun serveur sur le port du backend. Lancez le backend (node server.js) et VITE_PROXY_TARGET si le port change.";
    }
    return `Impossible de joindre l'API (${String(api.defaults.baseURL || "").replace(/\/$/, "")}). Backend démarré ? Port ${apiPort} ? Testez dans le navigateur : http://127.0.0.1:${apiPort}/api`;
  }
  return fallback;
}

export default api;
