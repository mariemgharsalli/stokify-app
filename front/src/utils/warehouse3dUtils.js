export const CELL_SIZE = 60;
export const BOX_FOOTPRINT = 52;

export const MIN_BOX_HEIGHT = 14;
export const MAX_BOX_HEIGHT = 150;

/** Couleurs de statut fixes (alignées WarehouseMap2D / légende projet). */
export const OCCUPATION_HEX = {
  low: "#1D9E75",
  mid: "#BA7517",
  high: "#E24B4A",
  empty: "#2d3148",
};

/** Couleur d'occupation — variables CSS (légendes / UI). */
export function occupationColor(rate, isEmpty = false) {
  if (isEmpty) return "var(--bg-input)";
  const r = Number(rate) || 0;
  if (r < 50) return "var(--commerce-success)";
  if (r <= 80) return "var(--commerce-warning)";
  return "var(--commerce-danger)";
}

/** Couleur hex pour dégradés 3D des caisses. */
export function occupationHex(rate, isEmpty = false) {
  if (isEmpty) return OCCUPATION_HEX.empty;
  const r = Number(rate) || 0;
  if (r < 50) return OCCUPATION_HEX.low;
  if (r <= 80) return OCCUPATION_HEX.mid;
  return OCCUPATION_HEX.high;
}

export function emplacementId(empl) {
  return empl?.id ?? empl?.emplacementId ?? null;
}

export function computeSceneGrid(count) {
  const cols = Math.max(6, Math.ceil(Math.sqrt(Math.max(count, 1))) + 2);
  return { cols, rows: cols };
}

export function gridPosition(emplacement, index, cols) {
  if (emplacement.col != null && emplacement.row != null) {
    return { x: emplacement.col + 1, y: emplacement.row + 1 };
  }
  return {
    x: (index % cols) + 1,
    y: Math.floor(index / cols) + 1,
  };
}

export function boxHeight(occupationRatioPct, isEmpty = false) {
  if (isEmpty) return MIN_BOX_HEIGHT;
  const r = Math.max(0, Math.min(1, (Number(occupationRatioPct) || 0) / 100));
  return MIN_BOX_HEIGHT + (MAX_BOX_HEIGHT - MIN_BOX_HEIGHT) * r ** 0.85;
}

function parseHex(hex) {
  const raw = String(hex).replace("#", "").trim();
  const norm =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  return [
    parseInt(norm.slice(0, 2), 16),
    parseInt(norm.slice(2, 4), 16),
    parseInt(norm.slice(4, 6), 16),
  ];
}

function rgbToHex(r, g, b) {
  const clamp = (n) => Math.min(255, Math.max(0, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;
}

function hexToHsl(hex) {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function lighten(hex, pct) {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(100, l + pct));
}

export function darken(hex, pct) {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, l - pct));
}

export function faceGradient(baseColor, face) {
  if (face === "top") {
    return `linear-gradient(135deg, ${lighten(baseColor, 25)} 0%, ${baseColor} 60%, ${lighten(baseColor, 10)} 100%)`;
  }
  if (face === "front") {
    return `linear-gradient(180deg, ${baseColor} 0%, ${darken(baseColor, 20)} 100%)`;
  }
  return `linear-gradient(180deg, ${darken(baseColor, 10)} 0%, ${darken(baseColor, 35)} 100%)`;
}

export function buildBoxVisuals(emplacement) {
  const ratio = Math.min(100, Math.max(0, Number(emplacement.occupationRatio) || 0));
  const stockQty = emplacement.stockQty;
  const isEmpty = stockQty != null ? Number(stockQty) <= 0 : ratio <= 0;
  const baseColor = occupationHex(ratio, isEmpty);
  const height = boxHeight(ratio, isEmpty);
  return {
    ratio,
    isEmpty,
    height,
    baseColor,
    faces: {
      top: faceGradient(baseColor, "top"),
      front: faceGradient(baseColor, "front"),
      side: faceGradient(baseColor, "side"),
    },
  };
}
