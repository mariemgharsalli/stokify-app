import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Ban, CheckCircle, Users } from "lucide-react";

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

const ITEMS = [
  {
    key: "actifs",
    label: "Actifs",
    hint: "en ligne",
    Icon: CheckCircle,
    accent: "#1D9E75",
  },
  {
    key: "total",
    label: "Total",
    hint: "registre",
    Icon: Users,
    accent: "#378ADD",
  },
  {
    key: "inactifs",
    label: "Désactivés",
    hint: "archivés",
    Icon: Ban,
    accent: "#E24B4A",
    pulseKey: true,
  },
];

function TierKpiTile({ item, value, index, reduceMotion, pulse }) {
  const animated = useAnimatedNumber(value, 1100);
  const display = Math.round(animated).toLocaleString("fr-FR");
  const Icon = item.Icon;

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`group relative overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-4 ${
        pulse ? "tier-kpi-pulse" : "border-[var(--border-default)]"
      }`}
      style={
        pulse
          ? {
              "--kpi-accent": item.accent,
              borderColor: `color-mix(in srgb, ${item.accent} 35%, var(--border-default))`,
            }
          : undefined
      }
    >
      <motion.span
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: item.accent }}
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.1 + index * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${item.accent} 10%, transparent) 0%, transparent 55%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.07] blur-2xl transition-opacity group-hover:opacity-[0.14]"
        style={{ background: item.accent }}
        aria-hidden
      />

      <div className="relative pl-2.5">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, ${item.accent} 16%, transparent), transparent)`,
              color: item.accent,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${item.accent} 24%, transparent)`,
            }}
          >
            <Icon size={20} strokeWidth={1.75} />
          </div>
          <span className="rounded-md bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
            {item.hint}
          </span>
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {item.label}
        </p>
        <p
          className="mt-0.5 font-display text-2xl font-bold tabular-nums tracking-tight"
          style={{ color: item.accent }}
        >
          {display}
        </p>
        <motion.div
          className="mt-2.5 h-px origin-left"
          style={{
            background: `linear-gradient(90deg, color-mix(in srgb, ${item.accent} 45%, transparent), transparent)`,
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

/** Cartes KPI style Ventes — barre latérale, icône, badge, valeur animée */
export default function TierKpiStrip({ actifs = 0, total = 0, inactifs = 0 }) {
  const reduceMotion = useReducedMotion();
  const values = { actifs, total, inactifs };

  return (
    <>
      <style>{`
        @keyframes tierKpiPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--kpi-accent) 18%, transparent); }
          50% { box-shadow: 0 0 22px 2px color-mix(in srgb, var(--kpi-accent) 28%, transparent); }
        }
        .tier-kpi-pulse { animation: tierKpiPulse 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .tier-kpi-pulse { animation: none !important; }
        }
        .tier-kpi-strip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }
        @media (max-width: 640px) {
          .tier-kpi-strip { grid-template-columns: 1fr; }
        }
      `}</style>
      <div className="tier-kpi-strip">
        {ITEMS.map((item, i) => (
          <TierKpiTile
            key={item.key}
            item={item}
            value={values[item.key] ?? 0}
            index={i}
            reduceMotion={reduceMotion}
            pulse={item.pulseKey && Number(values.inactifs) > 0}
          />
        ))}
      </div>
    </>
  );
}
