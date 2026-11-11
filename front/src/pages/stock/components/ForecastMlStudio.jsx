import { motion, useReducedMotion } from "framer-motion";
import {
  IconActivity,
  IconBrain,
  IconCircleCheck,
  IconMinus,
  IconSparkles,
  IconTrendingUp,
} from "@tabler/icons-react";
import {
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  gold: "#BA7517",
  success: "#1D9E75",
  warning: "#EF9F27",
  violet: "#7F77DD",
  muted: "var(--text-muted)",
};

const EASE = [0.22, 1, 0.36, 1];

const MODEL_COLOR = {
  hw: THEME.accent,
  nbeats: THEME.violet,
  hybrid: THEME.cyan,
};

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

export function ForecastPipeline({ pipeline = [] }) {
  if (!pipeline.length) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      {pipeline.map((step, i) => (
        <PipelineStep key={step.id || i} step={step} index={i} />
      ))}
    </div>
  );
}

function ChampionPodium({ models = [], champion }) {
  const rows = models.filter((m) => m.mape != null || m.preds?.some((v) => v != null));
  if (!rows.length) return null;
  const maxMape = Math.max(...rows.map((m) => Number(m.mape) || 0), 1);
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Walk-forward MAPE · champion {champion || "—"}
      </p>
      <div className="space-y-2">
        {rows.map((m) => {
          const color = MODEL_COLOR[m.id] || THEME.accent;
          const mape = m.mape;
          const pct = mape == null ? 0 : Math.round((Number(mape) / maxMape) * 100);
          const selected = m.selected || m.id === champion;
          return (
            <div key={m.id}>
              <div className="mb-0.5 flex items-center justify-between text-[11px]">
                <span className="font-semibold" style={{ color: selected ? color : "var(--text-secondary)" }}>
                  {m.label}
                  {selected ? " · retenu" : ""}
                </span>
                <span className="font-mono tabular-nums text-[var(--text-muted)]">
                  {mape == null ? "—" : `${mape}%`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-input)]">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${mape == null ? 8 : Math.max(8, 100 - pct + 12)}%` }}
                  transition={{ duration: 0.7, ease: EASE }}
                  style={{ background: color, opacity: selected ? 1 : 0.45 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NBeatsBlocks({ neural }) {
  const blocks = neural?.blocks || ["trend", "seasonal", "generic"];
  const labels = { trend: "Tendance", seasonal: "Saison", generic: "Générique" };
  const colors = [THEME.gold, THEME.accent, THEME.violet];
  const trained = Boolean(neural?.trained);
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        <IconBrain size={12} style={{ color: THEME.violet }} />
        Architecture N-BEATS
      </p>
      <div className="flex items-stretch gap-1.5">
        {blocks.map((b, i) => (
          <motion.div
            key={b}
            className="flex-1 rounded-xl border px-2 py-2.5 text-center"
            style={{
              borderColor: "var(--border-default)",
              background: `color-mix(in srgb, ${colors[i % colors.length]} 12%, var(--bg-card))`,
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.35, ease: EASE }}
          >
            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: colors[i % colors.length] }}>
              Bloc {i + 1}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-primary)]">{labels[b] || b}</p>
          </motion.div>
        ))}
      </div>
      <p className="mt-1.5 font-mono text-[10px] text-[var(--text-muted)]">
        lookback {neural?.lookback ?? 12} · hidden {neural?.hidden ?? 28} ·{" "}
        {trained ? `${neural.windows} fenêtres · ${neural.epochs} époques` : "non entraîné"}
        {neural?.peers != null ? ` · ${neural.peers} pairs` : ""}
      </p>
    </div>
  );
}

function LossSpark({ curve = [] }) {
  if (!curve.length) return null;
  const w = 168;
  const h = 42;
  const min = Math.min(...curve);
  const max = Math.max(...curve);
  const span = max - min || 1e-6;
  const pts = curve
    .map((v, i) => {
      const x = (i / Math.max(1, curve.length - 1)) * w;
      const y = h - 4 - ((v - min) / span) * (h - 8);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Loss MSE</p>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <polyline fill="none" stroke={THEME.violet} strokeWidth="1.8" points={pts} />
      </svg>
      <p className="font-mono text-[10px] text-[var(--text-muted)]">
        {curve[0]} → {curve[curve.length - 1]}
      </p>
    </div>
  );
}

function DecompStack({ decomposition }) {
  const months = decomposition?.mois || [];
  const level = decomposition?.level || [];
  const trend = decomposition?.trend || [];
  const seasonal = decomposition?.seasonal || [];
  if (!months.length || !level.length) return null;
  const n = Math.min(months.length, level.length);
  const rows = [
    { key: "level", label: "Niveau", color: THEME.accent, data: level },
    { key: "trend", label: "Tendance", color: THEME.gold, data: trend },
    { key: "seasonal", label: "Saison", color: THEME.cyan, data: seasonal },
  ].filter((r) => r.data.some((v) => Number(v) !== 0));
  if (!rows.length) return null;
  const last = n - 1;
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Décomposition HW · {months[last] || ""}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {rows.map((r) => (
          <div
            key={r.key}
            className="rounded-xl border px-2.5 py-2"
            style={{ borderColor: "var(--border-default)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: r.color }}>
              {r.label}
            </p>
            <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[var(--text-primary)]">
              {Number(r.data[last] || 0).toFixed(1)}
            </p>
          </div>
        ))}
      </div>
      {decomposition?.neuralBoost?.length ? (
        <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
          Boost neural M+1…{" "}
          {decomposition.neuralBoost.map((v, i) => (
            <span key={i} className="mr-2 font-mono tabular-nums" style={{ color: Number(v) >= 0 ? THEME.success : THEME.warning }}>
              {Number(v) >= 0 ? "+" : ""}
              {v}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function QuantileFan({ scenarios }) {
  if (!scenarios?.p50?.length) return null;
  const mois = scenarios.mois || scenarios.p50.map((_, i) => `M+${i + 1}`);
  const max = Math.max(...(scenarios.p90 || []), ...(scenarios.p50 || []), 1);
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Éventail P10 / P50 / P90 · service {Math.round((scenarios.serviceLevel || 0.9) * 100)}%
      </p>
      <div className="flex items-end gap-3">
        {scenarios.p50.map((p50, i) => {
          const p10 = Number(scenarios.p10?.[i]) || 0;
          const p90 = Number(scenarios.p90?.[i]) || p50;
          const h90 = Math.round((p90 / max) * 88);
          const h50 = Math.round((Number(p50) / max) * 88);
          const h10 = Math.round((p10 / max) * 88);
          return (
            <div key={mois[i] || i} className="flex flex-1 flex-col items-center">
              <div className="relative flex h-24 w-8 items-end justify-center">
                <motion.div
                  className="absolute bottom-0 w-6 rounded-full"
                  style={{ background: `color-mix(in srgb, ${THEME.violet} 22%, transparent)` }}
                  initial={{ height: 0 }}
                  animate={{ height: h90 }}
                  transition={{ duration: 0.7, ease: EASE }}
                />
                <motion.div
                  className="absolute bottom-0 w-3 rounded-full"
                  style={{ background: THEME.cyan }}
                  initial={{ height: 0 }}
                  animate={{ height: h50 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
                />
                <motion.div
                  className="absolute bottom-0 w-1.5 rounded-full"
                  style={{ background: THEME.gold }}
                  initial={{ height: 0 }}
                  animate={{ height: h10 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
                />
              </div>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">{mois[i]}</p>
              <p className="font-mono text-[11px] font-bold tabular-nums text-[var(--text-primary)]">
                {Math.round(p90)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MaturityRing({ pct, label }) {
  const reduce = useReducedMotion();
  const size = 92;
  const r = 34;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, Number(pct) || 0));
  const color = clamped >= 75 ? THEME.success : clamped >= 55 ? THEME.cyan : THEME.warning;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-default)" strokeWidth="7" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
          transition={{ duration: 1.05, ease: EASE }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black tabular-nums" style={{ color }}>
          {Math.round(clamped)}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      </div>
    </div>
  );
}

export function ForecastStudio({ result }) {
  if (!result) return null;
  const isMl = result.mode !== "local" && !String(result.modele || "").includes("local");
  const champion = result.champion || result.comparaison?.champion;
  const neural = result.neural;
  const quality = result.quality || {};

  return (
    <div
      className="forecast-studio-dock relative overflow-hidden rounded-2xl border"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${isMl ? THEME.violet : THEME.warning}`,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="forecast-studio-scan pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(ellipse 50% 90% at 0% 0%, ${THEME.violet}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 0%, ${THEME.cyan}16, transparent 50%)`,
        }}
        aria-hidden
      />
      <div className="relative z-[1] space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Studio demande · {isMl ? "moteur FastAPI" : "jumeau local"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="truncate text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: "Syne, sans-serif" }}>
                {result.articleLibelle || "Article"}
              </p>
              <span
                className="rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide"
                style={{
                  color: isMl ? THEME.violet : THEME.warning,
                  background: `color-mix(in srgb, ${isMl ? THEME.violet : THEME.warning} 16%, transparent)`,
                }}
              >
                {isMl ? result.modele || "hybrid" : "local"}
              </span>
              {champion ? (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ color: THEME.cyan }}>
                  champion {champion}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
              {quality.points ?? result.historique?.length ?? "—"} mois
              {quality.peers != null ? ` · ${quality.peers} pairs famille` : ""}
              {quality.mape != null ? ` · MAPE ${quality.mape}%` : ""}
              {result.hwSpec?.aic != null ? ` · AIC ${result.hwSpec.aic}` : ""}
              {result.confidence != null ? ` · confiance ${result.confidence}%` : ""}
            </p>
          </div>
          <MaturityRing pct={quality.maturity ?? result.confidence} label="maturité" />
        </div>

        <ForecastPipeline pipeline={result.pipeline} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_168px]">
          <ChampionPodium models={result.comparaison?.models} champion={champion} />
          <NBeatsBlocks neural={neural} />
          <LossSpark curve={neural?.lossCurve} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DecompStack decomposition={result.decomposition} />
          <QuantileFan scenarios={result.scenarios} />
        </div>

        {result.story?.length ? (
          <ul className="grid gap-1 sm:grid-cols-2">
            {result.story.map((line) => (
              <li
                key={line}
                className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]"
              >
                <IconSparkles size={12} className="mt-0.5 shrink-0" style={{ color: THEME.violet }} />
                {line}
              </li>
            ))}
          </ul>
        ) : null}

        {result.methodologyLabel ? (
          <p className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <IconTrendingUp size={12} />
            {result.methodologyLabel}
            {result.hwSpec?.seasonal ? ` · saison ${result.hwSpec.seasonal}` : ""}
            {result.hwSpec?.damped ? " · tendance amortie" : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { THEME as FORECAST_ML_THEME, MODEL_COLOR };

const RISK_COLOR = {
  rupture: THEME.warning,
  surplus: THEME.gold,
  ok: THEME.success,
};

const PALETTE = ["#1D9E75", "#378ADD", "#7F77DD", "#BA7517", "#E24B4A"];

const MOIS_COURTS = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr", "05": "Mai", "06": "Juin",
  "07": "Juil", "08": "Août", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};

function formatMoisLabel(mois) {
  if (!mois || typeof mois !== "string") return mois;
  const parts = mois.split("-");
  if (parts.length >= 2) return `${MOIS_COURTS[parts[1]] || parts[1]} ${parts[0].slice(2)}`;
  return mois;
}

function buildOverlayData(items, scenario) {
  const moisSet = new Map();
  items.forEach((it) => {
    const key = `a${it.articleId}`;
    const hist = it.historique || [];
    for (const h of hist) {
      const mk = h.mois;
      if (!moisSet.has(mk)) moisSet.set(mk, { mois: formatMoisLabel(mk), moisKey: mk });
      moisSet.get(mk)[key] = Number(h.valeur);
    }
    const last = hist[hist.length - 1];
    if (last) {
      const row = moisSet.get(last.mois);
      if (row && row[`${key}Pred`] == null) row[`${key}Pred`] = Number(last.valeur);
    }
    for (const p of it.predictions || []) {
      const mk = p.mois;
      if (!moisSet.has(mk)) moisSet.set(mk, { mois: formatMoisLabel(mk), moisKey: mk });
      moisSet.get(mk)[`${key}Pred`] = Number(p[scenario] ?? p.p50 ?? p.valeur);
    }
  });
  return Array.from(moisSet.values()).sort((a, b) => String(a.moisKey).localeCompare(String(b.moisKey)));
}

function CompareCurvesChart({ items, hiddenIds, selectedId, onSelect, onToggle, scenario }) {
  const hidden = hiddenIds instanceof Set ? hiddenIds : new Set();
  const data = buildOverlayData(items, scenario);
  if (!data.length || !items.length) return null;

  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Courbes comparées · plein = historique · pointillé = prévision {String(scenario || "p90").toUpperCase()}
      </p>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
            <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              onClick={(e) => {
                const id = String(e?.dataKey || "").replace(/Pred$/, "");
                if (id.startsWith("a")) onToggle?.(id);
              }}
            />
            {items.map((it, i) => {
              const key = `a${it.articleId}`;
              if (hidden.has(key)) return null;
              const color = PALETTE[i % PALETTE.length];
              const dim = selectedId != null && Number(selectedId) !== Number(it.articleId);
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={it.articleLibelle || it.articleCode || key}
                  stroke={color}
                  strokeWidth={dim ? 1.4 : 2.4}
                  strokeOpacity={dim ? 0.35 : 1}
                  dot={false}
                  connectNulls={false}
                  onClick={() => onSelect?.(it.articleId)}
                />
              );
            })}
            {items.map((it, i) => {
              const key = `a${it.articleId}`;
              if (hidden.has(key)) return null;
              const color = PALETTE[i % PALETTE.length];
              const dim = selectedId != null && Number(selectedId) !== Number(it.articleId);
              return (
                <Line
                  key={`${key}Pred`}
                  type="monotone"
                  dataKey={`${key}Pred`}
                  name={`${it.articleLibelle || it.articleCode} (prév.)`}
                  stroke={color}
                  strokeWidth={dim ? 1.4 : 2.2}
                  strokeOpacity={dim ? 0.35 : 1}
                  strokeDasharray="6 4"
                  dot={false}
                  connectNulls
                  legendType="none"
                  onClick={() => onSelect?.(it.articleId)}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MiniSpark({ hist = [], pred = [], color = THEME.cyan }) {
  const vals = [...hist.slice(-8).map(Number), ...pred.map(Number)].filter((v) => Number.isFinite(v));
  if (vals.length < 2) return null;
  const w = 72;
  const h = 28;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals
    .map((v, i) => {
      const x = (i / Math.max(1, vals.length - 1)) * w;
      const y = h - 3 - ((v - min) / span) * (h - 6);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.6" points={pts} />
    </svg>
  );
}

function MapeHeatmap({ heatmap = [], onSelect, selectedId }) {
  if (!heatmap.length) return null;
  const cols = [
    { id: "hw", label: "HW" },
    { id: "nbeats", label: "N-BEATS" },
    { id: "hybrid", label: "Hybride" },
  ];
  const colorOf = (v, champ, col) => {
    if (v == null) return "transparent";
    const win = champ === col || (champ === "holt_winters" && col === "hw");
    if (win) return `color-mix(in srgb, ${THEME.success} 28%, transparent)`;
    if (v <= 15) return `color-mix(in srgb, ${THEME.cyan} 16%, transparent)`;
    if (v <= 28) return `color-mix(in srgb, ${THEME.gold} 16%, transparent)`;
    return `color-mix(in srgb, ${THEME.warning} 18%, transparent)`;
  };
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Heatmap MAPE · cellule verte = champion
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-left text-[11px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <th className="pb-1.5 pr-2 font-semibold">Article</th>
              {cols.map((c) => (
                <th key={c.id} className="pb-1.5 px-1 font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.map((row) => {
              const selected = Number(selectedId) === Number(row.articleId);
              return (
                <tr
                  key={row.articleId}
                  className="cursor-pointer"
                  onClick={() => onSelect?.(row.articleId)}
                  style={{ background: selected ? `color-mix(in srgb, ${THEME.violet} 10%, transparent)` : "transparent" }}
                >
                  <td className="py-1 pr-2 font-semibold text-[var(--text-primary)]">{row.libelle || row.code}</td>
                  {cols.map((c) => (
                    <td key={c.id} className="px-1 py-1">
                      <span
                        className="inline-block min-w-[2.4rem] rounded-md px-1.5 py-0.5 text-center font-mono tabular-nums"
                        style={{ background: colorOf(row[c.id], row.champion, c.id) }}
                      >
                        {row[c.id] == null ? "—" : row[c.id]}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReorderQueue({ ranking = [] }) {
  if (!ranking.length) return null;
  const maxGap = Math.max(...ranking.map((r) => Math.abs(Number(r.gap) || 0)), 1);
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        File de réappro · P90 − stock
      </p>
      <ul className="space-y-1.5">
        {ranking.map((r) => {
          const color = RISK_COLOR[r.risk] || THEME.muted;
          const pct = Math.round((Math.abs(Number(r.gap) || 0) / maxGap) * 100);
          return (
            <li key={r.articleId} className="flex items-center gap-2">
              <span className="w-28 truncate text-[11px] font-semibold" style={{ color }}>
                {r.libelle || r.code}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-input)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(8, pct)}%`,
                    background: color,
                    marginLeft: Number(r.gap) < 0 ? "auto" : 0,
                  }}
                />
              </div>
              <span className="w-12 text-right font-mono text-[11px] tabular-nums" style={{ color }}>
                {Number(r.gap) > 0 ? "+" : ""}
                {Math.round(r.gap)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PortfolioStudio({
  items = [],
  portfolio,
  hiddenIds,
  onToggle,
  selectedId,
  onSelect,
  scenario = "p90",
  onScenario,
}) {
  if (!portfolio && !items.length) return null;
  const isMl = items.some((it) => it.mode !== "local" && !String(it.modele || "").includes("local"));
  const p = portfolio || {};
  const hidden = hiddenIds instanceof Set ? hiddenIds : new Set();
  const visible = items.filter((it) => !hidden.has(`a${it.articleId}`));
  const scenarioVals = p[scenario] || p.p90 || [];

  return (
    <div
      className="forecast-studio-dock relative overflow-hidden rounded-2xl border"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${isMl ? THEME.violet : THEME.warning}`,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="forecast-studio-scan pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(ellipse 50% 90% at 0% 0%, ${THEME.violet}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 0%, ${THEME.gold}14, transparent 50%)`,
        }}
        aria-hidden
      />
      <div className="relative z-[1] space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Studio portefeuille · {isMl ? "N-BEATS global" : "jumeau local"}
            </p>
            <p className="mt-1 text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: "Syne, sans-serif" }}>
              {p.n || items.length} articles · P90 {Math.round(p.totalP90 || 0)} u.
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
              {p.reconciled ? "réconcilié famille → catalogue" : "sans réconciliation"}
              {p.neural?.cached ? " · cache N-BEATS" : ""}
              {p.concentration?.topCode
                ? ` · ${p.concentration.sharePct}% sur ${p.concentration.topLibelle || p.concentration.topCode}`
                : ""}
            </p>
          </div>
          <div className="flex gap-1">
            {["p10", "p50", "p90"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onScenario?.(s)}
                className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  borderColor: scenario === s ? THEME.violet : "var(--border-default)",
                  color: scenario === s ? THEME.violet : "var(--text-muted)",
                  background: scenario === s ? `color-mix(in srgb, ${THEME.violet} 14%, transparent)` : "transparent",
                }}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <ForecastPipeline pipeline={p.pipeline} />

        <div className="flex flex-wrap gap-2">
          {items.map((it, i) => {
            const key = `a${it.articleId}`;
            const color = PALETTE[i % PALETTE.length];
            const off = hidden.has(key);
            const selected = Number(selectedId) === Number(it.articleId);
            const hist = (it.historique || []).map((h) => h.valeur);
            const pred = (it.predictions || []).map((x) => x[scenario] ?? x.valeur);
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (off) onToggle?.(key);
                  onSelect?.(it.articleId);
                }}
                className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5"
                style={{
                  borderColor: selected ? color : "var(--border-default)",
                  opacity: off ? 0.35 : 1,
                  background: selected ? `color-mix(in srgb, ${color} 12%, transparent)` : "var(--bg-card)",
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                <span className="max-w-[140px] truncate text-[11px] font-bold">{it.articleLibelle || it.articleCode}</span>
                <MiniSpark hist={hist} pred={pred} color={color} />
                <span className="font-mono text-[9px] uppercase text-[var(--text-muted)]">{it.champion || "—"}</span>
              </button>
            );
          })}
        </div>

        <CompareCurvesChart
          items={items}
          hiddenIds={hidden}
          selectedId={selectedId}
          onSelect={onSelect}
          onToggle={onToggle}
          scenario={scenario}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <MapeHeatmap
            heatmap={(p.heatmap || []).map((row) => {
              const it = items.find((x) => Number(x.articleId) === Number(row.articleId));
              return { ...row, libelle: it?.articleLibelle || row.libelle };
            })}
            onSelect={onSelect}
            selectedId={selectedId}
          />
          <ReorderQueue ranking={p.ranking} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <QuantileFan
            scenarios={{
              p10: p.p10,
              p50: p.p50,
              p90: p.p90,
              mois: p.mois,
              serviceLevel: p.serviceLevel || 0.9,
            }}
          />
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Small multiples · {scenario.toUpperCase()}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visible.map((it, i) => {
                const color = PALETTE[i % PALETTE.length];
                const hist = (it.historique || []).map((h) => Number(h.valeur));
                const pred = (it.predictions || []).map((x) => Number(x[scenario] ?? x.valeur));
                return (
                  <button
                    key={it.articleId}
                    type="button"
                    onClick={() => onSelect?.(it.articleId)}
                    className="rounded-xl border px-2 py-2 text-left"
                    style={{
                      borderColor:
                        Number(selectedId) === Number(it.articleId) ? color : "var(--border-default)",
                    }}
                  >
                    <p className="truncate text-[10px] font-bold">{it.articleLibelle || it.articleCode}</p>
                    <MiniSpark hist={hist} pred={pred} color={color} />
                    <p className="font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                      {Math.round(pred.reduce((s, v) => s + (Number(v) || 0), 0) || 0)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {p.story?.length ? (
          <ul className="grid gap-1 sm:grid-cols-2">
            {p.story.map((line) => (
              <li key={line} className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <IconSparkles size={12} className="mt-0.5 shrink-0" style={{ color: THEME.violet }} />
                {line}
              </li>
            ))}
          </ul>
        ) : null}

        {scenarioVals.length ? (
          <p className="text-[10px] text-[var(--text-muted)]">
            Portefeuille {scenario.toUpperCase()} : {scenarioVals.map((v) => Math.round(v)).join(" · ")} u.
            {p.gapP90 != null ? ` · gap stock ${Math.round(p.gapP90)}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
