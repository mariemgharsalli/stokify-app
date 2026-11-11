import { motion, useReducedMotion } from "framer-motion";
import {
  IconActivity,
  IconAffiliate,
  IconArrowNarrowLeft,
  IconArrowNarrowRight,
  IconArrowRight,
  IconBrain,
  IconChartHistogram,
  IconCircleCheck,
  IconLayoutGrid,
  IconMapPin,
  IconMinus,
  IconSparkles,
} from "@tabler/icons-react";
import { getArticleRealImageUrl } from "../../../utils/articleImage";

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  gold: "#BA7517",
  success: "#1D9E75",
  warning: "#EF9F27",
  muted: "var(--text-muted)",
};

const EASE = [0.22, 1, 0.36, 1];

const ARC = [
  { key: "A", color: THEME.gold },
  { key: "B", color: THEME.accent },
  { key: "C", color: "#94a3b8" },
];

function polar(cx, cy, r, angle) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, start, end) {
  if (end - start >= 359.9) {
    const a = polar(cx, cy, r, start);
    const b = polar(cx, cy, r, start + 180);
    return `M ${a.x} ${a.y} A ${r} ${r} 0 1 1 ${b.x} ${b.y} A ${r} ${r} 0 1 1 ${a.x} ${a.y}`;
  }
  const large = end - start > 180 ? 1 : 0;
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function GmmDonut({ posterior, abcClass, confidence, size = 156 }) {
  const reduce = useReducedMotion();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const values = ARC.map((a) => Math.max(0, Number(posterior?.[a.key]) || 0));
  const sum = values.reduce((s, v) => s + v, 0) || 1;
  let cursor = 0;
  const slices = ARC.map((a, i) => {
    const sweep = (values[i] / sum) * 360;
    const start = cursor;
    cursor += sweep;
    return { ...a, start, end: start + sweep, pct: Math.round((values[i] / sum) * 100) };
  });
  const winner = abcClass || "C";
  const conf = Math.max(0, Math.min(100, Number(confidence) || 0));
  const confCirc = 2 * Math.PI * (r + 7);
  const confOffset = confCirc * (1 - conf / 100);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={cx}
          cy={cy}
          r={r + 7}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth="3"
        />
        <motion.circle
          cx={cx}
          cy={cy}
          r={r + 7}
          fill="none"
          stroke={THEME.cyan}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={confCirc}
          initial={reduce ? false : { strokeDashoffset: confCirc }}
          animate={{ strokeDashoffset: confOffset }}
          transition={{ duration: 1.1, ease: EASE }}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-default)" strokeWidth="9" />
        {slices.map((s) =>
          s.end - s.start < 0.8 ? null : (
            <motion.path
              key={s.key}
              d={arcPath(cx, cy, r, s.start, s.end)}
              fill="none"
              stroke={s.color}
              strokeWidth={winner === s.key ? 11 : 8}
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.08 }}
            />
          )
        )}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: THEME.muted }}>
          GMM
        </span>
        <span className="text-3xl font-black tabular-nums tracking-tight" style={{ color: THEME.gold }}>
          {winner}
        </span>
        <span className="text-[10px] tabular-nums text-[var(--text-muted)]">
          P={Math.round((Number(posterior?.[winner]) || 0) * 100)}%
        </span>
      </div>
    </div>
  );
}

function PipelineStep({ step, index }) {
  const ok = step.status === "ok";
  const fallback = step.status === "fallback";
  const color = ok ? THEME.success : fallback ? THEME.warning : THEME.muted;
  return (
    <motion.div
      className="min-w-0 flex-1 rounded-xl border px-3 py-2.5"
      style={{
        borderColor: "var(--border-default)",
        background: `color-mix(in srgb, ${color} 8%, var(--bg-card))`,
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.35, ease: EASE }}
    >
      <div className="flex items-center gap-2">
        {ok ? (
          <IconCircleCheck size={14} style={{ color }} />
        ) : fallback ? (
          <IconActivity size={14} style={{ color }} />
        ) : (
          <IconMinus size={14} style={{ color }} />
        )}
        <p className="text-[11px] font-bold" style={{ color }}>
          {step.label}
        </p>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-[var(--text-secondary)]">{step.detail}</p>
    </motion.div>
  );
}

