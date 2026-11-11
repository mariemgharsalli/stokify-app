import { useMemo } from "react";
import { motion } from "framer-motion";
import SocieteCard, { SocieteCardSkeleton, SocieteEmptyState } from "./SocieteCard";
import SocieteTable, { SocieteTableEmpty } from "./SocieteTable";
import { matchSocieteFilter } from "./societesTheme";

export default function SocieteList({
  companies,
  filteredCompanies,
  companiesLoading,
  listError,
  viewMode,
  isSuperAdmin,
  uploadLogoMutation,
  onAction,
  onToggleActif,
  togglePending,
  onCreate,
  onLogoUpload,
}) {
  const isEmpty = !companiesLoading && filteredCompanies.length === 0;
  const isSearchEmpty = companies.length > 0 && filteredCompanies.length === 0;

  return (
    <section className="space-y-4">
      {listError && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--danger-border)",
            background: "var(--danger-bg)",
            color: "var(--danger-text)",
          }}
        >
          {listError}
        </div>
      )}

      {isEmpty ? (
        viewMode === "table" ? (
          <SocieteTableEmpty isSearchEmpty={isSearchEmpty} onCreate={onCreate} />
        ) : (
          <SocieteEmptyState onCreate={onCreate} isSearchEmpty={isSearchEmpty} />
        )
      ) : viewMode === "table" ? (
        <SocieteTable
          companies={filteredCompanies}
          loading={companiesLoading}
          onAction={onAction}
          onToggleActif={onToggleActif}
          togglePending={togglePending}
          logoUploadPending={uploadLogoMutation.isPending}
          logoUploadId={uploadLogoMutation.variables?.id}
        />
      ) : companiesLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SocieteCardSkeleton key={i} index={i} />
          ))}
        </div>
      ) : (
        <motion.div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {filteredCompanies.map((s, i) => (
            <SocieteCard
              key={s.id}
              societe={s}
              index={i}
              isSuperAdmin={isSuperAdmin}
              logoUploadPending={uploadLogoMutation.isPending}
              logoUploadId={uploadLogoMutation.variables?.id}
              onAction={onAction}
              onToggleActif={onToggleActif}
              togglePending={togglePending}
              onLogoUpload={(file) => onLogoUpload(s, file)}
            />
          ))}
        </motion.div>
      )}
    </section>
  );
}

export function useFilteredCompanies(companies, search, filter) {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((s) => {
      const matchSearch =
        !q ||
        (s.nom || "").toLowerCase().includes(q) ||
        (s.code || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q) ||
        (s.ville || "").toLowerCase().includes(q);
      return matchSearch && matchSocieteFilter(s, filter);
    });
  }, [companies, search, filter]);
}

export function useFilterCounts(companies) {
  return useMemo(
    () => ({
      ALL: companies.length,
      VISIBLE: companies.filter((s) => s.actif !== false).length,
      HIDDEN: companies.filter((s) => s.actif === false).length,
      LOCATED: companies.filter((s) => s.latitude != null && s.longitude != null).length,
    }),
    [companies]
  );
}
