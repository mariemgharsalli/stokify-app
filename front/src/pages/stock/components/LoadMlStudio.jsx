import { motion, useReducedMotion } from "framer-motion";
import {
  IconActivity,
  IconCircleCheck,
  IconMinus,
  IconSparkles,
  IconTruck,
} from "@tabler/icons-react";

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  gold: "#BA7517",
  success: "#1D9E75",
  warning: "#EF9F27",
  muted: "var(--text-muted)",
};

const EASE = [0.22, 1, 0.36, 1];

const LAYER_COLOR = {
  BOTTOM: THEME.gold,
  MID: THEME.accent,
  TOP: THEME.cyan,
};

function polar(cx, cy, r, angle) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
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

export function LoadPipeline({ pipeline = [] }) {
  if (!pipeline.length) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      {pipeline.map((step, i) => (
        <PipelineStep key={step.id || i} step={step} index={i} />
      ))}
    </div>
  );
}

export function LayerCensus({ census, quality, hacMode }) {
  if (!census) return null;
  const rows = [
    { key: "BOTTOM", n: census.BOTTOM, color: LAYER_COLOR.BOTTOM, label: "Fond" },
    { key: "MID", n: census.MID, color: LAYER_COLOR.MID, label: "Milieu" },
    { key: "TOP", n: census.TOP, color: LAYER_COLOR.TOP, label: "Haut" },
  ];
  const total = Math.max(1, Number(census.n) || rows.reduce((s, r) => s + (r.n || 0), 0));
  const hac = String(hacMode || "").startsWith("hac");
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        {hac ? "Couches HAC · Ward" : "Couches cargo"} · {census.n} SKU
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
              {r.label}
            </span>{" "}
            {r.n || 0}
          </span>
        ))}
        {quality?.silhouette != null ? (
          <span className="font-mono text-[var(--text-muted)]">sil {quality.silhouette}</span>
        ) : null}
      </div>
    </div>
  );
}

