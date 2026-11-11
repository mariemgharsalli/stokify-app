import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  ChevronDown,
  Cpu,
  Eye,
  Lightbulb,
  Minus,
  Radio,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useCountUp } from "../../../hooks/useCountUp";
import { FADE_UP, IA, formatRelativeTime } from "../moduleIaTheme";

const DETAIL_BLUE = "#378ADD";
const DETAIL_CYAN = "#0EA5E9";
const DETAIL_VIOLET = "#7F77DD";
const EASE = [0.22, 1, 0.36, 1];

const TYPE_META = {
  opportunite: {
    label: "Opportunité",
    color: DETAIL_CYAN,
    icon: Lightbulb,
  },
  risque: {
    label: "Risque",
    color: IA.red,
    icon: ShieldAlert,
  },
  tendance: {
    label: "Tendance",
    color: DETAIL_BLUE,
    icon: TrendingUp,
  },
};

const FILTERS = [
  { id: "all", label: "Tous" },
  { id: "risque", label: "Risques" },
  { id: "opportunite", label: "Opportunités" },
  { id: "tendance", label: "Tendances" },
];

const SORTS = [
  { id: "importance", label: "Priorité" },
  { id: "confidence", label: "Fiabilité" },
];

function ImpactBadge({ insight }) {
  const dir = insight.impactDirection || "neutral";
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const color = dir === "up" ? DETAIL_CYAN : dir === "down" ? IA.red : IA.muted;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: `${color}18`, color }}
    >
      <Icon size={11} />
      {insight.impact}
    </span>
  );
}

function ImportanceRing({ pct, color, size = 56, children }) {
  const reduceMotion = useReducedMotion();
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = Math.min(100, Math.max(0, pct));
  const offset = c - (value / 100) * c;
  const inner = size - stroke * 2 - 4;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="color-mix(in srgb, var(--text-primary) 10%, transparent)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduceMotion ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: EASE }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full"
        style={{
          width: inner,
          height: inner,
          background: IA.bgElevated,
          boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 10%, transparent)",
        }}
      >
        {children}
      </div>
      <span
        className="absolute -bottom-0.5 left-1/2 z-[1] -translate-x-1/2 rounded-md px-1.5 py-px text-[9px] font-bold tabular-nums text-white"
        style={{
          background: `linear-gradient(135deg, ${color}, ${DETAIL_CYAN})`,
          boxShadow: `0 2px 8px -2px ${color}99`,
        }}
      >
        {Math.round(value)}
      </span>
    </div>
  );
}

