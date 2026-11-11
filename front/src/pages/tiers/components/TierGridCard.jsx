import { motion, useReducedMotion } from "framer-motion";
import { Ban, CheckCircle, Eye, Mail, MapPin, Pencil, Phone, User } from "lucide-react";
import TierStatusBadge from "./TierStatusBadge";
import TierMapPreview from "./TierMapPreview";
import { TIERS_ACCENT, TIERS_CYAN } from "./tiersTheme";

function avatarGradient(name) {
  const palettes = [
    `linear-gradient(145deg, ${TIERS_ACCENT}, ${TIERS_CYAN})`,
    "linear-gradient(145deg, #1D9E75, #0EA5E9)",
    "linear-gradient(145deg, #0EA5E9, #378ADD)",
    "linear-gradient(145deg, #2563eb, #06B6D4)",
  ];
  const n = String(name || "?").charCodeAt(0) || 0;
  return palettes[n % palettes.length];
}

function ActionIcon({ title, onClick, variant = "view", children }) {
  const styles = {
    view: {
      background: "rgba(55,138,221,0.12)",
      borderColor: "rgba(55,138,221,0.3)",
      color: TIERS_ACCENT,
    },
    edit: {
      background: "rgba(14,165,233,0.12)",
      borderColor: "rgba(14,165,233,0.3)",
      color: TIERS_CYAN,
    },
    deactivate: {
      background: "rgba(226,75,74,0.1)",
      borderColor: "rgba(226,75,74,0.3)",
      color: "#E24B4A",
    },
    reactivate: {
      background: "rgba(29,158,117,0.1)",
      borderColor: "rgba(29,158,117,0.3)",
      color: "#1D9E75",
    },
  };
  const s = styles[variant] || styles.view;
  return (
    <motion.button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border transition"
      style={s}
      whileHover={{ scale: 1.08, y: -1 }}
      whileTap={{ scale: 0.94 }}
    >
      {children}
    </motion.button>
  );
}

/**
 * Carte grille pro — Clients / Fournisseurs
 * @param {{ label: string, style?: object }[]} badges
 */
export default function TierGridCard({
  tier,
  index = 0,
  badges = [],
  canWrite,
  onView,
  onEdit,
  onToggle,
}) {
  const reduceMotion = useReducedMotion();
  const isDisabled = tier.actif === false;
  const initial = (tier.nom || tier.code || "?")[0].toUpperCase();
  const hasMap = tier.latitude != null && tier.longitude != null;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: isDisabled ? 0.82 : 1, y: 0, scale: 1 }}
      transition={{
        delay: reduceMotion ? 0 : Math.min(index * 0.05, 0.4),
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -6, transition: { type: "spring", stiffness: 400, damping: 28 } }
      }
      className="tier-grid-card group relative overflow-hidden rounded-2xl border"
      style={{
        borderColor: "color-mix(in srgb, #378ADD 20%, var(--border-default))",
        background:
          "linear-gradient(165deg, color-mix(in srgb, #378ADD 5%, var(--bg-card)), var(--bg-card))",
        boxShadow: "0 18px 40px -24px rgba(55, 138, 221, 0.35), var(--shadow-card)",
      }}
      onClick={() => onView?.(tier)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView?.(tier);
        }
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: isDisabled
            ? "linear-gradient(90deg, #64748b, #94a3b8)"
            : `linear-gradient(90deg, #0B1F3A, ${TIERS_ACCENT}, ${TIERS_CYAN})`,
        }}
      />
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-40 blur-2xl transition-opacity duration-300 group-hover:opacity-70"
        style={{ background: `radial-gradient(circle, ${TIERS_ACCENT}55, transparent 70%)` }}
      />

      <div className="relative p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg transition-transform duration-300 group-hover:scale-105"
              style={{
                background: avatarGradient(tier.nom),
                boxShadow: `0 8px 20px -8px ${TIERS_ACCENT}88`,
              }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                {tier.nom}
              </p>
              <span
                className="mt-0.5 inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide"
                style={{
                  color: "#7dd3fc",
                  background: "rgba(55,138,221,0.14)",
                  borderColor: "rgba(55,138,221,0.28)",
                }}
              >
                {tier.code}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
            <TierStatusBadge actif={tier.actif} />
            <div className="flex gap-1">
              <ActionIcon title="Voir le détail" onClick={() => onView?.(tier)} variant="view">
                <Eye size={14} strokeWidth={2.25} />
              </ActionIcon>
              {canWrite ? (
                <>
                  <ActionIcon title="Modifier" onClick={() => onEdit?.(tier)} variant="edit">
                    <Pencil size={14} strokeWidth={2.25} />
                  </ActionIcon>
                  <ActionIcon
                    title={isDisabled ? "Réactiver" : "Désactiver"}
                    onClick={() => onToggle?.(tier)}
                    variant={isDisabled ? "reactivate" : "deactivate"}
                  >
                    {isDisabled ? (
                      <CheckCircle size={14} strokeWidth={2.25} />
                    ) : (
                      <Ban size={14} strokeWidth={2.25} />
                    )}
                  </ActionIcon>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mb-3 space-y-1.5">
          {tier.telephone ? (
            <p className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <Phone className="h-3 w-3 shrink-0 text-[var(--accent-primary)]" />
              <span className="truncate">{tier.telephone}</span>
            </p>
          ) : null}
          {tier.email ? (
            <p className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <Mail className="h-3 w-3 shrink-0 text-[var(--accent-primary)]" />
              <span className="truncate">{tier.email}</span>
            </p>
          ) : null}
          {tier.contact ? (
            <p className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <User className="h-3 w-3 shrink-0 text-[var(--accent-primary)]" />
              <span className="truncate">{tier.contact}</span>
            </p>
          ) : null}
          {(tier.ville || tier.adresse) && !hasMap ? (
            <p className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <MapPin className="h-3 w-3 shrink-0 text-emerald-500" />
              <span className="truncate">{tier.ville || tier.adresse}</span>
            </p>
          ) : null}
        </div>

        {hasMap ? (
          <div
            className="mb-3 overflow-hidden rounded-xl border border-[var(--border-default)]"
            style={{ isolation: "isolate", position: "relative", zIndex: 0 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <TierMapPreview
              latitude={Number(tier.latitude)}
              longitude={Number(tier.longitude)}
              nom={tier.nom}
              ville={tier.ville}
              pays={tier.pays}
              autoOpenPopup={false}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5 border-t border-[var(--border-default)] pt-3">
          {badges.length > 0 ? (
            badges.map((b) => (
              <span
                key={b.label}
                className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                style={b.style}
              >
                {b.label}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-[var(--text-muted)]">Aucune condition commerciale</span>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export function TierGridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-52 animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}