export function MlPipeline({ pipeline = [] }) {
  if (!pipeline.length) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      {pipeline.map((step, i) => (
        <PipelineStep key={step.id || i} step={step} index={i} />
      ))}
    </div>
  );
}

export function ClusterCensus({ census, quality }) {
  if (!census) return null;
  const rows = [
    { key: "A", n: census.A, color: THEME.gold },
    { key: "B", n: census.B, color: THEME.accent },
    { key: "C", n: census.C, color: "#94a3b8" },
  ];
  const total = Math.max(1, Number(census.n) || rows.reduce((s, r) => s + (r.n || 0), 0));
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Census catalogue · {census.n} SKU
        {quality?.maturity != null ? (
          <span className="ml-2 font-mono font-semibold normal-case tracking-normal" style={{ color: THEME.accent }}>
            maturité {quality.maturity}%
          </span>
        ) : null}
      </p>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--bg-input)]">
        {rows.map((r) => (
          <motion.div
            key={r.key}
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(((r.n || 0) / total) * 100)}%` }}
            transition={{ duration: 0.7, ease: EASE }}
            style={{ background: r.color }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-[var(--text-secondary)]">
        {rows.map((r) => (
          <span key={r.key}>
            <span className="font-bold" style={{ color: r.color }}>
              {r.key}
            </span>{" "}
            {r.n || 0}
          </span>
        ))}
        {quality?.silhouette != null ? (
          <span className="font-mono text-[var(--text-muted)]">sil {quality.silhouette}</span>
        ) : null}
        {quality?.certainty != null ? (
          <span className="font-mono text-[var(--text-muted)]">
            certitude {Math.round(quality.certainty * 100)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function AffinityOrbit({ neighbors = [] }) {
  if (!neighbors.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {neighbors.map((n, i) => {
        const src = getArticleRealImageUrl(n);
        return (
          <motion.div
            key={n.articleId}
            className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] py-1 pl-1 pr-3"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.32, ease: EASE }}
            title={n.libelle}
          >
            {src ? (
              <img src={src} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: THEME.accent }}
              >
                {(n.code || "?").slice(0, 2)}
              </span>
            )}
            <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)]">
              {n.code}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">×{n.count}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Radar 4 axes — score du meilleur emplacement. */
export function ScoreRadar({ radar, size = 148 }) {
  if (!radar) return null;
  const reduce = useReducedMotion();
  const axes = [
    { key: "proximity", label: "Distance", color: THEME.accent },
    { key: "zone", label: "Zone", color: THEME.cyan },
    { key: "capacity", label: "Capacité", color: THEME.success },
    { key: "affinity", label: "Affinité", color: THEME.gold },
  ];
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 22;
  const pts = axes.map((a, i) => {
    const angle = -90 + i * 90;
    const v = Math.max(0, Math.min(100, Number(radar[a.key]) || 0)) / 100;
    return polar(cx, cy, r * v, angle);
  });
  const poly = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const grid = [0.33, 0.66, 1].map((f) =>
    axes
      .map((_, i) => {
        const p = polar(cx, cy, r * f, -90 + i * 90);
        return `${p.x},${p.y}`;
      })
      .join(" ")
  );

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Radar de score">
        {grid.map((g) => (
          <polygon key={g} points={g} fill="none" stroke="var(--border-default)" strokeWidth="1" />
        ))}
        {axes.map((a, i) => {
          const tip = polar(cx, cy, r, -90 + i * 90);
          return (
            <line
              key={a.key}
              x1={cx}
              y1={cy}
              x2={tip.x}
              y2={tip.y}
              stroke="var(--border-default)"
              strokeWidth="1"
            />
          );
        })}
        <motion.polygon
          points={poly}
          fill={`${THEME.accent}33`}
          stroke={THEME.accent}
          strokeWidth="2"
          initial={reduce ? false : { opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: EASE }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
        {axes.map((a, i) => {
          const tip = polar(cx, cy, r + 12, -90 + i * 90);
          return (
            <text
              key={a.key}
              x={tip.x}
              y={tip.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={a.color}
              fontSize="9"
              fontWeight="700"
            >
              {a.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/** Mini-parcours pour l'audit (actuel → cible sur 0–100). */
export function PathSpark({ from, to }) {
  const a = Math.max(0, Math.min(100, Number(from) || 0));
  const b = Math.max(0, Math.min(100, Number(to) || 0));
  return (
    <div className="relative mt-1.5 h-1.5 w-28 rounded-full bg-[var(--bg-input)]" aria-hidden>
      <span
        className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
        style={{ left: `calc(${a}% - 4px)`, background: "#94a3b8" }}
      />
      <span
        className="absolute top-1/2 z-[1] h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-white"
        style={{ left: `calc(${b}% - 5px)`, background: THEME.accent }}
      />
    </div>
  );
}

/** Règle visuelle quai → fond avec marqueurs actuel / cible. */
export function JourneyRail({ fromDistance, toDistance, fromCode, toCode }) {
  const reduce = useReducedMotion();
  if (toDistance == null && fromDistance == null) return null;
  const from = Math.max(0, Math.min(100, Number(fromDistance ?? toDistance) || 0));
  const to = Math.max(0, Math.min(100, Number(toDistance ?? fromDistance) || 0));

  return (
    <div
      className="rounded-2xl border px-4 py-3.5"
      style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
    >
      <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <IconMapPin size={12} style={{ color: THEME.gold }} /> Quai
        </span>
        <span>Parcours ML</span>
        <span>Fond</span>
      </div>
      <div className="relative h-3 rounded-full bg-[var(--bg-input)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: "100%",
            background: `linear-gradient(90deg, ${THEME.gold}55, ${THEME.accent}33, transparent)`,
          }}
        />
        <motion.span
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white"
          style={{ background: THEME.muted, left: `calc(${from}% - 8px)` }}
          title={`Actuel ${fromCode || ""}`}
          initial={false}
        />
        <motion.span
          className="absolute top-1/2 z-[1] h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ background: THEME.accent, left: `calc(${to}% - 10px)` }}
          title={`Cible ${toCode || ""}`}
          initial={reduce ? false : { left: `calc(${from}% - 10px)` }}
          animate={{ left: `calc(${to}% - 10px)` }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-[var(--text-secondary)]">
        <span className="font-mono">
          {fromCode || "—"} · d={from}
        </span>
        <span className="inline-flex items-center gap-1 font-semibold" style={{ color: THEME.accent }}>
          <IconArrowRight size={12} />
          {toCode || "—"} · d={to}
        </span>
      </div>
    </div>
  );
}

export function WeightsBar({ weights }) {
  if (!weights) return null;
  const rows = [
    { key: "proximity", label: "Distance", color: THEME.accent },
    { key: "zone", label: "Zone", color: THEME.cyan },
    { key: "capacity", label: "Capacité", color: THEME.success },
    { key: "affinity", label: "Affinité", color: THEME.gold },
  ];
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--bg-input)]">
        {rows.map((r) => (
          <div
            key={r.key}
            title={`${r.label} ${weights[r.key] || 0}%`}
            style={{
              width: `${Math.max(0, Number(weights[r.key]) || 0)}%`,
              background: r.color,
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--text-muted)]">
        {rows.map((r) => (
          <span key={r.key} className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
            {r.label} {weights[r.key] || 0}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function SlottingStudio({ suggestion, abcBadge }) {
  const isMl = suggestion.mode !== "local" && !String(suggestion.modele || "").includes("local");
  const best = suggestion.suggestions?.[0];
  const radar = suggestion.radar
    ? suggestion.radar
    : best?.scoreBreakdown
      ? {
          proximity: best.scoreBreakdown.proximity,
          zone: best.scoreBreakdown.zoneAlignment,
          capacity: best.scoreBreakdown.capacity,
          affinity: best.scoreBreakdown.affinity,
        }
      : null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${isMl ? THEME.accent : THEME.warning}`,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(ellipse 45% 80% at 0% 0%, ${THEME.accent}18, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${THEME.gold}12, transparent 50%)`,
        }}
        aria-hidden
      />
      <div className="relative z-[1] space-y-5 p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_150px_150px]">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-start gap-3">
              {abcBadge}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-bold text-[var(--text-primary)]">
                    {suggestion.articleCode} — {suggestion.articleLibelle}
                  </p>
                  <span
                    className="rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide"
                    style={{
                      color: isMl ? THEME.accent : THEME.warning,
                      background: `color-mix(in srgb, ${isMl ? THEME.accent : THEME.warning} 16%, transparent)`,
                    }}
                  >
                    {isMl ? suggestion.modele || "gmm" : "local"}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                  {suggestion.depotLibelle ? `${suggestion.depotLibelle} · ` : ""}
                  {suggestion.sampleSize || suggestion.census?.n || "—"} SKU
                  {suggestion.cooccurrencePairs != null
                    ? ` · ${suggestion.cooccurrencePairs} paires`
                    : ""}
                </p>
              </div>
            </div>

            <MlPipeline pipeline={suggestion.pipeline} />
            <ClusterCensus census={suggestion.census} quality={suggestion.quality} />
            <WeightsBar weights={suggestion.weights} />

            {suggestion.affinityNeighbors?.length ? (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <IconSparkles size={12} style={{ color: THEME.gold }} />
                  Co-pickés
                </p>
                <AffinityOrbit neighbors={suggestion.affinityNeighbors} />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-center justify-center gap-1">
            <GmmDonut
              posterior={suggestion.posterior}
              abcClass={suggestion.abcClass}
              confidence={suggestion.confidence}
            />
            <p className="text-[10px] tabular-nums text-[var(--text-muted)]">
              confiance {suggestion.confidence ?? "—"}%
            </p>
          </div>

          <div className="flex flex-col items-center justify-center">
            <ScoreRadar radar={radar} />
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">radar du 1er choix</p>
          </div>
        </div>

        <JourneyRail
          fromDistance={suggestion.currentEmplacementDistance}
          toDistance={best?.distanceQuai}
          fromCode={suggestion.currentEmplacementCode}
          toCode={best?.code}
        />

        {suggestion.story?.length ? (
          <ul className="grid gap-1 sm:grid-cols-2">
            {suggestion.story.map((line) => (
              <li
                key={line}
                className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]"
              >
                <IconArrowRight size={12} className="mt-0.5 shrink-0" style={{ color: THEME.accent }} />
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export const SLOTTING_RULES = [
  {
    id: "gmm",
    title: "Mélange gaussien",
    model: "GaussianMixture · 3 classes",
    rule: "A/B/C latentes apprises sur rotation, cube-velocity, dollar-velocity et récence — pas des seuils 33/67.",
  },
  {
    id: "hgb",
    title: "Demande 90 jours",
    model: "HistGradientBoosting",
    rule: "Prévision leave-one-out de la rotation 90 j pour caler la distance cible au quai.",
  },
  {
    id: "affinity",
    title: "Affinité co-picking",
    model: "Co-occurrence ventes",
    rule: "Les SKU vendus ensemble gagnent du score s'ils occupent des emplacements voisins.",
  },
  {
    id: "zone",
    title: "Politique de zone",
    model: "Posterior × zone",
    rule: "A → picking (d≤33), B → mixte (34–66), C → réserve (≥67). Chimie incompatible et slots pleins exclus.",
  },
];

const RULE_ICONS = {
  gmm: IconBrain,
  hgb: IconChartHistogram,
  affinity: IconAffiliate,
  zone: IconLayoutGrid,
};

const RULE_COLORS = {
  gmm: THEME.gold,
  hgb: THEME.cyan,
  affinity: THEME.warning,
  zone: THEME.accent,
};

export function resolveSlottingRules(audit) {
  const pipeline = audit?.pipeline || [];
  const byId = Object.fromEntries(pipeline.map((s) => [s.id, s]));
  const source = audit?.rules?.length ? audit.rules : SLOTTING_RULES;
  return source.map((r) => {
    const fallback = SLOTTING_RULES.find((d) => d.id === r.id) || {};
    return {
      ...fallback,
      ...r,
      status: r.status || byId[r.id]?.status || (audit?.mode === "local" && r.id === "gmm" ? "fallback" : "ok"),
      detail: r.detail || byId[r.id]?.detail || "",
    };
  });
}

function statusTone(status) {
  if (status === "ok") return THEME.success;
  if (status === "fallback") return THEME.warning;
  return THEME.muted;
}

export function MlRulesGrid({ rules = SLOTTING_RULES, compact = false }) {
  return (
    <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
      {rules.map((rule, i) => {
        const Icon = RULE_ICONS[rule.id] || IconSparkles;
        const color = RULE_COLORS[rule.id] || THEME.accent;
        const tone = statusTone(rule.status);
        return (
          <motion.article
            key={rule.id}
            className="slotting-rule-card relative overflow-hidden rounded-2xl border p-4"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-card)",
              borderLeft: `3px solid ${color}`,
              boxShadow: "var(--shadow-card)",
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.38, ease: EASE }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                background: `radial-gradient(ellipse 70% 80% at 0% 0%, ${color}18, transparent 55%)`,
              }}
              aria-hidden
            />
            <div className="relative z-[1]">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                  style={{
                    background: `linear-gradient(145deg, ${color}, ${THEME.cyan})`,
                    boxShadow: `0 8px 16px -10px ${color}`,
                  }}
                >
                  <Icon size={16} />
                </span>
                {rule.status ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{
                      color: tone,
                      background: `color-mix(in srgb, ${tone} 16%, transparent)`,
                    }}
                  >
                    <span className="slotting-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
                    {rule.status === "ok" ? "live" : rule.status === "fallback" ? "local" : "off"}
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{rule.title}</p>
              <p className="mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide" style={{ color }}>
                {rule.model}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">{rule.rule}</p>
              {rule.detail ? (
                <p className="mt-1.5 font-mono text-[10px] text-[var(--text-muted)]">{rule.detail}</p>
              ) : null}
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}

export function GmmFeatureStrip() {
  const feats = [
    { id: "rot30", label: "Rotation 30 j" },
    { id: "cube", label: "Cube-velocity" },
    { id: "dollar", label: "Dollar-velocity" },
    { id: "rot90", label: "Rotation 90 j" },
    { id: "recency", label: "Récence" },
  ];
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        <IconBrain size={12} style={{ color: THEME.gold }} />
        Espace latent GMM · 5D → 3 gaussiennes
      </p>
      <div className="flex items-stretch gap-1.5">
        {feats.map((f, i) => (
          <motion.div
            key={f.id}
            className="min-w-0 flex-1 rounded-xl border px-2 py-2.5 text-center"
            style={{
              borderColor: "var(--border-default)",
              background: `color-mix(in srgb, ${i === 2 ? THEME.gold : THEME.accent} 12%, var(--bg-card))`,
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i, duration: 0.35, ease: EASE }}
          >
            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: THEME.accent }}>
              x{i + 1}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold leading-tight text-[var(--text-primary)]">{f.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function PosteriorMini({ posterior, abcClass }) {
  if (!posterior) return null;
  const rows = [
    { key: "A", color: THEME.gold },
    { key: "B", color: THEME.accent },
    { key: "C", color: "#94a3b8" },
  ];
  return (
    <div className="flex min-w-[7.5rem] flex-col gap-1">
      {rows.map((r) => {
        const pct = Math.round((Number(posterior[r.key]) || 0) * 100);
        const win = abcClass === r.key;
        return (
          <div key={r.key} className="flex items-center gap-1.5">
            <span className="w-3 text-[9px] font-black" style={{ color: r.color }}>
              {r.key}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-input)]">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: EASE }}
                style={{
                  background: r.color,
                  boxShadow: win ? `0 0 8px ${r.color}66` : undefined,
                }}
              />
            </div>
            <span className="w-7 text-right font-mono text-[9px] tabular-nums text-[var(--text-muted)]">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

const ZONE_META = [
  { key: "A", label: "Picking", sub: "d ≤ 33", color: THEME.gold },
  { key: "B", label: "Mixte", sub: "34–66", color: THEME.accent },
  { key: "C", label: "Réserve", sub: "d ≥ 67", color: "#94a3b8" },
];

export function ZoneMigrationMap({ items = [], flows }) {
  const reduce = useReducedMotion();
  const current = { A: 0, B: 0, C: 0 };
  const target = { A: 0, B: 0, C: 0 };
  let towardsDock = Number(flows?.towardsDock) || 0;
  let towardsReserve = Number(flows?.towardsReserve) || 0;
  const computedDock = { dock: 0, reserve: 0 };
  for (const it of items) {
    const ck = it.currentZone?.key;
    const tk = it.recommendedZone?.key;
    if (ck && current[ck] != null) current[ck] += 1;
    if (tk && target[tk] != null) target[tk] += 1;
    const from = Number(it.currentEmplacementDistance);
    const to = Number(it.recommendedDistance);
    if (Number.isFinite(from) && Number.isFinite(to)) {
      if (to < from) computedDock.dock += 1;
      else if (to > from) computedDock.reserve += 1;
    }
  }
  if (!flows) {
    towardsDock = computedDock.dock;
    towardsReserve = computedDock.reserve;
  }
  const mismatches = flows?.byMismatch || {};
  const mismatchEntries = Object.entries(mismatches).sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 sm:p-5"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${THEME.gold}`,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(ellipse 50% 80% at 0% 50%, ${THEME.gold}16, transparent 55%), radial-gradient(ellipse 40% 60% at 100% 50%, ${THEME.accent}12, transparent 50%)`,
        }}
        aria-hidden
      />
      <div className="relative z-[1]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Flux de reslotting · quai → fond
          </p>
          <div className="flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{
                color: THEME.gold,
                background: `color-mix(in srgb, ${THEME.gold} 14%, transparent)`,
              }}
            >
              <IconArrowNarrowLeft size={14} />
              {towardsDock} vers le quai
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{
                color: THEME.accent,
                background: `color-mix(in srgb, ${THEME.accent} 14%, transparent)`,
              }}
            >
              {towardsReserve} vers la réserve
              <IconArrowNarrowRight size={14} />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2 sm:gap-3">
          <div
            className="flex h-24 w-10 flex-col items-center justify-center rounded-xl text-[9px] font-bold uppercase tracking-wide text-white"
            style={{
              background: "linear-gradient(180deg, var(--accent-warning) 0%, var(--commerce-warning, #BA7517) 100%)",
            }}
          >
            <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Quai</span>
          </div>
          {ZONE_META.map((z, i) => (
            <motion.div
              key={z.key}
              className="relative rounded-2xl border px-3 py-3 text-center"
              style={{
                borderColor: `color-mix(in srgb, ${z.color} 45%, var(--border-default))`,
                background: `color-mix(in srgb, ${z.color} 10%, var(--bg-card))`,
              }}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.4, ease: EASE }}
            >
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black text-white"
                style={{ background: z.color }}
              >
                {z.key}
              </span>
              <p className="mt-1.5 text-[11px] font-bold text-[var(--text-primary)]">{z.label}</p>
              <p className="text-[9px] text-[var(--text-muted)]">{z.sub}</p>
              <p className="mt-2 font-mono text-lg font-black tabular-nums" style={{ color: z.color }}>
                {current[z.key] || 0}
              </p>
              <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">hors zone</p>
              <p className="mt-1 text-[10px] text-[var(--text-secondary)]">cible {target[z.key] || 0}</p>
            </motion.div>
          ))}
        </div>

        {mismatchEntries.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {mismatchEntries.map(([key, n]) => (
              <span
                key={key}
                className="rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]"
              >
                {key} · {n}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
