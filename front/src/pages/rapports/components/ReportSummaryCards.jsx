import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Receipt, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { formatMoney } from "../rapportUtils";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const CARDS = [
  {
    key: "ventesHT",
    label: "Ventes HT",
    accent: "var(--accent-primary)",
    Icon: TrendingUp,
    field: (s) => s?.ventes?.totalHT,
  },
  {
    key: "ventesTTC",
    label: "Ventes TTC",
    accent: "var(--accent-info, #378ADD)",
    Icon: Receipt,
    field: (s) => s?.ventes?.totalTTC,
  },
  {
    key: "achatsHT",
    label: "Achats HT",
    accent: "var(--accent-warning)",
    Icon: ShoppingCart,
    field: (s) => s?.achats?.totalHT,
  },
  {
    key: "marge",
    label: "Marge brute",
    accent: "var(--accent-success)",
    Icon: Wallet,
    field: (s) => s?.indicateurs?.margeBruteApproxHT,
  },
];

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

function KpiTile({ icon: Icon, label, value, hint, accent, index, reduceMotion, pulse }) {
  const animated = useAnimatedNumber(value, 1100);

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`group relative overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-4 ${
        pulse ? "rapport-kpi-pulse" : "border-[var(--border-default)]"
      }`}
      style={
        pulse
          ? {
              "--kpi-accent": accent,
              borderColor: `color-mix(in srgb, ${accent} 35%, var(--border-default))`,
            }
          : undefined
      }
    >
      <motion.span
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: accent }}
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.1 + index * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 10%, transparent) 0%, transparent 55%)` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.08] blur-2xl transition-opacity group-hover:opacity-[0.16]"
        style={{ background: accent }}
        aria-hidden
      />

      <div className="relative pl-2.5">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 16%, transparent), transparent)`,
              color: accent,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 24%, transparent)`,
            }}
          >
            <Icon size={20} strokeWidth={1.75} />
          </div>
          {hint ? (
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                color: accent,
              }}
            >
              {hint}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
        <p className="mt-0.5 font-display text-xl font-bold tabular-nums tracking-tight sm:text-2xl" style={{ color: accent }}>
          {formatMoney(animated)}
        </p>
        <motion.div
          className="mt-2.5 h-px origin-left"
          style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 45%, transparent), transparent)` }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.18 + index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />
      </div>
    </motion.div>
  );
}

export default function ReportSummaryCards({ summary, loading }) {
  const reduceMotion = useReducedMotion();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--bg-hover)]" />
        ))}
      </div>
    );
  }

  const marge = summary?.indicateurs?.margeBruteApproxHT ?? 0;
  const ventesHT = summary?.ventes?.totalHT ?? 0;
  const tauxMarge = ventesHT > 0 ? Math.round((marge / ventesHT) * 100) : 0;
  const varPct = summary?.evolutionVs?.variationPct;

  const hints = {
    ventesHT:
      varPct != null ? `${varPct >= 0 ? "+" : ""}${varPct}% vs préc.` : "période",
    ventesTTC: varPct != null ? `${varPct >= 0 ? "↑" : "↓"} ${Math.abs(varPct)}%` : "TTC",
    achatsHT: "achats",
    marge: `${tauxMarge}% taux`,
  };

  return (
    <>
      <style>{`
        @keyframes rapportKpiPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--kpi-accent) 18%, transparent); }
          50% { box-shadow: 0 0 22px 2px color-mix(in srgb, var(--kpi-accent) 28%, transparent); }
        }
        .rapport-kpi-pulse { animation: rapportKpiPulse 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rapport-kpi-pulse { animation: none !important; }
        }
      `}</style>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card, i) => (
          <KpiTile
            key={card.key}
            index={i}
            reduceMotion={reduceMotion}
            icon={card.Icon}
            label={card.label}
            value={card.field(summary) ?? 0}
            hint={hints[card.key]}
            accent={card.accent}
            pulse={card.key === "marge" && tauxMarge >= 50}
          />
        ))}
      </div>
    </>
  );
}
