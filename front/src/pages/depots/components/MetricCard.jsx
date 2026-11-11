import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DEPOT_KPI_ACCENTS } from "../depotsTheme";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
};

function useAnimatedNumber(target, duration = 1000) {
  const [val, setVal] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setVal(Number(target) || 0);
      return undefined;
    }
    const end = Number(target) || 0;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      setVal(Math.round(end * eased * 10) / 10);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduceMotion]);

  return val;
}

export default function MetricCard({
  icon: Icon,
  label,
  value,
  suffix = "",
  sub,
  ringPct,
  accentIndex = 0,
  index = 0,
}) {
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedNumber(typeof value === "number" ? value : parseFloat(value) || 0);
  const display = Number.isInteger(Number(value)) ? Math.round(animated) : animated.toFixed(1);
  const accent = DEPOT_KPI_ACCENTS[accentIndex % DEPOT_KPI_ACCENTS.length];

  return (
    <motion.div
      className="depot-kpi-card group"
      style={{ "--kpi-accent": accent }}
      custom={index}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={reduceMotion ? undefined : { y: -4 }}
    >
      <motion.span
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: accent }}
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.1 + index * 0.05, duration: 0.4 }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${accent}14 0%, transparent 55%)`,
        }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3 pl-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {label}
          </p>
          <p
            className="mt-1 font-display text-2xl font-bold tabular-nums tracking-tight"
            style={{ color: accent }}
          >
            {display}
            {suffix}
          </p>
          {sub ? (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</p>
          ) : null}
          <motion.div
            className="mt-2.5 h-px origin-left"
            style={{
              background: `linear-gradient(90deg, ${accent}55, transparent)`,
            }}
            initial={reduceMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.18 + index * 0.05, duration: 0.45 }}
            aria-hidden
          />
        </div>
        {Icon ? (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(145deg, ${accent}22, transparent)`,
              color: accent,
              boxShadow: `inset 0 0 0 1px ${accent}33`,
            }}
          >
            <Icon size={20} strokeWidth={1.75} />
          </div>
        ) : null}
        {ringPct != null ? (
          <div
            className="relative h-12 w-12 shrink-0"
            style={{
              background: `conic-gradient(${accent} ${Math.min(100, ringPct) * 3.6}deg, var(--border-default) 0)`,
              borderRadius: "50%",
            }}
          >
            <div
              className="absolute inset-1 flex items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: "var(--bg-card)", color: accent }}
            >
              {Math.round(ringPct)}%
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
