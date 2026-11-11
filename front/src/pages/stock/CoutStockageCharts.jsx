import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

const CATEGORY_COLORS = {
  stockage: "#378ADD",
  logistique: "#7F77DD",
  manutention: "#1D9E75",
  autre: "#BA7517",
  loyer: "#378ADD",
  personnel: "#7F77DD",
  energie: "#BA7517",
  autres: "#D4537E",
};

const GRADIENT_TO = {
  "#378ADD": "#5BA3F5",
  "#7F77DD": "#A89EF0",
  "#1D9E75": "#2BC492",
  "#BA7517": "#E8A020",
  "#D4537E": "#E87AA0",
  "#E24B4A": "#F06B6A",
};

function segmentGradient(color) {
  const to = GRADIENT_TO[color] || color;
  return `linear-gradient(90deg, ${color}, ${to})`;
}

const CATEGORY_META = {
  STOCKAGE: { key: "stockage", label: "Stockage", color: CATEGORY_COLORS.stockage },
  LOGISTIQUE: { key: "logistique", label: "Logistique", color: CATEGORY_COLORS.logistique },
  MANUTENTION: { key: "manutention", label: "Manutention", color: CATEGORY_COLORS.manutention },
  AUTRE: { key: "autre", label: "Autre", color: CATEGORY_COLORS.autre },
};

/** Transforme la réponse GET /cout-entries/grouped en segments pour StackedCostBar */
export function buildSegmentsFromGroupedEntries(groupedData = []) {
  const totals = { STOCKAGE: 0, LOGISTIQUE: 0, MANUTENTION: 0, AUTRE: 0 };
  for (const row of groupedData || []) {
    const cat = row.categorie || "AUTRE";
    if (totals[cat] !== undefined) totals[cat] += Number(row.total || 0);
    else totals.AUTRE += Number(row.total || 0);
  }
  return ["STOCKAGE", "LOGISTIQUE", "MANUTENTION", "AUTRE"].map((cat) => ({
    key: CATEGORY_META[cat].key,
    label: CATEGORY_META[cat].label,
    value: totals[cat],
    color: CATEGORY_META[cat].color,
  }));
}

