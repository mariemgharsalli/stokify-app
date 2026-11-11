import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Archive, CheckCircle, Package } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
};

function useAnimatedNumber(target, duration = 1100) {
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

/** Tuile KPI style Ventes — barre latérale, hint, hairline. */
function LotKpiTile({ icon: Icon, label, value, hint, accentVar, index, pulse }) {
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedNumber(value, 1100);
  const display = Math.round(animated).toLocaleString("fr-FR");

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`group relative overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-4 ${
        pulse ? "lots-kpi-pulse" : "border-[var(--border-default)]"
      }`}
      style={
        pulse
          ? {
              "--kpi-accent": `var(${accentVar})`,
              borderColor: `color-mix(in srgb, var(${accentVar}) 35%, var(--border-default))`,
            }
          : undefined
      }
    >
      <motion.span
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: `var(${accentVar})` }}
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.1 + index * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, var(${accentVar}) 8%, transparent) 0%, transparent 55%)`,
        }}
        aria-hidden
      />
      <div className="relative pl-2.5">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, var(${accentVar}) 14%, transparent), transparent)`,
              color: `var(${accentVar})`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(${accentVar}) 22%, transparent)`,
            }}
          >
            <Icon size={20} strokeWidth={1.75} />
          </div>
          {hint ? (
            <span className="rounded-md bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              {hint}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </p>
        <p
          className="mt-0.5 font-display text-2xl font-bold tabular-nums tracking-tight"
          style={{ color: `var(${accentVar})` }}
        >
          {display}
        </p>
        <motion.div
          className="mt-2.5 h-px origin-left"
          style={{
            background: `linear-gradient(90deg, color-mix(in srgb, var(${accentVar}) 40%, transparent), transparent)`,
          }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.18 + index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />
      </div>
    </motion.div>
  );
}

export default function LotKpiCards({ stats }) {
  const total = stats.total ?? 0;
  const actifs = stats.actifs ?? 0;
  const expiring = stats.expiring ?? 0;
  const epuises = stats.epuises ?? 0;

  return (
    <>
      <style>{`
        @keyframes lotsKpiPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--kpi-accent) 18%, transparent); }
          50% { box-shadow: 0 0 22px 2px color-mix(in srgb, var(--kpi-accent) 28%, transparent); }
        }
        .lots-kpi-pulse { animation: lotsKpiPulse 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .lots-kpi-pulse { animation: none !important; }
        }
      `}</style>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LotKpiTile
          index={0}
          icon={Package}
          label="Total lots"
          value={total}
          hint="registre"
          accentVar="--accent-primary"
        />
        <LotKpiTile
          index={1}
          icon={CheckCircle}
          label="Actifs (page)"
          value={actifs}
          hint="disponibles"
          accentVar="--accent-success"
        />
        <LotKpiTile
          index={2}
          icon={AlertTriangle}
          label="Expirent bientôt"
          value={expiring}
          hint="≤ 30 j"
          accentVar="--accent-warning"
          pulse={expiring > 0}
        />
        <LotKpiTile
          index={3}
          icon={Archive}
          label="Épuisés (page)"
          value={epuises}
          hint="stock 0"
          accentVar="--accent-danger"
        />
      </div>
    </>
  );
}
