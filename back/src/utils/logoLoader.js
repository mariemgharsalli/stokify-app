const fs = require("fs");
const path = require("path");
const { uploadDir } = require("../config/paths");

const PUBLIC_ROOT = path.join(__dirname, "../../public");

function uploadCandidates(pathname) {
  const rel = String(pathname || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const under = rel.replace(/^uploads\//, "");
  const parts = under.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) return [];
  return [uploadDir(...parts)];
}
const BORDER = "#E2E8F0";
const DEFAULT_ACCENT = "#1B3A5C";

const RASTER_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

function normalizeImageExtension(extOrMime) {
  const raw = String(extOrMime || "")
    .toLowerCase()
    .replace(/^\./, "");
  if (raw === "jpg" || raw === "jpeg") return "jpeg";
  if (raw === "png" || raw === "gif") return raw;
  return "png";
}

function extensionFromBuffer(buf) {
  if (!buf || buf.length < 4) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  return "png";
}

function extensionFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpeg";
  if (m.includes("png")) return "png";
  if (m.includes("gif")) return "gif";
  return "png";
}

/**
 * Résout un chemin logo société (`/uploads/logos/...`) vers un fichier sur disque.
 * @returns {{ path?: string, buffer?: Buffer, extension?: string } | null}
 */
function resolveLogoAsset(logoPath) {
  const raw = String(logoPath || "").trim();
  if (!raw) return null;

  if (raw.startsWith("data:image/")) {
    const match = raw.match(/^data:image\/([\w+.-]+);base64,(.+)$/i);
    if (match) {
      try {
        const buffer = Buffer.from(match[2], "base64");
        return {
          buffer,
          extension: extensionFromMime(match[1]),
        };
      } catch {
        return null;
      }
    }
    return null;
  }

  let pathname = raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return null;
    }
  }

  pathname = pathname.replace(/^\//, "");
  const candidates = uploadCandidates(pathname);

  for (const filePath of candidates) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      if (RASTER_EXT.has(ext)) {
        if (ext === ".webp") return null;
        return { path: filePath, extension: normalizeImageExtension(ext) };
      }
    }
  }

  return null;
}

const HTML_LOGO_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/**
 * Convertit un logo société en data URL pour l’HTML d’aperçu (iframe srcDoc).
 * Les chemins relatifs `/uploads/logos/...` ne se résolvent pas correctement dans srcDoc.
 */
function logoToDataUrl(logoPath) {
  const raw = String(logoPath || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:image/")) return raw;

  let pathname = raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return null;
    }
  }

  pathname = pathname.replace(/^\//, "");
  const candidates = uploadCandidates(pathname);

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;
    const ext = path.extname(filePath).toLowerCase();
    const mime = HTML_LOGO_MIME[ext];
    if (!mime) continue;
    try {
      const buf = fs.readFileSync(filePath);
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  }

  return null;
}

function drawMonogram(doc, { x, y, size, label, accent = DEFAULT_ACCENT }) {
  const letter = (String(label || "L").trim()[0] || "L").toUpperCase();
  doc.save();
  doc.roundedRect(x, y, size, size, 4).fill(accent);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(Math.max(10, Math.round(size * 0.48)));
  doc.text(letter, x + size / 2, y + size * 0.62, { width: size, align: "center", height: size });
  doc.restore();
}

/**
 * Dessine le logo société dans un PDFKit document (image raster ou monogramme).
 * @returns {boolean} true si une image a été rendue
 */
function drawPdfKitLogo(doc, societe, x, y, width, height, options = {}) {
  const boxW = width ?? 28;
  const boxH = height ?? width ?? 28;
  const accent = options.accent || societe?.accentHex || DEFAULT_ACCENT;
  const bordered = options.bordered !== false;
  const company = String(societe?.nom || "—");

  if (bordered) {
    doc.save();
    doc.roundedRect(x, y, boxW, boxH, 4).fill("#ffffff");
    doc.roundedRect(x, y, boxW, boxH, 4).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.restore();
  }

  const pad = bordered ? 2 : 0;
  const innerW = boxW - pad * 2;
  const innerH = boxH - pad * 2;
  const asset = resolveLogoAsset(societe?.logo);

  if (asset?.path || asset?.buffer) {
    try {
      const imgX = x + pad;
      const imgY = y + pad;
      const fit = [innerW, innerH];
      if (asset.path) {
        doc.image(asset.path, imgX, imgY, { fit, align: "center", valign: "center" });
      } else {
        doc.image(asset.buffer, imgX, imgY, { fit, align: "center", valign: "center" });
      }
      return true;
    } catch {
      /* monogramme de secours */
    }
  }

  drawMonogram(doc, { x: x + pad, y: y + pad, size: Math.min(innerW, innerH), label: company, accent });
  return false;
}

module.exports = {
  PUBLIC_ROOT,
  resolveLogoAsset,
  logoToDataUrl,
  drawPdfKitLogo,
  drawMonogram,
};
