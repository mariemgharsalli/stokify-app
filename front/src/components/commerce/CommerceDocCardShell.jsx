import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export const COMMERCE_THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  success: "#1D9E75",
  warning: "#EF9F27",
  danger: "#E24B4A",
  muted: "#94A3B8",
};

export function useAnimatedNumber(target, duration = 900) {
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

/** Anneau de progression autour d’un avatar (initiales / icône) — inspiré ProgressRing stock */
export function CommerceAvatarRing({
  pct = 72,
  accent,
  size = 56,
  pulse = false,
  children,
  chipLabel,
}) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  const inner = size - stroke * 2 - 4;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size, "--doc-accent": accent }}>
      {pulse ? (
        <span className="commerce-doc-pulse pointer-events-none absolute inset-0 rounded-full" aria-hidden />
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
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
        style={{
          width: inner,
          height: inner,
          background: `linear-gradient(145deg, ${accent}, color-mix(in srgb, ${accent} 45%, ${COMMERCE_THEME.cyan}))`,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      >
        {children}
      </div>
      {chipLabel != null ? (
        <span
          className="absolute -bottom-0.5 left-1/2 z-[1] -translate-x-1/2 rounded-md px-1.5 py-px text-[9px] font-bold tabular-nums text-white"
          style={{
            background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, ${COMMERCE_THEME.cyan}))`,
            boxShadow: `0 2px 8px -2px ${accent}99`,
          }}
        >
          {chipLabel}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Coque visuelle type ArticleStockCard — achats / ventes.
 */
export default function CommerceDocCardShell({
  accent,
  index = 0,
  pulse = false,
  WatermarkIcon,
  onClick,
  children,
  className = "",
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border ${className}`}
      style={{
        "--doc-accent": accent,
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
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${COMMERCE_THEME.cyan}12, transparent 50%)`,
        }}
        aria-hidden
      />

      {WatermarkIcon ? (
        <WatermarkIcon
          className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 opacity-[0.06] transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.1]"
          style={{ color: accent }}
          strokeWidth={1}
          aria-hidden
        />
      ) : null}

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}88, transparent)`,
        }}
        aria-hidden
      />

      {pulse ? (
        <span
          className="commerce-doc-live-dot pointer-events-none absolute right-3 top-3 h-2 w-2 rounded-full"
          style={{ background: accent }}
          aria-hidden
        />
      ) : null}

      <div className="relative z-[1]">{children}</div>

      <style>{`
        .commerce-doc-pulse {
          animation: commerceDocPulse 2s ease-out infinite;
        }
        .commerce-doc-live-dot {
          box-shadow: 0 0 6px var(--doc-accent);
          animation: commerceDocPulse 1.6s ease-out infinite;
        }
        @keyframes commerceDocPulse {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--doc-accent) 55%, transparent); opacity: 1; }
          70% { box-shadow: 0 0 0 10px transparent; opacity: 0.35; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 0; }
        }
      `}</style>
    </motion.article>
  );
}

export function CommerceMiniGauge({ pct, accent, reduceMotion }) {
  return (
    <div
      className="mt-2 h-1 max-w-[180px] overflow-hidden rounded-full"
      style={{ background: "color-mix(in srgb, var(--border-default) 70%, transparent)" }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{
          background: `linear-gradient(90deg, ${accent}, ${COMMERCE_THEME.cyan})`,
          boxShadow: `0 0 8px ${accent}55`,
        }}
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      />
    </div>
  );
}

export function CommerceMicroBadge({ children, bg, color, pulse, accent }) {
  return (
    <span
      className="relative inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
      style={{ background: bg, color }}
    >
      {pulse ? (
        <span
          className="commerce-doc-live-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
          style={{ background: accent || color }}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}
