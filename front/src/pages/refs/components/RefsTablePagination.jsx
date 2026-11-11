/** Pagination réutilisable — référentiels (familles, marques, …) */
export default function RefsTablePagination({
  page,
  pages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  entityLabel = "élément",
  entityLabelPlural,
  pageSizeOptions = [5, 10, 15, 20],
  selectAriaLabel,
}) {
  if (!total) return null;

  const plural = entityLabelPlural ?? `${entityLabel}s`;
  const label = total !== 1 ? plural : entityLabel;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5"
      style={{
        borderColor: "var(--border-default, var(--color-border-tertiary))",
        background: "var(--bg-card, var(--color-background-primary))",
      }}
    >
      <div
        className="flex flex-wrap items-center gap-3 text-sm"
        style={{ color: "var(--text-secondary, var(--color-text-secondary))" }}
      >
        <span className="tabular-nums">
          {from} à {to} sur {total} {label}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs">Afficher</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border px-2 py-1 text-sm outline-none"
              style={{
                borderColor: "var(--border-default, var(--color-border-secondary))",
                background: "var(--bg-input, var(--color-background-secondary))",
                color: "var(--text-primary, var(--color-text-primary))",
              }}
              aria-label={selectAriaLabel ?? `${entityLabel}s par page`}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
          style={{
            borderColor: "var(--border-default, var(--color-border-secondary))",
            color: "var(--text-primary, var(--color-text-primary))",
          }}
        >
          Précédent
        </button>
        <span
          className="min-w-[4rem] text-center text-sm tabular-nums"
          style={{ color: "var(--text-muted, var(--color-text-tertiary))" }}
        >
          {page} / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          className="rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
          style={{
            borderColor: "var(--border-default, var(--color-border-secondary))",
            color: "var(--text-primary, var(--color-text-primary))",
          }}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
