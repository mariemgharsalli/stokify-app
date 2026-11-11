import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  Hash,
  Mail,
  MapPin,
  Package,
  Pencil,
  Power,
  PowerOff,
  Sparkles,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { buildLogoUrl } from "./SocieteTableRow";
import SocieteStatusBadge from "./SocieteStatusBadge";
import { getCardAccent } from "./societesTheme";
import ChampSeuilValidation from "../../admin/ChampSeuilValidation";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const EASE = [0.16, 1, 0.3, 1];

/**
 * Modal centrée — détail société + carte intégrée.
 */
export default function SocieteDetailModal({ societe, onClose, onAction }) {
  const open = Boolean(societe);
  const reduce = useReducedMotion();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const s = societe;
  const hasLocation =
    s?.latitude != null &&
    s?.longitude != null &&
    Number.isFinite(Number(s.latitude)) &&
    Number.isFinite(Number(s.longitude));

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !hasLocation) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return undefined;
    }

    const el = mapContainerRef.current;
    if (!el) return undefined;

    const lat = Number(s.latitude);
    const lng = Number(s.longitude);
    const map = L.map(el, { center: [lat, lng], zoom: 13, zoomControl: true });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    L.marker([lat, lng], { draggable: false }).addTo(map);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => map.invalidateSize());
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [open, hasLocation, s?.id, s?.latitude, s?.longitude]);

  if (!open) return null;

  const logoUrl = buildLogoUrl(s.logo);
  const accent = getCardAccent(s);
  const counts = s._count || {};
  const isActive = s.actif !== false;
  const locationLabel =
    [s.adresse, s.ville].filter(Boolean).join(" — ") ||
    (hasLocation
      ? `${Number(s.latitude).toFixed(4)}, ${Number(s.longitude).toFixed(4)}`
      : "Non localisée");

  const stats = [
    { icon: Users, label: "Utilisateurs", value: counts.utilisateurs ?? 0 },
    { icon: Package, label: "Articles", value: counts.articles ?? 0 },
    { icon: Warehouse, label: "Dépôts", value: counts.depots ?? 0 },
  ];

  function run(action) {
    onAction?.(action, s);
    onClose?.();
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="societe-view-root"
        className="societe-view-modal-root"
        role="presentation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="societe-view-title"
          className="societe-view-modal"
          style={{
            "--societe-accent": accent.accent,
            "--societe-soft": accent.soft,
            "--societe-border": accent.border,
          }}
          initial={reduce ? false : { opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, y: 14, scale: 0.98 }}
          transition={{ duration: 0.38, ease: EASE }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="societe-view-modal__beam" aria-hidden />
          <div className="societe-view-modal__glow" aria-hidden />

          <header className="societe-view-modal__header">
            <div className="societe-view-modal__brand">
              <div
                className="societe-view-modal__logo"
                style={{
                  background: logoUrl ? "var(--bg-input)" : accent.gradient,
                }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="" />
                ) : (
                  <span>{(s.nom || "?")[0].toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="societe-view-modal__kicker">
                  <Sparkles className="h-3.5 w-3.5" />
                  Fiche société
                </p>
                <h2 id="societe-view-title">{s.nom || "—"}</h2>
                <div className="societe-view-modal__badges">
                  <span className="societe-view-modal__code">
                    <Hash className="h-3 w-3" />
                    {s.code || "—"}
                  </span>
                  <SocieteStatusBadge actif={s.actif} />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="societe-modal__close"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="societe-view-modal__body">
            <section className="societe-view-modal__stats">
              {stats.map(({ icon: Icon, label, value }, i) => (
                <motion.div
                  key={label}
                  className="societe-view-modal__stat"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.05, duration: 0.35, ease: EASE }}
                  whileHover={reduce ? undefined : { y: -3 }}
                >
                  <span className="societe-view-modal__stat-icon">
                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <div>
                    <p>{label}</p>
                    <strong>{Number(value).toLocaleString("fr-FR")}</strong>
                  </div>
                </motion.div>
              ))}
            </section>

            <section className="societe-view-modal__info">
              <h3>Coordonnées</h3>
              <ul>
                <li>
                  <Mail className="h-4 w-4" />
                  <div>
                    <p>Email</p>
                    {s.email ? (
                      <a href={`mailto:${s.email}`}>{s.email}</a>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </li>
                <li>
                  <MapPin className="h-4 w-4" />
                  <div>
                    <p>Adresse</p>
                    <span>{locationLabel}</span>
                  </div>
                </li>
                <li>
                  <Building2 className="h-4 w-4" />
                  <div>
                    <p>Identifiant</p>
                    <span>#{s.id}</span>
                  </div>
                </li>
              </ul>
            </section>

            <section className="societe-view-modal__info">
              <ChampSeuilValidation societeId={s.id} valeur={s.seuilValidationMouvement} fiche />
            </section>

            <section className="societe-view-modal__map-section">
              <div className="societe-view-modal__map-head">
                <h3>
                  <MapPin className="h-3.5 w-3.5" />
                  Localisation
                </h3>
                {hasLocation ? (
                  <span>
                    {Number(s.latitude).toFixed(5)}, {Number(s.longitude).toFixed(5)}
                  </span>
                ) : null}
              </div>
              {hasLocation ? (
                <div ref={mapContainerRef} className="societe-view-modal__map" />
              ) : (
                <div className="societe-view-modal__map-empty">
                  <MapPin className="h-5 w-5" />
                  <p>Aucune position GPS renseignée pour cette société.</p>
                </div>
              )}
            </section>
          </div>

          <footer className="societe-view-modal__footer">
            <button
              type="button"
              className="societe-view-modal__btn"
              onClick={() => run("edit")}
            >
              <Pencil className="h-4 w-4" />
              Modifier
            </button>
            <button
              type="button"
              className={`societe-view-modal__btn${isActive ? " is-danger" : " is-ok"}`}
              onClick={() => run(isActive ? "deactivate" : "reactivate")}
            >
              {isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
              {isActive ? "Désactiver" : "Réactiver"}
            </button>
            <button type="button" className="societe-view-modal__btn-primary" onClick={onClose}>
              Fermer
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
