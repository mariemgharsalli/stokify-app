import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, Search, X } from "lucide-react";
import {
  LIGHT_TILE_ATTRIBUTION,
  LIGHT_TILE_URL,
  TUNISIA_CENTER,
  loadLeaflet,
} from "../../pages/depots/components/depotLeaflet";

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "fr,ar,en", "User-Agent": "Stokify-App/1.0" },
    });
    const data = await res.json();
    if (!data?.address) return { adresse: "", ville: "", pays: "" };
    const a = data.address;
    const ville = a.city || a.town || a.village || a.municipality || a.county || a.state || "";
    const pays = a.country || "";
    const adresse = (data.display_name || "").split(",").slice(0, 4).join(", ").trim();
    return { adresse, ville, pays };
  } catch {
    return { adresse: "", ville: "", pays: "" };
  }
}

function makePinIcon(L) {
  return L.divIcon({
    className: "client-checkout-map__icon",
    html: `<span class="client-checkout-pin" aria-hidden="true"><span class="client-checkout-pin__pulse"></span><span class="client-checkout-pin__head"></span></span>`,
    iconSize: [36, 48],
    iconAnchor: [18, 46],
  });
}

/**
 * Carte de livraison (OpenStreetMap) pour le checkout panier.
 */
export default function ClientCheckoutMap({
  value,
  onChange,
  active = true,
  labels = {},
}) {
  const mapEl = useRef(null);
  const mapInst = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState("");

  const lat = Number(value?.latitude);
  const lng = Number(value?.longitude);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);

  function emit(nextLat, nextLng, extra = {}) {
    onChangeRef.current?.({
      adresse: extra.adresse ?? value?.adresse ?? "",
      ville: extra.ville ?? value?.ville ?? "",
      pays: extra.pays ?? value?.pays ?? "",
      latitude: nextLat,
      longitude: nextLng,
    });
  }

  function ensureMarker(L, map, nextLat, nextLng) {
    if (!markerRef.current) {
      const m = L.marker([nextLat, nextLng], { draggable: true, icon: makePinIcon(L) }).addTo(map);
      m.on("dragend", async (ev) => {
        const p = ev.target.getLatLng();
        const rev = await reverseGeocode(p.lat, p.lng);
        emit(p.lat, p.lng, rev);
      });
      markerRef.current = m;
    } else {
      markerRef.current.setLatLng([nextLat, nextLng]);
    }
  }

  useEffect(() => {
    if (!active) return undefined;
    const el = mapEl.current;
    if (!el) return undefined;
    let cancelled = false;

    (async () => {
      const L = await loadLeaflet();
      if (cancelled || !mapEl.current) return;
      leafletRef.current = L;
      const center = hasPoint ? [lat, lng] : TUNISIA_CENTER;
      const zoom = hasPoint ? 14 : 7;
      const map = L.map(el, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
      });
      L.tileLayer(LIGHT_TILE_URL, {
        attribution: LIGHT_TILE_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      map.on("click", async (e) => {
        ensureMarker(L, map, e.latlng.lat, e.latlng.lng);
        const rev = await reverseGeocode(e.latlng.lat, e.latlng.lng);
        emit(e.latlng.lat, e.latlng.lng, rev);
      });

      if (hasPoint) ensureMarker(L, map, lat, lng);
      mapInst.current = map;

      const kick = () => map.invalidateSize();
      requestAnimationFrame(kick);
      setTimeout(kick, 280);
      setTimeout(kick, 700);
    })();

    return () => {
      cancelled = true;
      mapInst.current?.remove();
      mapInst.current = null;
      markerRef.current = null;
      leafletRef.current = null;
    };
    // mount once when the delivery step becomes active
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active || !mapInst.current || !leafletRef.current || !hasPoint) return;
    ensureMarker(leafletRef.current, mapInst.current, lat, lng);
    mapInst.current.setView([lat, lng], Math.max(mapInst.current.getZoom(), 14));
  }, [active, hasPoint, lat, lng]);

  useEffect(() => {
    if (!active || !mapInst.current) return undefined;
    const map = mapInst.current;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.invalidateSize()) : null;
    if (mapEl.current && ro) ro.observe(mapEl.current);
    const t = setTimeout(() => map.invalidateSize(), 80);
    return () => {
      ro?.disconnect();
      clearTimeout(t);
    };
  }, [active]);

  async function runSearch(e) {
    e?.preventDefault?.();
    const q = search.trim();
    if (q.length < 2) {
      setHint(labels.searchMin || "Saisissez au moins 2 caractères.");
      return;
    }
    setSearchLoading(true);
    setHint("");
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
        setHint(labels.noResult || "Aucun résultat.");
        return;
      }
      const nextLat = parseFloat(result.lat);
      const nextLng = parseFloat(result.lon);
      const a = result.address || {};
      const ville = a.city || a.town || a.village || a.county || "";
      const pays = a.country || "";
      const adresse = (result.display_name || "").split(",").slice(0, 4).join(", ").trim();
      const L = leafletRef.current;
      if (L && mapInst.current) {
        ensureMarker(L, mapInst.current, nextLat, nextLng);
        mapInst.current.flyTo([nextLat, nextLng], 15, { duration: 0.7 });
      }
      emit(nextLat, nextLng, { adresse, ville, pays });
    } catch {
      setHint(labels.networkError || "Erreur réseau.");
    } finally {
      setSearchLoading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setHint(labels.geoUnsupported || "Géolocalisation indisponible.");
      return;
    }
    setLocating(true);
    setHint("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        const L = leafletRef.current;
        if (L && mapInst.current) {
          ensureMarker(L, mapInst.current, nextLat, nextLng);
          mapInst.current.flyTo([nextLat, nextLng], 16, { duration: 0.85 });
        }
        const rev = await reverseGeocode(nextLat, nextLng);
        emit(nextLat, nextLng, rev);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setHint(labels.geoDenied || "Position refusée. Placez le pin sur la carte.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  function clearPin() {
    if (markerRef.current && mapInst.current) {
      mapInst.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    onChangeRef.current?.(null);
    setHint("");
  }

  return (
    <div className="client-checkout-map">
      <form className="client-checkout-map__search" onSubmit={runSearch}>
        <Search className="client-checkout-map__search-icon" strokeWidth={1.8} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={labels.searchPh || "Rechercher une ville, une rue…"}
          aria-label={labels.searchPh || "Rechercher une adresse"}
        />
        <button type="submit" disabled={searchLoading} className="client-checkout-map__search-btn">
          {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : labels.searchBtn || "OK"}
        </button>
      </form>

      <div className="client-checkout-map__stage">
        <div ref={mapEl} className="client-checkout-map__canvas" />
        <button
          type="button"
          className="client-checkout-map__locate"
          onClick={useMyLocation}
          disabled={locating}
          title={labels.locate || "Ma position"}
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
          <span>{labels.locate || "Ma position"}</span>
        </button>
        {hasPoint && (
          <button type="button" className="client-checkout-map__clear" onClick={clearPin}>
            <X className="w-3.5 h-3.5" />
            {labels.clear || "Effacer"}
          </button>
        )}
      </div>

      <p className="client-checkout-map__hint">
        {hint || labels.hint || "Cliquez sur la carte ou déplacez le pin."}
      </p>
      {hasPoint && (
        <p className="client-checkout-map__coords">
          {lat.toFixed(5)}, {lng.toFixed(5)}
          {(value?.ville || value?.pays) && (
            <span>
              {" · "}
              {[value.ville, value.pays].filter(Boolean).join(", ")}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
