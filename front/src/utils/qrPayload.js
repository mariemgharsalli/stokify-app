/** Chemins métier ouverts par les QR Stokify. */
export function stockScanPath(stockId) {
  return `/stock/scan/${Number(stockId)}`;
}

export function lotScanPath(lotId) {
  return `/stock/lots/scan/${Number(lotId)}`;
}

export function isLoopbackHost(host) {
  const h = String(host || "").toLowerCase();
  return !h || h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

export function isLoopbackOrigin(origin) {
  try {
    return isLoopbackHost(new URL(origin).hostname);
  } catch {
    return true;
  }
}

let cachedLanOrigin = "";
let pendingOrigin = null;

async function fetchLanOriginFromApi() {
  try {
    const { default: api } = await import("../services/api");
    const { data } = await api.get("runtime/qr-origin");
    const origin = String(data?.origin || "").replace(/\/$/, "");
    if (origin && !isLoopbackOrigin(origin)) return origin;
  } catch {
    /* backend down or CORS — keep window origin */
  }
  return "";
}

/** Origine joignable par un téléphone (IP LAN), pas localhost. */
export async function resolveQrOrigin() {
  const configured = String(import.meta.env.VITE_PUBLIC_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (configured && !isLoopbackOrigin(configured)) return configured;

  if (typeof window !== "undefined" && !isLoopbackOrigin(window.location.origin)) {
    return window.location.origin;
  }

  if (cachedLanOrigin) return cachedLanOrigin;
  if (!pendingOrigin) {
    pendingOrigin = fetchLanOriginFromApi().then((origin) => {
      if (origin) cachedLanOrigin = origin;
      return origin || (typeof window !== "undefined" ? window.location.origin : "");
    });
  }
  try {
    return await pendingOrigin;
  } finally {
    pendingOrigin = null;
  }
}

export async function buildScanUrl(path) {
  const origin = await resolveQrOrigin();
  return `${String(origin).replace(/\/$/, "")}${path}`;
}

function pathFromUrlOrText(text) {
  try {
    return new URL(text).pathname;
  } catch {
    const m = String(text).match(/https?:\/\/[^/\s]+(\/[^?\s]*)/i);
    return m ? m[1] : text;
  }
}

/**
 * Interprète la valeur lue par un scanner (URL, ancien QR texte, ou code emplacement).
 */
export function parseScannedCode(raw) {
  const text = String(raw || "").trim();
  if (!text) return { type: "unknown", value: text };

  const pathname = pathFromUrlOrText(text);
  const stock = pathname.match(/\/stock\/scan\/(\d+)/);
  if (stock) {
    return { type: "stock", id: Number(stock[1]), path: stockScanPath(stock[1]), value: text };
  }
  const lot = pathname.match(/\/stock\/lots\/scan\/(\d+)/);
  if (lot) {
    return { type: "lot", id: Number(lot[1]), path: lotScanPath(lot[1]), value: text };
  }

  const articleCode = text.match(/^Code:\s*(.+)$/m)?.[1]?.trim();
  const emplacement = text.match(/^Emplacement:\s*(.+)$/m)?.[1]?.trim();
  if (articleCode) {
    return {
      type: "stock-text",
      articleCode,
      emplacement: emplacement && emplacement !== "—" ? emplacement : "",
      value: text,
    };
  }

  return { type: "code", value: text };
}