function fmtNum(v, decimals = 3) {
  return Number(v || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(v) {
  return `${Number(v || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`;
}

/** Construit un path SVG monotone pour le tracé sparkline. */
function buildSparkPath(values, width, height, pad = 3) {
  const nums = (values || []).map((v) => Number(v) || 0);
  if (nums.length < 2) return { line: "", area: "", len: 0 };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const pts = nums.map((v, i) => {
    const x = pad + (i / (nums.length - 1)) * innerW;
    const y = pad + innerH - ((v - min) / range) * innerH;
    return [x, y];
  });
  let line = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i += 1) line += ` L ${pts[i][0]} ${pts[i][1]}`;
  const area = `${line} L ${pts[pts.length - 1][0]} ${height - pad} L ${pts[0][0]} ${height - pad} Z`;
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return { line, area, len: Math.max(1, Math.round(len)) };
}

/** Mini sparkline animée — tracé stroke-dasharray au premier affichage. */
export function CostSparkline({ data = [], color = "#378ADD", width = 100, height = 36 }) {
  const [drawn, setDrawn] = useState(false);
  const uid = useId().replace(/:/g, "");
  const chartData = useMemo(
    () => (data || []).map((v, i) => ({ i, v: Number(v) || 0 })),
    [data]
  );
  const pathMeta = useMemo(
    () => buildSparkPath(chartData.map((d) => d.v), width, height),
    [chartData, width, height]
  );

  useEffect(() => {
    setDrawn(false);
    const t = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(t);
  }, [pathMeta.line]);

  if (!chartData.length) {
    return (
      <div
        style={{ width, height, borderRadius: 6, background: "var(--bg-input)", border: "1px solid var(--border-default)" }}
      />
    );
  }

  const areaGradId = `spark-area-${uid}`;
  const strokeGradId = `spark-stroke-${uid}`;

  return (
    <div style={{ width, height }} title="Tendance 6 mois — estimée au stock actuel" className="cout-fade-up">
      {pathMeta.line ? (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
          <defs>
            <linearGradient id={strokeGradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0.65} />
              <stop offset="100%" stopColor={GRADIENT_TO[color] || color} stopOpacity={1} />
            </linearGradient>
            <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path
            d={pathMeta.area}
            fill={`url(#${areaGradId})`}
            className={drawn ? "cout-sparkline-area" : undefined}
            style={!drawn ? { opacity: 0 } : undefined}
          />
          <path
            d={pathMeta.line}
            fill="none"
            stroke={`url(#${strokeGradId})`}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={drawn ? "cout-sparkline-path" : undefined}
            style={{
              "--spark-len": pathMeta.len,
              strokeDasharray: pathMeta.len,
              strokeDashoffset: drawn ? undefined : pathMeta.len,
            }}
          />
        </svg>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <Area type="monotone" dataKey="v" stroke={color} fill="transparent" strokeWidth={2} dot={false} isAnimationActive />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/** @deprecated alias — utiliser CostSparkline */
export const CategorySparkline = CostSparkline;

/** Barre empilée horizontale — highlight croisé via highlightedKey / onHighlight */
export function StackedCostBar({
  segments = [],
  animate = true,
  segmentCascade = false,
  highlightedKey = null,
  onHighlight,
}) {
  const [mounted, setMounted] = useState(false);
  const total = useMemo(() => segments.reduce((s, seg) => s + Number(seg.value || 0), 0), [segments]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [segments]);

  const setHover = useCallback(
    (key) => {
      onHighlight?.(key);
    },
    [onHighlight]
  );

  if (!total) {
    return (
      <div
        className="cout-stacked-bar"
        style={{ height: 14, background: "var(--color-background-secondary, var(--bg-card))" }}
      />
    );
  }

  return (
    <div className="cout-stacked-bar" onMouseLeave={() => setHover(null)}>
      {segments.map((seg, idx) => {
        const pct = (Number(seg.value || 0) / total) * 100;
        const hasValue = Number(seg.value || 0) > 0;
        const segDelay = segmentCascade ? idx * 100 : 0;
        const isActive = highlightedKey === seg.key;
        const isDimmed = highlightedKey != null && !isActive;
        return (
          <div
            key={seg.key}
            title={`${seg.label}: ${fmtNum(seg.value)} TND (${fmtPct(pct)})`}
            className={[
              "cout-stacked-segment",
              animate && segmentCascade ? "cout-stacked-segment--animate" : "",
              isActive ? "cout-stacked-segment--active" : "",
              isDimmed ? "cout-stacked-segment--dimmed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onMouseEnter={() => hasValue && setHover(seg.key)}
            onFocus={() => hasValue && setHover(seg.key)}
            style={{
              width: mounted || !animate ? `${pct}%` : "0%",
              background: segmentGradient(seg.color),
              transition: animate
                ? segmentCascade
                  ? `width 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${segDelay}ms, opacity 0.5s ease ${segDelay}ms, filter 0.15s ease`
                  : "width 1.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.15s ease, filter 0.15s ease"
                : "opacity 0.15s ease, filter 0.15s ease",
              minWidth: pct > 0 ? 3 : 0,
              cursor: hasValue ? "pointer" : "default",
              opacity: mounted || !animate || !segmentCascade ? undefined : 0,
              animationDelay: `${segDelay}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Légende sous la barre empilée — synchronisée avec le highlight */
export function StackedCostLegend({ segments = [], highlightedKey = null, onHighlight }) {
  const total = segments.reduce((s, seg) => s + Number(seg.value || 0), 0);
  if (!total) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2" onMouseLeave={() => onHighlight?.(null)}>
      {segments.map((seg, i) => {
        const pct = (Number(seg.value || 0) / total) * 100;
        if (!seg.value) return null;
        const isActive = highlightedKey === seg.key;
        const isDimmed = highlightedKey != null && !isActive;
        return (
          <span
            key={seg.key}
            role="button"
            tabIndex={0}
            className={[
              "cout-legend-pill cout-fade-up",
              isActive ? "cout-legend-pill--active" : "",
              isDimmed ? "cout-legend-pill--dimmed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              animationDelay: `${i * 50}ms`,
              "--legend-accent": seg.color,
            }}
            onMouseEnter={() => onHighlight?.(seg.key)}
            onFocus={() => onHighlight?.(seg.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onHighlight?.(seg.key);
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: seg.color,
                flexShrink: 0,
                boxShadow: isActive ? `0 0 0 3px ${seg.color}33` : undefined,
              }}
            />
            {seg.label}{" "}
            <strong style={{ color: seg.color }}>{fmtNum(seg.value)} TND</strong>
            <span style={{ color: "var(--text-muted)" }}>({fmtPct(pct)})</span>
          </span>
        );
      })}
    </div>
  );
}

/** Groupe barre + légende avec highlight croisé partagé */
export function StackedCostBlock({ segments = [], animate = true, segmentCascade = true }) {
  const [highlightedKey, setHighlightedKey] = useState(null);
  return (
    <div>
      <StackedCostBar
        segments={segments}
        animate={animate}
        segmentCascade={segmentCascade}
        highlightedKey={highlightedKey}
        onHighlight={setHighlightedKey}
      />
      <StackedCostLegend
        segments={segments}
        highlightedKey={highlightedKey}
        onHighlight={setHighlightedKey}
      />
    </div>
  );
}

/** Mini barre empilée pour historique (ligne expandable) */
export function MiniStackedBar({ row }) {
  const segments = [
    { key: "loyer", value: row.coutLoyer, color: CATEGORY_COLORS.loyer },
    { key: "personnel", value: row.coutPersonnel, color: CATEGORY_COLORS.personnel },
    { key: "energie", value: row.coutEnergie, color: CATEGORY_COLORS.energie },
    { key: "manutention", value: row.coutManutention, color: CATEGORY_COLORS.manutention },
    { key: "autres", value: row.autresFrais, color: CATEGORY_COLORS.autres },
  ];
  return <StackedCostBar segments={segments.map((s) => ({ ...s, label: s.key }))} animate={false} />;
}

/** Jauge SVG semi-circulaire pour taux de rotation */
export function RotationGauge({ score = 0, size = 120 }) {
  const height = 70;
  const clamped = Math.min(100, Math.max(0, Number(score) || 0));
  const dashArray = 157;
  const dashOffset = dashArray - (clamped / 100) * dashArray;
  const stroke =
    clamped >= 70 ? "#1D9E75" : clamped >= 30 ? "#BA7517" : "#E24B4A";
  const gradEnd = clamped >= 70 ? "#2BC492" : clamped >= 30 ? "#E8A020" : "#F06B6A";

  return (
    <svg width={size} height={height} viewBox="0 0 120 70" className="cout-progress-ring mx-auto">
      <defs>
        <linearGradient id="rotation-gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={stroke} />
          <stop offset="100%" stopColor={gradEnd} />
        </linearGradient>
      </defs>
      <path
        d="M 10 60 A 50 50 0 0 1 110 60"
        stroke="var(--color-background-secondary, var(--bg-card))"
        strokeWidth="10"
        fill="none"
      />
      <path
        d="M 10 60 A 50 50 0 0 1 110 60"
        stroke="url(#rotation-gauge-grad)"
        strokeWidth="10"
        fill="none"
        strokeDasharray={dashArray}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
      <text x="60" y="55" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--text-primary, #f1f5f9)">
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

/** Compteur animé requestAnimationFrame */
export function AnimatedNumber({ value, duration = 800, decimals = 0, suffix = "" }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const end = Number(value) || 0;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(end * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const formatted =
    decimals > 0
      ? display.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : Math.round(display).toLocaleString("fr-FR");

  return (
    <span className="cout-kpi-value tabular-nums">
      {formatted}
      {suffix}
    </span>
  );
}

export { CATEGORY_COLORS, fmtNum, fmtPct };

/** Legacy export — graphiques agrégés (conservé pour compatibilité) */
export default function CoutStockageCharts({ depotMensuels }) {
  const segments = useMemo(() => {
    let loyer = 0;
    let personnel = 0;
    let energie = 0;
    let manut = 0;
    let autres = 0;
    for (const row of depotMensuels || []) {
      loyer += Number(row.coutLoyer || 0);
      personnel += Number(row.coutPersonnel || 0);
      energie += Number(row.coutEnergie || 0);
      manut += Number(row.coutManutention || 0);
      autres += Number(row.autresFrais || 0);
    }
    return [
      { key: "loyer", label: "Loyer", value: loyer, color: CATEGORY_COLORS.loyer },
      { key: "personnel", label: "Personnel", value: personnel, color: CATEGORY_COLORS.personnel },
      { key: "energie", label: "Énergie", value: energie, color: CATEGORY_COLORS.energie },
      { key: "manutention", label: "Manutention", value: manut, color: CATEGORY_COLORS.manutention },
      { key: "autres", label: "Autres", value: autres, color: CATEGORY_COLORS.autres },
    ];
  }, [depotMensuels]);

  const total = segments.reduce((s, seg) => s + seg.value, 0);

  if (!depotMensuels?.length) {
    return (
      <div className="cout-empty-state">
        <div
          className="cout-empty-state__icon cout-empty-float"
          style={{ color: "var(--text-muted)", fontSize: 22, fontWeight: 700 }}
        >
          —
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Aucune donnée mensuelle</p>
        <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
          Saisissez des coûts dépôt pour afficher la répartition.
        </p>
      </div>
    );
  }

  return (
    <div className="cout-chart-card">
      <p className="cout-chart-card-title">Répartition globale des coûts dépôt</p>
      <p className="mb-4 text-3xl font-bold" style={{ color: "#1D9E75" }}>
        <AnimatedNumber value={total} duration={1000} decimals={3} suffix=" TND" />
      </p>
      <StackedCostBlock segments={segments} segmentCascade />
    </div>
  );
}
