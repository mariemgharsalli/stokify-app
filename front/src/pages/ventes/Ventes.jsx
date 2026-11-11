import { useMemo, useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  IconDownload,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconTrendingUp,
  IconShoppingCart,
  IconAlertCircle,
  IconUserDollar,
  IconFilter,
  IconChartAreaLine,
  IconCash,
} from "@tabler/icons-react";
import api from "../../services/api";
import { exportVentesExcel } from "../../utils/exportHelpers";
import PageShell from "../../components/ui/PageShell";
import SearchableSelect from "../../components/ui/SearchableSelect";
import VenteWorkflowBar from "../../components/ventes/VenteWorkflowBar";
import FilterChips from "../../components/commerce/FilterChips";
import { CommerceDocCardSkeleton, CommerceDocEmpty } from "../../components/commerce/CommerceDocEmpty";
import VenteCard from "../../components/ventes/VenteCard";
import ModalValidation from "../../components/ventes/ModalValidation";
import ModalReglementVente from "../../components/ventes/ModalReglementVente";
import { WORKFLOW_VENTE } from "../../constants/statuts";
import { asItems } from "../../utils/commerceUi";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";
import { prefetchCommerceFormData } from "../../hooks/useCommerceReferenceData";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const listStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045 } },
};

const rowFade = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};

function useAnimatedNumber(target, duration = 1100) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setValue(Number(target) || 0);
      return undefined;
    }
    const end = Number(target) || 0;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(end * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduceMotion]);

  return value;
}

function KpiTile({ icon: Icon, label, value, hint, accentVar, index, reduceMotion, pulse, isCurrency }) {
  const animated = useAnimatedNumber(value, 1100);
  const display = isCurrency
    ? `${Number(animated).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`
    : Math.round(animated).toLocaleString("fr-FR");

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -6,
              boxShadow: `0 18px 36px -16px color-mix(in srgb, var(${accentVar}) 40%, transparent)`,
            }
      }
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`group relative overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-4 ${
        pulse ? "ventes-kpi-pulse" : "border-[var(--border-default)]"
      }`}
      style={pulse ? { "--kpi-accent": `var(${accentVar})`, borderColor: `color-mix(in srgb, var(${accentVar}) 35%, var(--border-default))` } : undefined}
    >
      <motion.span
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: `var(${accentVar})` }}
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.1 + index * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, color-mix(in srgb, var(${accentVar}) 18%, transparent), transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, color-mix(in srgb, #0EA5E9 10%, transparent), transparent 50%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, color-mix(in srgb, var(${accentVar}) 55%, transparent), transparent)`,
        }}
        aria-hidden
      />
      <Icon
        className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-20 opacity-[0.06] transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.1]"
        style={{ color: `var(${accentVar})` }}
        stroke={1}
        aria-hidden
      />
      <div className="relative pl-2.5">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, var(${accentVar}) 14%, transparent), transparent)`,
              color: `var(${accentVar})`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(${accentVar}) 22%, transparent)`,
            }}
          >
            <Icon size={20} stroke={1.75} />
          </div>
          {hint ? (
            <span className="rounded-md bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              {hint}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
        <p className="mt-0.5 font-display text-2xl font-bold tabular-nums tracking-tight" style={{ color: `var(${accentVar})` }}>
          {display}
        </p>
        <motion.div
          className="mt-2.5 h-px origin-left"
          style={{ background: `linear-gradient(90deg, color-mix(in srgb, var(${accentVar}) 40%, transparent), transparent)` }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.18 + index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />
      </div>
    </motion.div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3.5 py-2.5 shadow-lg">
      <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--accent-primary)]">
        {Number(payload[0].value).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}{" "}
        <span className="text-[10px] font-medium text-[var(--text-muted)]">TND</span>
      </p>
    </div>
  );
}

