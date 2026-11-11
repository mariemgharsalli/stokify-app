import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconMapPin,
  IconSparkles,
} from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import { FADE_UP, IA, STAGGER } from "../../ai/moduleIaTheme";
import {
  ABC_COPY,
  SIMPLE_COPY,
  abcMeta,
  formatPickGain,
  formatTrip,
  isPriorityMove,
  moveTitle,
  reliabilityFromConfidence,
  whyRecommendation,
} from "./slottingCopy";

const EASE = [0.22, 1, 0.36, 1];

const RELIABILITY_TONE = {
  high: "var(--accent-success)",
  medium: "var(--accent-info)",
  low: "var(--accent-warning)",
};

const ABC_TONE = {
  A: "var(--accent-warning)",
  B: "var(--accent-info)",
  C: "var(--text-muted)",
};

export function SlottingViewToggle({ mode, onChange }) {
  const reduceMotion = useReducedMotion();
  const options = [
    { id: "simple", label: SIMPLE_COPY.viewSimple },
    { id: "expert", label: SIMPLE_COPY.viewExpert },
  ];

  return (
    <div
      className="inline-flex rounded-xl border p-1"
      style={{
        background: IA.bgCard,
        borderColor: IA.border,
        boxShadow: "var(--shadow-card)",
      }}
      role="group"
      aria-label="Mode d'affichage"
    >
      {options.map((opt) => {
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className="relative rounded-lg px-3 py-1.5 text-[11px] font-semibold transition"
            style={{
              color: active ? IA.onAccent : IA.muted,
              background: active ? "transparent" : "transparent",
            }}
            aria-pressed={active}
          >
            {active && !reduceMotion ? (
              <motion.span
                layoutId="slotting-view-toggle"
                className="absolute inset-0 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${IA.accent}, var(--accent-info))`,
                  boxShadow: `0 8px 16px -10px ${IA.accent}`,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : active ? (
              <span
                className="absolute inset-0 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${IA.accent}, var(--accent-info))`,
                }}
              />
            ) : null}
            <span className="relative z-[1]">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SlottingAbcBadge({ abcClass, size = "md" }) {
  const reduceMotion = useReducedMotion();
  const meta = abcMeta(abcClass);
  const tone = ABC_TONE[meta.letter] || ABC_TONE.C;
  const dim = size === "lg" ? "h-12 w-12 text-xl" : "h-8 w-8 text-sm";

  return (
    <span className="group relative inline-flex shrink-0">
      <motion.span
        className={`inline-flex ${dim} items-center justify-center rounded-xl border font-black tracking-tight`}
        style={{
          color: meta.letter === "C" ? IA.text : IA.onAccent,
          background:
            meta.letter === "C"
              ? `linear-gradient(135deg, ${IA.fill}, ${IA.border})`
              : `linear-gradient(135deg, ${tone}, color-mix(in srgb, ${tone} 70%, white))`,
          borderColor: tone,
        }}
        aria-label={meta.hint}
        initial={reduceMotion ? false : { scale: 0.55, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={reduceMotion ? undefined : { scale: 1.08 }}
        transition={{ type: "spring", stiffness: 420, damping: 16 }}
      >
        {meta.letter}
      </motion.span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-52 -translate-x-1/2 rounded-xl px-3 py-2 text-center text-[11px] leading-snug opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
        style={{
          background: "var(--bg-modal)",
          color: IA.text,
          border: `1px solid ${IA.border}`,
        }}
      >
        {meta.hint}
      </span>
    </span>
  );
}

export function SlottingReliabilityBadge({ confidence }) {
  const rel = reliabilityFromConfidence(confidence);
  const tone = RELIABILITY_TONE[rel.id];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
      style={{
        color: tone,
        background: `color-mix(in srgb, ${tone} 16%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
      {SIMPLE_COPY.reliability} {rel.label}
    </span>
  );
}

export function SlottingBeforeAfter({
  currentCode,
  recommendedCode,
  currentDistance,
  recommendedDistance,
  optimal = false,
}) {
  const reduceMotion = useReducedMotion();
  const trip = formatTrip(currentDistance, recommendedDistance);
  const accent = optimal ? "var(--accent-success)" : IA.accent;

  return (
    <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
      <div
        className="rounded-xl border border-dashed px-3 py-2.5"
        style={{ borderColor: IA.border, background: IA.bgElevated }}
      >
        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: IA.muted }}>
          {SIMPLE_COPY.currentSlot}
        </p>
        <p className="mt-0.5 font-mono text-sm font-bold" style={{ color: IA.text }}>
          {currentCode || "—"}
        </p>
      </div>

      <motion.span
        className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-white"
        style={{
          background: `linear-gradient(145deg, ${accent}, var(--accent-info))`,
          boxShadow: `0 10px 18px -10px ${accent}`,
        }}
        animate={optimal || reduceMotion ? undefined : { x: [0, 4, 0] }}
        transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
        aria-hidden
      >
        {optimal ? <IconCheck size={16} /> : <IconArrowRight size={16} />}
      </motion.span>

      <div
        className="rounded-xl border px-3 py-2.5"
        style={{
          borderColor: `color-mix(in srgb, ${accent} 42%, ${IA.border})`,
          background: `color-mix(in srgb, ${accent} 12%, transparent)`,
        }}
      >
        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: IA.muted }}>
          {optimal ? SIMPLE_COPY.alreadyOptimalTitle : SIMPLE_COPY.recommendedSlot}
        </p>
        <p className="mt-0.5 font-mono text-sm font-bold" style={{ color: accent }}>
          {recommendedCode || "—"}
        </p>
      </div>

      {trip ? (
        <p
          className="col-span-full text-center text-[11px] leading-relaxed"
          style={{ color: IA.textSecondary }}
        >
          {trip.sentence}
        </p>
      ) : null}
    </div>
  );
}

export function SlottingRecommendationCard({
  row,
  canWrite = false,
  applying = false,
  onApply,
  onHover,
}) {
  const reduceMotion = useReducedMotion();
  const abc = abcMeta(row.abcClass);
  const impact = formatPickGain(row.estimatedPickGainSec);
  const why = whyRecommendation(row);
  const title = moveTitle({
    articleCode: row.articleCode,
    articleLibelle: row.articleLibelle,
    currentCode: row.currentEmplacementCode,
    recommendedCode: row.recommendedEmplacementCode,
  });
  const accent = row.isOptimal ? "var(--accent-success)" : IA.accent;
  const destId = row.recommendedEmplacementId || row.emplacementId;

  return (
    <motion.article
      layout
      className="group relative overflow-hidden rounded-2xl p-4"
      style={{
        background: IA.bgCard,
        border: `1px solid ${IA.border}`,
        borderLeft: `3px solid ${accent}`,
        boxShadow: "var(--shadow-card)",
      }}
      variants={FADE_UP}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -6,
              boxShadow: `0 18px 36px -16px ${accent}66`,
              transition: { duration: 0.22, ease: EASE },
            }
      }
      onMouseEnter={() => onHover?.(row)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(row)}
      onBlur={() => onHover?.(null)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}22, transparent 55%)`,
        }}
        aria-hidden
      />
      <IconMapPin
        className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 opacity-[0.07] transition-transform duration-500 group-hover:scale-110"
        style={{ color: accent }}
        stroke={1}
        aria-hidden
      />

      <div className="relative z-[1] space-y-3.5">
        <div className="flex items-start gap-3">
          <SlottingAbcBadge abcClass={row.abcClass} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug" style={{ color: IA.text, fontFamily: IA.fontTitle }}>
              {title}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: IA.muted }}>
              {abc.short}
              {row.rotationLabel ? ` · ${ABC_COPY[row.abcClass]?.zone || abc.zone}` : ""}
            </p>
          </div>
          <SlottingReliabilityBadge confidence={row.confidence} />
        </div>

        <SlottingBeforeAfter
          currentCode={row.currentEmplacementCode}
          recommendedCode={row.recommendedEmplacementCode}
          currentDistance={row.currentEmplacementDistance}
          recommendedDistance={row.recommendedDistance}
          optimal={row.isOptimal}
        />

        <div
          className="rounded-xl px-3 py-2.5"
          style={{ background: IA.fill, border: `1px solid ${IA.border}` }}
        >
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: IA.muted }}>
            {SIMPLE_COPY.whyLabel}
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: IA.textSecondary }}>
            {why}
          </p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: IA.muted }}>
              Impact
            </p>
            <p
              className="text-2xl font-black tabular-nums tracking-tight"
              style={{ color: impact.value > 0 ? "var(--accent-success)" : IA.text }}
            >
              {impact.value > 0 ? impact.headline : "—"}
            </p>
            <p className="max-w-xs text-[11px] leading-snug" style={{ color: IA.textSecondary }}>
              {impact.sentence}
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              color: IA.accent,
              background: IA.accentDim,
            }}
          >
            <IconClock size={13} />
            {SIMPLE_COPY.kpiPickGain}
          </span>
        </div>

        {canWrite && onApply && !row.isOptimal ? (
          <button
            type="button"
            onClick={() => onApply(destId, row)}
            disabled={applying}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition hover:brightness-110 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${IA.accent}, var(--accent-info))`,
              color: IA.onAccent,
              boxShadow: `0 10px 22px -12px ${IA.accent}`,
            }}
          >
            {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <IconArrowRight size={14} />}
            {SIMPLE_COPY.apply}
          </button>
        ) : null}
      </div>
    </motion.article>
  );
}

export function SlottingPriorityBoard({
  items = [],
  canWrite,
  applying = false,
  onApply,
  onHover,
  emptyPriority = SIMPLE_COPY.noPriority,
  emptyOptional = SIMPLE_COPY.noOptional,
}) {
  const reduceMotion = useReducedMotion();
  const { priority, optional } = useMemo(() => {
    const p = [];
    const o = [];
    for (const row of items) {
      if (row.isOptimal) continue;
      if (isPriorityMove(row)) p.push(row);
      else o.push(row);
    }
    return { priority: p, optional: o };
  }, [items]);

  const [tab, setTab] = useState("priority");
  const list = tab === "priority" ? priority : optional;
  const empty = tab === "priority" ? emptyPriority : emptyOptional;

  const tabs = [
    { id: "priority", label: SIMPLE_COPY.priorityTab, count: priority.length },
    { id: "optional", label: SIMPLE_COPY.optionalTab, count: optional.length },
  ];

  return (
    <div className="space-y-3">
      <div
        className="inline-flex flex-wrap gap-1 rounded-2xl border p-1"
        style={{ background: IA.bgCard, borderColor: IA.border }}
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="rounded-xl px-3.5 py-2 text-[12px] font-semibold transition"
              style={{
                color: active ? IA.onAccent : IA.muted,
                background: active
                  ? `linear-gradient(135deg, ${IA.accent}, var(--accent-info))`
                  : "transparent",
                boxShadow: active ? `0 8px 16px -10px ${IA.accent}` : undefined,
              }}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums opacity-80">{t.count}</span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <p
          className="rounded-2xl px-4 py-10 text-center text-sm"
          style={{ border: `1px dashed ${IA.border}`, color: IA.muted }}
        >
          {empty}
        </p>
      ) : (
        <motion.div
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          variants={STAGGER}
          initial={reduceMotion ? false : "hidden"}
          animate="show"
        >
          {list.map((row, i) => (
            <SlottingRecommendationCard
              key={`${row.articleId || row.articleCode || "sku"}-${row.emplacementId || row.recommendedEmplacementId}-${i}`}
              row={row}
              canWrite={canWrite}
              applying={applying}
              onApply={onApply}
              onHover={onHover}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

export function SlottingSimpleKpis({ tiles = [] }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile, i) => {
        const Icon = tile.icon;
        const accent = tile.accent || IA.accent;
        return (
          <motion.div
            key={tile.label}
            initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: EASE }}
            whileHover={reduceMotion ? undefined : { y: -6, boxShadow: `0 18px 36px -16px ${accent}55` }}
            className="relative overflow-hidden rounded-2xl p-4"
            style={{
              background: IA.bgCard,
              border: `1px solid ${IA.border}`,
              borderLeft: `3px solid ${accent}`,
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: IA.muted }}>
                {tile.label}
              </p>
              {Icon ? (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                  style={{
                    background: `linear-gradient(145deg, ${accent}, var(--accent-info))`,
                    boxShadow: `0 8px 16px -10px ${accent}`,
                  }}
                >
                  <Icon size={16} stroke={2} />
                </span>
              ) : null}
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: accent }}>
              {tile.value}
              {tile.suffix ? (
                <span className="ml-0.5 text-sm font-semibold" style={{ color: IA.muted }}>
                  {tile.suffix}
                </span>
              ) : null}
            </p>
            {tile.hint ? (
              <p className="mt-1 text-[11px] leading-snug" style={{ color: IA.textSecondary }}>
                {tile.hint}
              </p>
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}

export function SlottingFlowSummary({ towardsDock = 0, towardsReserve = 0 }) {
  return (
    <div
      className="flex flex-wrap gap-2 rounded-2xl border px-4 py-3"
      style={{ background: IA.bgCard, borderColor: IA.border }}
    >
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
        style={{
          color: "var(--accent-warning)",
          background: "color-mix(in srgb, var(--accent-warning) 14%, transparent)",
        }}
      >
        <IconSparkles size={14} />
        {towardsDock} {SIMPLE_COPY.towardsDock}
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
        style={{
          color: IA.accent,
          background: IA.accentDim,
        }}
      >
        <IconMapPin size={14} />
        {towardsReserve} {SIMPLE_COPY.towardsReserve}
      </span>
    </div>
  );
}
