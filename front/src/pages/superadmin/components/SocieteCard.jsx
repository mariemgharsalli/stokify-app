import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  Camera,
  Eye,
  Hash,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Power,
  PowerOff,
  Users,
  Warehouse,
} from "lucide-react";
import { buildLogoUrl } from "./SocieteTableRow";
import SocieteActionMenu from "./SocieteActionMenu";
import AnimatedSwitch from "./AnimatedSwitch";
import SocieteStatusBadge from "./SocieteStatusBadge";
import { getCardAccent } from "./societesTheme";

/**
 * Carte société — grille simple, claire et professionnelle.
 */
export default function SocieteCard({
  societe: s,
  index,
  onAction,
  onToggleActif,
  togglePending,
  onLogoUpload,
  isSuperAdmin,
  logoUploadPending,
  logoUploadId,
}) {
  const reduceMotion = useReducedMotion();
  const fileRef = useRef(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const logoUrl = buildLogoUrl(s.logo);
  const isUploading = logoUploadPending && Number(logoUploadId) === Number(s.id);
  const counts = s._count || {};
  const accent = getCardAccent(s);
  const locationLabel = s.ville || s.adresse || "Non localisée";

  return (
    <>
      <motion.article
        className="societe-grid-card"
        style={{
          "--societe-accent": accent.accent,
          "--societe-soft": accent.soft,
          "--societe-border": accent.border,
        }}
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.35,
          delay: reduceMotion ? 0 : Math.min(index * 0.05, 0.4),
          ease: [0.22, 1, 0.36, 1],
        }}
        whileHover={reduceMotion ? undefined : { y: -4 }}
      >
        <div className="societe-grid-card__top">
          <div
            className={`societe-grid-card__logo${isSuperAdmin ? " is-editable" : ""}`}
            onClick={() => isSuperAdmin && fileRef.current?.click()}
            role={isSuperAdmin ? "button" : undefined}
            tabIndex={isSuperAdmin ? 0 : undefined}
            onKeyDown={(e) => isSuperAdmin && e.key === "Enter" && fileRef.current?.click()}
            title={isSuperAdmin ? "Changer le logo" : undefined}
            style={isSuperAdmin ? { cursor: "pointer" } : undefined}
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: accent.accent }} />
            ) : logoUrl ? (
              <img src={logoUrl} alt="" />
            ) : (
              <span>{(s.nom || "?")[0].toUpperCase()}</span>
            )}
            {isSuperAdmin && !isUploading && (
              <div className="societe-grid-card__logo-overlay">
                <Camera className="h-3.5 w-3.5" />
              </div>
            )}
            {isSuperAdmin && (
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onLogoUpload(file);
                  e.target.value = "";
                }}
              />
            )}
          </div>

          <div className="societe-grid-card__identity">
            <button
              type="button"
              className="societe-grid-card__name-btn"
              onClick={() => onAction("view", s)}
              title="Voir le détail"
            >
              {s.nom || "—"}
            </button>
            <span>
              <Hash className="h-3 w-3" />
              {s.code}
            </span>
          </div>

          <div className="societe-grid-card__tools">
            <AnimatedSwitch
              checked={s.actif !== false}
              disabled={togglePending}
              onChange={() => onToggleActif?.(s)}
              id={`societe-card-toggle-${s.id}`}
            />
            <button
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setMenuAnchor(menuAnchor ? null : rect);
              }}
              className="societe-grid-card__more"
              aria-label="Actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="societe-grid-card__status">
          <SocieteStatusBadge actif={s.actif} />
        </div>

        <div className="societe-grid-card__stats">
          <span title="Utilisateurs">
            <Users className="h-3.5 w-3.5" />
            {(counts.utilisateurs ?? 0).toLocaleString("fr-FR")}
          </span>
          <span title="Articles">
            <Package className="h-3.5 w-3.5" />
            {(counts.articles ?? 0).toLocaleString("fr-FR")}
          </span>
          <span title="Dépôts">
            <Warehouse className="h-3.5 w-3.5" />
            {(counts.depots ?? 0).toLocaleString("fr-FR")}
          </span>
        </div>

        <div className="societe-grid-card__meta">
          {s.email ? (
            <p>
              <Mail className="h-3.5 w-3.5" />
              <span>{s.email}</span>
            </p>
          ) : null}
          <p>
            <MapPin className="h-3.5 w-3.5" />
            <span>{locationLabel}</span>
          </p>
        </div>

        <div className="societe-grid-card__actions">
          <button type="button" onClick={() => onAction("view", s)}>
            <Eye className="h-3.5 w-3.5" />
            Détail
          </button>
          <button type="button" onClick={() => onAction("edit", s)}>
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </button>
          <button
            type="button"
            className={s.actif !== false ? "is-danger" : "is-ok"}
            onClick={() => onAction(s.actif !== false ? "deactivate" : "reactivate", s)}
          >
            {s.actif !== false ? (
              <PowerOff className="h-3.5 w-3.5" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )}
            {s.actif !== false ? "Désactiver" : "Réactiver"}
          </button>
        </div>
      </motion.article>

      {menuAnchor && (
        <SocieteActionMenu
          societe={s}
          anchorRect={menuAnchor}
          close={() => setMenuAnchor(null)}
          onAction={onAction}
        />
      )}
    </>
  );
}

export function SocieteCardSkeleton({ index }) {
  return (
    <div
      className="societe-grid-card societe-grid-card--skeleton"
      style={{ animation: `societesFadeUp 0.4s ease ${Math.min(index * 50, 500)}ms both` }}
    >
      <div className="societe-grid-card__top">
        <div className="h-12 w-12 rounded-xl societes-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded societes-shimmer" />
          <div className="h-3 w-16 rounded societes-shimmer" />
        </div>
      </div>
      <div className="h-8 rounded-lg societes-shimmer" />
      <div className="h-10 rounded-lg societes-shimmer" />
    </div>
  );
}

export function SocieteEmptyState({ onCreate, isSearchEmpty }) {
  return (
    <div className="societe-grid-empty">
      <div className="societe-grid-empty__icon">
        <Building2 className="h-7 w-7" />
      </div>
      <h3>{isSearchEmpty ? "Aucun résultat" : "Aucune société"}</h3>
      <p>
        {isSearchEmpty
          ? "Modifiez vos filtres ou votre recherche."
          : "Créez votre premier tenant pour démarrer."}
      </p>
      {!isSearchEmpty && (
        <button type="button" onClick={onCreate}>
          <Building2 className="h-4 w-4" />
          Créer une société
        </button>
      )}
    </div>
  );
}
