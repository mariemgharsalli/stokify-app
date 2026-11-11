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

export default function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor = "#1D9E75",
  formatValue,
  pulse = false,
  valueClassName = "",
  delayIndex = 0,
  isCurrency = false,
  children,
}) {
  const animated = useAnimatedNumber(isCurrency ? value : value, 1200);
  const display = formatValue
    ? formatValue(animated)
    : isCurrency
      ? `${Number(animated).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`
      : Math.round(animated).toLocaleString("fr-FR");

  return (
    <div
      className="kpi-card group rounded-xl border border-[var(--border-default)] p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        background: "var(--bg-card)",
        borderLeft: `3px solid ${accentColor}`,
        animationDelay: `${delayIndex * 60}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{title}</p>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${valueClassName}`}
            style={{ color: accentColor }}
          >
            {display}
          </p>
          {subtitle ? (
            <p className="mt-1.5 text-xs text-[var(--text-secondary)] leading-snug">{subtitle}</p>
          ) : null}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${pulse && Number(value) > 0 ? "badge-urgent" : ""}`}
          style={{ background: `${accentColor}15`, color: accentColor }}
        >
          {Icon ? <Icon size={20} strokeWidth={1.75} aria-hidden /> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
