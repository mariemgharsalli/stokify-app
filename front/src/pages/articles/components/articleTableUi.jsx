import {
  Archive,
  ArchiveRestore,
  BarChart3,
  Box,
  Eye,
  Hash,
  ImageIcon,
  Layers,
  Lock,
  MapPin,
  Package,
  Pencil,
  Settings2,
  Tag,
  Trash2,
  Truck,
  Unlock,
} from "lucide-react";

/** Colonnes tableau — ordre strict identique au tbody (ArticleTableRow). */
export const ARTICLE_TABLE_COLUMNS = [
  { key: "sel", label: "", Icon: null, width: "40px", hide: null },
  { key: "img", label: "Image", Icon: ImageIcon, width: "64px", hide: null },
  { key: "code", label: "Code", Icon: Hash, width: "108px", hide: null },
  { key: "name", label: "Désignation", Icon: Package, width: "120px", hide: null },
  { key: "famille", label: "Famille", Icon: Layers, width: "130px", hide: "md" },
  { key: "sf", label: "Sous-famille", Icon: Tag, width: "130px", hide: "lg" },
  { key: "fourn", label: "Fournisseur", Icon: Truck, width: "160px", hide: "lg" },
  { key: "pu", label: "Prix achat", Icon: BarChart3, width: "110px", hide: "md" },
  { key: "pv", label: "Prix vente", Icon: BarChart3, width: "110px", hide: "md" },
  { key: "stock", label: "Stock", Icon: Box, width: "80px", hide: null },
  { key: "emp", label: "Emplacement", Icon: MapPin, width: "120px", hide: "xl" },
  { key: "statut", label: "Statut", Icon: null, width: "100px", hide: null },
  { key: "actions", label: "Actions", Icon: Settings2, width: "168px", hide: null },
];

export function columnHideClass(hide) {
  if (hide === "md") return "hidden md:table-cell";
  if (hide === "lg") return "hidden lg:table-cell";
  if (hide === "xl") return "hidden xl:table-cell";
  return "";
}

/** Styles injectés une fois dans la page Articles. */
export const ARTICLES_TABLE_UI_CSS = `
  @keyframes artRowIn {
    from { opacity: 0; transform: translateX(-6px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes artCardIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes artIconPop {
    0% { transform: scale(0.85); }
    60% { transform: scale(1.08); }
    100% { transform: scale(1); }
  }
  .art-table-wrap table {
    table-layout: fixed;
  }
  .art-table-row {
    animation: artRowIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
    transition: background-color 0.2s ease;
  }
  .art-table-row:nth-child(even) {
    background: rgba(248, 250, 252, 0.85);
  }
  .art-table-row:hover {
    background: rgba(245, 243, 255, 0.95) !important;
  }
  .dark .art-table-row:nth-child(even) {
    background: rgba(255, 255, 255, 0.015);
  }
  .dark .art-table-row:hover {
    background: rgba(124, 58, 237, 0.06) !important;
  }
  .art-grid-card {
    animation: artCardIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .art-action-btn:hover svg {
    animation: artIconPop 0.35s ease;
  }
`;

const ACTION_STYLES = {
  view: {
    idle: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400 dark:bg-sky-500/15 dark:border-sky-500/25",
    hover: "hover:bg-sky-500 hover:text-white hover:border-sky-500 hover:shadow-lg hover:shadow-sky-500/30",
  },
  edit: {
    idle: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400 dark:bg-violet-500/15 dark:border-violet-500/25",
    hover: "hover:bg-violet-500 hover:text-white hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/30",
  },
  lock: {
    idle: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/15 dark:border-amber-500/25",
    hover: "hover:bg-amber-500 hover:text-white hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/30",
  },
  archive: {
    idle: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400 dark:bg-orange-500/15 dark:border-orange-500/25",
    hover: "hover:bg-orange-500 hover:text-white hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/30",
  },
  unlock: {
    idle: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/15 dark:border-emerald-500/25",
    hover: "hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/30",
  },
  restore: {
    idle: "bg-teal-500/10 text-teal-600 border-teal-500/20 dark:text-teal-400 dark:bg-teal-500/15 dark:border-teal-500/25",
    hover: "hover:bg-teal-500 hover:text-white hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/30",
  },
  delete: {
    idle: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400 dark:bg-rose-500/15 dark:border-rose-500/25",
    hover: "hover:bg-rose-500 hover:text-white hover:border-rose-500 hover:shadow-lg hover:shadow-rose-500/30",
  },
};

export function ArticleActionIcon({ variant = "view", title, onClick, disabled, children }) {
  const s = ACTION_STYLES[variant] || ACTION_STYLES.view;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`art-action-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all duration-250 ease-out hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 ${s.idle} ${s.hover}`}
    >
      {children}
    </button>
  );
}

export function ArticleTableColGroup() {
  return (
    <colgroup>
      {ARTICLE_TABLE_COLUMNS.map((col) => (
        <col key={col.key} style={{ width: col.width }} />
      ))}
    </colgroup>
  );
}

export function ArticleTableHeadRow({ headClass }) {
  return (
    <tr>
      {ARTICLE_TABLE_COLUMNS.map((col) => {
        const Icon = col.Icon;
        const hide = columnHideClass(col.hide);
        return (
          <th
            key={col.key}
            scope="col"
            className={`${headClass} ${hide} ${col.key === "actions" ? "border-r-0" : ""} ${col.key === "sel" ? "w-10" : ""}`}
          >
            {col.label ? (
              <span className="inline-flex items-center gap-1 truncate">
                {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" strokeWidth={2.25} /> : null}
                <span className="truncate">{col.label}</span>
              </span>
            ) : null}
          </th>
        );
      })}
    </tr>
  );
}

export function ArticleThumbnail({ src, alt }) {
  if (!src) {
    return (
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-[#141a24] dark:text-slate-500">
        <Package className="h-4 w-4" aria-hidden />
      </div>
    );
  }
  return (
    <div className="mx-auto h-11 w-11 overflow-hidden rounded-lg border border-slate-200/80 dark:border-white/10">
      <img src={src} alt={alt || ""} className="h-full w-full object-cover" />
    </div>
  );
}

export { Archive, ArchiveRestore, Eye, Lock, Pencil, Trash2, Unlock };