function InsightMesh({ color }) {
  const reduceMotion = useReducedMotion();
  const nodes = [
    [22, 28],
    [70, 16],
    [118, 32],
    [40, 68],
    [92, 62],
    [138, 78],
    [28, 110],
    [80, 118],
    [128, 108],
  ];
  const links = [
    [0, 1],
    [1, 2],
    [0, 3],
    [1, 4],
    [2, 5],
    [3, 4],
    [4, 5],
    [3, 6],
    [4, 7],
    [5, 8],
    [6, 7],
    [7, 8],
  ];
  return (
    <svg viewBox="0 0 160 140" className="h-full w-full" aria-hidden>
      {links.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a][0]}
          y1={nodes[a][1]}
          x2={nodes[b][0]}
          y2={nodes[b][1]}
          stroke={color}
          strokeWidth="0.7"
          opacity="0.28"
        />
      ))}
      {nodes.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r={i % 3 === 0 ? 2.6 : 1.7}
          fill={color}
          animate={reduceMotion ? undefined : { opacity: [0.25, 0.9, 0.25] }}
          transition={{ duration: 2.2 + (i % 4) * 0.3, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </svg>
  );
}

function MixBar({ summary }) {
  const total = Math.max(1, summary.total);
  const rows = [
    { key: "risques", n: summary.risques, color: IA.red },
    { key: "opportunités", n: summary.opportunités, color: DETAIL_CYAN },
    { key: "tendances", n: summary.tendances, color: DETAIL_BLUE },
  ];
  return (
    <div className="flex h-2 overflow-hidden rounded-full" style={{ background: IA.track }}>
      {rows.map((r) => (
        <motion.div
          key={r.key}
          className="h-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.round((r.n / total) * 100)}%` }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ background: r.color }}
        />
      ))}
    </div>
  );
}

function EngineKpi({ label, value, color, icon: Icon, index }) {
  const animated = useCountUp(value, 900);
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border p-3.5"
      style={{
        background: IA.bgCard,
        borderColor: IA.border,
        borderLeft: `3px solid ${color}`,
        boxShadow: "var(--shadow-card)",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.38, ease: EASE }}
      whileHover={reduceMotion ? undefined : { y: -4, boxShadow: `0 16px 32px -16px ${color}55` }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{ background: `radial-gradient(ellipse 70% 80% at 0% 0%, ${color}20, transparent 55%)` }}
        aria-hidden
      />
      <div className="relative z-[1] flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: IA.muted }}>
            {label}
          </p>
          <p className="mt-1 text-2xl font-black tabular-nums" style={{ color, fontFamily: IA.fontTitle }}>
            {Math.round(animated)}
          </p>
        </div>
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
          style={{
            background: `linear-gradient(145deg, ${color}, ${DETAIL_CYAN})`,
            boxShadow: `0 8px 16px -10px ${color}`,
          }}
        >
          <Icon size={16} />
        </span>
      </div>
    </motion.div>
  );
}

