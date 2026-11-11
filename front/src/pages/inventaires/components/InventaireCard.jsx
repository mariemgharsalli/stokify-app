import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Eye, Play, Warehouse } from "lucide-react";
import { STATUS_MAP, formatDate, formatTnd, INV_THEME } from "../inventaireUtils";

function ProgressRing({ pct, accent, size = 52, pulse }) {
  const stroke = 4.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {pulse ? (
        <span
          className="inv-card-pulse pointer-events-none absolute inset-0 rounded-full"
          aria-hidden
        />
      ) : null}
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-subtle, rgba(148,163,184,0.18))"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${accent}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold tabular-nums" style={{ color: accent }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

export default function InventaireCard({
  inv,
  index = 0,
  canWrite,
  layout = "grid",
  onContinue,
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const s = inv.summary || {};
  const total = s.totalLignes ?? inv._count?.lignes ?? 0;
  const saisis = s.saisis ?? 0;
  const pct = s.progressionPct ?? (total > 0 ? Math.round((saisis / total) * 100) : 0);
  const ecarts = s.ecarts ?? 0;
  const cfg = STATUS_MAP[inv.statut] || STATUS_MAP.BROUILLON;
  const isLive = inv.statut === "EN_COURS";

  const accent =
    inv.statut === "VALIDE"
      ? INV_THEME.success
      : inv.statut === "ANNULE"
        ? INV_THEME.danger
        : isLive
          ? INV_THEME.cyan
          : INV_THEME.accent;

  return (
    <motion.article
      className="group relative overflow-hidden rounded-2xl border"
      style={{
        "--inv-accent": accent,
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: "var(--shadow-card)",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: reduceMotion ? 0 : Math.min(index * 0.045, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -6,
              borderColor: `${accent}66`,
              boxShadow: `0 18px 36px -16px ${accent}66`,
            }
      }
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${INV_THEME.cyan}12, transparent 50%)`,
        }}
        aria-hidden
      />

      <ClipboardList
        className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 opacity-[0.06] transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.1]"
        style={{ color: accent }}
        strokeWidth={1}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}88, transparent)`,
        }}
        aria-hidden
      />

      <div className="relative z-[1] flex items-center gap-3 px-3.5 py-3.5">
        <ProgressRing
          pct={pct}
          accent={accent}
          size={layout === "timeline" ? 58 : 54}
          pulse={!reduceMotion && isLive}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="relative rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {isLive && !reduceMotion ? (
                <span
                  className="inv-card-live-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: accent }}
                  aria-hidden
                />
              ) : null}
              {cfg.label}
            </span>
            <span className="truncate font-mono text-[11px] font-semibold" style={{ color: accent }}>
              {inv.reference}
            </span>
          </div>

          <h3
            className="mt-0.5 truncate text-sm font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {inv.depot?.libelle || "Dépôt"}
          </h3>

          <p
            className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px]"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="inline-flex items-center gap-0.5">
              <Warehouse className="h-3 w-3" style={{ color: INV_THEME.cyan }} />
              {inv.depot?.code || "—"}
            </span>
            <span>{formatDate(inv.date)}</span>
            <span className="tabular-nums">
              {saisis}/{total}
            </span>
            <span
              className="tabular-nums"
              style={{ color: ecarts > 0 ? INV_THEME.amber : INV_THEME.success }}
            >
              {ecarts} écart{ecarts !== 1 ? "s" : ""}
            </span>
            <span className="font-mono tabular-nums">{formatTnd(s.valeurEcart)}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
          <motion.button
            type="button"
            onClick={() => navigate(`/inventaires/${inv.id}`)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white"
            style={{
              background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, #0ea5e9))`,
              boxShadow: `0 4px 14px -4px ${accent}99`,
            }}
            whileHover={reduceMotion ? undefined : { scale: 1.04, y: -1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          >
            <Eye className="h-3 w-3" />
            Détail
          </motion.button>
          {canWrite && isLive && (
            <motion.button
              type="button"
              onClick={() => onContinue?.(inv)}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
              style={{
                borderColor: `${INV_THEME.success}55`,
                background: `${INV_THEME.success}18`,
                color: INV_THEME.success,
                boxShadow: `0 4px 12px -6px ${INV_THEME.success}66`,
              }}
              whileHover={reduceMotion ? undefined : { scale: 1.04, y: -1 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              <Play className="h-3 w-3" />
              Suite
            </motion.button>
          )}
        </div>
      </div>

      <style>{`
        .inv-card-pulse {
          animation: invCardPulse 2s ease-out infinite;
        }
        .inv-card-live-dot {
          box-shadow: 0 0 6px var(--inv-accent);
          animation: invCardPulse 1.6s ease-out infinite;
        }
        @keyframes invCardPulse {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--inv-accent) 55%, transparent); opacity: 1; }
          70% { box-shadow: 0 0 0 10px transparent; opacity: 0.35; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 0; }
        }
      `}</style>
    </motion.article>
  );
}
