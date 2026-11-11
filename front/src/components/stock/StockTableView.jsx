import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown, Package } from "lucide-react";
import { stockLevelColor, getLineStockMin } from "../../hooks/useStockGroupes";
import {
  tableCellClass,
  tableHeadClass,
  tableShellClass,
} from "../../pages/articles/components/articlesTheme";
import StockLineActions from "./StockLineActions";
import { STATUT_CONFIG, parseLineStatut } from "./stockUi";
import ArticleThumb from "./ArticleThumb";

function TableSkeleton() {
  return (
    <div className="divide-y divide-[var(--border-default)]">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 animate-pulse">
          <div className="h-10 w-10 rounded-xl bg-[var(--bg-hover)]" />
          <div className="h-4 flex-1 rounded bg-[var(--bg-hover)]" />
          <div className="h-4 w-24 rounded bg-[var(--bg-hover)]" />
          <div className="h-4 w-20 rounded bg-[var(--bg-hover)]" />
        </div>
      ))}
    </div>
  );
}

export default function StockTableView({
  rows,
  isLoading,
  sortBy,
  sortDir,
  onToggleSort,
  onTransfer,
  onEmplacementTransfer,
  onQrClick,
  actionsPending,
  rotationMap,
  pageSlice,
  rangeStart,
  rangeEnd,
  totalResults,
  safePage,
  totalPages,
  pageSize = 25,
  onPageSizeChange,
  onPagePrev,
  onPageNext,
  hidePagination = false,
}) {
  const reduceMotion = useReducedMotion();
  const isEmpty = hidePagination
    ? !(pageSlice?.length)
    : totalResults === 0 || !(pageSlice?.length);

  if (isLoading) {
    return (
      <div className={tableShellClass}>
        <TableSkeleton />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <motion.div
        className="relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed px-6 py-20 text-center"
        style={{
          background:
            "linear-gradient(160deg, color-mix(in srgb, #378ADD 10%, var(--bg-card)), var(--bg-card))",
          borderColor: "rgba(55,138,221,0.28)",
        }}
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Package size={40} className="text-sky-400/50" aria-hidden="true" />
        <p className="text-lg font-semibold text-[var(--text-primary)]">Aucune ligne de stock trouvée</p>
        <p className="max-w-md text-sm text-[var(--text-muted)]">
          Modifiez vos filtres ou ajoutez une nouvelle ligne de stock.
        </p>
      </motion.div>
    );
  }

  const SortBtn = ({ col, label, align = "left" }) => (
    <button
      type="button"
      onClick={() => onToggleSort(col)}
      className={`inline-flex items-center gap-1 font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] ${
        align === "right" ? "ml-auto" : ""
      }`}
    >
      {label}
      {sortBy === col ? (
        sortDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
      ) : (
        <ArrowUpDown size={14} className="opacity-40" />
      )}
    </button>
  );

  return (
    <div className={`${tableShellClass} stock-table-wrap`}>
      <style>{`
        .stock-table-row:nth-child(even) { background: rgba(255,255,255,0.015); }
        .stock-table-row:hover { background: rgba(55,138,221,0.07) !important; }
      `}</style>
      <div className="max-h-[min(60vh,520px)] overflow-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${tableHeadClass} text-left`}>
                <SortBtn col="article" label="Article" />
              </th>
              <th className={tableHeadClass}>Dépôt</th>
              <th className={tableHeadClass}>Emplacement</th>
              <th className={`${tableHeadClass} text-right`}>
                <SortBtn col="quantite" label="Quantité" align="right" />
              </th>
              <th className={`${tableHeadClass} text-center`}>Niveau</th>
              <th className={tableHeadClass}>Statut</th>
              <th className={`${tableHeadClass} border-r-0 text-center min-w-[9rem]`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {pageSlice.map((row, i) => {
              const q = Number(row.quantite) || 0;
              const min = getLineStockMin(row);
              const levelColor = stockLevelColor(q, min);
              const statKey = parseLineStatut(row);
              const s = STATUT_CONFIG[statKey] || STATUT_CONFIG.ACTIF;
              const aid = row.articleId ?? row.article?.id;
              const rotationLabel = rotationMap?.get?.(aid);

              return (
                <motion.tr
                  key={row.id}
                  initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.35), duration: 0.28 }}
                  className="stock-table-row group border-t border-[var(--border-default)]/50"
                >
                  <td className={tableCellClass}>
                    <div className="flex items-center gap-3">
                      <ArticleThumb
                        article={row.article}
                        alt={row.article?.libelle || ""}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-300">
                          {row.article?.code}
                        </span>
                        <div className="mt-1 truncate text-xs font-medium text-[var(--text-primary)]">
                          {row.article?.libelle}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={tableCellClass}>{row.depot?.libelle}</td>
                  <td className={`${tableCellClass} text-[var(--text-muted)]`}>
                    {row.emplacement
                      ? `${row.emplacement.code} — ${row.emplacement.libelle}`
                      : "—"}
                  </td>
                  <td className={`${tableCellClass} text-right`}>
                    <span className="font-semibold tabular-nums" style={{ color: levelColor }}>
                      {q.toLocaleString("fr-FR")}
                    </span>
                    <span className="ml-1 text-[11px] text-[var(--text-muted)]">
                      {row.article?.unite}
                    </span>
                  </td>
                  <td className={`${tableCellClass} text-center`}>
                    {q === 0 ? (
                      <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                        Rupture
                      </span>
                    ) : min != null && q <= min ? (
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        Critique
                      </span>
                    ) : (
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        OK
                      </span>
                    )}
                  </td>
                  <td className={tableCellClass}>
                    <span
                      className="inline-block rounded-md px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                    >
                      {s.label}
                    </span>
                    {rotationLabel ? (
                      <span className="ml-1 text-[10px] text-[var(--text-muted)]">
                        · {rotationLabel}
                      </span>
                    ) : null}
                  </td>
                  <td className={`${tableCellClass} border-r-0 text-center`}>
                    <StockLineActions
                      ligne={row}
                      onTransfer={onTransfer}
                      onEmplacementTransfer={onEmplacementTransfer}
                      onQrClick={onQrClick}
                      pending={actionsPending}
                    />
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!hidePagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] px-4 py-3">
          <p className="text-xs text-[var(--text-muted)]">
            {rangeStart}–{rangeEnd} sur {totalResults}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-xs"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={onPagePrev}
              className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Préc.
            </button>
            <span className="text-xs text-[var(--text-secondary)]">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={onPageNext}
              className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Suiv.
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
