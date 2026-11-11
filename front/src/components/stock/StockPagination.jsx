import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function StockPagination({
  page,
  totalPages,
  totalResults,
  pageSize,
  rangeStart,
  rangeEnd,
  unitLabel = "résultat(s)",
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = "",
}) {
  const nums = useMemo(() => {
    if (totalPages <= 1) return [1];
    const out = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, Math.max(start + 4, page + 2));
    const from = Math.max(1, end - 4);
    for (let p = from; p <= end; p += 1) out.push(p);
    return out;
  }, [page, totalPages]);

  if (totalResults === 0) return null;

  return (
    <div
      className={`mb-20 flex flex-col gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 sm:mb-24 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          Par page
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--accent-primary)_50%,transparent)]"
            aria-label="Nombre par page"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text-secondary)]">
            {rangeStart}–{rangeEnd}
          </span>{" "}
          sur{" "}
          <span className="font-medium text-[var(--text-secondary)]">{totalResults}</span>{" "}
          {unitLabel}
        </p>
      </div>

      {/* mr réserve l'espace du FAB Stoki (bottom-right) pour garder « page suivante » cliquable */}
      <div className="mr-16 flex items-center gap-1 sm:mr-20">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {nums.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange?.(p)}
            className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
              p === page
                ? "text-white shadow-sm"
                : "border border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            }`}
            style={p === page ? { background: "var(--accent-primary)" } : undefined}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange?.(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
