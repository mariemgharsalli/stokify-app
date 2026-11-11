import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  Eye,
  Lock,
  Pencil,
  Trash2,
  Unlock,
} from "lucide-react";
import ArticleThumb from "../../../components/stock/ArticleThumb";
import { ArticleTableStatutBadge, parseArticleStatut } from "../articleStatusUi";
import { highlightMatch, stockIsCritical } from "../../refs/components/refsUtils";
import {
  articleTableFamilleGradient,
  articleTableSousFamilleGradient,
  articleTableStockLevelClass,
  checkboxClass,
  tableCellClass,
} from "./articlesTheme";
import { ArticleActionIcon, columnHideClass } from "./articleTableUi";

function TagPill({ label, gradient }) {
  if (!label) return <span className="text-[var(--text-muted)]">—</span>;
  return (
    <span
      className="inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
      style={{ background: gradient }}
      title={label}
    >
      {label}
    </span>
  );
}

export default function ArticleTableRow({
  item,
  index,
  search,
  selected,
  onToggleSelect,
  onInlineEdit,
  onViewDetail,
  formatCurrency,
  canWrite,
  canDeletePermanent,
  userRole,
  setStatutArticle,
  deleteMutation,
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const s = parseArticleStatut(item);
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
  const pending = setStatutArticle.isPending;
  const stockClass = articleTableStockLevelClass(item.stock, item.stockMin);
  const critical = stockIsCritical(item.stock, item.stockMin);
  const hide = columnHideClass;

  const familleCode = item.familleCode ?? item.famille?.code ?? item.familleNom;
  const sousFamilleCode = item.sousFamilleCode ?? item.sousFamille?.code ?? item.sousFamilleNom;
  const parentFamilleCode = item.familleCode ?? item.famille?.code ?? "";

  return (
    <motion.tr
      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.35), duration: 0.28 }}
      className={`group border-t border-[var(--border-default)]/50 transition-colors hover:bg-[var(--bg-hover)] ${
        selected ? "bg-[color-mix(in_srgb,var(--accent-primary)_6%,transparent)]" : ""
      }`}
    >
      {/* 1 — sélection */}
      <td className={tableCellClass}>
        <input type="checkbox" checked={selected} onChange={() => onToggleSelect(item.id)} className={checkboxClass} />
      </td>

      {/* 2 — image */}
      <td className={tableCellClass}>
        <div className="mx-auto w-fit">
          <ArticleThumb article={item} alt={item.designation} size="sm" />
        </div>
      </td>

      {/* 3 — code */}
      <td className={tableCellClass}>
        <span className="block truncate font-mono text-[11px] font-semibold text-[var(--accent-primary)]">
          {highlightMatch(item.code || "ART-0000", search)}
        </span>
      </td>

      {/* 4 — désignation */}
      <td className={tableCellClass}>
        <button
          type="button"
          onClick={() => onInlineEdit(item)}
          className="block w-full truncate text-left text-xs font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
          title={item.designation}
        >
          {highlightMatch(item.designation, search)}
        </button>
      </td>

      {/* 5 — famille */}
      <td className={`${tableCellClass} ${hide("md")}`}>
        <TagPill label={item.familleNom} gradient={articleTableFamilleGradient(familleCode)} />
      </td>

      {/* 6 — sous-famille */}
      <td className={`${tableCellClass} ${hide("lg")}`}>
        <TagPill label={item.sousFamilleNom} gradient={articleTableSousFamilleGradient(sousFamilleCode, parentFamilleCode)} />
      </td>

      {/* 7 — fournisseur */}
      <td className={`${tableCellClass} ${hide("lg")}`}>
        <span className="block truncate text-xs text-[var(--text-muted)]" title={item.fournisseurs || ""}>
          {item.fournisseurs || "—"}
        </span>
      </td>

      {/* 8 — prix achat */}
      <td className={`${tableCellClass} ${hide("md")} tabular-nums text-xs`}>
        {formatCurrency(item.prixUnitaire)}
      </td>

      {/* 9 — prix vente */}
      <td className={`${tableCellClass} ${hide("md")} tabular-nums text-xs font-semibold text-[var(--text-primary)]`}>
        {formatCurrency(item.prixCatalogue)}
      </td>

      {/* 10 — stock */}
      <td className={tableCellClass}>
        <span className={`inline-flex min-w-[2rem] justify-center rounded-full px-2 py-0.5 text-xs font-bold ${stockClass} ${critical ? "article-stock-critical" : ""}`}>
          {item.stock}
        </span>
      </td>

      {/* 11 — emplacement */}
      <td className={`${tableCellClass} ${hide("xl")}`}>
        <span className="block truncate text-xs text-[var(--text-muted)]">{item.emplacementNom || "—"}</span>
      </td>

      {/* 12 — statut */}
      <td className={tableCellClass}>
        <ArticleTableStatutBadge row={item} />
      </td>

      {/* 13 — actions */}
      <td className={`${tableCellClass} border-r-0`}>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <ArticleActionIcon variant="view" title="Voir le détail" onClick={() => (onViewDetail ? onViewDetail(item) : navigate(`/articles/${item.id}`))}>
            <Eye size={14} strokeWidth={2.25} />
          </ArticleActionIcon>
          {canWrite && s === "ACTIF" && (
            <ArticleActionIcon variant="edit" title="Modifier" onClick={() => onInlineEdit(item)}>
              <Pencil size={14} strokeWidth={2.25} />
            </ArticleActionIcon>
          )}
          {canWrite && s === "ACTIF" && (
            <ArticleActionIcon variant="lock" title="Bloquer" disabled={pending} onClick={() => setStatutArticle.mutate({ id: Number(item.id), statut: "BLOQUE" })}>
              <Lock size={14} strokeWidth={2.25} />
            </ArticleActionIcon>
          )}
          {canWrite && s === "ACTIF" && (
            <ArticleActionIcon variant="archive" title="Archiver" disabled={pending} onClick={() => setStatutArticle.mutate({ id: Number(item.id), statut: "ARCHIVE" })}>
              <Archive size={14} strokeWidth={2.25} />
            </ArticleActionIcon>
          )}
          {canWrite && s === "BLOQUE" && (
            <ArticleActionIcon variant="unlock" title="Débloquer" disabled={pending} onClick={() => setStatutArticle.mutate({ id: Number(item.id), statut: "ACTIF" })}>
              <Unlock size={14} strokeWidth={2.25} />
            </ArticleActionIcon>
          )}
          {canWrite && s === "BLOQUE" && (
            <ArticleActionIcon variant="archive" title="Archiver" disabled={pending} onClick={() => setStatutArticle.mutate({ id: Number(item.id), statut: "ARCHIVE" })}>
              <Archive size={14} strokeWidth={2.25} />
            </ArticleActionIcon>
          )}
          {canWrite && s === "ARCHIVE" && (
            <ArticleActionIcon variant="restore" title="Désarchiver" disabled={pending} onClick={() => setStatutArticle.mutate({ id: Number(item.id), statut: "ACTIF" })}>
              <ArchiveRestore size={14} strokeWidth={2.25} />
            </ArticleActionIcon>
          )}
          {s === "ARCHIVE" && isAdmin && (
            <ArticleActionIcon
              variant="delete"
              title="Supprimer définitivement"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`Supprimer définitivement "${item.libelle}" ?`)) deleteMutation.mutate(Number(item.id));
              }}
            >
              <Trash2 size={14} strokeWidth={2.25} />
            </ArticleActionIcon>
          )}
        </div>
      </td>
    </motion.tr>
  );
}
