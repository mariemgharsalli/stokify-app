import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { DASHBOARD_TONES } from "./dashboardTones";
import { useLandingLang } from "../../landing/LandingLangContext";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

function useAnimatedNumber(target, duration = 1100) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (target == null || Number.isNaN(Number(target))) {
      setValue(0);
      return undefined;
    }
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

function MiniSpark({ values = [], color }) {
  if (!values.length) return null;
  const w = 88;
  const h = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const last = values[values.length - 1];
  const lastX = w;
  const lastY = h - ((last - min) / span) * (h - 4) - 2;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
        opacity="0.9"
      />
      <circle cx={lastX} cy={lastY} r="2.4" fill={color} />
    </svg>
  );
}

function StatCardSkeleton({ index = 0 }) {
  return (
    <div className="dash-glass-card p-4" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="mb-4 h-11 w-11 animate-pulse rounded-2xl bg-[var(--bg-hover)]" />
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--bg-hover)]" />
        <div className="h-8 w-16 animate-pulse rounded bg-[var(--bg-hover)]" />
        <div className="h-2.5 w-20 animate-pulse rounded bg-[var(--bg-hover)]" />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  numericValue,
  hint,
  tone = "primary",
  trend,
  index = 0,
  sub,
  pulse = false,
  spark,
}) {
  const toneMeta = DASHBOARD_TONES[tone] ?? DASHBOARD_TONES.primary;
  const accent = toneMeta.accent;
  const chart = toneMeta.chart;
  const reduceMotion = useReducedMotion();
  const { t } = useLandingLang();
  const localeTag = t.localeTag || "fr-FR";
  const canAnimate = numericValue != null && !Number.isNaN(Number(numericValue));
  const animated = useAnimatedNumber(canAnimate ? numericValue : 0, 1100);
  const display = canAnimate
    ? Math.round(animated * 100) / 100 === Math.round(animated)
      ? Math.round(animated).toLocaleString(localeTag)
      : animated.toLocaleString(localeTag, { maximumFractionDigits: 2 })
    : value;

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={reduceMotion ? undefined : { y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`group relative overflow-hidden rounded-[1.25rem] border bg-[var(--dash-glass)] p-4 backdrop-blur-xl ${
        pulse ? "dash-kpi-pulse" : ""
      }`}
      style={{
        "--kpi-accent": accent,
        borderColor: pulse
          ? `color-mix(in srgb, ${accent} 38%, var(--dash-line))`
          : "var(--dash-line)",
        boxShadow: "var(--dash-shadow)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-70"
        style={{ background: chart }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${chart}, transparent)` }}
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 22%, transparent), transparent)`,
              color: accent,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 28%, transparent)`,
            }}
          >
            <Icon size={20} strokeWidth={1.75} />
          </div>
          {trend != null && trend !== "" ? (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                color: accent,
              }}
            >
              <ArrowUpRight className="h-3 w-3" />
              {trend}
            </span>
          ) : hint ? (
            <span className="rounded-lg bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              {hint}
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {label}
        </p>
        <p className="mt-0.5 font-display text-[1.65rem] font-bold tabular-nums tracking-tight" style={{ color: accent }}>
          {display}
        </p>

        <div className="mt-2 flex items-end justify-between gap-2">
          {sub ? <div className="text-xs text-[var(--text-secondary)]">{sub}</div> : <span />}
          {spark?.length ? <MiniSpark values={spark} color={chart} /> : null}
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardStatCards({ cards, loadingIndices = [] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
      {cards.map((card, index) =>
        loadingIndices.includes(index) ? (
          <StatCardSkeleton key={card.key ?? index} index={index} />
        ) : (
          <StatCard key={card.key ?? index} {...card} index={index} />
        )
      )}
    </div>
  );
}

export { StatCardSkeleton };
