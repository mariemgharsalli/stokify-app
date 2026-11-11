import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export function useAnimatedNumber(target, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
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
  }, [target, duration]);
  return value;
}

/** KPI animé — style Ventes + effets dynamiques (shine, hover, barre) */
export default function SocieteKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor,
  valueColor,
  formatValue,
  delayIndex = 0,
  pulse = false,
  barPct,
}) {
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedNumber(value, 1200);
  const display = formatValue
    ? formatValue(animated)
    : Math.round(animated).toLocaleString("fr-FR");

  const resolvedValueColor = valueColor || accentColor;
  const resolvedBar =
    barPct != null ? Math.min(100, Math.max(4, barPct)) : null;

  return (
    <motion.div
      className={`societe-kpi-card group relative overflow-hidden ${pulse ? "societe-kpi-card--pulse" : ""}`}
      style={{
        "--kpi-accent": accentColor,
        "--kpi-glow": `${accentColor}44`,
        borderLeftColor: accentColor,
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.45,
        delay: reduceMotion ? 0 : delayIndex * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
    >
      <div className="societe-kpi-shine pointer-events-none absolute inset-0" aria-hidden />

      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle, ${accentColor}33 0%, transparent 70%)`,
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {title}
          </p>
          <p
            className="societe-kpi-value mt-1 text-2xl font-bold tabular-nums tracking-tight"
            style={{ color: resolvedValueColor }}
          >
            {display}
          </p>
          {subtitle ? (
            <p className="mt-1.5 text-xs leading-snug text-[var(--text-secondary)]">{subtitle}</p>
          ) : null}
        </div>

        <div
          className={`societe-kpi-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${pulse ? "societe-kpi-icon--pulse" : ""}`}
          style={{
            background: `${accentColor}18`,
            color: accentColor,
            border: `1px solid ${accentColor}30`,
            boxShadow: `0 6px 18px -6px ${accentColor}40`,
          }}
        >
          {Icon ? <Icon size={22} strokeWidth={1.75} aria-hidden /> : null}
        </div>
      </div>

      {resolvedBar != null && (
        <div
          className="relative mt-4 h-1 overflow-hidden rounded-full"
          style={{ background: "var(--border-subtle)" }}
        >
          <div
            className="societe-kpi-bar absolute left-0 top-0 h-full rounded-full"
            style={{
              width: `${resolvedBar}%`,
              background: `linear-gradient(90deg, ${accentColor}bb, ${accentColor})`,
              boxShadow: `0 0 10px ${accentColor}55`,
            }}
          />
        </div>
      )}
    </motion.div>
  );
}
