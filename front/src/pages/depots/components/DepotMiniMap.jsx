import { useEffect, useRef } from "react";
import { depotMarkerColor } from "./depotUtils";
import {
  LIGHT_TILE_ATTRIBUTION,
  LIGHT_TILE_URL,
  createDepotDivIcon,
  escapeMapPopup,
  loadLeaflet,
} from "./depotLeaflet";

export default function DepotMiniMap({
  depot,
  height = 200,
  zoomable = true,
}) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);

  const lat = Number(depot.latitude);
  const lng = Number(depot.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const color = depotMarkerColor(depot.code);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return undefined;
    let cancelled = false;

    (async () => {
      const L = await loadLeaflet();
      if (cancelled) return;

      const map = L.map(el, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: false,
        dragging: zoomable,
        scrollWheelZoom: zoomable,
        doubleClickZoom: zoomable,
        touchZoom: zoomable,
        attributionControl: false,
      });

      L.tileLayer(LIGHT_TILE_URL, { attribution: LIGHT_TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);

      if (zoomable) {
        L.control.zoom({ position: "bottomright" }).addTo(map);
      }

      const icon = createDepotDivIcon(L, color, "🏭");
      L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(
          `<b>${escapeMapPopup(depot.libelle)}</b><br/>${escapeMapPopup(depot.code)}${depot.ville ? ` — ${escapeMapPopup(depot.ville)}` : ""}`
        );

      mapInst.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
      }
    };
  }, [lat, lng, depot.code, depot.libelle, depot.ville, color, zoomable]);

  return (
    <div
      className="depot-mini-map relative overflow-hidden rounded-xl border shadow-sm"
      style={{
        height,
        borderColor: "var(--color-border-tertiary, var(--border-default, #e2e8f0))",
        background: "#f8fafc",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div ref={mapRef} className="h-full w-full" />
      {zoomable && (
        <p
          className="pointer-events-none absolute bottom-1 left-2 z-[400] rounded px-1.5 py-0.5 text-[9px]"
          style={{
            background: "rgba(255,255,255,0.92)",
            color: "var(--color-text-tertiary, #64748b)",
            border: "1px solid var(--color-border-tertiary, #e2e8f0)",
          }}
        >
          +/- ou molette pour zoomer · glisser pour déplacer
        </p>
      )}
      <style>{`
        .depot-mini-map .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12) !important;
        }
        .depot-mini-map .leaflet-control-zoom a {
          width: 28px !important;
          height: 28px !important;
          line-height: 28px !important;
          font-size: 16px !important;
          color: #378ADD !important;
          background: rgba(255, 255, 255, 0.95) !important;
          border: 1px solid #e2e8f0 !important;
        }
        .depot-mini-map .leaflet-control-zoom a:hover {
          background: #f8fafc !important;
          color: #2563b8 !important;
        }
        .depot-mini-map .leaflet-control-zoom-in {
          border-radius: 8px 8px 0 0 !important;
        }
        .depot-mini-map .leaflet-control-zoom-out {
          border-radius: 0 0 8px 8px !important;
        }
      `}</style>
    </div>
  );
}
