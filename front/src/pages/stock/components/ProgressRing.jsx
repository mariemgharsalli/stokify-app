import { useEffect, useId, useState } from "react";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Anneau de progression SVG — style net et lisible. */
export default function ProgressRing({
  value = 0,
  max = 100,
  color = "#378ADD",
  gradientTo,
  label,
  size = 72,
  strokeWidth,
  className = "",
  formatValue,
  animate = true,
  duration = 900,
}) {
  const [animatedPct, setAnimatedPct] = useState(animate ? 0 : null);
  const uid = useId().replace(/:/g, "");
  const sw = strokeWidth ?? Math.max(4, Math.round(size * 0.09));
  const radius = (size - sw) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetPct = max > 0 ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0;
  const gradEnd = gradientTo || color;
  const gradId = `ring-grad-${uid}`;

  useEffect(() => {
    if (!animate) {
      setAnimatedPct(targetPct);
      return undefined;
    }
    setAnimatedPct(0);
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setAnimatedPct(targetPct * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetPct, animate, duration]);

  const pct = animatedPct ?? targetPct;
  const offset = circumference - (pct / 100) * circumference;
  const center = size / 2;
  const display = formatValue != null ? formatValue(value) : `${Math.round(pct)}%`;

  return (
    <div
      className={`cout-progress-ring relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={gradEnd} />
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--bg-input)"
          strokeWidth={sw}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: animate ? `stroke-dashoffset ${duration}ms ${EASE}` : undefined }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-sm font-bold tabular-nums leading-none cout-kpi-value" style={{ color }}>
          {display}
        </span>
        {label ? (
          <span className="mt-0.5 max-w-[90%] truncate text-[8px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Couleur gravité dead stock. */
export function gravityRingColors(pct) {
  if (pct >= 60) return { color: "#E24B4A", gradientTo: "#C23A39" };
  if (pct >= 30) return { color: "#BA7517", gradientTo: "#E8A020" };
  return { color: "#1D9E75", gradientTo: "#2BC492" };
}

export function hexToRgba(hex, alpha) {
  const h = String(hex || "#378ADD").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
