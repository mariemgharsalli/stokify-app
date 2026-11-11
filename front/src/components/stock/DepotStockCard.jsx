import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Eye,
  MapPin,
  Package,
  Warehouse,
} from "lucide-react";
import { fmtMoney } from "./stockUi";

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  success: "#1D9E75",
  warning: "#EF9F27",
  danger: "#E24B4A",
  muted: "#94A3B8",
};

function useAnimatedNumber(target, duration = 900) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setValue(Number(target) || 0);
      return undefined;
    }
    const end = Number(target) || 0;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(end * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduceMotion]);

  return value;
}

function fillAccent(fill, hasAlerts) {
  if (hasAlerts) return THEME.danger;
  if (fill > 85) return THEME.danger;
  if (fill > 60) return THEME.warning;
  if (fill > 0) return THEME.success;
  return THEME.accent;
}

function depotStatus(fill, nbAlertes) {
  if (nbAlertes > 0) {
    return { label: "Alertes", bg: "rgba(226,75,74,0.18)", color: "#fca5a5", key: "alertes" };
  }
  if (fill > 85) {
    return { label: "Saturé", bg: "rgba(226,75,74,0.18)", color: "#fca5a5", key: "sature" };
  }
  if (fill > 60) {
    return { label: "Chargé", bg: "rgba(239,159,39,0.18)", color: "#fcd34d", key: "charge" };
  }
  return { label: "Actif", bg: "rgba(29,158,117,0.18)", color: "#6ee7b7", key: "ok" };
}

function ProgressRing({ pct, accent, size = 64, pulse, children }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  const inner = size - stroke * 2 - 4;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {pulse ? (
        <span className="depot-stock-pulse pointer-events-none absolute inset-0 rounded-full" aria-hidden />
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
          transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${accent}66)` }}
        />
      </svg>
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full"
        style={{
          width: inner,
          height: inner,
          background: `linear-gradient(145deg, ${accent}28, color-mix(in srgb, ${THEME.cyan} 12%, var(--bg-input)))`,
          boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.12)",
        }}
      >
        {children}
      </div>
      <span
        className="absolute -bottom-0.5 left-1/2 z-[1] -translate-x-1/2 rounded-md px-1.5 py-px text-[9px] font-bold tabular-nums text-white"
        style={{
          background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, ${THEME.cyan}))`,
          boxShadow: `0 2px 8px -2px ${accent}99`,
        }}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

/**
 * Carte stock par dépôt — layout compact type Article / Lot.
 */
export default function DepotStockCard({ depot, index, onViewDepot }) {
  const reduceMotion = useReducedMotion();
  const fill = Number(depot.tauxRemplissage) || 0;
  const nbAlertes = Number(depot.nbAlertes) || 0;
  const accent = fillAccent(fill, nbAlertes > 0);
  const status = depotStatus(fill, nbAlertes);
  const needsPulse = !reduceMotion && (status.key === "alertes" || status.key === "sature");
  const animatedArticles = useAnimatedNumber(depot.nbArticles || 0, 900);
  const animatedValue = useAnimatedNumber(depot.valeurCMP || 0, 1100);

  return (
    <motion.article
      className="group relative overflow-hidden rounded-2xl border"
      style={{
        "--depot-accent": accent,
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
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${THEME.cyan}12, transparent 50%)`,
        }}
        aria-hidden
      />

      <Warehouse
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

      <div className="relative z-[1] flex items-start gap-3 px-3.5 pt-3.5">
        <ProgressRing pct={fill} accent={accent} size={64} pulse={needsPulse}>
          <Warehouse className="h-6 w-6" style={{ color: accent }} aria-hidden />
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="relative rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ background: status.bg, color: status.color }}
            >
              {needsPulse ? (
                <span
                  className="depot-stock-live-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: accent }}
                  aria-hidden
                />
              ) : null}
              {status.label}
            </span>
            {depot.code ? (
              <span className="font-mono text-[11px] font-semibold text-[#378ADD]">{depot.code}</span>
            ) : null}
          </div>

          <h3 className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
            {depot.libelle}
          </h3>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
            {depot.ville ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-sky-400/80" aria-hidden />
                {depot.ville}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Package className="h-3 w-3 text-sky-400/80" aria-hidden />
              {Math.round(animatedArticles).toLocaleString("fr-FR")} article
              {depot.nbArticles > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-[1] mt-3 grid grid-cols-3 gap-2 px-3.5">
        <div
          className="rounded-xl border px-2 py-2 text-center"
          style={{
            borderColor: "rgba(55,138,221,0.22)",
            background: "color-mix(in srgb, #378ADD 8%, var(--bg-input))",
          }}
        >
          <p className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
            {depot.nbEmplacements}
          </p>
          <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Empl.
          </p>
        </div>
        <div
          className="rounded-xl border px-2 py-2 text-center"
          style={{
            borderColor: "rgba(14,165,233,0.28)",
            background: "color-mix(in srgb, #0EA5E9 10%, var(--bg-input))",
          }}
        >
          <p className="text-sm font-bold tabular-nums text-sky-300">
            {fmtMoney(animatedValue)}
          </p>
          <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Valeur
          </p>
        </div>
        <div
          className="rounded-xl border px-2 py-2 text-center"
          style={{
            borderColor:
              nbAlertes > 0 ? "rgba(226,75,74,0.35)" : "rgba(29,158,117,0.28)",
            background:
              nbAlertes > 0
                ? "color-mix(in srgb, #E24B4A 10%, var(--bg-input))"
                : "color-mix(in srgb, #1D9E75 10%, var(--bg-input))",
          }}
        >
          <p
            className="inline-flex items-center justify-center gap-1 text-sm font-bold tabular-nums"
            style={{ color: nbAlertes > 0 ? THEME.danger : THEME.success }}
          >
            {nbAlertes > 0 ? <AlertTriangle className="h-3 w-3" aria-hidden /> : null}
            {nbAlertes}
          </p>
          <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Alertes
          </p>
        </div>
      </div>

      <div className="relative z-[1] mt-3 px-3.5">
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "color-mix(in srgb, var(--border-default) 70%, transparent)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${accent}, ${THEME.cyan})`,
              boxShadow: `0 0 10px ${accent}55`,
            }}
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${Math.min(100, fill)}%` }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          />
        </div>
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
          Remplissage{" "}
          <span className="font-semibold tabular-nums" style={{ color: accent }}>
            {fill.toFixed(0)}%
          </span>
          {depot.quantiteTotale != null ? (
            <span>
              {" "}
              · {Number(depot.quantiteTotale).toLocaleString("fr-FR")} u. en stock
            </span>
          ) : null}
        </p>
      </div>

      <div className="relative z-[1] p-3.5 pt-3">
        <motion.button
          type="button"
          onClick={() => onViewDepot?.(depot.id)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white"
          style={{
            background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`,
            boxShadow: `0 8px 20px -8px ${THEME.accent}88`,
          }}
          whileHover={reduceMotion ? undefined : { y: -2, scale: 1.02 }}
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        >
          <Eye className="h-3.5 w-3.5" />
          Voir le stock
        </motion.button>
      </div>

      <style>{`
        .depot-stock-pulse {
          animation: depotStockPulse 2s ease-out infinite;
        }
        .depot-stock-live-dot {
          box-shadow: 0 0 6px var(--depot-accent);
          animation: depotStockPulse 1.6s ease-out infinite;
        }
        @keyframes depotStockPulse {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--depot-accent) 55%, transparent); opacity: 1; }
          70% { box-shadow: 0 0 0 10px transparent; opacity: 0.35; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 0; }
        }
      `}</style>
    </motion.article>
  );
}
