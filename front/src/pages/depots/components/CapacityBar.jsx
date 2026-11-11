import { useEffect, useState } from "react";

export function fillColor(pct, theme = false) {
  if (theme) {
    if (pct > 85) return "var(--accent-danger)";
    if (pct >= 60) return "var(--accent-warning)";
    return "var(--accent-success)";
  }
  if (pct > 85) return "#ef4444";
  if (pct >= 60) return "#f59e0b";
  return "#10b981";
}

export default function CapacityBar({
  value = 0,
  height = 8,
  animate = true,
  className = "",
  theme = false,
  label,
  suffix = "",
  capacity,
}) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const [width, setWidth] = useState(animate ? 0 : pct);
  const color = fillColor(pct, theme);
  const pulse = pct > 85;

  useEffect(() => {
    if (!animate) {
      setWidth(pct);
      return undefined;
    }
    const t = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(t);
  }, [pct, animate]);

  const bar = (
    <div
      className={`w-full overflow-hidden rounded-full ${theme ? "bg-[var(--bg-hover)]" : "bg-white/5"} ${className}`}
      style={{ height }}
      title={`${pct}%`}
    >
      <div
        className={`h-full rounded-full transition-all duration-1000 ease-out ${pulse ? "animate-pulse-capacity" : ""}`}
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );

  if (!label) return bar;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-[var(--text-muted)]">{label}</span>
        <span className="tabular-nums text-[var(--text-secondary)]">
          {capacity != null
            ? `${Number(capacity).toLocaleString("fr-FR")}${suffix ? ` ${suffix}` : ""}`
            : `${pct}%`}
        </span>
      </div>
      {bar}
    </div>
  );
}
