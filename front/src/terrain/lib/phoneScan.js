export const PHONE_HTTPS_PORT = "5174";

function loopback(host) {
  const value = String(host || "").toLowerCase();
  return !value || value === "localhost" || value === "127.0.0.1" || value === "[::1]" || value === "::1";
}

/** Adresse où la caméra du téléphone est autorisée. */
export function phoneScanUrl() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  if (window.isSecureContext) {
    const port = window.location.port ? `:${window.location.port}` : "";
    return `https://${host}${port}/terrain`;
  }
  return `https://${host}:${PHONE_HTTPS_PORT}/terrain`;
}

/** Le HTTP du réseau local n'est pas un contexte sûr : la caméra reste bloquée. */
export function needsPhoneHttps() {
  if (typeof window === "undefined" || window.isSecureContext) return false;
  return !loopback(window.location.hostname);
}
