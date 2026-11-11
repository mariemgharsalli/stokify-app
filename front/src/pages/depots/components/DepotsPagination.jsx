/** Pagination liste dépôts — même pattern que Tiers / Achats */
export default function DepotsPagination({ page, pages, total, pageSize, onPageChange, onPageSizeChange }) {
  if (!total) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2"
      style={{
        borderColor: "var(--color-border-tertiary, var(--border-default))",
        background: "var(--color-background-primary, var(--bg-card))",
      }}
    >
      <div
        className="flex flex-wrap items-center gap-3 text-sm"
        style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}
      >
        <span className="tabular-nums">
          {from} à {to} sur {total} dépôt{total !== 1 ? "s" : ""}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Afficher</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border px-2 py-1 text-sm outline-none"
              style={{
                borderColor: "var(--color-border-secondary, var(--border-default))",
                background: "var(--color-background-secondary, var(--bg-app))",
                color: "var(--color-text-primary, var(--text-primary))",
              }}
              aria-label="Dépôts par page"
            >
              {[6, 9, 12].map((n) => (
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
          className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
          style={{
            borderColor: "var(--color-border-secondary, var(--border-default))",
            color: "var(--color-text-primary, var(--text-primary))",
          }}
        >
          Précédent
        </button>
        <span
          className="text-sm tabular-nums"
          style={{ color: "var(--color-text-tertiary, var(--text-muted))" }}
        >
          {page} / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
          style={{
            borderColor: "var(--color-border-secondary, var(--border-default))",
            color: "var(--color-text-primary, var(--text-primary))",
          }}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
