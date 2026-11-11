import { useEffect, useState } from "react";
import { getApiOrigin } from "../../../services/api";
import { stockLevelColor } from "../../../hooks/useStockGroupes";

/** Palette élargie — 14 paires de dégradés vifs, plus saturée que DEPOT_COLORS */
export const REFS_GRADIENT_PALETTE = [
  ["#7c3aed", "#6366f1"],
  ["#4f46e5", "#3b82f6"],
  ["#2563eb", "#0ea5e9"],
  ["#06b6d4", "#14b8a6"],
  ["#0d9488", "#10b981"],
  ["#22c55e", "#84cc16"],
  ["#eab308", "#f59e0b"],
  ["#f97316", "#ef4444"],
  ["#dc2626", "#e11d48"],
  ["#ec4899", "#f43f5e"],
  ["#d946ef", "#c026d3"],
  ["#a855f7", "#7c3aed"],
  ["#db2777", "#9333ea"],
  ["#0891b2", "#0284c7"],
];

/** Alias demandé par le cahier des charges */
export const REFS_COLORS = REFS_GRADIENT_PALETTE;

export function getArticleCount(item) {
  return Number(item?._count?.articles ?? 0);
}

export function sumArticleCounts(items) {
  return (items || []).reduce((s, i) => s + getArticleCount(i), 0);
}

/** IDs des items dans le top 20 % par nombre d'articles (seuil = 80e percentile). */
export function computeHighRotationIds(items) {
  const counts = (items || []).map(getArticleCount).filter((c) => c > 0);
  if (counts.length === 0) return new Set();

  const sorted = [...counts].sort((a, b) => a - b);
  const idx = Math.min(Math.floor(sorted.length * 0.8), sorted.length - 1);
  const threshold = sorted[idx];

  return new Set(
    (items || []).filter((i) => getArticleCount(i) >= threshold && getArticleCount(i) > 0).map((i) => i.id)
  );
}

export function colorFromString(str) {
  let hash = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % REFS_GRADIENT_PALETTE.length;
  return REFS_GRADIENT_PALETTE[idx];
}

