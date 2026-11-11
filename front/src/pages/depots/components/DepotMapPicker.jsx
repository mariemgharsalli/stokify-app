import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Loader2 } from "lucide-react";
import {
  LIGHT_TILE_ATTRIBUTION,
  LIGHT_TILE_URL,
  TUNISIA_CENTER,
  loadLeaflet,
} from "./depotLeaflet";

const DepotMapPicker = forwardRef(function DepotMapPicker(
  {
    latitude,
    longitude,
    onCoordsChange,
    height = 260,
    isGeocoding = false,
    showGeoSuccess = false,
  },
  ref
) {
  const mapEl = useRef(null);
  const mapInst = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);
  const onCoordsRef = useRef(onCoordsChange);
  onCoordsRef.current = onCoordsChange;

  const latNum = latitude !== "" && latitude != null ? Number(latitude) : null;
  const lngNum = longitude !== "" && longitude != null ? Number(longitude) : null;
  const hasPoint = Number.isFinite(latNum) && Number.isFinite(lngNum);

  function ensureMarker(L, map, lat, lng) {
    if (!markerRef.current) {
      const m = L.marker([lat, lng], { draggable: true }).addTo(map);
      m.on("dragend", (ev) => {
        const p = ev.target.getLatLng();
        onCoordsRef.current(p.lat, p.lng);
      });
      markerRef.current = m;
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
  }

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng, zoom = 15, duration = 1.2) {
      const map = mapInst.current;
      if (!map) return;
      map.flyTo([lat, lng], zoom, { animate: true, duration });
      const L = leafletRef.current;
      if (L) ensureMarker(L, map, lat, lng);
    },
    setMarker(lat, lng) {
      const map = mapInst.current;
      const L = leafletRef.current;
      if (map && L) ensureMarker(L, map, lat, lng);
    },
    invalidateSize() {
      requestAnimationFrame(() => mapInst.current?.invalidateSize());
    },
  }));

  useEffect(() => {
    const el = mapEl.current;
    if (!el) return undefined;
    let cancelled = false;

    (async () => {
      const L = await loadLeaflet();
      if (cancelled || !mapEl.current) return;
      leafletRef.current = L;

      const center = hasPoint ? [latNum, lngNum] : TUNISIA_CENTER;
      const zoom = hasPoint ? 14 : 6;
      const map = L.map(el, { center, zoom, scrollWheelZoom: true });
      L.tileLayer(LIGHT_TILE_URL, { attribution: LIGHT_TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);

      map.on("click", (e) => {
        const { lat, lng } = e.latlng;
        ensureMarker(L, map, lat, lng);
        onCoordsRef.current(lat, lng);
      });

      if (hasPoint) ensureMarker(L, map, latNum, lngNum);

      mapInst.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      leafletRef.current = null;
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInst.current;
    if (!L || !map || !hasPoint) return;
    ensureMarker(L, map, latNum, lngNum);
    if (!isGeocoding) {
      map.flyTo([latNum, lngNum], 15, { animate: true, duration: 0.8 });
    }
  }, [latNum, lngNum, hasPoint, isGeocoding]);

  return (
    <div className="relative">
      <div
        ref={mapEl}
        className="w-full overflow-hidden rounded-xl border"
        style={{
          height,
          background: "#f1f5f9",
          borderColor: "var(--color-border-tertiary, var(--border-default, #e2e8f0))",
        }}
      />
      {isGeocoding && (
        <div
          className="pointer-events-none absolute right-2 top-2 flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] shadow-sm"
          style={{
            background: "var(--color-background-primary, #ffffff)",
            borderColor: "var(--color-border-tertiary, #e2e8f0)",
            color: "var(--color-text-secondary, #64748b)",
          }}
        >
          <Loader2 size={14} className="animate-spin" style={{ color: "#378ADD" }} />
          Recherche…
        </div>
      )}
      {showGeoSuccess && !isGeocoding && (
        <div
          className="absolute bottom-2 left-2 right-2 rounded-md px-2 py-1.5 text-center text-[11px] font-medium text-emerald-400"
          style={{ background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.35)" }}
        >
          ✓ Adresse localisée automatiquement
        </div>
      )}
    </div>
  );
});

export default DepotMapPicker;
