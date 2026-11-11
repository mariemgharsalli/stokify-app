import { useMemo } from "react";
import { accentColorFromString } from "./refsUtils";

/** Barre segmentée : répartition d'articles par sous-famille (branches de l'arbre). */
export default function RefsSegmentBar({ segments, parentSeed, className = "" }) {
  const total = useMemo(
    () => segments.reduce((s, seg) => s + (Number(seg.value) || 0), 0),
    [segments]
  );

  if (!segments.length || total === 0) return null;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        Répartition par branche
      </p>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
        {segments.map((seg) => {
          const pct = (seg.value / total) * 100;
          const color = accentColorFromString(`${parentSeed}-${seg.id}`);
          return (
            <div
              key={seg.id}
              className="h-full transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full"
              style={{ width: `${pct}%`, backgroundColor: color }}
              title={`${seg.label}: ${seg.value} article(s) (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((seg) => {
          const color = accentColorFromString(`${parentSeed}-${seg.id}`);
          return (
            <span key={seg.id} className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              {seg.label} ({seg.value})
            </span>
          );
        })}
      </div>
    </div>
  );
}
