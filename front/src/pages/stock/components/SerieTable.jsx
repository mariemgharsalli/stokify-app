import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  ArrowRightLeft,
  Calendar,
  ClipboardList,
  Hash,
  ImageIcon,
  Link2,
  Package,
  Pencil,
  RotateCcw,
  Settings2,
  Timer,
  Warehouse,
} from "lucide-react";
import { getArticleRealImageUrl } from "../../../utils/articleImage";
import {
  tableCellClass,
  tableHeadClass,
  tableShellClass,
} from "../../articles/components/articlesTheme";

export const SERIE_STATUT_CFG = {
  DISPONIBLE: {
    label: "Disponible",
    cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
  VENDU: {
    label: "Vendu",
    cls: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  RETOURNE: {
    label: "Retourné",
    cls: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  DEFECTUEUX: {
    label: "Défectueux",
    cls: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-300",
  },
  DESACTIVE: {
    label: "Désactivé",
    cls: "border-slate-500/30 bg-slate-500/15 text-slate-500 dark:text-slate-300",
  },
};

export const SERIE_TABLE_COLUMNS = [
  { key: "img", label: "Image", Icon: ImageIcon, width: "64px" },
  { key: "numero", label: "N° Série", Icon: Hash, width: "160px" },
  { key: "article", label: "Article", Icon: Package, width: "180px" },
  { key: "depot", label: "Dépôt", Icon: Warehouse, width: "110px", hide: "md" },
  { key: "lot", label: "Lot", Icon: Link2, width: "120px" },
  { key: "statut", label: "Statut", Icon: Timer, width: "120px" },
  { key: "created", label: "Créé le", Icon: Calendar, width: "110px", hide: "md" },
  { key: "actions", label: "Actions", Icon: Settings2, width: "200px" },
];

function columnHideClass(hide) {
  if (hide === "md") return "hidden md:table-cell";
  return "";
}

export const SERIES_TABLE_UI_CSS = `
  @keyframes serieRowIn {
    from { opacity: 0; transform: translateX(-6px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes serieIconPop {
    0% { transform: scale(0.85); }
    60% { transform: scale(1.08); }
    100% { transform: scale(1); }
  }
  .serie-table-wrap table { table-layout: fixed; }
  .serie-table-row {
    animation: serieRowIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
    transition: background-color 0.2s ease;
  }
  .serie-table-row:nth-child(even) {
    background: rgba(255, 255, 255, 0.015);
  }
  .serie-table-row:hover {
    background: rgba(55, 138, 221, 0.07) !important;
  }
  .serie-table-row.is-disabled {
    opacity: 0.72;
  }
  .serie-action-btn:hover svg {
    animation: serieIconPop 0.35s ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .serie-table-row, .serie-action-btn:hover svg {
      animation: none !important;
    }
  }
`;

const ACTION_STYLES = {
  history: {
    idle: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400 dark:bg-sky-500/15 dark:border-sky-500/25",
    hover: "hover:bg-sky-500 hover:text-white hover:border-sky-500 hover:shadow-lg hover:shadow-sky-500/30",
  },
  transfer: {
    idle: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/15 dark:border-amber-500/25",
    hover: "hover:bg-amber-500 hover:text-white hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/30",
  },
  assign: {
    idle: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400 dark:bg-cyan-500/15 dark:border-cyan-500/25",
    hover: "hover:bg-cyan-500 hover:text-white hover:border-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30",
  },
  edit: {
    idle: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-300 dark:bg-sky-500/12 dark:border-sky-500/25",
    hover: "hover:bg-[#378ADD] hover:text-white hover:border-[#378ADD] hover:shadow-lg hover:shadow-sky-500/30",
  },
  archive: {
    idle: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400 dark:bg-rose-500/15 dark:border-rose-500/25",
    hover: "hover:bg-rose-500 hover:text-white hover:border-rose-500 hover:shadow-lg hover:shadow-rose-500/30",
  },
  restore: {
    idle: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/15 dark:border-emerald-500/25",
    hover: "hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/30",
  },
};

function SerieActionIcon({ variant = "history", title, onClick, disabled, children }) {
  const s = ACTION_STYLES[variant] || ACTION_STYLES.history;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`serie-action-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all duration-250 ease-out hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 ${s.idle} ${s.hover}`}
    >
      {children}
    </button>
  );
}

function SerieThumb({ serie }) {
  const [err, setErr] = useState(false);
  const src = getArticleRealImageUrl(serie?.article);
  const label = serie?.article?.libelle || serie?.numero || "";

  if (!src || err) {
    return (
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)]">
        <Hash className="h-4 w-4" aria-hidden />
      </div>
    );
  }
  return (
    <div className="mx-auto h-11 w-11 overflow-hidden rounded-lg border border-[var(--border-default)]">
      <img
        src={src}
        alt={label}
        onError={() => setErr(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function StatutBadge({ statut }) {
  const cfg = SERIE_STATUT_CFG[statut] || {
    label: statut,
    cls: "border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-muted)]",
  };
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function LotBadge({ lot }) {
  if (!lot?.numero) {
    return <span className="text-xs text-[var(--text-muted)]">—</span>;
  }
  return (
    <span className="inline-flex rounded-md border border-sky-500/30 bg-sky-500/12 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-600 dark:text-sky-300">
      {lot.numero}
    </span>
  );
}

export function SerieTableColGroup() {
  return (
    <colgroup>
      {SERIE_TABLE_COLUMNS.map((col) => (
        <col key={col.key} style={{ width: col.width }} />
      ))}
    </colgroup>
  );
}

export function SerieTableHead() {
  return (
    <tr>
      {SERIE_TABLE_COLUMNS.map((col) => {
        const Icon = col.Icon;
        return (
          <th
            key={col.key}
            scope="col"
            className={`${tableHeadClass} ${columnHideClass(col.hide)} ${
              col.key === "actions" ? "border-r-0 text-right" : ""
            }`}
          >
            <span className="inline-flex items-center gap-1 truncate">
              {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" strokeWidth={2.25} /> : null}
              <span className="truncate">{col.label}</span>
            </span>
          </th>
        );
      })}
    </tr>
  );
}

export function SerieTableRow({
  serie,
  index,
  canWrite,
  deactivatePending,
  onHistory,
  onTransfer,
  onAssign,
  onEdit,
  onDesactiver,
  onReactivate,
}) {
  const reduceMotion = useReducedMotion();
  const articleLabel = serie.article?.libelle || "—";
  const isDisabled = String(serie.statut || "").toUpperCase() === "DESACTIVE";

  return (
    <motion.tr
      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: isDisabled ? 0.78 : 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.35), duration: 0.28 }}
      className={`serie-table-row group border-t border-[var(--border-default)]/50 ${isDisabled ? "is-disabled" : ""}`}
      style={{ animationDelay: `${Math.min(index * 30, 280)}ms` }}
    >
      <td className={tableCellClass}>
        <SerieThumb serie={serie} />
      </td>

      <td className={tableCellClass}>
        <span
          className="block truncate font-mono text-sm font-bold tracking-wide text-[var(--accent-primary)]"
          title={serie.numero}
        >
          {serie.numero}
        </span>
      </td>

      <td className={tableCellClass}>
        <span
          className="block truncate text-xs font-medium text-[var(--text-primary)]"
          title={articleLabel}
        >
          {articleLabel}
        </span>
        <span className="block truncate font-mono text-[10px] text-[var(--text-muted)]">
          {serie.article?.code || "—"}
        </span>
      </td>

      <td className={`${tableCellClass} ${columnHideClass("md")}`}>
        <span className="block truncate text-xs text-[var(--text-muted)]" title={serie.depot?.libelle}>
          {serie.depot?.code || serie.depot?.libelle || "—"}
        </span>
      </td>

      <td className={tableCellClass}>
        <LotBadge lot={serie.lot} />
      </td>

      <td className={tableCellClass}>
        <StatutBadge statut={serie.statut} />
      </td>

      <td className={`${tableCellClass} ${columnHideClass("md")}`}>
        <span className="text-xs tabular-nums text-[var(--text-muted)]">{fmtDate(serie.createdAt)}</span>
      </td>

      <td className={`${tableCellClass} border-r-0`}>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <SerieActionIcon variant="history" title="Historique mouvements" onClick={() => onHistory?.(serie)}>
            <ClipboardList size={14} strokeWidth={2.25} />
          </SerieActionIcon>
          {canWrite ? (
            <>
              {!isDisabled ? (
                <>
                  <SerieActionIcon variant="transfer" title="Transférer" onClick={() => onTransfer?.(serie)}>
                    <ArrowRightLeft size={14} strokeWidth={2.25} />
                  </SerieActionIcon>
                  <SerieActionIcon variant="assign" title="Assigner à un lot" onClick={() => onAssign?.(serie)}>
                    <Link2 size={14} strokeWidth={2.25} />
                  </SerieActionIcon>
                  <SerieActionIcon variant="edit" title="Modifier" onClick={() => onEdit?.(serie)}>
                    <Pencil size={14} strokeWidth={2.25} />
                  </SerieActionIcon>
                  <SerieActionIcon
                    variant="archive"
                    title="Désactiver"
                    disabled={deactivatePending}
                    onClick={() => onDesactiver?.(serie)}
                  >
                    <Archive size={14} strokeWidth={2.25} />
                  </SerieActionIcon>
                </>
              ) : (
                <SerieActionIcon
                  variant="restore"
                  title="Réactiver"
                  disabled={deactivatePending}
                  onClick={() => onReactivate?.(serie)}
                >
                  <RotateCcw size={14} strokeWidth={2.25} />
                </SerieActionIcon>
              )}
            </>
          ) : null}
        </div>
      </td>
    </motion.tr>
  );
}

export default function SerieTable({
  items,
  isLoading,
  empty,
  canWrite,
  deactivatePending,
  onHistory,
  onTransfer,
  onAssign,
  onEdit,
  onDesactiver,
  onReactivate,
}) {
  return (
    <div className={`${tableShellClass} serie-table-wrap`}>
      <style>{SERIES_TABLE_UI_CSS}</style>
      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full text-sm">
          <SerieTableColGroup />
          <thead>
            <SerieTableHead />
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-[var(--border-default)]/50">
                    {SERIE_TABLE_COLUMNS.map((col) => (
                      <td key={col.key} className={tableCellClass}>
                        <div className="h-4 animate-pulse rounded bg-[var(--bg-hover)]" />
                      </td>
                    ))}
                  </tr>
                ))
              : items.length === 0
                ? (
                    <tr>
                      <td colSpan={SERIE_TABLE_COLUMNS.length} className="px-4 py-16 text-center">
                        {empty || (
                          <>
                            <Hash className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              Aucun numéro de série
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              Créez un numéro ou modifiez vos filtres
                            </p>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                : items.map((serie, index) => (
                    <SerieTableRow
                      key={serie.id}
                      serie={serie}
                      index={index}
                      canWrite={canWrite}
                      deactivatePending={deactivatePending}
                      onHistory={onHistory}
                      onTransfer={onTransfer}
                      onAssign={onAssign}
                      onEdit={onEdit}
                      onDesactiver={onDesactiver}
                      onReactivate={onReactivate}
                    />
                  ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
