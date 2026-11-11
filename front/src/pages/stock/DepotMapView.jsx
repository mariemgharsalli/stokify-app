import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";

const HEALTH_COLORS = {
  green: "#1D9E75",
  amber: "#BA7517",
  red: "#E24B4A",
};

const TUNISIA_CENTER = [33.8869, 9.5375];
const DEFAULT_ZOOM = 6;

export default function DepotMapView({ onSelectDepot }) {
  const societeScope = useSocieteQueryScope();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  const { data: depots = [], isLoading } = useQuery({
    queryKey: ["depots-map-summary", societeScope],
    queryFn: () => api.get("depots/with-stock-summary").then((r) => r.data),
  });

  const withCoords = depots.filter((d) => d.latitude != null && d.longitude != null);
  const withoutCoords = depots.filter((d) => d.latitude == null || d.longitude == null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    mapInstance.current = L.map(mapRef.current, {
      center: TUNISIA_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(mapInstance.current);

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || isLoading) return;
    mapInstance.current.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) mapInstance.current.removeLayer(layer);
    });

    withCoords.forEach((d, i) => {
      const color = HEALTH_COLORS[d.health] || HEALTH_COLORS.green;
      const marker = L.circleMarker([d.latitude, d.longitude], {
        radius: 10,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 2,
        className: "depot-marker-bounce",
      });
      marker.on("add", () => {
        const el = marker.getElement();
        if (el) el.style.animationDelay = `${i * 80}ms`;
      });
      const popup = `
        <div style="font-family:system-ui;font-size:13px;min-width:180px;">
          <strong>${d.libelle}</strong><br/>
          ${d.region || d.ville || ""}<br/>
          Articles : ${d.totalArticles}<br/>
          Valeur : ${Number(d.valeurStock).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND<br/>
          Ruptures : ${d.ruptures} | Critiques : ${d.critiques}<br/>
          <a href="#" data-depot-id="${d.id}" style="color:#378ADD">Voir le stock de ce dépôt</a>
        </div>`;
      marker.bindPopup(popup);
      marker.on("popupopen", (e) => {
        const link = e.popup.getElement()?.querySelector("[data-depot-id]");
        if (link) {
          link.onclick = (ev) => {
            ev.preventDefault();
            onSelectDepot?.(d.id);
            mapInstance.current?.closePopup();
          };
        }
      });
      marker.addTo(mapInstance.current);
    });
  }, [withCoords, isLoading, onSelectDepot]);

  return (
    <div className="space-y-4 animate-[fadeUp_0.4s_ease_both]">
      <div className="overflow-hidden rounded-xl border border-[var(--border-default)]">
        <div ref={mapRef} className="h-[420px] w-full bg-[var(--bg-hover)]" aria-label="Carte des dépôts" />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
        {[
          { key: "green", label: "Stock sain" },
          { key: "amber", label: "Articles critiques" },
          { key: "red", label: "Ruptures détectées" },
        ].map(({ key, label }) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: HEALTH_COLORS[key] }} />
            {label}
          </span>
        ))}
      </div>

      {withoutCoords.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <p className="col-span-full text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Dépôts sans coordonnées GPS
          </p>
          {withoutCoords.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelectDepot?.(d.id)}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 text-left transition hover:bg-[var(--bg-hover)]"
              style={{ animation: `fadeUp 0.4s ease ${i * 50}ms both` }}
            >
              <p className="font-medium text-[var(--text-primary)]">{d.libelle}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {d.totalArticles} article(s) · {Number(d.valeurStock).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND
              </p>
              <p className="mt-1 text-xs">
                <span className="text-[#E24B4A]">{d.ruptures} rupture(s)</span>
                {" · "}
                <span className="text-[#BA7517]">{d.critiques} critique(s)</span>
              </p>
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? <p className="text-center text-sm text-[var(--text-muted)]">Chargement de la carte…</p> : null}
    </div>
  );
}
