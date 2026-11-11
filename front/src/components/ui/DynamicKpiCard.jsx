import { useEffect, useState } from "react";

function useAnimatedNumber(target, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
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
  }, [target, duration]);
  return value;
}

/**
 * KPI card with animated counter, shine sweep, hover glow and progress bar.
 * Aligned with Ventes / Règlements report interfaces.
 */
export default function DynamicKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor = "#378ADD",
  delayIndex = 0,
  barPct,
  pulse = false,
  intense = false,
  formatValue,
}) {
  const isNumeric = typeof value === "number" && !Number.isNaN(value);
  const animated = useAnimatedNumber(isNumeric ? value : 0, 1200);

  const display = formatValue
    ? formatValue(animated)
    : isNumeric
      ? Math.round(animated).toLocaleString("fr-FR")
      : String(value ?? "—");

  const resolvedBar =
    barPct != null
      ? Math.min(100, Math.max(4, barPct))
      : isNumeric && value > 0
        ? 68
        : 12;

  return (
    <div
      className={`dynamic-kpi-card group relative overflow-hidden rounded-xl border p-5 ${
        pulse ? "dynamic-kpi-card--pulse" : ""
      }`}
      style={{
        "--kpi-accent": accentColor,
        "--kpi-glow": intense ? `${accentColor}bb` : `${accentColor}55`,
        background: "var(--color-background-secondary, var(--bg-card))",
        borderColor: intense
          ? `color-mix(in srgb, ${accentColor} 35%, var(--color-border-tertiary, var(--border-subtle)))`
          : "var(--color-border-tertiary, var(--border-subtle))",
        borderLeftWidth: intense ? "4px" : "3px",
        borderLeftColor: accentColor,
        animationDelay: `${delayIndex * 80}ms`,
      }}
    >
      <div className="dynamic-kpi-shine pointer-events-none absolute inset-0" aria-hidden />

      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full"
        style={{
          background: `radial-gradient(circle at center, ${accentColor} 0%, transparent 68%)`,
          opacity: intense ? 0.14 : 0.08,
        }}
      />

      <div
        className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-40"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-text-tertiary, var(--text-muted))" }}
          >
            {title}
          </p>
          <p
            className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight"
            style={{ color: accentColor }}
          >
            {display}
          </p>
          {subtitle ? (
            <p
              className="mt-1.5 text-xs leading-snug"
              style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${
            pulse ? "badge-urgent" : ""
          }`}
          style={{
            background: intense
              ? `linear-gradient(145deg, ${accentColor}38, ${accentColor}14)`
              : `linear-gradient(145deg, ${accentColor}24, ${accentColor}0a)`,
            border: `1px solid ${accentColor}${intense ? "55" : "35"}`,
            color: accentColor,
            boxShadow: intense
              ? `0 8px 28px -2px ${accentColor}55`
              : `0 6px 20px -4px ${accentColor}30`,
          }}
        >
          {Icon ? <Icon size={20} strokeWidth={1.75} aria-hidden /> : null}
        </div>
      </div>

      <div
        className="relative mt-4 h-1.5 overflow-hidden rounded-full"
        style={{ background: "var(--color-border-tertiary, rgba(255,255,255,0.06))" }}
      >
        <div
          className="dynamic-kpi-bar absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${resolvedBar}%`,
            background: intense
              ? `linear-gradient(90deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, #7f1d1d))`
              : `linear-gradient(90deg, ${accentColor}cc, ${accentColor})`,
            boxShadow: intense ? `0 0 18px ${accentColor}88` : `0 0 14px ${accentColor}55`,
          }}
        />
      </div>
    </div>
  );
}

export function DynamicKpiGrid({ children, className = "" }) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-3 ${className}`}>{children}</div>
  );
}
