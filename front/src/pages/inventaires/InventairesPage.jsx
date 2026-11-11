import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  ClipboardList,
  FileDown,
  FileSpreadsheet,
  Package,
  Plus,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import PageShell from "../../components/ui/PageShell";
import { GlassAside } from "../../components/ui/GlassPageHeader";
import StockPagination from "../../components/stock/StockPagination";
import api, { getAxiosErrorMessage } from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useClientBranding } from "../../hooks/useClientBranding";
import InventaireWizard from "./components/InventaireWizard";
import InventaireKpiCards from "./components/InventaireKpiCards";
import InventaireFilterBoard from "./components/InventaireFilterBoard";
import InventaireList from "./components/InventaireList";
import { INV_THEME, STATUS_MAP } from "./inventaireUtils";
import {
  exportInventairesListPdf,
  exportInventairesListExcelPro,
} from "../../utils/inventaireReports";

const PAGE_SIZE_OPTIONS = [6, 9, 12, 24];

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function InventairesPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const clientBranding = useClientBranding();
  const qc = useQueryClient();
  const canWrite = hasPermission(user?.role, "stock:write");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [depotFilter, setDepotFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [continueInv, setContinueInv] = useState(null);
  const [duplicateFrom, setDuplicateFrom] = useState(null);
  const [toast, setToast] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  const { data: depotsData } = useQuery({
    queryKey: ["depots", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 200, statut: "ACTIF" } }).then((r) => r.data),
  });
  const depots = depotsData?.items ?? depotsData ?? [];

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["inventaires-enriched", societeScope, debouncedSearch, depotFilter, statutFilter],
    queryFn: () =>
      api
        .get("inventaires", {
          params: {
            enriched: 1,
            search: debouncedSearch || undefined,
            depotId: depotFilter || undefined,
            statut: statutFilter || undefined,
            limit: 100,
          },
        })
        .then((r) => r.data),
  });

  const items = data?.items ?? [];
  const global = data?.global ?? {};

  const totalResults = items.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const rangeStart = totalResults === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalResults);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, depotFilter, statutFilter, pageSize]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadFullInventaire = async (inv) => {
    const { data: full } = await api.get(`inventaires/${inv.id}`);
    return full;
  };

  const handleContinue = async (inv) => {
    try {
      const full = await loadFullInventaire(inv);
      setContinueInv(full);
      setWizardOpen(true);
    } catch (e) {
      showToast(getAxiosErrorMessage(e), "error");
    }
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setContinueInv(null);
    setDuplicateFrom(null);
  };

  const openCreate = () => {
    setContinueInv(null);
    setDuplicateFrom(null);
    setWizardOpen(true);
  };

  const exportMeta = () => ({
    search: debouncedSearch || "",
    depotLabel: depotFilter
      ? depots.find((d) => String(d.id) === String(depotFilter))?.libelle || ""
      : "",
    statutLabel: statutFilter ? STATUS_MAP[statutFilter]?.label || statutFilter : "",
  });

  const handleExportListPdf = async () => {
    if (exportLoading) return;
    setExportLoading(true);
    try {
      await exportInventairesListPdf(items, global, exportMeta(), clientBranding);
      showToast("Registre PDF exporté");
    } catch (e) {
      showToast(getAxiosErrorMessage(e) || "Erreur export PDF", "error");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportListExcel = async () => {
    if (exportLoading) return;
    setExportLoading(true);
    try {
      await exportInventairesListExcelPro(items, global, exportMeta(), clientBranding);
      showToast("Registre Excel exporté");
    } catch (e) {
      showToast(getAxiosErrorMessage(e) || "Erreur export Excel", "error");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <PageShell
      title="Inventaires"
      subtitle="Comparez le stock théorique vs réel — contrôlez, validez et ajustez en un flux fluide."
      icon={ClipboardList}
      badge="Contrôle"
      aside={
        <GlassAside
          icon={Package}
          label="En cours"
          value={
            <>
              <span className="tabular-nums text-sky-300">{global.enCours ?? 0}</span>
              {(global.enCours ?? 0) !== 1 ? " saisies actives" : " saisie active"}
            </>
          }
          iconColor="#7dd3fc"
          iconBg="rgba(55,138,221,0.25)"
          iconBorder="rgba(96,165,250,0.35)"
        />
      }
      actions={
        <>
          <motion.button
            type="button"
            disabled={exportLoading || !items.length}
            onClick={handleExportListPdf}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-400/25 bg-white/5 px-3.5 py-2 text-xs font-medium text-sky-50 transition hover:bg-white/10 disabled:opacity-50"
            whileHover={reduceMotion || exportLoading || !items.length ? undefined : { y: -2 }}
            whileTap={reduceMotion || exportLoading || !items.length ? undefined : { scale: 0.97 }}
          >
            <FileDown className="h-4 w-4" />
            Export PDF
          </motion.button>
          <motion.button
            type="button"
            disabled={exportLoading || !items.length}
            onClick={handleExportListExcel}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-400/25 bg-white/5 px-3.5 py-2 text-xs font-medium text-sky-50 transition hover:bg-white/10 disabled:opacity-50"
            whileHover={reduceMotion || exportLoading || !items.length ? undefined : { y: -2 }}
            whileTap={reduceMotion || exportLoading || !items.length ? undefined : { scale: 0.97 }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </motion.button>
          <motion.div
            whileHover={reduceMotion ? undefined : { y: -2 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          >
            <Link
              to="/rapports"
              className="inline-flex items-center gap-2 rounded-xl border border-sky-400/25 bg-white/5 px-3.5 py-2 text-xs font-medium text-sky-50 transition hover:bg-white/10"
            >
              <BarChart3 className="h-4 w-4" />
              Rapport
            </Link>
          </motion.div>
          {canWrite ? (
            <motion.button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #378ADD 0%, #0EA5E9 100%)",
                boxShadow: "0 4px 18px rgba(55,138,221,0.4)",
              }}
              whileHover={reduceMotion ? undefined : { y: -2, scale: 1.03 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              <Plus className="h-4 w-4" />
              Nouvel inventaire
            </motion.button>
          ) : null}
        </>
      }
    >
      <div className="space-y-5">
        <InventaireKpiCards global={global} />

        <InventaireFilterBoard
          search={search}
          onSearchChange={setSearch}
          depotFilter={depotFilter}
          onDepotChange={setDepotFilter}
          depots={depots}
          statutFilter={statutFilter}
          onStatutChange={setStatutFilter}
          filteredCount={totalResults}
          totalCount={global.nbInventaires ?? totalResults}
        />

        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                className="h-24 rounded-2xl border"
                style={{
                  background:
                    "linear-gradient(110deg, var(--bg-card) 30%, color-mix(in srgb, #378ADD 12%, var(--bg-card)) 50%, var(--bg-card) 70%)",
                  backgroundSize: "200% 100%",
                  borderColor: "var(--border-default)",
                  animation: reduceMotion ? undefined : "invSkeletonShine 1.4s ease-in-out infinite",
                  animationDelay: `${i * 80}ms`,
                }}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-sm" style={{ color: "var(--danger-text, #fca5a5)" }}>
            {getAxiosErrorMessage(error)}
          </p>
        )}

        {!isLoading && !items.length && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed px-6 py-16 text-center"
            style={{
              background:
                "linear-gradient(160deg, color-mix(in srgb, #378ADD 10%, var(--bg-card)), var(--bg-card))",
              borderColor: "rgba(55,138,221,0.28)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(14,165,233,0.18), transparent 60%)",
              }}
              aria-hidden
            />
            <motion.div
              className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(145deg, rgba(55,138,221,0.4), rgba(6,182,212,0.22))",
                color: "#7dd3fc",
                border: "1px solid rgba(96,165,250,0.4)",
                boxShadow: "0 12px 28px -12px rgba(55,138,221,0.55)",
              }}
              animate={
                reduceMotion
                  ? undefined
                  : { y: [0, -6, 0], rotate: [0, -3, 3, 0] }
              }
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ClipboardList className="h-8 w-8" />
            </motion.div>
            <h3 className="relative text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Aucun inventaire trouvé
            </h3>
            <p className="relative mt-2 max-w-sm text-sm" style={{ color: "var(--text-secondary)" }}>
              Modifiez vos filtres ou créez un nouvel inventaire pour démarrer le contrôle.
            </p>
            {canWrite ? (
              <motion.button
                type="button"
                onClick={openCreate}
                className="relative mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white"
                style={{
                  background: "linear-gradient(135deg, #378ADD, #0EA5E9)",
                  boxShadow: "0 8px 22px -8px rgba(55,138,221,0.55)",
                }}
                whileHover={reduceMotion ? undefined : { y: -2, scale: 1.03 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              >
                <Plus className="h-4 w-4" />
                Nouvel inventaire
              </motion.button>
            ) : null}
          </motion.div>
        )}

        {!isLoading && pageItems.length > 0 && (
          <>
            <InventaireList
              items={pageItems}
              canWrite={canWrite}
              onContinue={handleContinue}
            />

            <StockPagination
              page={safePage}
              totalPages={totalPages}
              totalResults={totalResults}
              pageSize={pageSize}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              unitLabel="inventaire(s)"
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}

        <InventaireWizard
          open={wizardOpen}
          onClose={closeWizard}
          depots={depots}
          initialInventaire={continueInv}
          duplicateFrom={duplicateFrom}
          initialStep={continueInv && !duplicateFrom ? 2 : 0}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["inventaires-enriched"] });
          }}
          onCreated={(newId) => {
            qc.invalidateQueries({ queryKey: ["inventaires-enriched"] });
            closeWizard();
            navigate(`/inventaires/${newId}`);
          }}
        />

        <AnimatePresence>
          {toast ? (
            <motion.div
              key={toast.msg}
              className="fixed bottom-6 right-6 z-50 rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur-md"
              style={{
                background: "var(--bg-card)",
                borderColor: toast.type === "error" ? INV_THEME.danger : INV_THEME.success,
                color: toast.type === "error" ? "#fca5a5" : "#6ee7b7",
                boxShadow:
                  toast.type === "error"
                    ? "0 12px 28px -12px rgba(226,75,74,0.45)"
                    : "0 12px 28px -12px rgba(29,158,117,0.45)",
              }}
              initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
            >
              {toast.msg}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <style>{`
          @keyframes invSkeletonShine {
            0% { background-position: 120% 0; }
            100% { background-position: -40% 0; }
          }
        `}</style>
      </div>
    </PageShell>
  );
}

