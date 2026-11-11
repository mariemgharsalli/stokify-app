import { useEffect, useRef, useState } from "react";
import { Info, Loader2, MapPin, Search, X } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { inputClass, SEARCH_BTN_GRADIENT } from "./superadminTheme";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export default function SocieteMapSection({
  latitude,
  longitude,
  setLatitude,
  setLongitude,
  form,
  setForm,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapInitialized = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [mapVisible, setMapVisible] = useState(false);

  function handleResetMap() {
    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    setLatitude("");
    setLongitude("");
    setSearchQuery("");
    setSearchError("");
    setSuggestions([]);
    if (mapRef.current) {
      mapRef.current.flyTo([33.8869, 9.5375], 6, { duration: 1 });
    }
  }

  function ensureDraggableMarkerAt(latNum, lngNum) {
    if (!mapRef.current || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) return;
    setLatitude(latNum.toFixed(6));
    setLongitude(lngNum.toFixed(6));
    if (markerRef.current) {
      markerRef.current.setLatLng([latNum, lngNum]);
    } else {
      markerRef.current = L.marker([latNum, lngNum], { draggable: true }).addTo(mapRef.current);
      markerRef.current.on("dragend", (ev) => {
        const pos = ev.target.getLatLng();
        setLatitude(pos.lat.toFixed(6));
        setLongitude(pos.lng.toFixed(6));
      });
    }
  }

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&countrycodes=tn&limit=5&addressdetails=1`,
          { headers: { "Accept-Language": "fr,ar,en" } },
        );
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function handleMapSearch() {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError("");
    setSuggestions([]);
    try {
      const query = searchQuery.trim();
      const attempts = [
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=tn&limit=3&addressdetails=1`,
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${query} Tunisia`)}&limit=3&addressdetails=1`,
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=3&addressdetails=1`,
      ];

      let result = null;
      for (const url of attempts) {
        try {
          const res = await fetch(url, {
            headers: { "Accept-Language": "fr,ar,en", "User-Agent": "Stokify-App/1.0" },
          });
          const data = await res.json();
          if (data && data.length > 0) {
            result = data[0];
            break;
          }
        } catch {
          /* try next */
        }
      }

      if (!result) {
        setSearchError(
          "Aucun résultat. Essayez en anglais ou vérifiez l'orthographe (ex: Kasserine, Sfax, Tunis).",
        );
        return;
      }

      const latNum = parseFloat(result.lat);
      const lngNum = parseFloat(result.lon);
      if (!mapRef.current) return;

      mapRef.current.flyTo([latNum, lngNum], 12, { duration: 1.2 });
      setLatitude(latNum.toFixed(6));
      setLongitude(lngNum.toFixed(6));

      if (markerRef.current) {
        markerRef.current.setLatLng([latNum, lngNum]);
      } else {
        markerRef.current = L.marker([latNum, lngNum], { draggable: true }).addTo(mapRef.current);
        markerRef.current.on("dragend", (ev) => {
          const pos = ev.target.getLatLng();
          setLatitude(pos.lat.toFixed(6));
          setLongitude(pos.lng.toFixed(6));
        });
      }

      const displayName = result.display_name || "";
      const shortAddress = displayName.split(",").slice(0, 2).join(",").trim();
      if (!String(form.adresse ?? "").trim() && shortAddress) {
        setForm((prev) => ({ ...prev, adresse: shortAddress }));
      }
      const ville =
        result.address?.city ||
        result.address?.town ||
        result.address?.village ||
        result.address?.county ||
        "";
      if (!String(form.ville ?? "").trim() && ville) {
        setForm((prev) => ({ ...prev, ville }));
      }
    } catch {
      setSearchError("Erreur lors de la recherche. Vérifiez votre connexion.");
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    if (mapInitialized.current) return;
    if (!mapContainerRef.current) return;
    mapInitialized.current = true;

    mapContainerRef.current.style.height = "220px";
    mapContainerRef.current.style.width = "100%";

    const map = L.map(mapContainerRef.current, {
      center: [33.8869, 9.5375],
      zoom: 6,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        map.invalidateSize();
        setMapVisible(true);
      });
    });

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      setLatitude(lat.toFixed(6));
      setLongitude(lng.toFixed(6));
      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng);
      } else {
        markerRef.current = L.marker(e.latlng, { draggable: true }).addTo(map);
        markerRef.current.on("dragend", (ev) => {
          const pos = ev.target.getLatLng();
          setLatitude(pos.lat.toFixed(6));
          setLongitude(pos.lng.toFixed(6));
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      mapInitialized.current = false;
    };
  }, [setLatitude, setLongitude]);

  function applySuggestion(s) {
    setSearchQuery(s.display_name.split(",").slice(0, 2).join(","));
    setSuggestions([]);
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    mapRef.current?.flyTo([lat, lng], 12, { duration: 1 });
    ensureDraggableMarkerAt(lat, lng);
    const displayName = s.display_name || "";
    const shortAddress = displayName.split(",").slice(0, 2).join(",").trim();
    if (!String(form.adresse ?? "").trim() && shortAddress) {
      setForm((prev) => ({ ...prev, adresse: shortAddress }));
    }
    const villeSuggestion =
      s.address?.city || s.address?.town || s.address?.village || s.address?.county || "";
    if (!String(form.ville ?? "").trim() && villeSuggestion) {
      setForm((prev) => ({ ...prev, ville: villeSuggestion }));
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMapSearch()}
            placeholder="Rechercher une ville ou adresse..."
            autoComplete="off"
            className={`${inputClass} pl-10`}
          />
        </div>
        <button
          type="button"
          onClick={handleMapSearch}
          disabled={searchLoading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-200 hover:scale-105 disabled:cursor-default disabled:opacity-60 disabled:hover:scale-100"
          style={{
            background: SEARCH_BTN_GRADIENT,
            boxShadow: "0 4px 16px rgba(79, 70, 229, 0.3)",
          }}
        >
          {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Rechercher
        </button>

        {suggestions.length > 0 && (
          <div className="absolute left-0 right-[130px] top-full z-[9999] mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#1e293b]">
            {suggestions.map((s, i) => (
              <div
                key={`${s.place_id ?? s.osm_id ?? "nom"}-${i}`}
                role="button"
                tabIndex={0}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySuggestion(s)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && applySuggestion(s)}
                className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm text-slate-700 last:border-0 hover:bg-violet-50 dark:border-white/5 dark:text-slate-200 dark:hover:bg-white/5"
              >
                <MapPin className="h-4 w-4 shrink-0 text-violet-500" />
                <span className="truncate">{s.display_name.split(",").slice(0, 3).join(", ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {searchError && (
        <p className="text-xs text-red-500 dark:text-red-400">{searchError}</p>
      )}

      <div
        className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-500 dark:border-white/10 dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] ${
          mapVisible ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
        }`}
      >
        <div ref={mapContainerRef} className="h-[220px] w-full min-h-[220px]" />
        {latitude && longitude && (
          <div className="pointer-events-none absolute right-3 top-3 z-[1000] rounded-lg border border-slate-200/80 bg-white/90 px-3 py-1.5 font-mono text-xs text-slate-600 backdrop-blur-sm dark:border-white/12 dark:bg-[#0f172a]/90 dark:text-slate-400">
            <MapPin className="mr-1 inline h-3 w-3 text-emerald-500" />
            {parseFloat(latitude).toFixed(4)}, {parseFloat(longitude).toFixed(4)}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-500">
          <Info className="superadmin-info-pulse h-3.5 w-3.5 text-violet-500" />
          Cliquez sur la carte pour placer un repère déplaçable.
        </p>
        <button
          type="button"
          onClick={handleResetMap}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-500 transition-all duration-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-white/12 dark:text-slate-400 dark:hover:border-red-500/40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <X className="h-3.5 w-3.5" />
          Réinitialiser
        </button>
      </div>

      <input type="hidden" name="latitude" value={latitude} readOnly />
      <input type="hidden" name="longitude" value={longitude} readOnly />
    </div>
  );
}