function CaAreaChart({ data, reduceMotion }) {
  const chartData = (data || []).map((d) => ({
    ...d,
    label: d.date ? String(d.date).slice(5) : "",
    ca: Number(d.ca || 0),
  }));

  return (
    <motion.section
      custom={4}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: "color-mix(in srgb, var(--accent-primary) 14%, transparent)",
            color: "var(--accent-primary)",
          }}
        >
          <IconChartAreaLine size={16} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Évolution du CA</p>
          <p className="text-[11px] text-[var(--text-muted)]">30 derniers jours — ventes confirmées TTC</p>
        </div>
      </div>
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ventesCaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border-default)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={42}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="ca"
              stroke="var(--accent-primary)"
              strokeWidth={2}
              fill="url(#ventesCaGradient)"
              isAnimationActive={!reduceMotion}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  );
}

export default function Ventes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const listRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const canWrite = hasPermission(user?.role, "ventes:write");
  const canViewEncours = hasPermission(user?.role, "encours:read");

  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState("");
  const [clientId, setClientId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [modePaiement, setModePaiement] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exportLoading, setExportLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [validateId, setValidateId] = useState(null);
  const [reglementVente, setReglementVente] = useState(null);

  useEffect(() => {
    prefetchCommerceFormData(qc, societeScope, "client");
  }, [qc, societeScope]);

  const filterParams = useMemo(
    () => ({
      ...(statut ? { statut } : {}),
      ...(clientId ? { clientId } : {}),
      ...(depotId ? { depotId } : {}),
      ...(modePaiement ? { modePaiement } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(dateDebut ? { dateDebut } : {}),
      ...(dateFin ? { dateFin } : {}),
    }),
    [statut, clientId, depotId, modePaiement, search, dateDebut, dateFin]
  );

  const queryParams = useMemo(() => ({ page, limit: pageSize, ...filterParams }), [page, pageSize, filterParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["ventes", societeScope, queryParams],
    queryFn: () => api.get("ventes", { params: queryParams }).then((r) => r.data),
  });

  const { data: kpis } = useQuery({
    queryKey: ["ventes-kpis", societeScope, "mois"],
    queryFn: () => api.get("ventes/kpis", { params: { periode: "mois" } }).then((r) => r.data),
  });

  const { data: statsApi } = useQuery({
    queryKey: ["ventes-stats", societeScope],
    queryFn: () => api.get("ventes/stats").then((r) => r.data),
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients", "ventes-filters", societeScope],
    queryFn: () => api.get("clients", { params: { limit: 300 } }).then((r) => r.data),
  });

  const { data: depotsData } = useQuery({
    queryKey: ["depots", "ventes-filters", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 100 } }).then((r) => r.data),
  });

  const items = asItems(data);
  const total = data?.total ?? items.length;
  const pages = Math.max(1, data?.pages ?? 1);
  const clients = asItems(clientsData);
  const depots = asItems(depotsData);

  const workflowCounts = statsApi?.countsWorkflow || {
    BROUILLON: statsApi?.nbBrouillons ?? 0,
    CONFIRME: statsApi?.nbConfirmes ?? statsApi?.nbValides ?? 0,
  };

  const filterChips = useMemo(() => {
    const chips = [];
    if (search.trim())
      chips.push({ key: "search", label: `Recherche : ${search}`, onRemove: () => setSearch("") });
    if (statut) {
      const step = WORKFLOW_VENTE.find((s) => s.key === statut);
      chips.push({ key: "statut", label: `Statut : ${step?.label || statut}`, onRemove: () => setStatut("") });
    }
    if (clientId) {
      const c = clients.find((x) => String(x.id) === String(clientId));
      chips.push({
        key: "client",
        label: `Client : ${c?.nom || clientId}`,
        onRemove: () => setClientId(""),
      });
    }
    if (depotId) {
      const d = depots.find((x) => String(x.id) === String(depotId));
      chips.push({
        key: "depot",
        label: `Dépôt : ${d?.libelle || depotId}`,
        onRemove: () => setDepotId(""),
      });
    }
    if (modePaiement)
      chips.push({
        key: "mode",
        label: `Paiement : ${modePaiement}`,
        onRemove: () => setModePaiement(""),
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
  }, [search, statut, clientId, depotId, modePaiement, dateDebut, dateFin, clients, depots]);

  function resetFilters() {
    setSearch("");
    setStatut("");
    setClientId("");
    setDepotId("");
    setModePaiement("");
    setDateDebut("");
    setDateFin("");
    setPage(1);
  }

  function selectWorkflow(key) {
    setStatut(key);
    setPage(1);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function exportCsvApi() {
    const date = new Date().toISOString().slice(0, 10);
    setExportLoading(true);
    try {
      const resp = await api.get("ventes/export", {
        params: { ...filterParams, format: "csv" },
        responseType: "blob",
      });
      const href = URL.createObjectURL(resp.data);
      const a = document.createElement("a");
      a.href = href;
      a.download = `ventes-${date}.csv`;
      a.click();
      URL.revokeObjectURL(href);
      toast.success("Export CSV téléchargé");
    } catch (e) {
      toast.error(e.message || "Erreur export");
    } finally {
      setExportLoading(false);
    }
  }

  async function exportExcelApi() {
    setExportLoading(true);
    try {
      await exportVentesExcel(api, filterParams);
      toast.success("Export Excel téléchargé");
    } catch (e) {
      toast.error(e.message || "Erreur export");
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <PageShell
      title="Ventes & Facturation"
      subtitle="Pilotage commercial — CA, encaissements et cycle de vie des commandes"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {canViewEncours ? (
            <button
              type="button"
              onClick={() => navigate("/encours-clients")}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-all duration-150 hover:bg-[var(--bg-hover)]"
            >
              <IconUserDollar size={16} />
              Encours clients
            </button>
          ) : null}
          <button
            type="button"
            onClick={exportCsvApi}
            disabled={exportLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-all duration-150 hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            {exportLoading ? <IconLoader2 size={16} className="animate-spin" /> : <IconDownload size={16} />}
            Exporter CSV
          </button>
          <button
            type="button"
            onClick={exportExcelApi}
            disabled={exportLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-all duration-150 hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            {exportLoading ? <IconLoader2 size={16} className="animate-spin" /> : <IconDownload size={16} />}
            Exporter Excel
          </button>
          {canWrite ? (
            <button
              type="button"
              onClick={() => navigate("/ventes/new")}
              className={PRIMARY_BTN_CLASSES}
              style={primaryButtonStyle}
            >
              <IconPlus size={16} />
              Nouvelle vente
            </button>
          ) : null}
        </div>
      }
    >
      <style>{`
        @keyframes ventesKpiPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--kpi-accent) 18%, transparent); }
          50% { box-shadow: 0 0 22px 2px color-mix(in srgb, var(--kpi-accent) 28%, transparent); }
        }
        .ventes-kpi-pulse { animation: ventesKpiPulse 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ventes-kpi-pulse { animation: none !important; }
        }
      `}</style>

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            index={0}
            reduceMotion={reduceMotion}
            icon={IconTrendingUp}
            label="CA du mois"
            value={kpis?.caTTC ?? statsApi?.caMois}
            isCurrency
            hint="TTC"
            accentVar="--accent-success"
          />
          <KpiTile
            index={1}
            reduceMotion={reduceMotion}
            icon={IconShoppingCart}
            label="Nb de ventes"
            value={kpis?.nbVentes ?? statsApi?.nbConfirmes}
            hint="confirmées"
            accentVar="--accent-primary"
          />
          <KpiTile
            index={2}
            reduceMotion={reduceMotion}
            icon={IconCash}
            label="Panier moyen"
            value={kpis?.panierMoyen}
            isCurrency
            hint="TTC"
            accentVar="--accent-warning"
          />
          <KpiTile
            index={3}
            reduceMotion={reduceMotion}
            icon={IconAlertCircle}
            label="En attente"
            value={kpis?.montantEnAttente ?? statsApi?.montantNonRegle ?? statsApi?.montantImpaye}
            isCurrency
            hint="règlement"
            accentVar="--accent-danger"
            pulse={Number(kpis?.montantEnAttente ?? statsApi?.montantNonRegle ?? 0) > 0}
          />
        </div>

        <CaAreaChart data={kpis?.evolutionCA30j} reduceMotion={reduceMotion} />

        <VenteWorkflowBar activeStatut={statut} counts={workflowCounts} onSelect={selectWorkflow} />

        <div className="sticky top-2 z-20 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/95 shadow-sm backdrop-blur-md">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)]"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <span className="inline-flex items-center gap-2">
              <IconFilter size={16} className="text-[var(--accent-primary)]" />
              Filtres avancés
              {filterChips.length > 0 ? (
                <span className="rounded-full bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  {filterChips.length}
                </span>
              ) : null}
            </span>
            <motion.span
              animate={{ rotate: filtersOpen ? 180 : 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
              className="text-[var(--text-muted)]"
            >
              ▼
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {filtersOpen ? (
              <motion.div
                key="filters"
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-t border-[var(--border-default)]"
              >
                <div className="px-4 pb-4 pt-2">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="relative min-w-[200px] flex-1">
                      <label className="mb-1 block text-xs text-[var(--text-secondary)]">Recherche</label>
                      <IconSearch className="pointer-events-none absolute left-3 top-8 h-4 w-4 text-[var(--text-muted)]" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] py-2 pl-9 pr-3 text-sm focus:outline-none"
                        placeholder="Référence, client…"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-[var(--text-secondary)]">Client</label>
                      <SearchableSelect
                        value={clientId}
                        onChange={setClientId}
                        options={clients.map((c) => ({
                          value: String(c.id),
                          label: `${c.code || ""} — ${c.nom || ""}`.trim(),
                        }))}
                        placeholder="Tous"
                        clearLabel="Tous"
                        className="min-w-[220px]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-[var(--text-secondary)]">Dépôt</label>
                      <SearchableSelect
                        value={depotId}
                        onChange={setDepotId}
                        options={depots.map((d) => ({
                          value: String(d.id),
                          label: `${d.code || ""} — ${d.libelle || ""}`.trim(),
                        }))}
                        placeholder="Tous"
                        clearLabel="Tous"
                        className="min-w-[180px]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-[var(--text-secondary)]">Mode paiement</label>
                      <select
                        value={modePaiement}
                        onChange={(e) => setModePaiement(e.target.value)}
                        className="min-w-[140px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                      >
                        <option value="">Tous</option>
                        <option value="ESPECES">Espèces</option>
                        <option value="CHEQUE">Chèque</option>
                        <option value="VIREMENT">Virement</option>
                        <option value="TRAITE">Traite</option>
                        <option value="CREDIT">Crédit</option>
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
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div ref={listRef} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterChips chips={filterChips} onClearAll={resetFilters} />
            <p className="text-sm text-[var(--text-muted)]">
              Page {page} / {pages} — {total} vente(s)
            </p>
          </div>

          {isLoading ? (
            <CommerceDocCardSkeleton count={5} />
          ) : items.length === 0 ? (
            <CommerceDocEmpty
              variant="vente"
              title="Aucune vente trouvée"
              description="Ajustez les filtres ou créez une nouvelle vente client."
              action={
                canWrite ? (
                  <button
                    type="button"
                    onClick={() => navigate("/ventes/new")}
                    className={PRIMARY_BTN_CLASSES}
                    style={primaryButtonStyle}
                  >
                    <IconPlus size={16} />
                    Créer une vente
                  </button>
                ) : null
              }
            />
          ) : (
            <motion.div
              variants={listStagger}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              className="space-y-3"
            >
              {items.map((v, idx) => (
                <motion.div key={v.id} variants={rowFade}>
                  <VenteCard
                    vente={v}
                    index={idx}
                    canWrite={canWrite}
                    onValidate={() => setValidateId(v.id)}
                    onReglement={() => setReglementVente(v)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2">
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
            </select>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-sm text-[var(--text-muted)]">
                {page} / {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      </div>

      {validateId ? (
        <ModalValidation venteId={validateId} onClose={() => setValidateId(null)} onSuccess={() => setValidateId(null)} />
      ) : null}

      {reglementVente ? (
        <ModalReglementVente
          vente={reglementVente}
          onClose={() => setReglementVente(null)}
          onSuccess={async () => {
            qc.invalidateQueries({ queryKey: ["ventes"] });
            qc.invalidateQueries({ queryKey: ["ventes-stats"] });
            qc.invalidateQueries({ queryKey: ["ventes-kpis"] });
            setReglementVente(null);
          }}
        />
      ) : null}
    </PageShell>
  );
}
