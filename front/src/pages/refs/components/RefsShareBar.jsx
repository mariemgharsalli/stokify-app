import { useEffect, useState } from "react";

/** Barre de part proportionnelle (style CapacityBar) avec couleur personnalisée. */
export default function RefsShareBar({
  value = 0,
  color = "#7c3aed",
  secondaryColor,
  height = 6,
  label,
  suffix = "%",
  animate = true,
}) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const [width, setWidth] = useState(animate ? 0 : pct);
  const grad = secondaryColor
    ? `linear-gradient(90deg, ${color}, ${secondaryColor})`
    : color;

  useEffect(() => {
    if (!animate) {
      setWidth(pct);
      return undefined;
    }
    const t = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(t);
  }, [pct, animate]);

  return (
    <div className="mt-3">
      {label && (
        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
          <span>{label}</span>
          <span style={{ color }} className="font-medium">
            {Math.round(pct)}
            {suffix}
          </span>
        </div>
      )}
      <div
        className="w-full overflow-hidden rounded-full bg-white/5"
        style={{ height }}
        title={`${Math.round(pct)}${suffix}`}
      >
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${width}%`, background: grad }}
        />
      </div>
    </div>
  );
}
