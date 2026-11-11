import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Pagination espace client — pages + option « par page ».
 */
export default function ClientPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [6, 9, 12, 24],
  label = "résultats",
}) {
  if (!totalItems || totalItems <= 0) return null;

  const pagesCount = Math.max(1, totalPages || 1);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const pages = [];
  const maxButtons = 5;
  let start = Math.max(1, page - Math.floor(maxButtons / 2));
  let end = Math.min(pagesCount, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <div className="client-pagination">
      <div className="client-pagination__meta-row">
        <p className="client-pagination__meta">
          <strong>
            {from}–{to}
          </strong>{" "}
          sur {totalItems} {label}
        </p>

        {onPageSizeChange && (
          <label className="client-pagination__size">
            <span>Par page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label={`${label} par page`}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="client-pagination__controls">
        <button
          type="button"
          className="client-pagination__nav"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pagesCount > 1 && start > 1 && (
          <>
            <button type="button" className="client-pagination__page" onClick={() => onPageChange(1)}>
              1
            </button>
            {start > 2 && <span className="client-pagination__ellipsis">…</span>}
          </>
        )}

        {pagesCount > 1 &&
          pages.map((p) => (
            <button
              key={p}
              type="button"
              className={`client-pagination__page ${p === page ? "is-active" : ""}`}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          ))}

        {pagesCount === 1 && (
          <button type="button" className="client-pagination__page is-active" aria-current="page">
            1
          </button>
        )}

        {pagesCount > 1 && end < pagesCount && (
          <>
            {end < pagesCount - 1 && <span className="client-pagination__ellipsis">…</span>}
            <button type="button" className="client-pagination__page" onClick={() => onPageChange(pagesCount)}>
              {pagesCount}
            </button>
          </>
        )}

        <button
          type="button"
          className="client-pagination__nav"
          disabled={page >= pagesCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Page suivante"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