export function LoadRadar({ radar, size = 148 }) {
  if (!radar) return null;
  const reduce = useReducedMotion();
  const axes = [
    { key: "fill", label: "Fill", color: THEME.accent },
    { key: "balance", label: "Essieux", color: THEME.cyan },
    { key: "cohesion", label: "Tournée", color: THEME.gold },
    { key: "stability", label: "Stabilité", color: THEME.success },
  ];
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 22;
  const pts = axes.map((a, i) => {
    const v = Math.max(0, Math.min(100, Number(radar[a.key]) || 0)) / 100;
    return polar(cx, cy, r * v, -90 + i * 90);
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
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Radar de chargement">
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
      <p className="mt-1 text-[10px] text-[var(--text-muted)]">radar du plan retenu</p>
    </div>
  );
}

export function TourRail({ stops = [], geoMode, tourKm }) {
  if (!stops.length) return null;
  return (
    <div
      className="rounded-2xl border px-4 py-3.5"
      style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
    >
      <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <IconTruck size={12} style={{ color: THEME.gold }} /> Cabine
        </span>
        <span>
          {geoMode === "geo_nn" ? `Tournée GPS${tourKm != null ? ` · ${tourKm} km` : ""}` : "Tournée LIFO"}
        </span>
        <span>Porte</span>
      </div>
      <div className="relative h-3 rounded-full bg-[var(--bg-input)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: "100%",
            background: `linear-gradient(90deg, ${THEME.gold}55, ${THEME.accent}33, ${THEME.cyan}44)`,
          }}
        />
        {stops.map((s, i) => {
          const pct = stops.length === 1 ? 50 : (i / (stops.length - 1)) * 100;
          return (
            <motion.span
              key={`${s.destination}-${i}`}
              className="absolute top-1/2 z-[1] h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{
                background: i === stops.length - 1 ? THEME.cyan : THEME.accent,
                left: `calc(${pct}% - 10px)`,
              }}
              title={`${s.destination} · stop ${s.stopIndex}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.08 * i, duration: 0.3, ease: EASE }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {stops.map((s, i) => (
          <span
            key={`${s.destination}-lab`}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
          >
            <span className="font-mono font-bold" style={{ color: THEME.accent }}>
              {i + 1}
            </span>
            {s.destination}
            <span className="text-[var(--text-muted)]">×{s.quantite}</span>
            {s.kmFromPrev != null ? (
              <span className="font-mono text-[var(--text-muted)]">{s.kmFromPrev} km</span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AxleSeesaw({ axle }) {
  if (!axle) return null;
  const rear = Math.max(0, Math.min(100, Number(axle.rearPct) || 50));
  const tilt = ((rear - 50) / 50) * 8;
  return (
    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border-default)" }}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Équilibre essieux · {axle.balance ?? "—"}%
      </p>
      <div className="relative mx-auto h-14 max-w-xs">
        <div className="absolute bottom-2 left-1/2 h-8 w-0.5 -translate-x-1/2 bg-[var(--border-default)]" />
        <div
          className="absolute bottom-8 left-[8%] right-[8%] h-2 origin-center rounded-full"
          style={{
            background: `linear-gradient(90deg, ${THEME.gold}, ${THEME.accent}, ${THEME.cyan})`,
            transform: `rotate(${tilt}deg)`,
          }}
        />
        <span className="absolute bottom-10 font-mono text-[10px] font-bold" style={{ left: "8%", color: THEME.gold }}>
          cab {rear}%
        </span>
        <span className="absolute bottom-10 right-[8%] font-mono text-[10px] font-bold" style={{ color: THEME.cyan }}>
          porte {100 - rear}%
        </span>
      </div>
    </div>
  );
}

export function CargoCutaway({ cargoBay }) {
  if (!cargoBay) return null;
  const bands = [
    { id: "TOP", label: "Haut / porte", color: LAYER_COLOR.TOP },
    { id: "MID", label: "Milieu", color: LAYER_COLOR.MID },
    { id: "BOTTOM", label: "Fond / cabine", color: LAYER_COLOR.BOTTOM },
  ];
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border-default)" }}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Coupe cargo
      </p>
      <div className="space-y-1.5">
        {bands.map((b) => {
          const items = cargoBay[b.id] || [];
          return (
            <div
              key={b.id}
              className="flex min-h-[2.4rem] items-center gap-2 rounded-xl border px-2 py-1.5"
              style={{
                borderColor: `color-mix(in srgb, ${b.color} 35%, var(--border-default))`,
                background: `color-mix(in srgb, ${b.color} 10%, transparent)`,
              }}
            >
              <span className="w-16 shrink-0 text-[9px] font-bold uppercase" style={{ color: b.color }}>
                {b.label}
              </span>
              <div className="flex flex-wrap gap-1">
                {items.length ? (
                  items.map((it, i) => (
                    <span
                      key={`${it.code}-${i}`}
                      className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white"
                      style={{ background: b.color }}
                    >
                      {it.code}×{it.qty}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-[var(--text-muted)]">vide</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PolicyBoard({ board = [] }) {
  if (!board.length) return null;
  const max = Math.max(0.01, ...board.map((p) => Number(p.score) || 0));
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Tournoi des politiques
      </p>
      {board.map((p) => (
        <div key={p.id} className="flex items-center gap-2">
          <span
            className="w-28 shrink-0 truncate text-[10px] font-semibold"
            style={{ color: p.winner ? THEME.accent : "var(--text-secondary)" }}
          >
            {p.label}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-input)]">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(((Number(p.score) || 0) / max) * 100)}%` }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{
                background: p.winner
                  ? `linear-gradient(90deg, ${THEME.accent}, ${THEME.cyan})`
                  : "var(--border-default)",
              }}
            />
          </div>
          <span className="w-10 text-right font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
            {Number(p.score || 0).toFixed(2)}
          </span>
          {p.winner ? (
            <span className="rounded px-1 text-[9px] font-bold uppercase" style={{ color: THEME.success }}>
              win
            </span>
          ) : p.predicted ? (
            <span className="rounded px-1 text-[9px] font-bold uppercase" style={{ color: THEME.gold }}>
              hgb
            </span>
          ) : p.pareto ? (
            <span className="rounded px-1 text-[9px] font-bold uppercase" style={{ color: THEME.cyan }}>
              pareto
            </span>
          ) : (
            <span className="w-6" />
          )}
        </div>
      ))}
    </div>
  );
}

