import { useEffect, useRef } from "react";
import { X, Crosshair } from "lucide-react";
import {
  createDepotDivIcon,
  escapeMapPopup,
  fillMarkerColor,
  getMapTiles,
  hasCoords,
  loadLeaflet,
} from "./depotLeaflet";

export default function DepotsMapView({ depots, onClose, onEditDepot, onFocusDepot }) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef([]);
  const leafletRef = useRef(null);

  const withCoords = depots.filter(hasCoords);
  const withoutCoords = depots.filter((d) => !hasCoords(d));

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return undefined;
    let cancelled = false;

    (async () => {
      const L = await loadLeaflet();
      if (cancelled) return;
      leafletRef.current = L;

      const map = L.map(el, {
        center: [33.8869, 9.5375],
        zoom: 6,
        scrollWheelZoom: true,
      });
      const tiles = getMapTiles("light");
      tileLayerRef.current = L.tileLayer(tiles.url, {
        attribution: tiles.attribution,
        maxZoom: 19,
      }).addTo(map);

      const bounds = [];
      markersRef.current = [];

      for (const d of withCoords) {
        const lat = Number(d.latitude);
        const lng = Number(d.longitude);
        const pct = d.stockSummary?.remplissagePct ?? 0;
        const color = fillMarkerColor(pct);
        const icon = createDepotDivIcon(L, color, "🏭");
        const nbEmp = d.emplacements?.length ?? d.stockSummary?.nbEmplacements ?? 0;
        const popupHtml = `
          <div style="min-width:180px;font-size:12px;line-height:1.4">
            <strong>${escapeMapPopup(d.libelle)}</strong><br/>
            <span style="opacity:.85">${escapeMapPopup(d.code)}${d.ville ? ` — ${escapeMapPopup(d.ville)}` : ""}</span><br/>
            <span style="color:${color};font-weight:600">${pct}% utilisé</span><br/>
            <span style="opacity:.75">${nbEmp} emplacement${nbEmp !== 1 ? "s" : ""}</span><br/>
            <button type="button" data-depot-id="${d.id}" class="depot-map-goto" style="margin-top:6px;padding:4px 8px;border-radius:6px;border:none;background:#378ADD;color:#fff;cursor:pointer;font-size:11px">
              Voir le dépôt →
            </button>
          </div>
        `;
        const marker = L.marker([lat, lng], { icon }).addTo(map).bindPopup(popupHtml);
        marker.on("popupopen", () => {
          const btn = document.querySelector(`.depot-map-goto[data-depot-id="${d.id}"]`);
          if (btn) {
            btn.onclick = () => {
              map.closePopup();
              onClose();
              onFocusDepot?.(d.code);
            };
          }
        });
        markersRef.current.push(marker);
        bounds.push([lat, lng]);
      }

      if (bounds.length === 1) {
        map.setView(bounds[0], 12);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      mapInst.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      leafletRef.current = null;
      markersRef.current = [];
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
      }
    };
  }, [depots, onClose, onFocusDepot, withCoords.length]);

  function fitAll() {
    const map = mapInst.current;
    if (!map || !withCoords.length) return;
    const bounds = withCoords.map((d) => [Number(d.latitude), Number(d.longitude)]);
    if (bounds.length === 1) map.setView(bounds[0], 12);
    else map.fitBounds(bounds, { padding: [40, 40] });
    requestAnimationFrame(() => map.invalidateSize());
  }

  return (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.65)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        className="flex h-[80vh] w-[90vw] max-w-6xl overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          borderColor: "var(--color-border-tertiary, var(--border-default, #e2e8f0))",
          background: "var(--color-background-primary, var(--bg-card, #ffffff))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative min-w-0 flex-1">
          <div className="absolute left-4 top-4 z-[500] flex gap-2">
            <button
              type="button"
              onClick={fitAll}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs shadow-sm transition-colors"
              style={{
                borderColor: "var(--color-border-secondary, #e2e8f0)",
                background: "var(--color-background-primary, #ffffff)",
                color: "var(--color-text-primary, #0f172a)",
              }}
            >
              <Crosshair size={14} /> Centrer sur tous les dépôts
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-[500] rounded-lg border p-2 shadow-sm transition-colors"
            style={{
              borderColor: "var(--color-border-secondary, #e2e8f0)",
              background: "var(--color-background-primary, #ffffff)",
              color: "var(--color-text-secondary, #64748b)",
            }}
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
          <div ref={mapRef} className="h-full w-full" />
        </div>
        {withoutCoords.length > 0 && (
          <aside
            className="w-64 shrink-0 overflow-y-auto border-l p-4"
            style={{
              borderColor: "var(--color-border-tertiary, #e2e8f0)",
              background: "var(--color-background-secondary, #f8fafc)",
            }}
          >
            <p
              className="mb-3 text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--color-text-tertiary, #94a3b8)" }}
            >
              Sans localisation ({withoutCoords.length})
            </p>
            <ul className="space-y-2">
              {withoutCoords.map((d) => (
                <li
                  key={d.id}
                  className="rounded-xl border p-3 text-xs shadow-sm"
                  style={{
                    borderColor: "var(--color-border-tertiary, #e2e8f0)",
                    background: "var(--color-background-primary, #ffffff)",
                  }}
                >
                  <p className="font-medium" style={{ color: "var(--color-text-primary, #0f172a)" }}>
                    {d.libelle}
                  </p>
                  <p style={{ color: "var(--color-text-tertiary, #94a3b8)" }}>{d.code}</p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditDepot?.(d);
                    }}
                    className="mt-2 font-medium"
                    style={{ color: "#378ADD" }}
                  >
                    + Ajouter la localisation
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