function InsightCard({ insight, index, onNavigate, featured = false }) {
  const [open, setOpen] = useState(featured || index === 0);
  const reduceMotion = useReducedMotion();
  const meta = TYPE_META[insight.type] || TYPE_META.tendance;
  const TypeIcon = meta.icon;
  const color = meta.color;
  const importance = Number(insight.importance) || 50;
  const confidence = Number(insight.confidence) || 0;
  const critical = insight.type === "risque" && importance >= 80;
  const evidence = insight.evidence || [];
  const tags = insight.tags || [];

  return (
    <motion.article
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.28), duration: 0.38, ease: EASE }}
      whileHover={
        reduceMotion ? undefined : { y: -5, boxShadow: `0 20px 40px -18px ${color}66` }
      }
      className={`ia-studio-card group relative flex h-full flex-col overflow-hidden rounded-2xl ${
        featured ? "sm:flex-row" : ""
      }`}
      style={{
        "--insight-accent": color,
        "--card-accent": color,
        background: IA.bgCard,
        border: `1px solid ${IA.border}`,
        borderLeft: `3px solid ${color}`,
        boxShadow: featured ? `0 18px 40px -22px ${color}77` : "var(--shadow-card)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-55 transition-opacity duration-300 group-hover:opacity-95"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${color}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${DETAIL_CYAN}12, transparent 50%)`,
        }}
        aria-hidden
      />
      <div className="insight-engine-scan pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden />
      <TypeIcon
        className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 opacity-[0.06] transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.12]"
        style={{ color }}
        strokeWidth={1}
        aria-hidden
      />

      <div className={`relative z-[1] flex flex-1 flex-col p-4 ${featured ? "sm:p-5" : ""}`}>
        <div className="flex items-start gap-3">
          <ImportanceRing pct={importance} color={color} size={featured ? 72 : 56}>
            <TypeIcon size={featured ? 22 : 18} style={{ color }} />
          </ImportanceRing>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] tabular-nums" style={{ color: IA.muted }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className="relative rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ background: `${color}22`, color }}
              >
                {critical ? (
                  <span
                    className="insight-live-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                    style={{ background: color }}
                    aria-hidden
                  />
                ) : null}
                {meta.label}
              </span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                style={{ background: IA.fill, color: IA.muted }}
              >
                Priorité {insight.priority || "moyenne"}
              </span>
              <ImpactBadge insight={insight} />
            </div>

            <h3
              className={`mt-1.5 font-bold leading-snug ${featured ? "text-lg sm:text-xl" : "text-sm"}`}
              style={{ fontFamily: IA.fontTitle, color: IA.text }}
            >
              {insight.titre}
            </h3>
            <p
              className={`mt-1 leading-relaxed ${featured ? "text-[13px]" : "line-clamp-2 text-[12px]"}`}
              style={{ color: IA.textSecondary }}
            >
              {insight.description}
            </p>
          </div>
        </div>

        <div className="relative mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex justify-between text-[10px]">
              <span style={{ color: IA.muted }}>Priorité</span>
              <span className="font-mono font-semibold" style={{ color }}>
                {importance}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full" style={{ background: IA.track }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${color}, ${DETAIL_CYAN})` }}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${importance}%` }}
                transition={{ duration: 0.7, ease: EASE }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[10px]">
              <span style={{ color: IA.muted }}>Fiabilité</span>
              <span className="font-mono font-semibold" style={{ color: DETAIL_CYAN }}>
                {confidence}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full" style={{ background: IA.track }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${DETAIL_VIOLET}, ${DETAIL_CYAN})` }}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${confidence}%` }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
              />
            </div>
          </div>
        </div>

        {tags.length ? (
          <div className="relative mt-3 flex flex-wrap gap-1">
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide"
                style={{
                  color: IA.textSecondary,
                  background: IA.fill,
                  boxShadow: `inset 0 0 0 1px ${IA.border}`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {evidence.length ? (
          <ul className="relative mt-3 space-y-1">
            {evidence.slice(0, open ? 6 : featured ? 4 : 2).map((ev) => (
              <li key={ev} className="flex items-start gap-2 text-[11px]" style={{ color: IA.textSecondary }}>
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                {ev}
              </li>
            ))}
          </ul>
        ) : null}

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="relative mt-3 space-y-2 border-t pt-3" style={{ borderColor: IA.border }}>
                {insight.methodology ? (
                  <p
                    className="rounded-xl px-3 py-2 text-[11px] leading-relaxed"
                    style={{ background: IA.fill, color: IA.muted }}
                  >
                    <span className="font-semibold" style={{ color: IA.textSecondary }}>
                      Méthode ·{" "}
                    </span>
                    {insight.methodology}
                  </p>
                ) : null}
                {insight.detail ? (
                  <p className="text-[12px] leading-relaxed" style={{ color: IA.textSecondary }}>
                    {insight.detail}
                  </p>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="relative mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold"
            style={{ color: IA.muted }}
          >
            {open ? "Réduire" : "Voir plus"}
            <ChevronDown
              size={13}
              style={{
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform .2s",
              }}
            />
          </button>

          {insight.cta?.tab ? (
            <motion.button
              type="button"
              onClick={() => onNavigate?.(insight.cta.tab)}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white"
              style={{
                background: `linear-gradient(135deg, ${color}, ${DETAIL_CYAN})`,
                boxShadow: `0 8px 16px -8px ${color}99`,
              }}
              whileHover={reduceMotion ? undefined : { scale: 1.03, y: -1 }}
            >
              <Eye className="h-3 w-3" />
              {insight.cta.label || "Voir détail"}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white"
              style={{
                background: `linear-gradient(135deg, ${DETAIL_BLUE}, ${DETAIL_CYAN})`,
                boxShadow: "0 8px 16px -8px #378ADD99",
              }}
              whileHover={reduceMotion ? undefined : { scale: 1.03, y: -1 }}
            >
              <Eye className="h-3 w-3" />
              Voir détail
            </motion.button>
          )}
        </div>
      </div>

      {featured ? (
        <div
          className="relative hidden w-[200px] shrink-0 border-l sm:block"
          style={{ borderColor: IA.border }}
        >
          <div className="absolute inset-0 p-3 opacity-80">
            <InsightMesh color={color} />
          </div>
        </div>
      ) : null}
    </motion.article>
  );
}

function EngineHero({ summary, pulse, updatedAt, compact }) {
  const reduceMotion = useReducedMotion();
  const accent = pulse >= 70 ? IA.red : pulse >= 45 ? DETAIL_VIOLET : DETAIL_CYAN;

  return (
    <motion.header
      className="relative overflow-hidden rounded-2xl border"
      style={{
        background: IA.bgCard,
        borderColor: IA.border,
        borderLeft: `3px solid ${accent}`,
        boxShadow: "var(--shadow-card)",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: EASE }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 90% at 0% 0%, ${accent}22, transparent 55%), radial-gradient(ellipse 45% 70% at 100% 0%, ${DETAIL_CYAN}16, transparent 50%)`,
        }}
        aria-hidden
      />
      <div className="insight-engine-scan pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden />

      <div className={`relative z-[1] flex gap-4 ${compact ? "p-4" : "p-4 sm:p-5"}`}>
        <motion.div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white sm:h-14 sm:w-14"
          style={{
            background: `linear-gradient(145deg, ${DETAIL_VIOLET}, ${DETAIL_CYAN})`,
            boxShadow: `0 14px 28px -12px ${DETAIL_VIOLET}aa`,
          }}
          animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <BrainCircuit size={24} strokeWidth={1.75} />
        </motion.div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ color: DETAIL_VIOLET }}
            >
              <Sparkles size={11} className="ai-hero-sparkle" />
              Radar métier
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{
                color: accent,
                background: `color-mix(in srgb, ${accent} 16%, transparent)`,
              }}
            >
              <span className="ai-hero-live-dot h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
              En direct
            </span>
          </div>
          <h2
            className={`font-extrabold leading-tight tracking-tight ${compact ? "text-xl" : "text-[1.45rem] sm:text-[1.75rem]"}`}
            style={{ fontFamily: IA.fontTitle }}
          >
            <span style={{ color: IA.text }}>Recommandations du </span>
            <span
              className="ai-hero-word"
              style={{
                backgroundImage: `linear-gradient(115deg, ${DETAIL_VIOLET}, ${DETAIL_CYAN}, ${DETAIL_VIOLET})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              moment
            </span>
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed" style={{ color: IA.textSecondary }}>
            {summary.total} {summary.total > 1 ? "signaux" : "signal"} fusionnés — risques, opportunités et
            tendances, classés par priorité. Mis à jour {formatRelativeTime(updatedAt)}.
          </p>
          {!compact ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Stock", "Risques", "Opportunités", "Tendances"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    color: IA.textSecondary,
                    background: "var(--bg-input)",
                    boxShadow: "inset 0 0 0 1px var(--border-default)",
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {!compact ? (
          <div className="hidden h-24 w-36 shrink-0 opacity-80 lg:block">
            <InsightMesh color={accent} />
          </div>
        ) : null}
      </div>
    </motion.header>
  );
}

export default function ModuleIAInsightsSection({
  insights = [],
  updatedAt,
  onNavigate,
  compact = false,
}) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("importance");
  const [query, setQuery] = useState("");

  const summary = useMemo(() => {
    const risques = insights.filter((i) => i.type === "risque").length;
    const opportunités = insights.filter((i) => i.type === "opportunite").length;
    const tendances = insights.filter((i) => i.type === "tendance").length;
    const pulse = insights.length
      ? Math.round(insights.reduce((s, i) => s + (Number(i.importance) || 0), 0) / insights.length)
      : 0;
    return { risques, opportunités, tendances, total: insights.length, pulse };
  }, [insights]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = filter === "all" ? [...insights] : insights.filter((i) => i.type === filter);
    if (q) {
      list = list.filter((i) => {
        const hay = `${i.titre || ""} ${i.description || ""} ${(i.tags || []).join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
    }
    list.sort((a, b) => {
      if (sort === "confidence") return (b.confidence || 0) - (a.confidence || 0);
      return (b.importance || 0) - (a.importance || 0);
    });
    return compact ? list.slice(0, 4) : list;
  }, [insights, filter, sort, query, compact]);

  const featured = !compact && filtered[0] ? filtered[0] : null;
  const rest = featured ? filtered.slice(1) : filtered;
  const counts = {
    all: insights.length,
    risque: summary.risques,
    opportunite: summary.opportunités,
    tendance: summary.tendances,
  };

  return (
    <motion.section
      variants={FADE_UP}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className="space-y-4"
    >
      <EngineHero summary={summary} pulse={summary.pulse} updatedAt={updatedAt} compact={compact} />

      {!compact ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <EngineKpi label="Signaux" value={summary.total} color={DETAIL_VIOLET} icon={Cpu} index={0} />
          <EngineKpi label="Risques" value={summary.risques} color={IA.red} icon={ShieldAlert} index={1} />
          <EngineKpi
            label="Opportunités"
            value={summary.opportunités}
            color={DETAIL_CYAN}
            icon={Zap}
            index={2}
          />
          <EngineKpi label="Tendances" value={summary.tendances} color={DETAIL_BLUE} icon={Radio} index={3} />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <MixBar summary={summary} />
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              const meta = TYPE_META[f.id];
              const color = f.id === "all" ? DETAIL_VIOLET : meta?.color || DETAIL_CYAN;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition"
                  style={{
                    color: active ? "#fff" : "var(--text-secondary)",
                    background: active ? `linear-gradient(135deg, ${color}, ${DETAIL_CYAN})` : "var(--bg-input)",
                    boxShadow: active ? `0 8px 16px -10px ${color}` : "inset 0 0 0 1px var(--border-default)",
                  }}
                >
                  {f.label}
                  <span className="font-mono text-[10px] opacity-80">{counts[f.id] || 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl p-1" style={{ background: IA.bgElevated, border: `1px solid ${IA.border}` }}>
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                className="rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                style={
                  sort === s.id
                    ? { background: "rgba(55,138,221,0.18)", color: DETAIL_CYAN }
                    : { color: IA.muted }
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          {!compact ? (
            <label className="relative block w-full sm:w-48">
              <Search
                size={13}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: IA.muted }}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer un signal…"
                className="w-full rounded-xl py-2 pl-8 pr-3 text-[12px] outline-none"
                style={{
                  background: IA.bgElevated,
                  border: `1px solid ${IA.border}`,
                  color: IA.text,
                }}
              />
            </label>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="relative overflow-hidden rounded-2xl border px-6 py-12 text-center"
          style={{ background: IA.bgCard, borderColor: IA.border }}
        >
          <div className="mx-auto mb-3 h-16 w-28 opacity-70">
            <InsightMesh color={DETAIL_VIOLET} />
          </div>
          <p className="text-sm font-medium" style={{ color: IA.textSecondary }}>
            Rien à signaler pour ce filtre
          </p>
          <p className="mt-1 text-xs" style={{ color: IA.muted }}>
            Aucune recommandation pour ce filtre. Enrichissez ventes, stocks ou anomalies pour relancer le radar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {featured ? (
            <InsightCard insight={featured} index={0} onNavigate={onNavigate} featured />
          ) : null}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {rest.map((insight, i) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                index={featured ? i + 1 : i}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      )}

      {compact && insights.length > 4 ? (
        <div className="text-right">
          <button
            type="button"
            onClick={() => onNavigate?.("insights")}
            className="inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: DETAIL_CYAN }}
          >
            Voir toutes les recommandations ({insights.length})
            <ArrowRight size={13} />
          </button>
        </div>
      ) : null}
    </motion.section>
  );
}
