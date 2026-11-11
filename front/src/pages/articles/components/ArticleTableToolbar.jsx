import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet, LayoutGrid, List, Loader2, Trash2 } from "lucide-react";
import { ArticleActionIcon } from "./articleTableUi";

function ViewToggleButton({ active, onClick, title, Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className="inline-flex h-9 w-9 items-center justify-center transition-all"
      style={
        active
          ? {
              background: "var(--accent-primary)",
              color: "#fff",
            }
          : { color: "var(--text-muted)" }
      }
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export default function ArticleTableToolbar({
  isAllPageSelected,
  onToggleSelectAll,
  selectedCount,
  canDeletePermanent,
  onBulkDelete,
  bulkDeletePending,
  onExportExcel,
  excelExportPending = false,
  filteredCount = 0,
  totalCount = 0,
  hasActiveFilters = false,
  onExportPdf,
  pdfExportPending = false,
  viewMode,
  onViewModeChange,
  checkboxClass,
}) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  const showExportHint =
    hasActiveFilters || (totalCount > 0 && filteredCount !== totalCount);
  const hasArticles = filteredCount > 0 || totalCount > 0;

  useEffect(() => {
    if (!exportMenuOpen) return undefined;
    const handleClickOutside = (e) => {
      if (exportMenuRef.current?.contains(e.target)) return;
      setExportMenuOpen(false);
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [exportMenuOpen]);

  const exportBusy = excelExportPending || pdfExportPending;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] bg-[var(--bg-hover)]/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={isAllPageSelected}
            onChange={onToggleSelectAll}
            className={checkboxClass}
          />
          Tout sélectionner
        </label>
        <span className="text-sm text-[var(--text-muted)]">
          {selectedCount} sélectionné(s)
        </span>
        {canDeletePermanent ? (
          <ArticleActionIcon
            variant="delete"
            title="Supprimer la sélection"
            disabled={!selectedCount || bulkDeletePending}
            onClick={onBulkDelete}
          >
            <Trash2 className="h-4 w-4" />
          </ArticleActionIcon>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showExportHint ? (
          <span className="text-xs text-[var(--accent-warning)]">
            {filteredCount} résultat(s) sur {totalCount} au total (filtres actifs)
          </span>
        ) : null}

        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            disabled={exportBusy}
            onClick={() => setExportMenuOpen((v) => !v)}
            aria-expanded={exportMenuOpen}
            aria-haspopup="menu"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exportBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden />
            )}
            Exporter
            <ChevronDown
              className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform ${
                exportMenuOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>

          {exportMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-lg"
            >
              <div className="border-b border-[var(--border-default)]">
                <button
                  type="button"
                  role="menuitem"
                  disabled={excelExportPending}
                  onClick={() => {
                    onExportExcel?.();
                    setExportMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="font-medium text-[var(--text-primary)]">Excel</div>
                  <div className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">
                    {hasArticles
                      ? selectedCount
                        ? `${selectedCount} ligne(s) cochée(s) — réimportable directement`
                        : showExportHint
                          ? `${filteredCount} article(s) filtré(s) — réimportable directement`
                          : "Vos données réelles — réimportable directement"
                      : "Base vide : modèle avec exemples pour démarrer"}
                  </div>
                </button>
                {hasArticles ? (
                  <button
                    type="button"
                    onClick={() => {
                      onExportExcel?.({ forceTemplate: true });
                      setExportMenuOpen(false);
                    }}
                    className="w-full px-4 pb-2.5 pt-0 text-left text-xs text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
                  >
                    Besoin d&apos;un modèle vide plutôt ?
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                role="menuitem"
                disabled={pdfExportPending}
                onClick={() => {
                  onExportPdf?.();
                  setExportMenuOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="font-medium text-[var(--text-primary)]">PDF</div>
                <div className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">
                  Catalogue visuel des articles affichés
                </div>
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
          <ViewToggleButton
            active={viewMode === "grid"}
            onClick={() => onViewModeChange("grid")}
            title="Vue grille"
            Icon={LayoutGrid}
          />
          <ViewToggleButton
            active={viewMode === "list"}
            onClick={() => onViewModeChange("list")}
            title="Vue liste"
            Icon={List}
          />
        </div>
      </div>
    </div>
  );
}
