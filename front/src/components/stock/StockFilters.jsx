import { RefreshCw, Search, X } from "lucide-react";
import SearchableSelect from "../ui/SearchableSelect";

const STATUS_PILLS = [
  { val: "", label: "Tous", color: "#888780" },
  { val: "ACTIF", label: "Actif", color: "#1D9E75" },
  { val: "ARCHIVE", label: "Archivé", color: "#EF9F27" },
  { val: "BLOQUE", label: "Bloqué", color: "#E24B4A" },
];

export default function StockFilters({
  filters,
  onChange,
  onReset,
  depots,
  emplacements,
  articleOptions,
}) {
  const activeCount = [filters.search, filters.depotId, filters.emplacementId, filters.statut, filters.articleId].filter(
    Boolean
  ).length;

  return (
    <div className="stock-filters mb-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 animate-[fadeUp_0.4s_ease_0.15s_both]">
      <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[1fr_180px_220px_200px_auto]">
        <div className="relative min-w-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Code ou libellé d'article..."
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className={`w-full rounded-lg border bg-[var(--bg-input)] py-2 pl-9 pr-3 text-[13px] text-[var(--text-primary)] outline-none transition-colors ${
              filters.search ? "border-[#7c3aed]" : "border-[var(--border-default)]"
            } focus:border-[#7c3aed]`}
            aria-label="Rechercher un article"
          />
        </div>

        <select
          value={filters.depotId}
          onChange={(e) => onChange({ depotId: e.target.value, emplacementId: "" })}
          className={`rounded-lg border bg-[var(--bg-input)] px-3 py-2 text-[13px] outline-none cursor-pointer ${
            filters.depotId ? "border-[#7c3aed] text-[#a78bfa]" : "border-[var(--border-default)] text-[var(--text-primary)]"
          }`}
          aria-label="Filtrer par dépôt"
        >
          <option value="">Tous les dépôts</option>
          {depots.map((d) => (
            <option key={d.id} value={String(d.id)}>
              {d.libelle}
            </option>
          ))}
        </select>

        <select
          value={filters.emplacementId}
          onChange={(e) => onChange({ emplacementId: e.target.value })}
          disabled={!filters.depotId}
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Filtrer par emplacement"
        >
          <option value="">{filters.depotId ? "Tous les emplacements" : "Choisir un dépôt d'abord"}</option>
          {emplacements.map((e) => (
            <option key={e.id} value={String(e.id)}>
              {e.code} — {e.libelle}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_PILLS.map((s) => (
            <button
              key={s.val || "all"}
              type="button"
              onClick={() => onChange({ statut: s.val })}
              className="rounded-full px-3 py-1 text-[11px] font-medium transition-all"
              style={{
                border: `1px solid ${filters.statut === s.val ? `${s.color}60` : "var(--border-default)"}`,
                background: filters.statut === s.val ? `${s.color}15` : "transparent",
                color: filters.statut === s.val ? s.color : "var(--text-muted)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Réinitialiser
        </button>
      </div>

      {articleOptions?.length > 0 && (
        <div className="mt-3 max-w-md">
          <SearchableSelect
            value={filters.articleId}
            onChange={(v) => onChange({ articleId: v })}
            options={articleOptions}
            placeholder="Filtrer par article (optionnel)"
            clearLabel="Tous les articles"
            className="w-full"
            aria-label="Filtrer par article"
          />
        </div>
      )}

      {activeCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.search && (
            <FilterChip label={`Recherche: ${filters.search}`} onRemove={() => onChange({ search: "" })} />
          )}
          {filters.depotId && (
            <FilterChip
              label={`Dépôt: ${depots.find((d) => String(d.id) === filters.depotId)?.libelle || filters.depotId}`}
              onRemove={() => onChange({ depotId: "", emplacementId: "" })}
            />
          )}
          {filters.statut && (
            <FilterChip label={`Statut: ${filters.statut}`} onRemove={() => onChange({ statut: "" })} />
          )}
          {filters.articleId && (
            <FilterChip
              label={`Article: ${articleOptions.find((a) => a.value === filters.articleId)?.label || filters.articleId}`}
              onRemove={() => onChange({ articleId: "" })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-2.5 py-0.5 text-[11px] text-[#a78bfa]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-0.5 hover:bg-white/10"
        aria-label={`Retirer le filtre ${label}`}
      >
        <X size={12} />
      </button>
    </span>
  );
}
