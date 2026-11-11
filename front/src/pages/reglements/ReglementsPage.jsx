import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Loader2, Receipt, Search, ShoppingCart } from "lucide-react";
import api from "../../services/api";
import PageShell from "../../components/ui/PageShell";
import WorkflowBar from "../../components/ui/WorkflowBar";
import FilterChips from "../../components/commerce/FilterChips";
import ReglementsKpiCards from "../../components/reglements/ReglementsKpiCards";
import ReglementsFluxChart from "../../components/reglements/ReglementsFluxChart";
import ReglementCard from "../../components/reglements/ReglementCard";
import { WORKFLOW_REGLEMENT } from "../../constants/statuts";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../hooks/useToast";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";

const MODE_LABELS = {
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  VIREMENT: "Virement",
  CARTE: "Carte",
  EFFET: "Effet",
  AUTRE: "Autre",
};

export default function ReglementsPage() {
  const societeScope = useSocieteQueryScope();
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const listRef = useRef(null);
  const canVente = hasPermission(user?.role, "ventes:read");
  const canAchat = hasPermission(user?.role, "achats:read");

  const [activeTab, setActiveTab] = useState(canVente ? "ventes" : "achats");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  const params = useMemo(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(mode ? { mode } : {}),
      ...(dateDebut ? { dateDebut } : {}),
      ...(dateFin ? { dateFin } : {}),
    }),
    [search, mode, dateDebut, dateFin]
  );

  const { data: stats } = useQuery({
    queryKey: ["reglements-stats", societeScope],
    queryFn: () => api.get("reglements/stats").then((r) => r.data),
  });

  const listPath = activeTab === "ventes" ? "reglements/list/ventes" : "reglements/list/achats";

  const { data: reglements = [], isLoading } = useQuery({
    queryKey: ["reglements-global", societeScope, activeTab, params],
    queryFn: () => api.get(listPath, { params }).then((r) => r.data),
    enabled: activeTab === "ventes" ? canVente : canAchat,
  });

  const workflowSteps = useMemo(() => {
    return WORKFLOW_REGLEMENT.filter((s) => {
      if (s.key === "ventes") return canVente;
      if (s.key === "achats") return canAchat;
      return true;
    });
  }, [canVente, canAchat]);

  const workflowCounts = useMemo(
    () => ({
      ventes: stats?.nbReglementsVentes ?? 0,
      achats: stats?.nbReglementsAchats ?? 0,
    }),
    [stats]
  );

  const totalResults = reglements.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const p = Math.max(0, safePage - 1);
    return reglements.slice(p * pageSize, p * pageSize + pageSize);
  }, [reglements, safePage, pageSize]);

  const totalMontant = useMemo(
    () => reglements.reduce((s, r) => s + Number(r.montant || 0), 0),
    [reglements]
  );

  useEffect(() => {
    setPage(1);
  }, [search, mode, dateDebut, dateFin, activeTab, pageSize]);

  const filterChips = useMemo(() => {
    const chips = [];
    if (search.trim())
      chips.push({ key: "search", label: `Recherche : ${search}`, onRemove: () => setSearch("") });
    if (mode)
      chips.push({
        key: "mode",
        label: `Mode : ${MODE_LABELS[mode] || mode}`,
        onRemove: () => setMode(""),
      });
    if (dateDebut || dateFin)
      chips.push({
        key: "dates",
        label: `Du ${dateDebut || "…"} au ${dateFin || "…"}`,
        onRemove: () => {
          setDateDebut("");
          setDateFin("");
        },
      });
    return chips;
  }, [search, mode, dateDebut, dateFin]);

  function resetFilters() {
    setSearch("");
    setMode("");
    setDateDebut("");
    setDateFin("");
    setPage(1);
  }

  function selectWorkflow(key) {
    if (!key) return;
    setActiveTab(key);
    setPage(1);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exportCSV() {
    if (!reglements.length) return;
    setExportLoading(true);
    try {
      const rows = reglements.map((r) => {
        const tier = activeTab === "ventes" ? r.vente?.client?.nom : r.achat?.fournisseur?.nom;
        const ref = activeTab === "ventes" ? r.vente?.reference : r.achat?.reference;
        return [tier, ref, r.mode, r.datePayment || r.dateReglement, r.montant].join(";");
      });
      const header = "Tiers;Reference;Mode;Date;Montant\n";
      const blob = new Blob([header + rows.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reglements-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } catch (e) {
      toast.error(e.message || "Erreur export");
    } finally {
      setExportLoading(false);
    }
  }

  const rangeStart = totalResults === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalResults);
  const accent = activeTab === "ventes" ? "#1D9E75" : "#378ADD";

  return (
    <PageShell
      title="Règlements & paiements"
      subtitle="Suivi des encaissements clients et paiements fournisseurs"
      actions={
        <button
          type="button"
          onClick={exportCSV}
          disabled={exportLoading || !reglements.length}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
        >
          {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Exporter CSV
        </button>
      }
    >
      <div className="space-y-6">
        <ReglementsKpiCards stats={stats} />

        <ReglementsFluxChart data={stats?.chartData} />

        {workflowSteps.length > 0 ? (
          <WorkflowBar
            type="reglement"
            steps={workflowSteps}
            activeStatut={activeTab}
            counts={workflowCounts}
            onSelect={selectWorkflow}
          />
        ) : null}

        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)]"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            Filtres avancés
            <span className="text-[var(--text-muted)]">{filtersOpen ? "▲" : "▼"}</span>
          </button>
          {filtersOpen ? (
            <div className="border-t border-[var(--border-default)] px-4 pb-4 pt-2">
              <div className="flex flex-wrap items-end gap-3">
                <div className="relative min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">Recherche</label>
                  <Search className="pointer-events-none absolute left-3 top-8 h-4 w-4 text-[var(--text-muted)]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] py-2 pl-9 pr-3 text-sm focus:border-[var(--border-focus)] focus:outline-none"
                    placeholder={
                      activeTab === "ventes"
                        ? "Client, référence vente…"
                        : "Fournisseur, référence achat…"
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">Mode de paiement</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="min-w-[160px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm focus:border-[var(--border-focus)] focus:outline-none"
                  >
                    <option value="">Tous</option>
                    {Object.entries(MODE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">Du</label>
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">Au</label>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  className={PRIMARY_BTN_CLASSES}
                  style={primaryButtonStyle}
                >
                  Appliquer
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div ref={listRef} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterChips chips={filterChips} onClearAll={resetFilters} />
            <p className="text-sm text-[var(--text-muted)]">
              {totalResults} règlement(s)
              {totalMontant > 0 ? (
                <span className="ml-2 font-medium tabular-nums" style={{ color: accent }}>
                  · {totalMontant.toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND
                </span>
              ) : null}
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--bg-hover)]" />
              ))}
            </div>
          ) : pageSlice.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-16 text-center">
              {activeTab === "ventes" ? (
                <Receipt className="mx-auto h-12 w-12 text-[var(--text-muted)] opacity-40" />
              ) : (
                <ShoppingCart className="mx-auto h-12 w-12 text-[var(--text-muted)] opacity-40" />
              )}
              <p className="mt-3 text-[var(--text-secondary)]">Aucun règlement trouvé</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {filterChips.length
                  ? "Modifiez vos filtres"
                  : activeTab === "ventes"
                    ? "Encaissez une vente depuis la page Ventes"
                    : "Réglez un achat depuis la page Achats"}
              </p>
            </div>
          ) : (
            pageSlice.map((r, idx) => (
              <ReglementCard key={r.id ?? idx} reglement={r} type={activeTab} index={idx} />
            ))
          )}

          {!isLoading && totalResults > 0 ? (
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                Lignes par page
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
              <p className="text-xs text-[var(--text-muted)]">
                Affichage de {rangeStart} à {rangeEnd} sur {totalResults}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
