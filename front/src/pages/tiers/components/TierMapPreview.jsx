import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function escapeMapPopup(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Carte Leaflet partagée — cartes grille, modals détail tiers, profil client */
export default function TierMapPreview({
  latitude,
  longitude,
  nom,
  ville,
  pays,
  /** Hauteur repliée (profil client : ~240) */
  collapsedHeight = 110,
  /** Hauteur agrandie */
  expandedHeight = 220,
  /** Ouvrir déjà agrandi (utile sur le profil) */
  defaultExpanded = false,
  /** Ne pas auto-ouvrir le popup (évite les bulles flottantes au-dessus des modales) */
  autoOpenPopup = false,
}) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!mapRef.current || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    if (mapInst.current) {
      mapInst.current.remove();
      mapInst.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
      dragging: expanded,
      scrollWheelZoom: false,
      doubleClickZoom: expanded,
      touchZoom: false,
    }).setView([lat, lng], expanded ? 14 : 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      html: `
        <div class="tier-map-marker" style="
          width:28px; height:28px; border-radius:50% 50% 50% 0;
          background:linear-gradient(135deg,#378ADD,#0EA5E9);
          transform:rotate(-45deg);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 3px 10px rgba(55,138,221,.5);
          border:2px solid white;
        ">
          <div style="transform:rotate(45deg); color:white; font-size:10px;">📍</div>
        </div>
      `,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
    const line2 = [ville, pays].filter(Boolean).join(", ");
    const marker = L.marker([lat, lng], { icon })
      .addTo(map)
      .bindPopup(`<strong>${escapeMapPopup(nom)}</strong><br/>${escapeMapPopup(line2)}`, {
        autoPan: false,
        closeOnClick: true,
        maxWidth: 200,
      });

    if (autoOpenPopup && expanded) {
      marker.openPopup();
    }

    mapInst.current = map;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      map.remove();
      mapInst.current = null;
    };
  }, [latitude, longitude, expanded, nom, ville, pays, autoOpenPopup]);

  const h = expanded ? expandedHeight : collapsedHeight;
  const latn = Number(latitude);
  const lngn = Number(longitude);

  return (
    <div style={{ marginBottom: 0, isolation: "isolate", position: "relative", zIndex: 0 }}>
      <style>{`
        .tier-map-preview {
          isolation: isolate;
          z-index: 0;
        }
        .tier-map-preview .leaflet-container {
          z-index: 0 !important;
          background: var(--bg-input, #0f172a);
        }
        .tier-map-preview .leaflet-pane,
        .tier-map-preview .leaflet-map-pane,
        .tier-map-preview .leaflet-tile-pane,
        .tier-map-preview .leaflet-overlay-pane,
        .tier-map-preview .leaflet-shadow-pane,
        .tier-map-preview .leaflet-marker-pane,
        .tier-map-preview .leaflet-tooltip-pane,
        .tier-map-preview .leaflet-popup-pane {
          z-index: auto !important;
        }
        .tier-map-preview .leaflet-top,
        .tier-map-preview .leaflet-bottom {
          z-index: 5 !important;
        }
        .tier-map-preview .leaflet-popup-content-wrapper {
          border-radius: 8px !important;
          font-size: 12px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,.15) !important;
        }
      `}</style>

      <div
        className="tier-map-preview map-container"
        style={{
          height: h,
          transition: "height .25s ease",
          overflow: "hidden",
          borderRadius: 10,
          border: "1px solid var(--border-default)",
          position: "relative",
          cursor: "pointer",
          zIndex: 0,
        }}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded((x) => !x);
        }}
        role="button"
        tabIndex={0}
      >
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((x) => !x);
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              cursor: "pointer",
              background: "white",
              border: "0.5px solid rgba(0,0,0,.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,.1)",
              fontSize: 12,
              color: "#374151",
            }}
            title={expanded ? "Réduire" : "Agrandir"}
          >
            {expanded ? "↙" : "↗"}
          </button>
          <a
            href={`https://www.google.com/maps?q=${latn},${lngn}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Ouvrir dans Google Maps"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "white",
              border: "0.5px solid rgba(0,0,0,.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,.1)",
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            🗺
          </a>
        </div>

        {!expanded && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "4px 8px",
              background: "linear-gradient(transparent, rgba(0,0,0,.45))",
              borderRadius: "0 0 10px 10px",
              display: "flex",
              alignItems: "center",
              gap: 5,
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span style={{ fontSize: 10, color: "white", fontWeight: 500 }}>
              {ville || "Localisé"}
              {pays ? `, ${pays}` : ""}
            </span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,.7)", marginLeft: "auto" }}>Cliquer pour agrandir</span>
          </div>
        )}
      </div>

      {expanded && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 4,
            padding: "4px 6px",
            background: "var(--color-background-secondary)",
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 10, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
            {latn.toFixed(6)}, {lngn.toFixed(6)}
          </span>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${latn},${lngn}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 10, color: "#378ADD", textDecoration: "none", fontWeight: 500 }}
          >
            Itinéraire →
          </a>
        </div>
      )}
    </div>
  );
}

export function hasTierLocation(latitude, longitude) {
  return Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
}
