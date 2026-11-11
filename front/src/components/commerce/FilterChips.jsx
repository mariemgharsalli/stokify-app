import { X } from "lucide-react";

export default function FilterChips({ chips = [], onClearAll }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[var(--text-muted)]">[{chips.length}] filtre(s) actif(s)</span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.onRemove}
          className="filter-chip inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          {c.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs text-[var(--text-link)] hover:underline"
      >
        Tout effacer
      </button>
    </div>
  );
}