export function gradientFromString(str) {
  const [a, b] = colorFromString(str);
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export function accentColorFromString(str) {
  return colorFromString(str)[0];
}

export function marqueGradient(code = "") {
  return gradientFromString(`marque-${code}`);
}

export function marqueAccent(code = "") {
  return accentColorFromString(`marque-${code}`);
}

export function familleGradient(code = "") {
  return gradientFromString(`famille-${code}`);
}

export function familleAccent(code = "") {
  return accentColorFromString(`famille-${code}`);
}

export function sousFamilleGradient(code = "", parentCode = "") {
  const seed = parentCode ? `sf-${parentCode}-${code}` : `sf-${code}`;
  return gradientFromString(seed);
}

export function sousFamilleAccent(code = "", parentCode = "") {
  const seed = parentCode ? `sf-${parentCode}-${code}` : `sf-${code}`;
  return accentColorFromString(seed);
}

export function lighterGradientFromString(str) {
  const [a, b] = colorFromString(str);
  return `linear-gradient(135deg, ${a}44, ${b}22)`;
}

function removeAccents(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugifyName(nom) {
  return removeAccents(nom)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim();
}

export function baseCodeFromName(nom) {
  const words = slugifyName(nom).split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  if (words.length === 1) {
    return words[0].slice(0, 8);
  }

  const parts = words.map((w) => w.slice(0, Math.min(4, w.length)));
  return parts.join("").slice(0, 8);
}

export function resolveUniqueCode(base, existingCodes = []) {
  const normalized = String(base || "").toUpperCase();
  if (!normalized) return "";

  const existing = new Set(
    (existingCodes || []).map((c) => String(c || "").toUpperCase()).filter(Boolean)
  );
  if (!existing.has(normalized)) return normalized;

  let n = 2;
  while (existing.has(`${normalized}${n}`)) n += 1;
  return `${normalized}${n}`;
}

/** Génère un code unique à partir du nom (majuscules, sans accents, collision → suffixe numérique). */
export function generateCodeFromName(nom, existingCodes = []) {
  const base = baseCodeFromName(nom);
  return resolveUniqueCode(base, existingCodes);
}

/** Sous-famille : préfixe code famille + partie dérivée du nom. */
export function generateSousFamilleCodeFromName(nom, parentCode = "", existingCodes = []) {
  const childPart = baseCodeFromName(nom);
  if (!childPart) return "";

  const parent = String(parentCode || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const suffix = childPart.slice(0, parent ? 4 : 8);
  const combined = parent ? `${parent}_${suffix}` : suffix;
  const base = combined.slice(0, 12);

  return resolveUniqueCode(base, existingCodes);
}

export function resolveMarqueImageUrl(raw) {
  const s0 = String(raw || "").trim().replace(/\\/g, "/");
  if (!s0) return "";

  let path = "";
  try {
    const u = new URL(s0);
    const p = String(u.pathname || "").replace(/^\/api(?=\/uploads\/)/i, "");
    if (p.startsWith("/uploads/")) {
      path = p + (u.search || "") + (u.hash || "");
    } else if (/^https?:\/\//i.test(s0)) {
      return s0;
    } else {
      return s0;
    }
  } catch {
    let p = s0.startsWith("/") ? s0 : `/${s0}`;
    p = p.replace(/^\/api(?=\/uploads\/)/i, "");
    if (!p.startsWith("/uploads/")) return s0;
    path = p;
  }

  const origin = getApiOrigin();
  return origin ? `${origin}${path}` : path;
}

export function getMarqueInitial(nom) {
  const t = String(nom || "").trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}

export function highlightMatch(text, term) {
  if (!term || !text) return text;
  const q = term.trim();
  if (!q) return text;
  const str = String(text);
  const idx = str.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {str.slice(0, idx)}
      <mark className="rounded bg-violet-500/25 px-0.5 text-violet-700 dark:bg-violet-500/30 dark:text-violet-200">
        {str.slice(idx, idx + q.length)}
      </mark>
      {str.slice(idx + q.length)}
    </>
  );
}

/** Dégradés statut article — mapping fixe partagé (segmented control, badges, filtres). */
export const ARTICLE_STATUS_GRADIENTS = {
  ALL: "linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)",
  ACTIF: "linear-gradient(135deg, #059669 0%, #14b8a6 100%)",
  ARCHIVE: "linear-gradient(135deg, #475569 0%, #64748b 100%)",
  BLOQUE: "linear-gradient(135deg, #dc2626 0%, #f43f5e 100%)",
};

/**
 * Dégradé unique par statut — utilisé partout (segmented control, badges tableau, etc.).
 * @param {string} statutKey — "", "ALL", "ACTIF", "ARCHIVE", "BLOQUE"
 */
export function statusGradient(statutKey) {
  const k = String(statutKey ?? "").trim().toUpperCase();
  if (!k || k === "ALL" || k === "TOUS") return ARTICLE_STATUS_GRADIENTS.ALL;
  return ARTICLE_STATUS_GRADIENTS[k] ?? ARTICLE_STATUS_GRADIENTS.ACTIF;
}

/** @deprecated Alias — préférer statusGradient */
export function statusFilterGradient(filterValue) {
  return statusGradient(filterValue);
}

export function statusGlowColor(statutKey) {
  const k = String(statutKey ?? "").trim().toUpperCase();
  if (!k || k === "ALL" || k === "TOUS") return "rgba(139, 92, 246, 0.38)";
  if (k === "ACTIF") return "rgba(20, 184, 166, 0.38)";
  if (k === "ARCHIVE") return "rgba(100, 116, 139, 0.35)";
  if (k === "BLOQUE") return "rgba(244, 63, 94, 0.35)";
  return "rgba(20, 184, 166, 0.38)";
}

/** Classes hover pour options inactives du segmented control statut. */
export const ARTICLE_STATUS_HOVER_CLASSES = {
  ALL: "hover:bg-violet-500/12 dark:hover:bg-violet-500/15",
  ACTIF: "hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15",
  ARCHIVE: "hover:bg-slate-400/10 dark:hover:bg-slate-400/12",
  BLOQUE: "hover:bg-rose-500/10 dark:hover:bg-rose-500/15",
};

export function statusHoverClass(statutKey) {
  const k = String(statutKey ?? "").trim().toUpperCase();
  if (!k || k === "ALL" || k === "TOUS") return ARTICLE_STATUS_HOVER_CLASSES.ALL;
  return ARTICLE_STATUS_HOVER_CLASSES[k] ?? ARTICLE_STATUS_HOVER_CLASSES.ACTIF;
}

/** Niveau stock — réutilise stockLevelColor (lecture seule). */
export function stockIsCritical(qty, stockMin) {
  const q = Number(qty) || 0;
  const min = stockMin != null && stockMin !== "" ? Number(stockMin) : null;
  if (q === 0) return true;
  if (min != null && q > 0 && q <= min) return true;
  return false;
}

export function stockLevelStyle(qty, stockMin) {
  const color = stockLevelColor(qty, stockMin);
  return {
    background: `linear-gradient(135deg, ${color}dd, ${color}99)`,
    color: "#fff",
    boxShadow: stockIsCritical(qty, stockMin) ? `0 0 12px ${color}66` : undefined,
  };
}

export function stockLevelClass(qty, stockMin) {
  const q = Number(qty) || 0;
  const min = stockMin != null && stockMin !== "" ? Number(stockMin) : null;
  if (q === 0) return "bg-gradient-to-r from-red-500 to-rose-500 text-white";
  if (min != null && q > 0 && q <= min) return "bg-gradient-to-r from-amber-500 to-orange-500 text-white";
  return "bg-gradient-to-r from-emerald-500 to-teal-500 text-white";
}

/** Onglets refs Marques / Familles (interface produits) */
export const REF_NAV_GRADIENTS = {
  marques: "linear-gradient(135deg, #378ADD, #2563a8)",
  familles: "linear-gradient(135deg, #ef4444, #b91c1c)",
};

export const REF_NAV_ACCENTS = {
  marques: "#378ADD",
  familles: "#ef4444",
};

export const REF_NAV_GLOWS = {
  marques: "rgba(55, 138, 221, 0.4)",
  familles: "rgba(239, 68, 68, 0.4)",
};

export const ARTICLES_ANIMATIONS_STYLE = `
  @keyframes articleFadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes articleFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  @keyframes articleTitleUnderline {
    from { width: 0; opacity: 0.5; }
    to { width: 100%; opacity: 1; }
  }
  @keyframes articleStockPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.88; transform: scale(1.04); }
  }
  @keyframes articleCheckIn {
    from { opacity: 0; transform: scale(0.6); }
    to { opacity: 1; transform: scale(1); }
  }
  .article-fade-up {
    animation: articleFadeUp 0.35s ease-out both;
  }
  .article-float-icon {
    animation: articleFloat 3s ease-in-out infinite;
  }
  .article-title-underline {
    animation: articleTitleUnderline 0.75s ease-out both;
  }
  .article-stock-critical {
    animation: articleStockPulse 2.5s ease-in-out infinite;
  }
  .article-check-pop:checked {
    animation: articleCheckIn 0.2s ease-out;
  }
`;

export function useAnimatedNumber(target, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const end = Number(target) || 0;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      setVal(Math.round(end * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return val;
}

export const REFS_ANIMATIONS_STYLE = `
  @keyframes refsFadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes refsSlideDown {
    from { opacity: 0; max-height: 0; transform: translateY(-8px); }
    to { opacity: 1; max-height: 600px; transform: translateY(0); }
  }
  .refs-collapse {
    max-height: 0;
    opacity: 0;
    transition: max-height 0.35s ease-out, opacity 0.3s ease-out;
  }
  .refs-collapse.is-open {
    max-height: 1200px;
    opacity: 1;
  }
  .refs-form-expand {
    animation: refsSlideDown 0.35s ease-out both;
  }
  .refs-view-transition {
    animation: refsFadeUp 0.3s ease-out both;
  }
  @keyframes refsSmartBadgeIn {
    from { opacity: 0; transform: scale(0.85); }
    to { opacity: 1; transform: scale(1); }
  }
  .refs-smart-badge {
    animation: refsSmartBadgeIn 0.35s ease-out both;
  }
  .refs-card-3d {
    transform-style: preserve-3d;
    perspective: 900px;
    transition: transform 0.28s ease-out, box-shadow 0.28s ease-out, border-color 0.28s ease-out;
  }
  .refs-card-3d:hover {
    transform: translateY(-4px) rotateX(2deg) rotateY(-2deg);
  }
  .refs-trunk {
    position: relative;
  }
  .refs-trunk::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 4px 0 0 4px;
  }
  .refs-branch-connector::before {
    content: "";
    position: absolute;
    left: 6px;
    top: -8px;
    width: 2px;
    height: 12px;
    border-radius: 2px;
    opacity: 0.5;
  }
`;

export const refsInputClass =
  "w-full rounded-xl border border-white/10 bg-navy-900/80 px-3 py-2 text-sm text-white transition-all duration-200 placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20";
