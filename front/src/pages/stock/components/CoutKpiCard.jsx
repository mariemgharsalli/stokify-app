import { useEffect, useState } from "react";
import ProgressRing from "./ProgressRing";

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
 * polarité métier pour le delta :
 * - "cost" : hausse = mauvaise (rouge), baisse = bonne (vert)
 * - "profit" : hausse = bonne (vert), baisse = mauvaise (rouge)
 */
function resolveDeltaClass(deltaPct, polarity = "cost") {
  const n = Number(deltaPct);
  if (!Number.isFinite(n) || n === 0) return "cout-kpi-delta--flat";
  const up = n > 0;
  if (polarity === "profit") {
    return up ? "cout-kpi-delta--up-good" : "cout-kpi-delta--down-bad";
  }
  return up ? "cout-kpi-delta--up-bad" : "cout-kpi-delta--down-good";
}

/** Carte KPI — fond solide, cascade, delta sémantique. */
export default function CoutKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor = "#1D9E75",
  formatValue,
  pulse = false,
  pulseHalo = false,
  valueClassName = "",
  delayIndex = 0,
  isCurrency = false,
  isTextValue = false,
  children,
  ring,
  barPct,
  className = "",
  /** Variation % vs période précédente (ex. 12.5 ou -3.2) */
  deltaPct = null,
  /** "cost" | "profit" — sens métier de la couleur */
  deltaPolarity = "cost",
  deltaLabel,
}) {
  const animated = useAnimatedNumber(isTextValue ? 0 : value, 1200);

  const display = isTextValue
    ? value
    : formatValue
      ? formatValue(animated)
      : isCurrency
        ? `${Number(animated).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`
        : Math.round(animated).toLocaleString("fr-FR");

  const resolvedBar =
    barPct != null
      ? Math.min(100, Math.max(4, barPct))
      : isTextValue
        ? 10
        : isCurrency && Number(value) > 0
          ? 70
          : !isTextValue && Number(value) > 0
            ? Math.min(100, Math.max(18, Number(value)))
            : 12;

  const hasDelta = deltaPct != null && Number.isFinite(Number(deltaPct));
  const deltaNum = hasDelta ? Number(deltaPct) : 0;
  const deltaArrow = deltaNum > 0 ? "▲" : deltaNum < 0 ? "▼" : "—";
  const deltaClass = hasDelta ? resolveDeltaClass(deltaNum, deltaPolarity) : "";

  return (
    <div
      className={`cout-kpi-card group relative overflow-hidden rounded-xl p-5 ${pulseHalo ? "cout-kpi-pulse-halo" : ""} ${className}`}
      style={{
        "--cout-kpi-accent": accentColor,
        borderLeftWidth: "4px",
        borderLeftColor: accentColor,
        animationDelay: `${delayIndex * 70}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</p>
          <p
            className={`cout-kpi-value mt-1 text-2xl font-bold tabular-nums tracking-tight ${valueClassName}`}
            style={{ color: accentColor }}
          >
            {display}
          </p>
          {hasDelta ? (
            <span
              className={`cout-kpi-delta ${deltaClass}`}
              style={{ animationDelay: `${delayIndex * 70 + 200}ms` }}
              title={deltaLabel || "vs période précédente"}
            >
              <span aria-hidden>{deltaArrow}</span>
              {Math.abs(deltaNum).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%
              {deltaLabel ? <span className="ml-1 font-medium opacity-70">{deltaLabel}</span> : null}
            </span>
          ) : null}
          {subtitle ? (
            <p className="mt-1.5 text-xs leading-snug text-[var(--text-secondary)]">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {ring ? (
            <ProgressRing {...ring} />
          ) : (
            <div
              className={`cout-kpi-icon-wrap flex h-10 w-10 items-center justify-center rounded-lg ${pulse && Number(value) > 0 ? "badge-urgent" : ""}`}
              style={{
                background: accentColor,
                color: "#fff",
              }}
            >
              {Icon ? <Icon size={20} strokeWidth={1.75} aria-hidden /> : null}
            </div>
          )}
        </div>
      </div>

      {!ring && (
        <div
          className="relative mt-3 h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-default)" }}
        >
          <div
            className="cout-kpi-bar absolute left-0 top-0 h-full rounded-full"
            style={{
              "--bar-target": `${resolvedBar}%`,
              width: `${resolvedBar}%`,
              background: accentColor,
              animationDelay: `${delayIndex * 70 + 150}ms`,
            }}
          />
        </div>
      )}

      {children}
    </div>
  );
}
