import { getApiOrigin } from "../services/api";

/** URL absolue ou relative correcte pour un fichier logo société (`/uploads/logos/...`). */
export function buildLogoUrl(logoPath) {
  const raw = String(logoPath || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) return raw;

  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const apiEnv = String(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "").trim();
  if (apiEnv) {
    const origin = apiEnv.replace(/\/api\/?$/i, "").replace(/\/$/, "");
    if (origin.startsWith("http")) return `${origin}${path}`;
  }

  const origin = getApiOrigin();
  if (origin) return `${origin}${path}`;
  if (typeof window !== "undefined") {
    try {
      return new URL(path, window.location.origin).href;
    } catch {
      return path;
    }
  }
  return path;
}

function mimeFromPath(pathOrUrl) {
  const ext = String(pathOrUrl || "").split("?")[0].split(".").pop()?.toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return map[ext] || "image/jpeg";
}

function isSvgSource(pathOrUrl, mime) {
  const raw = String(pathOrUrl || "").toLowerCase();
  return mime === "image/svg+xml" || raw.includes(".svg") || raw.startsWith("data:image/svg");
}

/** URLs à tenter pour charger un logo (chemins absolus API d'abord pour /uploads). */
function logoFetchCandidates(logoPath) {
  const raw = String(logoPath || "").trim();
  if (!raw) return [];
  if (raw.startsWith("data:")) return [raw];

  const urls = [];

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    urls.push(raw);
  }

  const absolute = buildLogoUrl(raw);
  if (absolute && !urls.includes(absolute)) urls.push(absolute);

  const relative = raw.startsWith("/") ? raw : `/${raw}`;
  if (!urls.includes(relative)) urls.push(relative);

  if (typeof window !== "undefined") {
    try {
      const fromOrigin = new URL(relative, window.location.origin).href;
      if (!urls.includes(fromOrigin)) urls.push(fromOrigin);
    } catch {
      /* ignore */
    }
  }

  if (absolute?.includes("127.0.0.1")) {
    const alt = absolute.replace("127.0.0.1", "localhost");
    if (!urls.includes(alt)) urls.push(alt);
  } else if (absolute?.includes("localhost")) {
    const alt = absolute.replace("localhost", "127.0.0.1");
    if (!urls.includes(alt)) urls.push(alt);
  }

  return [...new Set(urls)];
}

function imageFormatFromDataUrl(dataUrl) {
  const m = String(dataUrl || "").match(/^data:image\/(\w+);/i);
  if (!m) return "PNG";
  const ext = m[1].toUpperCase();
  if (ext === "JPG") return "JPEG";
  if (ext === "SVG") return "PNG";
  return ext;
}

async function blobToDataUrl(blob, fallbackMime) {
  let type = blob.type;
  if (!type || !type.startsWith("image/")) {
    type = fallbackMime || "image/jpeg";
  }
  const buffer = await blob.arrayBuffer();
  const normalizedBlob = type === blob.type ? blob : new Blob([buffer], { type });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(normalizedBlob);
  });
}

/** Convertit en PNG via canvas pour compatibilité jsPDF (WEBP, SVG, etc.). */
async function rasterizeForPdf(dataUrl, sourceHint = "") {
  if (typeof document === "undefined") return dataUrl;

  const mime = String(dataUrl).match(/^data:([^;]+)/)?.[1] || "";
  const needsRaster =
    isSvgSource(sourceHint, mime) ||
    /^data:image\/(svg\+xml|webp)/i.test(String(dataUrl));

  if (!needsRaster) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width || 256;
        const h = img.naturalHeight || img.height || 256;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function fetchLogoBlob(url) {
  const res = await fetch(url, { credentials: "include", mode: "cors" });
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!blob || blob.size === 0) return null;
  return blob;
}

/**
 * Charge le logo société en data URL PNG pour les exports PDF (jsPDF).
 * @param {string} logoPath — chemin DB, URL absolue, data URL ou asset bundlé
 */
export async function loadLogoDataUrl(logoPath) {
  const candidates = logoFetchCandidates(logoPath);
  if (!candidates.length) return null;

  const fallbackMime = mimeFromPath(logoPath);

  for (const url of candidates) {
    try {
      const blob = await fetchLogoBlob(url);
      if (!blob) continue;
      const dataUrl = await blobToDataUrl(blob, fallbackMime);
      if (!dataUrl) continue;
      return await rasterizeForPdf(dataUrl, logoPath || url);
    } catch {
      /* essayer l'URL suivante */
    }
  }
  return null;
}

/**
 * Résout le logo depuis un objet branding (logo + logoUrl).
 */
export async function loadBrandingLogoDataUrl(branding = {}) {
  if (branding.logoDataUrl) return branding.logoDataUrl;

  const sources = [branding.logo, branding.logoUrl].filter(Boolean);
  const unique = [...new Set(sources.map((s) => String(s).trim()).filter(Boolean))];

  for (const src of unique) {
    const dataUrl = await loadLogoDataUrl(src);
    if (dataUrl) return dataUrl;
  }
  return null;
}

export { imageFormatFromDataUrl };
