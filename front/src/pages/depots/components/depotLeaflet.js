export const TUNISIA_CENTER = [33.8869, 9.5375];
export const LIGHT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const LIGHT_TILE_ATTRIBUTION = "© OpenStreetMap";
export const DARK_TILE_URL = LIGHT_TILE_URL;
export const DARK_TILE_ATTRIBUTION = LIGHT_TILE_ATTRIBUTION;

export function getMapTiles(effective = "light") {
  if (effective === "dark") {
    return { url: DARK_TILE_URL, attribution: DARK_TILE_ATTRIBUTION };
  }
  return { url: LIGHT_TILE_URL, attribution: LIGHT_TILE_ATTRIBUTION };
}

let leafletPromise;

export async function loadLeaflet() {
  if (!leafletPromise) {
    leafletPromise = (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      const markerIcon = (await import("leaflet/dist/images/marker-icon.png")).default;
      const markerIcon2x = (await import("leaflet/dist/images/marker-icon-2x.png")).default;
      const markerShadow = (await import("leaflet/dist/images/marker-shadow.png")).default;
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: markerIcon,
        iconRetinaUrl: markerIcon2x,
        shadowUrl: markerShadow,
      });
      return L;
    })();
  }
  return leafletPromise;
}

export function hasCoords(depot) {
  const lat = Number(depot?.latitude);
  const lng = Number(depot?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

export function fillMarkerColor(pct) {
  const p = Number(pct) || 0;
  if (p > 85) return "#ef4444";
  if (p >= 60) return "#f97316";
  return "#22c55e";
}

export function escapeMapPopup(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createDepotDivIcon(L, color, label = "📍") {
  return L.divIcon({
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.45);border:2px solid rgba(255,255,255,.9)"><span style="transform:rotate(45deg);font-size:11px;">${label}</span></div>`,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
}
