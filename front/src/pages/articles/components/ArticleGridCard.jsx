import { motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  Eye,
  Lock,
  Pencil,
  Trash2,
  TrendingUp,
  Unlock,
} from "lucide-react";
import ArticleThumb from "../../../components/stock/ArticleThumb";
import { ArticleTableStatutBadge, parseArticleStatut } from "../articleStatusUi";
import { ArticleActionIcon } from "./articleTableUi";

export default function ArticleGridCard({
  item,
  index,
  formatCurrency,
  stockBadgeClass,
  canWrite,
  canDeletePermanent,
  onViewDetail,
  onEdit,
  setStatutArticle,
  deleteMutation,
}) {
  const reduceMotion = useReducedMotion();
  const statut = parseArticleStatut(item);
  const pending = setStatutArticle.isPending;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] transition-shadow hover:shadow-md"
      style={{ borderLeft: "3px solid var(--accent-primary)" }}
    >
      <div className="flex gap-0 sm:block">
        <div className="relative w-28 shrink-0 overflow-hidden sm:h-40 sm:w-full">
          <div className="h-full min-h-[7rem] w-full sm:h-40 sm:min-h-[10rem]">
            <ArticleThumb article={item} alt={item.designation} fill />
          </div>
          <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:flex">
            <ArticleActionIcon variant="view" title="Voir" onClick={() => onViewDetail(item)}>
              <Eye size={14} strokeWidth={2.25} />
            </ArticleActionIcon>
            {canWrite && statut === "ACTIF" ? (
              <ArticleActionIcon variant="edit" title="Modifier" onClick={() => onEdit(item)}>
                <Pencil size={14} strokeWidth={2.25} />
              </ArticleActionIcon>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-3.5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold text-[var(--accent-primary)]">
              {item.code || "ART-0000"}
            </span>
            <ArticleTableStatutBadge row={item} />
          </div>

          <h3
            className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text-primary)]"
            title={item.designation}
          >
            {item.designation}
          </h3>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
            {item.familleNom ? <span>{item.familleNom}</span> : null}
            {item.sousFamilleNom ? <span>· {item.sousFamilleNom}</span> : null}
          </div>

          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Prix vente</p>
              <p className="text-base font-semibold tabular-nums text-[var(--text-primary)]">
                {formatCurrency(item.prixCatalogue)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Stock</p>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${stockBadgeClass}`}
              >
                {item.stock}
              </span>
            </div>
            {item.margePct != null && Number.isFinite(item.margePct) ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--accent-success)]">
                <TrendingUp className="h-3 w-3" />
                {Math.round(item.margePct)}%
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {(canWrite || (canDeletePermanent && statut === "ARCHIVE")) && (
        <div className="flex flex-wrap items-center justify-end gap-1 border-t border-[var(--border-default)] px-3 py-2">
          {canWrite && statut === "ACTIF" && (
            <>
              <ArticleActionIcon
                variant="lock"
                title="Bloquer"
                disabled={pending}
                onClick={() => setStatutArticle.mutate({ id: Number(item.id), statut: "BLOQUE" })}
              >
                <Lock size={14} strokeWidth={2.25} />
              </ArticleActionIcon>
              <ArticleActionIcon
                variant="archive"
                title="Archiver"
                disabled={pending}
                onClick={() => setStatutArticle.mutate({ id: Number(item.id), statut: "ARCHIVE" })}
              >
                <Archive size={14} strokeWidth={2.25} />
              </ArticleActionIcon>
            </>
          )}
          {canWrite && statut === "BLOQUE" && (
            <>
              <ArticleActionIcon
                variant="unlock"
                title="Débloquer"
                disabled={pending}
                onClick={() => setStatutArticle.mutate({ id: Number(item.id), statut: "ACTIF" })}
              >
                <Unlock size={14} strokeWidth={2.25} />
              </ArticleActionIcon>
              <ArticleActionIcon
                variant="archive"
                title="Archiver"
                disabled={pending}
                onClick={() => setStatutArticle.mutate({ id: Number(item.id), statut: "ARCHIVE" })}
              >
                <Archive size={14} strokeWidth={2.25} />
              </ArticleActionIcon>
            </>
          )}
          {canWrite && statut === "ARCHIVE" && (
            <ArticleActionIcon
              variant="restore"
              title="Désarchiver"
              disabled={pending}
              onClick={() => setStatutArticle.mutate({ id: Number(item.id), statut: "ACTIF" })}
            >
              <ArchiveRestore size={14} strokeWidth={2.25} />
            </ArticleActionIcon>
          )}
          {canDeletePermanent && statut === "ARCHIVE" && (
            <ArticleActionIcon
              variant="delete"
              title="Supprimer"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm("Supprimer définitivement cet article ?")) {
                  deleteMutation.mutate(Number(item.id));
                }
              }}
            >
              <Trash2 size={14} strokeWidth={2.25} />
            </ArticleActionIcon>
          )}
        </div>
      )}
    </motion.article>
  );
}