function UtilityRankLadder({ rank = [], r2 }) {
  if (!rank.length) return null;
  const max = Math.max(0.01, ...rank.map((r) => Number(r.score) || 0));
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Échelle d&apos;utilité HGB
        {r2 != null && Number(r2) >= 0 ? (
          <span className="ml-2 font-mono font-semibold normal-case tracking-normal" style={{ color: THEME.cyan }}>
            R² {Number(r2).toFixed(2)}
          </span>
        ) : null}
      </p>
      {rank.slice(0, 6).map((row) => (
        <div key={`${row.rank}-${row.code}`} className="flex items-center gap-2">
          <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
            {String(row.rank).padStart(2, "0")}
          </span>
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: LAYER_COLOR[row.layer] || THEME.accent }}
            title={row.layer}
          />
          <span className="w-24 shrink-0 truncate text-[10px] font-semibold text-[var(--text-secondary)]">
            {row.code || row.libelle}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-input)]">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(((Number(row.score) || 0) / max) * 100)}%` }}
              transition={{ duration: 0.55, ease: EASE }}
              style={{
                background: `linear-gradient(90deg, ${THEME.gold}, ${THEME.cyan})`,
              }}
            />
          </div>
          <span className="w-10 text-right font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
            {Number(row.score || 0).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function FeatureDna({ items = [] }) {
  if (!items.length) return null;
  const max = Math.max(0.01, ...items.map((f) => Number(f.weight) || 0));
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        ADN du classeur HGB
      </p>
      {items.slice(0, 6).map((f) => (
        <div key={f.id} className="flex items-center gap-2">
          <span className="w-[4.5rem] shrink-0 truncate text-[10px] font-semibold text-[var(--text-secondary)]">
            {f.label}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-input)]">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(((Number(f.weight) || 0) / max) * 100)}%` }}
              transition={{ duration: 0.55, ease: EASE }}
              style={{ background: `linear-gradient(90deg, ${THEME.gold}, ${THEME.cyan})` }}
            />
          </div>
          <span className="w-9 text-right font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
            {Math.round((Number(f.weight) || 0) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function SilhouetteKScan({ scan = [], k }) {
  if (!scan.length) return null;
  const w = 168;
  const h = 72;
  const pad = 14;
  const sils = scan.map((s) => Number(s.silhouette));
  const known = sils.filter((v) => Number.isFinite(v));
  if (!known.length) return null;
  const lo = Math.min(...known, 0);
  const hi = Math.max(...known, 0.01);
  const xs = scan.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(1, scan.length - 1));
  const ys = scan.map((s) => {
    const v = Number(s.silhouette);
    if (!Number.isFinite(v)) return h - pad;
    return h - pad - ((v - lo) / (hi - lo || 1)) * (h - pad * 2);
  });
  const poly = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Silhouette · k*
        {k != null ? (
          <span className="ml-1 font-mono normal-case tracking-normal" style={{ color: THEME.cyan }}>
            {k}
          </span>
        ) : null}
      </p>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Scan silhouette HAC">
        <polyline points={poly} fill="none" stroke={THEME.accent} strokeWidth="2" />
        {scan.map((s, i) => (
          <g key={s.k}>
            <circle
              cx={xs[i]}
              cy={ys[i]}
              r={s.k === k ? 5 : 3}
              fill={s.k === k ? THEME.gold : THEME.cyan}
            />
            <text x={xs[i]} y={h - 2} textAnchor="middle" fill="var(--text-muted)" fontSize="8">
              {s.k}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function HacDendrogram({ leaves = [], census, k }) {
  const rows = leaves.length
    ? leaves
    : [
        { id: "BOTTOM", n: census?.BOTTOM || 0 },
        { id: "MID", n: census?.MID || 0 },
        { id: "TOP", n: census?.TOP || 0 },
      ];
  const total = Math.max(1, rows.reduce((s, r) => s + (Number(r.n) || 0), 0));
  const w = 180;
  const h = 168;
  const root = { x: 90, y: 22 };
  const tips = [
    { x: 32, y: 128, id: "BOTTOM" },
    { x: 90, y: 142, id: "MID" },
    { x: 148, y: 128, id: "TOP" },
  ];
  const midY = 72;
  return (
    <div className="flex flex-col items-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Dendrogramme HAC">
        <text x={root.x} y={12} textAnchor="middle" fill={THEME.gold} fontSize="9" fontWeight="800">
          HAC Ward{k != null ? ` · k=${k}` : ""}
        </text>
        {tips.map((t) => (
          <g key={t.id}>
            <line x1={root.x} y1={root.y} x2={root.x} y2={midY} stroke="var(--border-default)" strokeWidth="1.5" />
            <line
              x1={root.x}
              y1={midY}
              x2={t.x}
              y2={t.y - 18}
              stroke={LAYER_COLOR[t.id]}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>
        ))}
        <circle cx={root.x} cy={root.y} r="6" fill={THEME.gold} />
        {tips.map((t) => {
          const leaf = rows.find((r) => r.id === t.id) || { n: 0 };
          const r = 10 + (14 * (Number(leaf.n) || 0)) / total;
          return (
            <g key={`leaf-${t.id}`}>
              <motion.circle
                cx={t.x}
                cy={t.y}
                r={r}
                fill={LAYER_COLOR[t.id]}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                style={{ transformOrigin: `${t.x}px ${t.y}px` }}
                transition={{ duration: 0.45, ease: EASE }}
              />
              <text x={t.x} y={t.y + 4} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="800">
                {leaf.n || 0}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-0.5 flex gap-3 text-[9px] font-bold uppercase tracking-wide">
        <span style={{ color: LAYER_COLOR.BOTTOM }}>Fond</span>
        <span style={{ color: LAYER_COLOR.MID }}>Milieu</span>
        <span style={{ color: LAYER_COLOR.TOP }}>Haut</span>
      </div>
    </div>
  );
}

function ParetoChart({ board = [] }) {
  if (board.length < 2) return null;
  const w = 168;
  const h = 148;
  const pad = 22;
  return (
    <div>
      <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Front de Pareto
      </p>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Pareto fill vs tournée">
        <text x={w / 2} y={h - 4} textAnchor="middle" fill="var(--text-muted)" fontSize="8">
          fill →
        </text>
        <text x={8} y={12} fill="var(--text-muted)" fontSize="8">
          tournée
        </text>
        <line x1={pad} y1={h - pad} x2={w - 8} y2={h - pad} stroke="var(--border-default)" />
        <line x1={pad} y1={h - pad} x2={pad} y2={10} stroke="var(--border-default)" />
        {board.map((p) => {
          const x = pad + (Number(p.fill) || 0) * (w - pad - 12);
          const y = h - pad - (Number(p.cohesion) || 0) * (h - pad - 16);
          return (
            <g key={p.id}>
              <circle
                cx={x}
                cy={y}
                r={p.winner ? 6 : p.pareto ? 4.5 : 3}
                fill={p.winner ? THEME.gold : p.pareto ? THEME.cyan : "var(--border-default)"}
                stroke={p.winner ? "#fff" : "none"}
                strokeWidth="1.5"
              />
              {p.winner ? (
                <text x={x} y={y - 9} textAnchor="middle" fill={THEME.gold} fontSize="7" fontWeight="700">
                  win
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FillStrip({ pct, label, color }) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className="min-w-[7.5rem] flex-1">
      <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
        <span>{label}</span>
        <span className="font-mono tabular-nums" style={{ color }}>
          {Math.round(v)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-input)]">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ background: `linear-gradient(90deg, ${color}, ${THEME.cyan})` }}
        />
      </div>
    </div>
  );
}

function DockTruck({ placements = [], articles = [], chargementComplet }) {
  const reduce = useReducedMotion();
  const items = (placements || []).filter((p) => p.dx != null);
  const fallback = !items.length
    ? (articles || []).map((a, i) => ({
        code: a.code,
        qty: a.quantiteChargee,
        layer: a.layer || "MID",
        fragile: a.fragile,
        x: Math.min(0.85, (Number(a.doorProximity) || i * 12) / 100),
        z: a.layer === "TOP" ? 0.66 : a.layer === "BOTTOM" ? 0 : 0.33,
        dx: 0.12,
        dz: 0.3,
      }))
    : items;
  const cargoX = 102;
  const cargoY = 30;
  const cargoW = 328;
  const cargoH = 100;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Soute 3D · cabine → porte
        </p>
        {chargementComplet ? (
          <span className="text-[10px] font-bold uppercase" style={{ color: THEME.success }}>
            prêt
          </span>
        ) : null}
      </div>
      <svg viewBox="0 0 470 168" className="w-full" aria-label="Plan de soute 3D">
        <line x1="8" y1="152" x2="462" y2="152" stroke="var(--border-default)" strokeWidth="3" strokeDasharray="12 8" />
        <rect x="16" y="86" width="70" height="50" rx="7" fill="var(--bg-hover)" stroke="var(--border-default)" />
        <rect x="28" y="96" width="30" height="18" rx="3" fill={THEME.accent} opacity="0.45" />
        <circle cx="36" cy="144" r="11" fill="var(--bg-app)" stroke="var(--text-muted)" strokeWidth="3" />
        <rect
          x={cargoX}
          y={cargoY}
          width={cargoW}
          height={cargoH}
          rx="8"
          fill="var(--bg-hover)"
          stroke="var(--border-default)"
        />
        {[0.33, 0.66].map((f) => (
          <line
            key={f}
            x1={cargoX + 6}
            x2={cargoX + cargoW - 6}
            y1={cargoY + cargoH * (1 - f)}
            y2={cargoY + cargoH * (1 - f)}
            stroke="var(--border-default)"
            strokeDasharray="4 6"
            opacity="0.5"
          />
        ))}
        {fallback.map((p, i) => {
          const w = Math.max(14, (Number(p.dx) || 0.1) * cargoW);
          const h = Math.max(12, (Number(p.dz) || 0.28) * cargoH);
          const x = cargoX + (Number(p.x) || 0) * cargoW;
          const y = cargoY + cargoH - (Number(p.z) || 0) * cargoH - h;
          const color = LAYER_COLOR[p.layer] || THEME.accent;
          return (
            <motion.g
              key={`${p.code}-${i}`}
              initial={reduce ? false : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : i * 0.05, duration: 0.35, ease: EASE }}
            >
              <rect x={x} y={y} width={w} height={h} rx="3" fill={color} opacity="0.92" />
              <rect x={x} y={y} width={w} height={Math.min(4, h / 4)} rx="2" fill="#fff" opacity="0.22" />
              {p.fragile ? (
                <circle cx={x + w / 2} cy={y + h / 2} r="2.6" fill="#fff" opacity="0.9" />
              ) : null}
            </motion.g>
          );
        })}
        <circle cx={cargoX + 36} cy="144" r="11" fill="var(--bg-app)" stroke="var(--text-muted)" strokeWidth="3" />
        <circle cx={cargoX + cargoW - 36} cy="144" r="11" fill="var(--bg-app)" stroke="var(--text-muted)" strokeWidth="3" />
        <text x={cargoX + 8} y={cargoY + cargoH + 14} fill="var(--text-muted)" fontSize="8" fontWeight="700">
          CAB
        </text>
        <text x={cargoX + cargoW - 28} y={cargoY + cargoH + 14} fill="var(--text-muted)" fontSize="8" fontWeight="700">
          PORTE
        </text>
      </svg>
    </div>
  );
}

function CargoManifest({ articles = [] }) {
  if (!articles.length) return null;
  const rows = [...articles].sort((a, b) => (Number(a.loadOrder) || 0) - (Number(b.loadOrder) || 0));
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Manifeste · {rows.length} lignes
      </p>
      <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
        {rows.map((a, i) => (
          <div
            key={`${a.articleId}-${a.destination}-${i}`}
            className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
          >
            <span className="w-5 font-mono text-[10px] text-[var(--text-muted)]">{a.loadOrder || i + 1}</span>
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: LAYER_COLOR[a.layer] || THEME.accent }}
            />
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--text-primary)]">
              {a.code} · {a.libelle}
            </span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">×{a.quantiteChargee}</span>
            <span className="max-w-[5.5rem] truncate text-[10px]" style={{ color: THEME.cyan }}>
              {a.destination}
            </span>
            {a.utilityScore != null ? (
              <span className="w-8 text-right font-mono text-[10px] text-[var(--text-muted)]">
                {Number(a.utilityScore).toFixed(2)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatR2(r2, kind) {
  if (r2 == null || Number.isNaN(Number(r2))) return null;
  const v = Number(r2);
  if (v < 0) return `R² ${kind === "oof" ? "OOF" : ""} faible`.replace(/\s+/g, " ").trim();
  return `R² ${kind === "oof" ? "OOF " : ""}${(v * 100).toFixed(0)}%`;
}

export function LoadStudio({ result }) {
  if (!result) return null;
  const isMl = result.mode !== "local" && !String(result.modele || "").includes("local");
  const r2Label = formatR2(result.hgbR2, result.r2Kind);

  return (
    <div
      className="load-studio-dock relative overflow-hidden rounded-2xl border"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${isMl ? THEME.cyan : THEME.warning}`,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="load-studio-scan pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(ellipse 50% 90% at 0% 0%, ${THEME.cyan}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 0%, ${THEME.gold}16, transparent 50%)`,
        }}
        aria-hidden
      />
      <div className="relative z-[1] space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Studio quai · {isMl ? "moteur FastAPI" : "jumeau local"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="truncate text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: "Syne, sans-serif" }}>
                {result.vehicule || "Véhicule"}
              </p>
              <span
                className="rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide"
                style={{
                  color: isMl ? THEME.cyan : THEME.warning,
                  background: `color-mix(in srgb, ${isMl ? THEME.cyan : THEME.warning} 16%, transparent)`,
                }}
              >
                {isMl ? result.modele || "hac" : "local"}
              </span>
              {result.policyLabel ? (
                <span className="text-[11px] text-[var(--text-secondary)]">politique {result.policyLabel}</span>
              ) : null}
              {result.beamUsed ? (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ color: THEME.gold }}>
                  lookahead
                </span>
              ) : null}
              {result.stack3d ? (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ color: THEME.cyan }}>
                  soute 3D
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
              {result.quality?.sampleSize || result.census?.n || "—"} SKU
              {r2Label ? ` · ${r2Label}` : ""}
              {result.hgbAccuracy != null ? ` · sélecteur ${(result.hgbAccuracy * 100).toFixed(0)}%` : ""}
              {result.confidence != null ? ` · confiance ${result.confidence}%` : ""}
              {result.bay ? ` · ${result.bay.length}×${result.bay.width}×${result.bay.height} m` : ""}
            </p>
          </div>
          <div className="flex min-w-[14rem] flex-1 flex-col gap-2 sm:max-w-xs">
            <FillStrip pct={result.pctPoids} label="Poids" color={THEME.success} />
            <FillStrip pct={result.pctVolume} label="Volume" color={THEME.accent} />
          </div>
        </div>

        <DockTruck
          placements={result.placements}
          articles={result.articlesCharges}
          chargementComplet={result.chargementComplet}
        />

        <LoadPipeline pipeline={result.pipeline} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_168px_160px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <HacDendrogram leaves={result.dendrogram} census={result.census} k={result.hacK} />
            <div className="space-y-3">
              <SilhouetteKScan scan={result.kScan} k={result.hacK} />
              <LayerCensus census={result.census} quality={result.quality} hacMode={result.hacMode} />
            </div>
          </div>
          <ParetoChart board={result.policyBoard} />
          <LoadRadar radar={result.radar} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <UtilityRankLadder rank={result.utilityRank} r2={result.hgbR2} />
          <FeatureDna items={result.featureImportance} />
        </div>

        <PolicyBoard board={result.policyBoard} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <AxleSeesaw axle={result.axle} />
          <CargoManifest articles={result.articlesCharges} />
        </div>
        <TourRail stops={result.stops} geoMode={result.geoMode} tourKm={result.tourKm} />

        {result.story?.length ? (
          <ul className="grid gap-1 sm:grid-cols-2">
            {result.story.map((line) => (
              <li
                key={line}
                className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]"
              >
                <IconSparkles size={12} className="mt-0.5 shrink-0" style={{ color: THEME.cyan }} />
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export { THEME as LOAD_ML_THEME, LAYER_COLOR };
