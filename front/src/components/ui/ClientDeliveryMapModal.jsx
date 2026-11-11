import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MapPin, X } from "lucide-react";
import {
  LIGHT_TILE_ATTRIBUTION,
  LIGHT_TILE_URL,
  loadLeaflet,
} from "../../pages/depots/components/depotLeaflet";

/** Extrait lat/lng depuis les notes (`GPS 36.12345, 10.12345`). */
export function parseGpsFromNotes(notes) {
  const m = String(notes || "").match(
    /GPS\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i
  );
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function stripGpsFromNotes(notes) {
  return (
    String(notes || "")
      .replace(/\n?GPS\s+-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?/gi, "")
      .replace(/\n{2,}/g, "\n")
      .trim() || ""
  );
}

function makePinIcon(L) {
  return L.divIcon({
    className: "client-delivery-map-modal__icon",
    html: `<span class="client-checkout-pin" aria-hidden="true"><span class="client-checkout-pin__pulse"></span><span class="client-checkout-pin__head"></span></span>`,
    iconSize: [36, 48],
    iconAnchor: [18, 46],
  });
}

/**
 * Fenêtre centrée — localisation de livraison (lecture seule).
 */
export default function ClientDeliveryMapModal({
  open,
  onClose,
  latitude,
  longitude,
  address = "",
  title = "Localisation de livraison",
  closeLabel = "Fermer",
  emptyLabel = "Aucune position GPS enregistrée.",
}) {
  const mapEl = useRef(null);
  const mapInst = useRef(null);
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !hasPoint) return undefined;
    let cancelled = false;

    (async () => {
      const L = await loadLeaflet();
      if (cancelled || !mapEl.current) return;

      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
      }

      const map = L.map(mapEl.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
      });
      L.tileLayer(LIGHT_TILE_URL, {
        attribution: LIGHT_TILE_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.marker([lat, lng], { icon: makePinIcon(L), draggable: false }).addTo(map);
      mapInst.current = map;

      const kick = () => map.invalidateSize();
      requestAnimationFrame(kick);
      setTimeout(kick, 120);
      setTimeout(kick, 360);
    })();

    return () => {
      cancelled = true;
      mapInst.current?.remove();
      mapInst.current = null;
    };
  }, [open, hasPoint, lat, lng]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="client-delivery-map-modal" role="presentation">
      <button
        type="button"
        className="client-delivery-map-modal__backdrop"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div
        className="client-delivery-map-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="client-delivery-map-modal__head">
          <div>
            <p className="client-delivery-map-modal__kicker">
              <MapPin size={14} aria-hidden />
              {title}
            </p>
            {address ? <p className="client-delivery-map-modal__address">{address}</p> : null}
          </div>
          <button
            type="button"
            className="client-delivery-map-modal__close"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X size={18} />
          </button>
        </header>

        {hasPoint ? (
          <>
            <div className="client-delivery-map-modal__stage">
              <div ref={mapEl} className="client-delivery-map-modal__canvas" />
            </div>
            <p className="client-delivery-map-modal__coords">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          </>
        ) : (
          <div className="client-delivery-map-modal__empty">
            <MapPin size={28} aria-hidden />
            <p>{emptyLabel}</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
