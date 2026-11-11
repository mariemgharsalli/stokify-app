import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  ArrowRightLeft,
  ClipboardList,
  Hash,
  Link2,
  Pencil,
  Timer,
  Warehouse,
} from "lucide-react";
import { getArticleRealImageUrl } from "../../utils/articleImage";

const SERIE_THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  success: "#1D9E75",
  danger: "#E24B4A",
  amber: "#D97706",
  muted: "#94A3B8",
};

const STATUS_STYLE = {
  DISPONIBLE: {
    label: "Disponible",
    bg: "rgba(29,158,117,0.18)",
    color: "#6ee7b7",
    accent: SERIE_THEME.success,
    pct: 100,
  },
  VENDU: {
    label: "Vendu",
    bg: "rgba(55,138,221,0.18)",
    color: "#93c5fd",
    accent: SERIE_THEME.accent,
    pct: 100,
  },
  RETOURNE: {
    label: "Retourné",
    bg: "rgba(217,119,6,0.18)",
    color: "#fcd34d",
    accent: SERIE_THEME.amber,
    pct: 65,
  },
  DEFECTUEUX: {
    label: "Défectueux",
    bg: "rgba(226,75,74,0.18)",
    color: "#fca5a5",
    accent: SERIE_THEME.danger,
    pct: 22,
  },
  DESACTIVE: {
    label: "Désactivé",
    bg: "rgba(100,116,139,0.22)",
    color: "#cbd5e1",
    accent: SERIE_THEME.muted,
    pct: 0,
  },
};

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function ProgressRing({ pct, accent, size = 58, pulse, children }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  const inner = size - stroke * 2 - 4;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {pulse ? (
        <span className="serie-card-pulse pointer-events-none absolute inset-0 rounded-full" aria-hidden />
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
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full"
        style={{
          width: inner,
          height: inner,
          background: "var(--bg-input)",
          boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.12)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function MiniIconBtn({ icon: Icon, onClick, title, color, disabled, reduceMotion }) {
  return (
    <motion.button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="rounded-lg p-1.5 disabled:opacity-40"
      style={{ color: color || "var(--text-muted)" }}
      whileHover={reduceMotion || disabled ? undefined : { scale: 1.12, y: -1 }}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.94 }}
    >
      <Icon className="h-3.5 w-3.5" />
    </motion.button>
  );
}

export function SerieCardSkeleton({ index = 0 }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="h-[88px] overflow-hidden rounded-2xl border"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: "3px solid rgba(55,138,221,0.35)",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div
        className="h-full w-full"
        style={{
          background:
            "linear-gradient(110deg, var(--bg-card) 30%, color-mix(in srgb, #378ADD 14%, var(--bg-card)) 50%, var(--bg-card) 70%)",
          backgroundSize: "200% 100%",
          animation: reduceMotion ? undefined : "serieSkelShine 1.4s ease-in-out infinite",
          animationDelay: `${index * 70}ms`,
        }}
      />
      <style>{`
        @keyframes serieSkelShine {
          0% { background-position: 120% 0; }
          100% { background-position: -40% 0; }
        }
      `}</style>
    </motion.div>
  );
}

/**
 * Carte numéro de série — même langage compact que LotCard.
 */
export default function SerieCard({
  serie,
  index = 0,
  canWrite = false,
  deactivatePending = false,
  onHistory,
  onTransfer,
  onAssign,
  onEdit,
  onDesactiver,
  onReactivate,
}) {
  const reduceMotion = useReducedMotion();
  const [imgErr, setImgErr] = useState(false);

  const statut = String(serie.statut || "").toUpperCase();
  const cfg = STATUS_STYLE[statut] || STATUS_STYLE.DISPONIBLE;
  const isDisabled = statut === "DESACTIVE";
  const isAvailable = statut === "DISPONIBLE";
  const accent = cfg.accent;
  const imgSrc = getArticleRealImageUrl(serie.article);
  const articleLabel = serie.article?.libelle || serie.article?.designation || "—";

  return (
    <motion.article
      className="group relative overflow-hidden rounded-2xl border"
      style={{
        "--serie-accent": accent,
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: "var(--shadow-card)",
        opacity: isDisabled ? 0.85 : 1,
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: isDisabled ? 0.85 : 1, y: 0, scale: 1 }}
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
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${SERIE_THEME.cyan}12, transparent 50%)`,
        }}
        aria-hidden
      />

      <Hash
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
          pct={cfg.pct}
          accent={accent}
          size={64}
          pulse={!reduceMotion && isAvailable}
        >
          {imgSrc && !imgErr ? (
            <img
              src={imgSrc}
              alt={articleLabel}
              onError={() => setImgErr(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Hash className="h-5 w-5" style={{ color: accent }} aria-hidden />
          )}
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="relative rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {isAvailable && !reduceMotion ? (
                <span
                  className="serie-card-live-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: accent }}
                  aria-hidden
                />
              ) : null}
              {cfg.label}
            </span>
            {serie.lot?.numero ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                style={{
                  background: `linear-gradient(135deg, ${SERIE_THEME.accent}, ${SERIE_THEME.cyan})`,
                }}
              >
                <Link2 className="h-2.5 w-2.5" />
                {serie.lot.numero}
              </span>
            ) : null}
            <span className="truncate font-mono text-[11px] font-semibold" style={{ color: accent }}>
              {serie.numero}
            </span>
          </div>

          <h3
            className="mt-0.5 truncate text-sm font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {articleLabel}
          </h3>

          <p
            className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px]"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="inline-flex items-center gap-0.5">
              <Warehouse className="h-3 w-3" style={{ color: SERIE_THEME.cyan }} />
              {serie.depot?.code || serie.depot?.libelle || "—"}
            </span>
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              <Timer className="h-3 w-3" />
              {fmtDate(serie.createdAt)}
            </span>
            <span className="hidden font-mono sm:inline">{serie.article?.code || ""}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <motion.button
            type="button"
            onClick={() => onHistory?.(serie)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white"
            style={{
              background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, #0ea5e9))`,
              boxShadow: `0 4px 14px -4px ${accent}99`,
            }}
            whileHover={reduceMotion ? undefined : { scale: 1.04, y: -1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          >
            <ClipboardList className="h-3 w-3" />
            Historique
          </motion.button>

          {canWrite ? (
            <div
              className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              {!isDisabled ? (
                <>
                  <MiniIconBtn
                    icon={ArrowRightLeft}
                    onClick={() => onTransfer?.(serie)}
                    title="Transférer"
                    color={SERIE_THEME.amber}
                    reduceMotion={reduceMotion}
                  />
                  <MiniIconBtn
                    icon={Link2}
                    onClick={() => onAssign?.(serie)}
                    title="Assigner à un lot"
                    color={SERIE_THEME.cyan}
                    reduceMotion={reduceMotion}
                  />
                  <MiniIconBtn
                    icon={Pencil}
                    onClick={() => onEdit?.(serie)}
                    title="Modifier"
                    color={SERIE_THEME.accent}
                    reduceMotion={reduceMotion}
                  />
                  <MiniIconBtn
                    icon={Archive}
                    onClick={() => onDesactiver?.(serie)}
                    title="Désactiver"
                    color={SERIE_THEME.muted}
                    disabled={deactivatePending}
                    reduceMotion={reduceMotion}
                  />
                </>
              ) : (
                <MiniIconBtn
                  icon={Archive}
                  onClick={() => onReactivate?.(serie)}
                  title="Réactiver"
                  color={SERIE_THEME.success}
                  disabled={deactivatePending}
                  reduceMotion={reduceMotion}
                />
              )}
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        .serie-card-pulse {
          animation: serieCardPulse 2s ease-out infinite;
        }
        .serie-card-live-dot {
          box-shadow: 0 0 6px var(--serie-accent);
          animation: serieCardPulse 1.6s ease-out infinite;
        }
        @keyframes serieCardPulse {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--serie-accent) 55%, transparent); opacity: 1; }
          70% { box-shadow: 0 0 0 10px transparent; opacity: 0.35; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 0; }
        }
      `}</style>
    </motion.article>
  );
}
