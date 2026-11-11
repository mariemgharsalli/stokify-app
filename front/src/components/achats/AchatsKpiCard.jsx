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

/** KPI card styling aligned with Ventes — used on Achats list only. */
export default function AchatsKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor,
  valueColor,
  formatValue,
  pulse = false,
  delayIndex = 0,
  isCurrency = false,
  solidIcon = false,
}) {
  const animated = useAnimatedNumber(value, 1200);
  const display = formatValue
    ? formatValue(animated)
    : isCurrency
      ? `${Number(animated).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`
      : Math.round(animated).toLocaleString("fr-FR");

  const resolvedValueColor = valueColor || accentColor;

  return (
    <div
      className="achats-kpi-card"
      style={{
        borderLeftColor: accentColor,
        animationDelay: `${delayIndex * 60}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{title}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: resolvedValueColor }}>
            {display}
          </p>
          {subtitle ? (
            <p className="mt-1.5 text-xs text-[var(--text-secondary)] leading-snug">{subtitle}</p>
          ) : null}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${pulse && Number(value) > 0 ? "badge-urgent" : ""}`}
          style={
            solidIcon
              ? { background: accentColor, color: "#fff" }
              : { background: `${accentColor}18`, color: accentColor }
          }
        >
          {Icon ? <Icon size={20} strokeWidth={1.75} aria-hidden /> : null}
        </div>
      </div>
    </div>
  );
}
