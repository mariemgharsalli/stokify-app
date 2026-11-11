import { useEffect, useRef, useState } from "react";
import { Loader2, Navigation } from "lucide-react";
import { TUNISIA_CENTER, loadLeaflet } from "./depotLeaflet";

const OSM_ATTRIBUTION = "© OpenStreetMap";
const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function truncate(s, max = 50) {
  const t = String(s || "").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export default function DepotLocationTab({
  active,
  latitude,
  longitude,
  onCoordsChange,
  onSearchError,
}) {
  const mapEl = useRef(null);
  const mapInst = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);

  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [coordsDisplay, setCoordsDisplay] = useState("");

  const latNum = latitude !== "" && latitude != null ? Number(latitude) : null;
  const lngNum = longitude !== "" && longitude != null ? Number(longitude) : null;
  const hasPoint = Number.isFinite(latNum) && Number.isFinite(lngNum);

  function updateCoords(lat, lng, label) {
    const latF = Number(lat).toFixed(6);
    const lngF = Number(lng).toFixed(6);
    onCoordsChange(latF, lngF);
    setCoordsDisplay(label ? `${latF}, ${lngF} — ${truncate(label, 50)}` : `${latF}, ${lngF} — Position personnalisée`);
  }

  function placeMarker(L, map, lat, lng, fly = true) {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const m = L.marker([lat, lng], { draggable: true }).addTo(map);
      m.on("dragend", () => {
        const pos = m.getLatLng();
        updateCoords(pos.lat, pos.lng, null);
      });
      markerRef.current = m;
    }
    if (fly) map.flyTo([lat, lng], 15, { animate: true, duration: 1.2 });
  }

  function destroyMap() {
    if (mapInst.current) {
      mapInst.current.remove();
      mapInst.current = null;
    }
    markerRef.current = null;
    leafletRef.current = null;
  }

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;

    (async () => {
      const L = await loadLeaflet();
      if (cancelled || !mapEl.current) return;
      leafletRef.current = L;

      if (mapInst.current) {
        mapInst.current.invalidateSize();
        if (hasPoint) placeMarker(L, mapInst.current, latNum, lngNum, false);
        return;
      }

      const center = hasPoint ? [latNum, lngNum] : TUNISIA_CENTER;
      const zoom = hasPoint ? 14 : 6;
      const map = L.map(mapEl.current, {
        center,
        zoom,
        zoomControl: true,
        scrollWheelZoom: true,
      });
      L.tileLayer(OSM_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(map);

      map.on("click", (e) => {
        placeMarker(L, map, e.latlng.lat, e.latlng.lng);
        updateCoords(e.latlng.lat, e.latlng.lng, null);
      });

      if (hasPoint) {
        placeMarker(L, map, latNum, lngNum, false);
        setCoordsDisplay(`${latNum}, ${lngNum}`);
      }

      mapInst.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!active || !mapInst.current || !leafletRef.current || !hasPoint) return;
    const L = leafletRef.current;
    const map = mapInst.current;
    placeMarker(L, map, latNum, lngNum, false);
    if (!coordsDisplay) setCoordsDisplay(`${latNum}, ${lngNum}`);
  }, [latNum, lngNum, active, hasPoint]);

  useEffect(
    () => () => {
      destroyMap();
    },
    []
  );

  async function runSearch(e) {
    e?.preventDefault?.();
    const q = search.trim();
    if (q.length < 2) {
      onSearchError?.("Saisissez au moins 2 caractères pour rechercher.");
      return;
    }
    setSearchLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${q}, Tunisie`)}&format=json&limit=1&countrycodes=tn`;
      const res = await fetch(url, { headers: { "User-Agent": "Stokify/1.0" } });
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) {
        onSearchError?.(
          "Adresse introuvable, essayez d'être plus précis (ex: kasserine, rue 14 janvier, Tunisie)"
        );
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const L = leafletRef.current;
      const map = mapInst.current;
      if (!L || !map) return;
      placeMarker(L, map, lat, lng);
      updateCoords(lat, lng, data[0].display_name);
    } catch {
      onSearchError?.("Erreur réseau lors de la recherche.");
    } finally {
      setSearchLoading(false);
    }
  }

  function useMyPosition() {
    if (!navigator.geolocation) {
      onSearchError?.("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const L = leafletRef.current;
        const map = mapInst.current;
        if (L && map) {
          placeMarker(L, map, lat, lng, true);
          map.flyTo([lat, lng], 16, { animate: true, duration: 1 });
        }
        updateCoords(lat, lng, "Ma position GPS");
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          onSearchError?.("Accès à la position refusé. Autorisez la localisation dans votre navigateur.");
        } else if (err.code === err.TIMEOUT) {
          onSearchError?.("Délai dépassé. Réessayez ou placez le marqueur manuellement.");
        } else {
          onSearchError?.("Impossible d'accéder à votre position GPS.");
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  function clearMap() {
    if (markerRef.current && mapInst.current) {
      mapInst.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    onCoordsChange("", "");
    setCoordsDisplay("");
    setSearch("");
    if (mapInst.current) {
      mapInst.current.flyTo(TUNISIA_CENTER, 6, { animate: true, duration: 0.8 });
    }
  }

  const inputStyle = {
    flex: 1,
    minWidth: 0,
    boxSizing: "border-box",
    height: 38,
    padding: "0 12px",
    borderRadius: 8,
    border: "0.5px solid var(--color-border-secondary, #e2e8f0)",
    background: "var(--color-background-primary, #ffffff)",
    color: "var(--color-text-primary, #0f172a)",
    fontSize: 14,
  };

  return (
    <div style={{ animation: "depotTabFade .15s ease" }}>
      <label className="f-label" style={{ display: "block", marginBottom: 8 }}>
        Adresse du dépôt
        <span style={{ marginLeft: 6, fontSize: 11, color: "var(--color-text-tertiary, #94a3b8)", fontWeight: 400 }}>
          — pour les livraisons et la carte
        </span>
      </label>

      <form onSubmit={runSearch} style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une adresse..."
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={searchLoading}
          style={{
            height: 38,
            padding: "0 16px",
            borderRadius: 8,
            border: "none",
            background: searchLoading ? "rgba(55,138,221,.5)" : "#378ADD",
            color: "white",
            fontSize: 13,
            fontWeight: 500,
            cursor: searchLoading ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {searchLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Recherche…
            </>
          ) : (
            "Rechercher"
          )}
        </button>
        <button
          type="button"
          onClick={clearMap}
          style={{
            height: 38,
            padding: "0 14px",
            borderRadius: 8,
            border: "1px solid var(--color-border-secondary, #e2e8f0)",
            background: "var(--color-background-secondary, #f8fafc)",
            color: "var(--color-text-secondary, #64748b)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Effacer la carte
        </button>
      </form>

      <p style={{ fontSize: 11, color: "var(--color-text-tertiary, #94a3b8)", marginBottom: 8 }}>
        Cliquez sur la carte pour placer ou déplacer le marqueur.
      </p>

      <div
        ref={mapEl}
        style={{
          height: 220,
          width: "100%",
          borderRadius: 8,
          overflow: "hidden",
          border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
          background: "#f1f5f9",
        }}
      />

      <input
        readOnly
        value={coordsDisplay}
        placeholder="Aucune position sélectionnée"
        style={{
          marginTop: 10,
          width: "100%",
          boxSizing: "border-box",
          background: "var(--color-background-secondary, #f8fafc)",
          border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
          borderRadius: 8,
          padding: "10px 14px",
          fontFamily: "ui-monospace, monospace",
          fontSize: 13,
          color: coordsDisplay ? "#378ADD" : "var(--color-text-tertiary, #94a3b8)",
          cursor: "default",
        }}
      />

      <button
        type="button"
        onClick={useMyPosition}
        disabled={isLocating || !active}
        style={{
          marginTop: 10,
          width: "100%",
          height: 40,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 8,
          border: "1px solid rgba(55, 138, 221, 0.35)",
          background: "rgba(55, 138, 221, 0.06)",
          color: "#378ADD",
          fontSize: 13,
          fontWeight: 500,
          cursor: isLocating || !active ? "not-allowed" : "pointer",
          opacity: isLocating || !active ? 0.55 : 1,
        }}
      >
        <Navigation size={16} className={isLocating ? "animate-pulse" : ""} />
        {isLocating ? "Localisation en cours…" : "📍 Ma position GPS"}
      </button>

      <div
        style={{
          marginTop: 14,
          padding: "12px 16px",
          background: "rgba(55, 138, 221, 0.06)",
          border: "1px solid rgba(55, 138, 221, 0.2)",
          borderRadius: 8,
          fontSize: 13,
          color: "var(--color-text-secondary, #475569)",
          display: "flex",
          gap: 10,
        }}
      >
        <span style={{ color: "#378ADD", flexShrink: 0 }}>ℹ</span>
        <span>
          La localisation permet de calculer les distances entre dépôts, optimiser les tournées de livraison et
          afficher les dépôts sur la carte interactive.
        </span>
      </div>
    </div>
  );
}
