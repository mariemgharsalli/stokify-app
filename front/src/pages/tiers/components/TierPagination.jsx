/** Pagination liste tiers — même pattern que Achats / Ventes */
export default function TierPagination({ page, pages, total, limit, onPageChange, onLimitChange }) {
  if (!total) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2"
      style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
    >
      <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
        <span className="tabular-nums">
          {from} à {to} sur {total} résultat{total !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <span>Afficher</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="rounded-lg border px-2 py-1"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
          style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
        >
          Précédent
        </button>
        <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>
          {page} / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
          style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
