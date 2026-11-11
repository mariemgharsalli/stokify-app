import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

function normalizeValue(v) {
  if (!v || v.latitude == null || v.longitude == null) return null;
  const lat = Number(v.latitude);
  const lng = Number(v.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    adresse: v.adresse ?? "",
    ville: v.ville ?? "",
    pays: v.pays ?? "",
    latitude: lat,
    longitude: lng,
  };
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "fr,ar,en", "User-Agent": "Stokify-App/1.0" },
    });
    const data = await res.json();
    if (!data?.address) return { adresse: "", ville: "", pays: "" };
    const a = data.address;
    const ville =
      a.city || a.town || a.village || a.municipality || a.county || a.state || "";
    const pays = a.country || "";
    const adresse = (data.display_name || "").split(",").slice(0, 3).join(", ").trim();
    return { adresse, ville, pays };
  } catch {
    return { adresse: "", ville: "", pays: "" };
  }
}

/**
 * @param {"dark"|"light"} [variant="dark"] — dark pour CRM staff, light pour modal profil client
 * @param {number} [height=220]
 */
export default function LocationPicker({ value, onChange, variant = "dark", height = 220 }) {
  const mapEl = useRef(null);
  const mapInst = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const light = variant === "light";

  const [mapReady, setMapReady] = useState(false);
  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const normalized = normalizeValue(value);

  function emitLocation(lat, lng, extra = {}) {
    onChangeRef.current({
      adresse: extra.adresse ?? "",
      ville: extra.ville ?? "",
      pays: extra.pays ?? "",
      latitude: lat,
      longitude: lng,
    });
  }

  function ensureMarkerDraggable() {
    if (!mapInst.current) return;
    if (markerRef.current) return;
    const center = normalized
      ? [normalized.latitude, normalized.longitude]
      : [33.8869, 9.5375];
    const m = L.marker(center, { draggable: true }).addTo(mapInst.current);
    m.on("dragend", async (ev) => {
      const p = ev.target.getLatLng();
      const rev = await reverseGeocode(p.lat, p.lng);
      emitLocation(p.lat, p.lng, rev);
    });
    markerRef.current = m;
  }

  useEffect(() => {
    const el = mapEl.current;
    if (!el) return undefined;
    el.style.height = `${height}px`;
    const map = L.map(el, {
      center: normalized ? [normalized.latitude, normalized.longitude] : [33.8869, 9.5375],
      zoom: normalized ? 14 : 6,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    mapInst.current = map;

    map.on("click", async (e) => {
      const { lat, lng } = e.latlng;
      if (!markerRef.current) {
        const m = L.marker([lat, lng], { draggable: true }).addTo(map);
        m.on("dragend", async (ev) => {
          const p = ev.target.getLatLng();
          const rev = await reverseGeocode(p.lat, p.lng);
          emitLocation(p.lat, p.lng, rev);
        });
        markerRef.current = m;
      } else {
        markerRef.current.setLatLng([lat, lng]);
      }
      const rev = await reverseGeocode(lat, lng);
      emitLocation(lat, lng, rev);
    });

    if (normalized) {
      const m = L.marker([normalized.latitude, normalized.longitude], { draggable: true }).addTo(map);
      m.on("dragend", async (ev) => {
        const p = ev.target.getLatLng();
        const rev = await reverseGeocode(p.lat, p.lng);
        emitLocation(p.lat, p.lng, rev);
      });
      markerRef.current = m;
    }

    requestAnimationFrame(() => {
      map.invalidateSize();
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapInst.current = null;
      markerRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount: init from initial value only
  }, []);

  useEffect(() => {
    if (!mapReady || !mapInst.current || !normalized) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([normalized.latitude, normalized.longitude]);
      mapInst.current.setView([normalized.latitude, normalized.longitude], 14);
    }
  }, [mapReady, normalized?.latitude, normalized?.longitude]);

  async function runSearch(e) {
    e?.preventDefault?.();
    const q = search.trim();
    if (q.length < 2) {
      setSearchError("Saisissez au moins 2 caractères.");
      return;
    }
    setSearchLoading(true);
    setSearchError("");
    try {
      const urls = [
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=tn&limit=1&addressdetails=1`,
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${q} Tunisia`)}&limit=1&addressdetails=1`,
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1`,
      ];
      let result = null;
      for (const url of urls) {
        const res = await fetch(url, {
          headers: { "Accept-Language": "fr,ar,en", "User-Agent": "Stokify-App/1.0" },
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          result = data[0];
          break;
        }
      }
      if (!result) {
        setSearchError("Aucun résultat.");
        return;
      }
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      const a = result.address || {};
      const ville = a.city || a.town || a.village || a.county || "";
      const pays = a.country || "";
      const adresse = (result.display_name || "").split(",").slice(0, 3).join(", ").trim();
      if (!mapInst.current) return;
      if (!markerRef.current) {
        const m = L.marker([lat, lng], { draggable: true }).addTo(mapInst.current);
        m.on("dragend", async (ev) => {
          const p = ev.target.getLatLng();
          const rev = await reverseGeocode(p.lat, p.lng);
          emitLocation(p.lat, p.lng, rev);
        });
        markerRef.current = m;
      } else {
        markerRef.current.setLatLng([lat, lng]);
      }
      mapInst.current.setView([lat, lng], 14);
      emitLocation(lat, lng, { adresse, ville, pays });
      requestAnimationFrame(() => mapInst.current?.invalidateSize());
    } catch {
      setSearchError("Erreur réseau.");
    } finally {
      setSearchLoading(false);
    }
  }

  function clearLocation() {
    if (markerRef.current && mapInst.current) {
      mapInst.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    onChangeRef.current(null);
  }

  const inputCls = light
    ? "min-w-[180px] flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
    : "min-w-[200px] flex-1 rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";
  const btnSearchCls = light
    ? "rounded-lg bg-[var(--brand-teal,#0c5460)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
    : "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50";
  const btnClearCls = light
    ? "rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
    : "rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 hover:bg-white/5";
  const hintCls = light ? "text-[11px] text-[var(--text-muted)]" : "text-[11px] text-slate-500";
  const mapBorder = light ? "border-[var(--border-default)]" : "border-white/10";
  const metaCls = light
    ? "rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)]"
    : "rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 font-mono text-[11px] text-slate-400";

  return (
    <div className="space-y-2">
      <form onSubmit={runSearch} className="flex flex-wrap gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une ville, une rue…"
          className={inputCls}
        />
        <button type="submit" disabled={searchLoading} className={btnSearchCls}>
          {searchLoading ? "…" : "Rechercher"}
        </button>
        {normalized && (
          <button type="button" onClick={clearLocation} className={btnClearCls}>
            Effacer la carte
          </button>
        )}
      </form>
      {searchError && (
        <p className={light ? "text-xs text-amber-600" : "text-xs text-amber-400"}>{searchError}</p>
      )}
      <p className={hintCls}>Cliquez sur la carte pour placer ou déplacer le marqueur.</p>
      <div
        ref={mapEl}
        className={`w-full overflow-hidden rounded-lg border ${mapBorder}`}
        style={{ minHeight: height }}
      />
      {normalized && (
        <div className={metaCls}>
          {normalized.latitude.toFixed(6)}, {normalized.longitude.toFixed(6)}
          {(normalized.ville || normalized.pays) && (
            <span className={light ? "ml-2 text-[var(--text-muted)]" : "ml-2 text-slate-500"}>
              — {[normalized.ville, normalized.pays].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
