import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  Box,
  Calendar,
  ClipboardList,
  Eye,
  Hash,
  ImageIcon,
  Package,
  Pencil,
  QrCode,
  Settings2,
  Timer,
  Warehouse,
} from "lucide-react";
import { getArticleRealImageUrl } from "../../articles/ClientCatalog";
import {
  tableCellClass,
  tableHeadClass,
  tableShellClass,
} from "../../articles/components/articlesTheme";
import { STATUT_CFG, computeStatut, daysLeft, fmtDate, freshnessColor } from "../lotsUi";

export const LOT_TABLE_COLUMNS = [
  { key: "img", label: "Image", Icon: ImageIcon, width: "64px" },
  { key: "numero", label: "N° Lot", Icon: Hash, width: "130px" },
  { key: "article", label: "Article", Icon: Package, width: "180px" },
  { key: "depot", label: "Dépôt", Icon: Warehouse, width: "110px", hide: "md" },
  { key: "init", label: "Qté init.", Icon: Box, width: "90px", hide: "md" },
  { key: "rest", label: "Restante", Icon: Box, width: "120px" },
  { key: "dlc", label: "DLC", Icon: Calendar, width: "120px" },
  { key: "statut", label: "Statut", Icon: Timer, width: "100px" },
  { key: "actions", label: "Actions", Icon: Settings2, width: "200px" },
];

function columnHideClass(hide) {
  if (hide === "md") return "hidden md:table-cell";
  return "";
}

export const LOTS_TABLE_UI_CSS = `
  @keyframes lotRowIn {
    from { opacity: 0; transform: translateX(-6px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes lotIconPop {
    0% { transform: scale(0.85); }
    60% { transform: scale(1.08); }
    100% { transform: scale(1); }
  }
  .lot-table-wrap table { table-layout: fixed; }
  .lot-table-row {
    animation: lotRowIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
    transition: background-color 0.2s ease;
  }
  .lot-table-row:nth-child(even) {
    background: rgba(255, 255, 255, 0.015);
  }
  .lot-table-row:hover {
    background: rgba(55, 138, 221, 0.07) !important;
  }
  .lot-action-btn:hover svg {
    animation: lotIconPop 0.35s ease;
  }
`;

const ACTION_STYLES = {
  view: {
    idle: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400 dark:bg-sky-500/15 dark:border-sky-500/25",
    hover: "hover:bg-sky-500 hover:text-white hover:border-sky-500 hover:shadow-lg hover:shadow-sky-500/30",
  },
  qr: {
    idle: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400 dark:bg-cyan-500/15 dark:border-cyan-500/25",
    hover: "hover:bg-cyan-500 hover:text-white hover:border-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30",
  },
  trace: {
    idle: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400 dark:bg-blue-500/15 dark:border-blue-500/25",
    hover: "hover:bg-blue-500 hover:text-white hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/30",
  },
  edit: {
    idle: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-300 dark:bg-sky-500/12 dark:border-sky-500/25",
    hover: "hover:bg-[#378ADD] hover:text-white hover:border-[#378ADD] hover:shadow-lg hover:shadow-sky-500/30",
  },
  archive: {
    idle: "bg-slate-500/10 text-slate-500 border-slate-500/20 dark:text-slate-400 dark:bg-slate-500/15 dark:border-slate-500/25",
    hover: "hover:bg-slate-500 hover:text-white hover:border-slate-500 hover:shadow-lg hover:shadow-slate-500/30",
  },
  restore: {
    idle: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/15 dark:border-emerald-500/25",
    hover: "hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/30",
  },
};

function LotActionIcon({ variant = "view", title, onClick, disabled, children }) {
  const s = ACTION_STYLES[variant] || ACTION_STYLES.view;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`lot-action-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all duration-250 ease-out hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 ${s.idle} ${s.hover}`}
    >
      {children}
    </button>
  );
}

