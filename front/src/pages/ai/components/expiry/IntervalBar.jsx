import { motion, useReducedMotion } from "framer-motion";
import { useCountUp } from "../../../../hooks/useCountUp";
import { IA } from "../../moduleIaTheme";

export function ProbaGauge({ proba = 0 }) {
  const reduce = useReducedMotion();
  const shown = useCountUp((Number(proba) || 0) * 100, 700, 0);
  const pct = Math.max(0, Math.min(100, shown));
  const r = 18;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="flex items-center gap-2">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke={IA.track} strokeWidth="4" />
        <motion.circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--accent-warning)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - dash }}
          transform="rotate(-90 24 24)"
          transition={reduce ? { duration: 0 } : { duration: 0.6 }}
        />
      </svg>
      <div>
        <p className="text-[10px] font-bold uppercase" style={{ color: IA.muted }}>Proba</p>
        <p className="font-mono text-sm font-semibold tabular-nums" style={{ color: IA.text }}>{Math.round(pct)} %</p>
      </div>
    </div>
  );
}

export function IntervalBar({ p10 = 0, p50 = 0, p90 = 0 }) {
  const reduce = useReducedMotion();
  const hi = Math.max(Number(p90) || 0, Number(p50) || 0, Number(p10) || 0, 1);
  const x = (v) => Math.max(0, Math.min(100, ((Number(v) || 0) / hi) * 100));
  const a = x(p10);
  const b = x(p90);
  const m = x(p50);
  return (
    <div>
      <svg viewBox="0 0 100 18" className="w-full" role="img" aria-label="Intervalle P10 P50 P90">
        <rect x="0" y="7" width="100" height="4" rx="2" fill={IA.track} />
        <motion.rect
          y="7"
          height="4"
          rx="2"
          fill="var(--accent-warning)"
          initial={reduce ? { x: a, width: Math.max(0.8, b - a) } : { x: a, width: 0 }}
          animate={{ x: a, width: Math.max(0.8, b - a) }}
          transition={reduce ? { duration: 0 } : { duration: 0.55 }}
        />
        <circle cx={m} cy="9" r="3.2" fill="var(--accent-primary)" />
      </svg>
      <div className="mt-0.5 flex justify-between font-mono text-[10px]" style={{ color: IA.muted }}>
        <span>P10 {Math.round(Number(p10) || 0)}</span>
        <span>P50 {Math.round(Number(p50) || 0)}</span>
        <span>P90 {Math.round(Number(p90) || 0)}</span>
      </div>
    </div>
  );
}

export function DriverChips({ drivers = [] }) {
  const rows = (drivers || []).slice(0, 3);
  if (!rows.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {rows.map((d) => {
        const up = Number(d.impact) > 0;
        const color = up ? "var(--accent-danger)" : "var(--accent-success)";
        const pts = Math.round(Math.abs(Number(d.impact) || 0) * 100);
        return (
          <span
            key={d.key}
            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={{
              color,
              borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
            }}
          >
            {d.label} {up ? "+" : "−"}{pts} pts
          </span>
        );
      })}
    </div>
  );
}