function LotThumb({ lot }) {
  const [err, setErr] = useState(false);
  const src = getArticleRealImageUrl(lot?.article);
  const label = lot?.article?.libelle || lot?.numero || "";

  if (!src || err) {
    return (
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)]">
        <Package className="h-4 w-4" aria-hidden />
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

function QtyCell({ initiale, restante }) {
  const init = Number(initiale) || 0;
  const rest = Number(restante) || 0;
  const pct = init > 0 ? Math.min(100, (rest / init) * 100) : 0;
  const color = pct <= 10 ? "#E24B4A" : pct <= 30 ? "#EF9F27" : "#1D9E75";

  return (
    <div className="min-w-[72px]">
      <p className="font-mono text-xs font-bold tabular-nums" style={{ color }}>
        {rest.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
      </p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--bg-hover)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <p className="mt-0.5 text-[10px] tabular-nums text-[var(--text-muted)]">
        {Math.round(pct)}%
      </p>
    </div>
  );
}

function DlcCell({ dateExpiration }) {
  const days = daysLeft(dateExpiration);
  const color = freshnessColor(dateExpiration);
  if (days === null) {
    return <span className="text-xs text-[var(--text-muted)]">Sans DLC</span>;
  }
  const label =
    days < 0
      ? `Expiré ${Math.abs(days)}j`
      : days === 0
        ? "Aujourd'hui"
        : `${days}j`;
  return (
    <div>
      <span
        className="inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums"
        style={{
          borderColor: `${color}44`,
          background: `${color}18`,
          color,
        }}
      >
        {label}
      </span>
      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{fmtDate(dateExpiration)}</p>
    </div>
  );
}

export function LotTableColGroup() {
  return (
    <colgroup>
      {LOT_TABLE_COLUMNS.map((col) => (
        <col key={col.key} style={{ width: col.width }} />
      ))}
    </colgroup>
  );
}

export function LotTableHead() {
  return (
    <tr>
      {LOT_TABLE_COLUMNS.map((col) => {
        const Icon = col.Icon;
        return (
          <th
            key={col.key}
            scope="col"
            className={`${tableHeadClass} ${columnHideClass(col.hide)} ${
              col.key === "actions" ? "border-r-0 text-right" : ""
            } ${col.key === "init" || col.key === "rest" ? "text-right" : ""}`}
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

export function LotTableRow({
  lot,
  index,
  isFefoPriority,
  canWrite,
  deactivatePending,
  onViewDetail,
  onQrCode,
  onTrace,
  onEdit,
  onDesactiver,
  onReactivate,
}) {
  const reduceMotion = useReducedMotion();
  const statut = computeStatut(lot);
  const cfg = STATUT_CFG[statut] || STATUT_CFG.ACTIF;
  const isDisabled = statut === "DESACTIVE";
  const articleLabel = lot.article?.libelle || lot.article?.designation || "—";

  return (
    <motion.tr
      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.35), duration: 0.28 }}
      className="lot-table-row group border-t border-[var(--border-default)]/50"
      style={{ animationDelay: `${Math.min(index * 30, 280)}ms` }}
    >
      <td className={tableCellClass}>
        <LotThumb lot={lot} />
      </td>

      <td className={tableCellClass}>
        <button
          type="button"
          onClick={() => onViewDetail?.(lot)}
          className="block w-full truncate text-left font-mono text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
          title={lot.numero}
        >
          {lot.numero}
        </button>
        {isFefoPriority && !isDisabled ? (
          <span className="mt-0.5 inline-flex rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-cyan-300 bg-cyan-500/15">
            FEFO
          </span>
        ) : null}
      </td>

      <td className={tableCellClass}>
        <button
          type="button"
          onClick={() => onViewDetail?.(lot)}
          className="block w-full truncate text-left text-xs font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
          title={articleLabel}
        >
          {articleLabel}
        </button>
        <span className="block truncate font-mono text-[10px] text-[var(--text-muted)]">
          {lot.article?.code || "—"}
        </span>
      </td>

      <td className={`${tableCellClass} ${columnHideClass("md")}`}>
        <span className="block truncate text-xs text-[var(--text-muted)]" title={lot.depot?.libelle}>
          {lot.depot?.code || lot.depot?.libelle || "—"}
        </span>
      </td>

      <td className={`${tableCellClass} ${columnHideClass("md")} text-right font-mono text-xs tabular-nums`}>
        {Number(lot.quantiteInitiale || 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
      </td>

      <td className={tableCellClass}>
        <QtyCell initiale={lot.quantiteInitiale} restante={lot.quantiteRestante} />
      </td>

      <td className={tableCellClass}>
        <DlcCell dateExpiration={lot.dateExpiration} />
      </td>

      <td className={tableCellClass}>
        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
          {cfg.label}
        </span>
      </td>

      <td className={`${tableCellClass} border-r-0`}>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <LotActionIcon variant="view" title="Voir le détail" onClick={() => onViewDetail?.(lot)}>
            <Eye size={14} strokeWidth={2.25} />
          </LotActionIcon>
          <LotActionIcon variant="qr" title="QR Code" onClick={() => onQrCode?.(lot)}>
            <QrCode size={14} strokeWidth={2.25} />
          </LotActionIcon>
          <LotActionIcon variant="trace" title="Traçabilité" onClick={() => onTrace?.(lot)}>
            <ClipboardList size={14} strokeWidth={2.25} />
          </LotActionIcon>
          {canWrite && (
            <>
              <LotActionIcon variant="edit" title="Modifier" onClick={() => onEdit?.(lot)}>
                <Pencil size={14} strokeWidth={2.25} />
              </LotActionIcon>
              {isDisabled ? (
                <LotActionIcon
                  variant="restore"
                  title="Réactiver"
                  disabled={deactivatePending}
                  onClick={() => onReactivate?.(lot)}
                >
                  <Archive size={14} strokeWidth={2.25} />
                </LotActionIcon>
              ) : (
                <LotActionIcon
                  variant="archive"
                  title="Désactiver"
                  disabled={deactivatePending}
                  onClick={() => onDesactiver?.(lot)}
                >
                  <Archive size={14} strokeWidth={2.25} />
                </LotActionIcon>
              )}
            </>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

export default function LotTable({
  lots,
  isLoading,
  empty,
  fefoPriorityIds,
  canWrite,
  deactivatePending,
  onViewDetail,
  onQrCode,
  onTrace,
  onEdit,
  onDesactiver,
  onReactivate,
}) {
  return (
    <div className={`${tableShellClass} lot-table-wrap`}>
      <style>{LOTS_TABLE_UI_CSS}</style>
      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full text-sm">
          <LotTableColGroup />
          <thead>
            <LotTableHead />
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-[var(--border-default)]/50">
                    {LOT_TABLE_COLUMNS.map((col) => (
                      <td key={col.key} className={tableCellClass}>
                        <div className="h-4 animate-pulse rounded bg-[var(--bg-hover)]" />
                      </td>
                    ))}
                  </tr>
                ))
              : lots.length === 0
                ? (
                    <tr>
                      <td colSpan={LOT_TABLE_COLUMNS.length} className="px-4 py-16 text-center">
                        {empty}
                      </td>
                    </tr>
                  )
                : lots.map((lot, index) => (
                    <LotTableRow
                      key={lot.id}
                      lot={lot}
                      index={index}
                      isFefoPriority={fefoPriorityIds?.has(lot.id)}
                      canWrite={canWrite}
                      deactivatePending={deactivatePending}
                      onViewDetail={onViewDetail}
                      onQrCode={onQrCode}
                      onTrace={onTrace}
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
