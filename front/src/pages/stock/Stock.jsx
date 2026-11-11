import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Box,
  Coins,
  FileDown,
  FlaskConical,
  Grid3x3,
  HeartPulse,
  List,
  Loader2,
  Package,
  QrCode,
  Search,
  Table2,
  Warehouse,
  X,
} from "lucide-react";
import { IconCalendar, IconMapPin } from "@tabler/icons-react";
import { NavLink, useSearchParams } from "react-router-dom";
import api, { downloadAuthenticatedCsv } from "../../services/api";
import { exportStockExcel } from "../../utils/exportHelpers";
import PageShell from "../../components/ui/PageShell";
import { GlassAside } from "../../components/ui/GlassPageHeader";
import SearchableSelect from "../../components/ui/SearchableSelect";
import WorkflowBar from "../../components/ui/WorkflowBar";
import FilterChips from "../../components/commerce/FilterChips";
import CommerceChart from "../../components/commerce/CommerceChart";
import StockKpiCards from "../../components/stock/StockKpiCards";
import StockTrendChart from "../../components/stock/StockTrendChart";
import TransferChooserModal from "../../components/stock/TransferChooserModal";
import TransfertModal from "../../components/stock/TransfertModal";
import TransferEmplacementModal from "../../components/stock/TransferEmplacementModal";
import ArticleStockCard from "../../components/stock/ArticleStockCard";
import DepotStockCard from "../../components/stock/DepotStockCard";
import StockTableView from "../../components/stock/StockTableView";
import StockPagination from "../../components/stock/StockPagination";
import { parseLineStatut } from "../../components/stock/stockUi";
import { WORKFLOW_STOCK } from "../../constants/statuts";
import {
  useStockDepotSummaries,
  useStockGroupes,
  useStockStats,
  getLineStockMin,
} from "../../hooks/useStockGroupes";
import DepotMapView from "./DepotMapView";
import StockCalendarView from "./StockCalendarView";
import StockHealthView from "./StockHealthView";
import StockHeatmapView from "./StockHeatmapView";
import SimulationPanel from "./SimulationPanel";
import QRModal from "./QRModal";
import { exportRapportInstantane } from "./exportRapportInstantane";
import { useClientBranding } from "../../hooks/useClientBranding";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import {
  PRIMARY_BTN_CLASSES,
  primaryButtonStyle,
  primaryButtonShadowStyle,
  primaryOptionHighlightStyle,
  primaryOptionSelectedStyle,
  STOKIFY_BLUE_RGB,
} from "../../utils/brandStyles";

const STOCK_TABS = [
  { key: "stock", to: "/stock", label: "Stock", Icon: Package, end: true },
  { key: "lots", to: "/lots", label: "Lots", Icon: Box },
  { key: "serie", to: "/numeros-serie", label: "N° série", Icon: QrCode },
  { key: "cout", to: "/cout-stockage", label: "Coût stockage", Icon: Coins },
];

const VIEW_MODES = [
  { key: "article", label: "Par article", Icon: List },
  { key: "depot", label: "Par dépôt", Icon: Warehouse },
  { key: "table", label: "Tableau", Icon: Table2 },
  { key: "carte", label: "Carte", Icon: IconMapPin },
  { key: "calendrier", label: "Calendrier", Icon: IconCalendar },
  { key: "sante", label: "Santé", Icon: HeartPulse, color: "#E24B4A" },
  { key: "heatmap", label: "Heatmap", Icon: Grid3x3, color: "#378ADD" },
];

const SAVED_FILTERS_KEY = "stokify_stock_filters";
const MAX_SAVED_FILTERS = 5;

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Stock() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const listRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const clientBranding = useClientBranding();
  const canWrite = hasPermission(user?.role, "stock:write");
  const canSeeLots = hasPermission(user?.role, "stock:read");
  const canSeeCoutStockage = hasPermission(user?.role, "valorisation:read");

  const [viewMode, setViewMode] = useState("article");
  const [search, setSearch] = useState("");
  const [depotId, setDepotId] = useState("");
  const [emplacementFilterId, setEmplacementFilterId] = useState("");
  const [articleId, setArticleId] = useState("");
  const [statut, setStatut] = useState("");
  const [alertFilter, setAlertFilter] = useState("");
  const [familleId, setFamilleId] = useState("");
  const [rotationFilter, setRotationFilter] = useState("");
  const [trendOpen, setTrendOpen] = useState(true);
  const [transferChooserLigne, setTransferChooserLigne] = useState(null);
  const [transferLigne, setTransferLigne] = useState(null);
  const [emplTransferPrefill, setEmplTransferPrefill] = useState(null);
  const [savedFilters, setSavedFilters] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");

  const [sortBy, setSortBy] = useState("article");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [qrModalStock, setQrModalStock] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [lineForm, setLineForm] = useState({ articleId: "", depotId: "", emplacementId: "", quantite: "" });
  const [lineFormErrors, setLineFormErrors] = useState({});
  const [lineCompatError, setLineCompatError] = useState("");
  const [lineShakeEmplacement, setLineShakeEmplacement] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["stock", societeScope, search, depotId, emplacementFilterId, articleId, statut],
    queryFn: () =>
      api
        .get("stock", {
          params: {
            search: search || undefined,
            depotId: depotId || undefined,
            emplacementId: emplacementFilterId || undefined,
            articleId: articleId || undefined,
            statut: statut || undefined,
            limit: 500,
          },
        })
        .then((r) => r.data),
  });

  const { data: depotsData } = useQuery({
    queryKey: ["depots-dd", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 200 } }).then((r) => r.data),
  });

  const { data: depotsActifsData } = useQuery({
    queryKey: ["depots-dd-actifs", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 200, statut: "ACTIF" } }).then((r) => r.data),
  });

  const { data: articlesData } = useQuery({
    queryKey: ["articles-dd", societeScope],
    queryFn: () => api.get("articles", { params: { limit: 500 } }).then((r) => r.data),
  });

  const { data: lotsExpiringData } = useQuery({
    queryKey: ["lots-expiring-soon", societeScope],
    queryFn: () => api.get("lots/expiring-soon", { params: { days: 30, limit: 1 } }).then((r) => r.data),
    enabled: canSeeLots,
  });

  const { data: famillesData } = useQuery({
    queryKey: ["familles-dd", societeScope],
    queryFn: () => api.get("familles").then((r) => r.data),
  });

  const { data: rotationData } = useQuery({
    queryKey: ["stock-rotation", societeScope],
    queryFn: () => api.get("stock/rotation-summary").then((r) => r.data),
  });

  const { data: emplacementsRaw } = useQuery({
    queryKey: ["emplacements-dd", societeScope, lineForm.depotId],
    queryFn: () => api.get("emplacements", { params: { depotId: lineForm.depotId, statut: "ACTIF" } }).then((r) => r.data),
    enabled: Boolean(lineForm.depotId),
  });

  const { data: emplacementsFilterRaw } = useQuery({
    queryKey: ["emplacements-dd-filter", societeScope, depotId],
    queryFn: () => api.get("emplacements", { params: { depotId } }).then((r) => r.data),
    enabled: Boolean(depotId),
  });

  useEffect(() => {
    const d = searchParams.get("depotId");
    const a = searchParams.get("articleId");
    if (d) setDepotId(d);
    if (a) setArticleId(a);
  }, [searchParams]);

  useEffect(() => {
    if (!lineForm.articleId || !lineForm.emplacementId) {
      setLineCompatError("");
      return;
    }
    let cancelled = false;
    api
      .get("stock/emplacement-compatibility", {
        params: { articleId: lineForm.articleId, emplacementId: lineForm.emplacementId },
      })
      .then((r) => {
        if (cancelled) return;
        if (!r.data.ok) {
          setLineCompatError(r.data.message);
          setLineShakeEmplacement(true);
          setTimeout(() => setLineShakeEmplacement(false), 400);
        } else {
          setLineCompatError("");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lineForm.articleId, lineForm.emplacementId]);

  const createLine = useMutation({
    mutationFn: (payload) => api.post("stock/lines", payload),
    onSuccess: () => {
      toast.success("Ligne de stock ajoutée.");
      setLineForm({ articleId: "", depotId: "", emplacementId: "", quantite: "" });
      setLineFormErrors({});
      qc.invalidateQueries({ queryKey: ["stock"], exact: false });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const depots = Array.isArray(depotsData) ? depotsData : depotsData?.items || [];
  const depotsActifs = Array.isArray(depotsActifsData) ? depotsActifsData : depotsActifsData?.items || [];
  const articles = Array.isArray(articlesData) ? articlesData : articlesData?.items || [];
  const emplacementsDd = Array.isArray(emplacementsRaw) ? emplacementsRaw : emplacementsRaw?.items || [];
  const emplacementsFilter = Array.isArray(emplacementsFilterRaw)
    ? emplacementsFilterRaw
    : emplacementsFilterRaw?.items || [];
  const familles = Array.isArray(famillesData) ? famillesData : famillesData?.items || [];

  const rotationMap = useMemo(() => {
    const m = new Map();
    for (const r of rotationData || []) m.set(r.articleId, r.rotationLabel);
    return m;
  }, [rotationData]);

  const articleImageMap = useMemo(() => {
    const m = new Map();
    for (const a of articles) {
      if (a?.id != null && a.imageUrl) m.set(Number(a.id), a.imageUrl);
    }
    return m;
  }, [articles]);

  const allItems = useMemo(() => {
    const items = data?.items || [];
    if (!articleImageMap.size) return items;
    return items.map((row) => {
      const aid = Number(row.articleId ?? row.article?.id);
      const fromCatalog = articleImageMap.get(aid);
      if (!fromCatalog || row.article?.imageUrl) return row;
      return {
        ...row,
        article: { ...(row.article || {}), imageUrl: fromCatalog },
      };
    });
  }, [data?.items, articleImageMap]);

  const displayedItems = useMemo(() => {
    let rows = allItems;
    if (alertFilter === "RUPTURE") {
      rows = rows.filter((r) => Number(r.quantite) === 0);
    } else if (alertFilter === "CRITIQUE") {
      rows = rows.filter((r) => {
        const q = Number(r.quantite) || 0;
        const min = getLineStockMin(r);
        return q > 0 && min != null && q <= Number(min);
      });
    }
    if (familleId) {
      rows = rows.filter((r) => String(r.article?.familleId ?? r.article?.famille?.id) === familleId);
    }
    if (rotationFilter) {
      rows = rows.filter((r) => {
        const aid = r.articleId ?? r.article?.id;
        const label = rotationMap.get(aid) || "Faible";
        return label === rotationFilter;
      });
    }
    return rows;
  }, [allItems, alertFilter, familleId, rotationFilter, rotationMap]);

  const stats = useStockStats(allItems, depots, lotsExpiringData?.total ?? 0);
  const articlesGroupes = useStockGroupes(displayedItems);
  const depotsAvecStock = useStockDepotSummaries(displayedItems, depots);

  const chartData = useMemo(
    () =>
      depotsAvecStock.slice(0, 8).map((d) => ({
        mois: d.libelle?.length > 12 ? `${d.libelle.slice(0, 12)}…` : d.libelle,
        total: d.valeurCMP,
      })),
    [depotsAvecStock]
  );

  const workflowCounts = useMemo(() => {
    const c = { ACTIF: 0, RUPTURE: 0, CRITIQUE: 0 };
    for (const row of allItems) {
      const s = parseLineStatut(row);
      if (s === "ACTIF") c.ACTIF++;
      const q = Number(row.quantite) || 0;
      const min = getLineStockMin(row);
      if (q === 0) c.RUPTURE++;
      else if (min != null && q > 0 && q <= Number(min)) c.CRITIQUE++;
    }
    return c;
  }, [allItems]);

  const depotOptions = useMemo(
    () => depots.map((d) => ({ value: String(d.id), label: `${d.code} — ${d.libelle}` })),
    [depots]
  );
  const depotLineOptions = useMemo(
    () => (depotsActifs.length ? depotsActifs : depots).map((d) => ({
      value: String(d.id),
      label: `${d.code} — ${d.libelle}`,
    })),
    [depotsActifs, depots]
  );
  const articleOptions = useMemo(
    () => articles.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.libelle}` })),
    [articles]
  );
  const emplacementLineOptions = useMemo(
    () => emplacementsDd.map((e) => ({ value: String(e.id), label: `${e.code} — ${e.libelle}` })),
    [emplacementsDd]
  );
  const familleOptions = useMemo(
    () => familles.map((f) => ({ value: String(f.id), label: f.nom || f.libelle || f.code })),
    [familles]
  );

  const sortedItems = useMemo(() => {
    const rows = [...displayedItems];
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sortBy === "quantite") {
        const va = Number(a.quantite) || 0;
        const vb = Number(b.quantite) || 0;
        return va === vb ? 0 : va > vb ? dir : -dir;
      }
      const sa = `${a.article?.code || ""} ${a.article?.libelle || ""}`.toLowerCase();
      const sb = `${b.article?.code || ""} ${b.article?.libelle || ""}`.toLowerCase();
      const c = sa.localeCompare(sb, "fr");
      return c === 0 ? 0 : c > 0 ? dir : -dir;
    });
    return rows;
  }, [displayedItems, sortBy, sortDir]);

  const tableTotal = sortedItems.length;
  const articleTotal = articlesGroupes.length;
  const depotTotal = depotsAvecStock.length;

  const listTotal =
    viewMode === "article" ? articleTotal : viewMode === "depot" ? depotTotal : tableTotal;
  const totalPages = Math.max(1, Math.ceil(listTotal / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageSlice = useMemo(() => {
    const p = Math.max(0, safePage - 1);
    return sortedItems.slice(p * pageSize, p * pageSize + pageSize);
  }, [sortedItems, safePage, pageSize]);

  const articlesPageSlice = useMemo(() => {
    const p = Math.max(0, safePage - 1);
    return articlesGroupes.slice(p * pageSize, p * pageSize + pageSize);
  }, [articlesGroupes, safePage, pageSize]);

  const depotsPageSlice = useMemo(() => {
    const p = Math.max(0, safePage - 1);
    return depotsAvecStock.slice(p * pageSize, p * pageSize + pageSize);
  }, [depotsAvecStock, safePage, pageSize]);

  const rangeStart = listTotal === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, listTotal);

  const paginationUnit =
    viewMode === "article"
      ? "article(s)"
      : viewMode === "depot"
        ? "dépôt(s)"
        : "ligne(s)";

  useEffect(() => {
    setPage(1);
  }, [search, depotId, emplacementFilterId, articleId, statut, alertFilter, familleId, rotationFilter, viewMode, pageSize]);

  const filterChips = useMemo(() => {
    const chips = [];
    if (search.trim()) chips.push({ key: "search", label: `Recherche : ${search}`, onRemove: () => setSearch("") });
    if (depotId) {
      const d = depots.find((x) => String(x.id) === depotId);
      chips.push({
        key: "depot",
        label: `Dépôt : ${d?.libelle || depotId}`,
        onRemove: () => {
          setDepotId("");
          setEmplacementFilterId("");
        },
      });
    }
    if (emplacementFilterId) {
      const e = emplacementsFilter.find((x) => String(x.id) === emplacementFilterId);
      chips.push({
        key: "emp",
        label: `Emplacement : ${e?.code || emplacementFilterId}`,
        onRemove: () => setEmplacementFilterId(""),
      });
    }
    if (statut) {
      const step = WORKFLOW_STOCK.find((s) => s.key === statut);
      chips.push({
        key: "statut",
        label: `Statut : ${step?.label || statut}`,
        onRemove: () => setStatut(""),
      });
    }
    if (alertFilter) {
      const step = WORKFLOW_STOCK.find((s) => s.key === alertFilter);
      chips.push({
        key: "alert",
        label: `Alerte : ${step?.label || alertFilter}`,
        onRemove: () => setAlertFilter(""),
      });
    }
    if (articleId) {
      const a = articles.find((x) => String(x.id) === articleId);
      chips.push({
        key: "article",
        label: `Article : ${a?.code || articleId}`,
        onRemove: () => setArticleId(""),
      });
    }
    if (familleId) {
      const f = familles.find((x) => String(x.id) === familleId);
      chips.push({
        key: "famille",
        label: `Famille : ${f?.nom || familleId}`,
        onRemove: () => setFamilleId(""),
      });
    }
    if (rotationFilter) {
      chips.push({
        key: "rotation",
        label: `Rotation : ${rotationFilter}`,
        onRemove: () => setRotationFilter(""),
      });
    }
    return chips;
  }, [search, depotId, emplacementFilterId, statut, alertFilter, articleId, familleId, rotationFilter, depots, emplacementsFilter, articles, familles]);

  function resetFilters() {
    setSearch("");
    setDepotId("");
    setEmplacementFilterId("");
    setArticleId("");
    setStatut("");
    setAlertFilter("");
    setFamilleId("");
    setRotationFilter("");
    setPage(1);
  }

  function currentFilterSnapshot() {
    return { search, depotId, emplacementFilterId, articleId, statut, alertFilter, familleId, rotationFilter };
  }

  function applySavedFilter(filters) {
    setSearch(filters.search || "");
    setDepotId(filters.depotId || "");
    setEmplacementFilterId(filters.emplacementFilterId || "");
    setArticleId(filters.articleId || "");
    setStatut(filters.statut || "");
    setAlertFilter(filters.alertFilter || "");
    setFamilleId(filters.familleId || "");
    setRotationFilter(filters.rotationFilter || "");
    setPage(1);
  }

  function saveCurrentFilter() {
    const name = saveFilterName.trim();
    if (!name) return toast.error("Indiquez un nom pour le filtre.");
    if (savedFilters.length >= MAX_SAVED_FILTERS) {
      return toast.error(`Maximum ${MAX_SAVED_FILTERS} filtres favoris.`);
    }
    const next = [...savedFilters, { name, filters: currentFilterSnapshot() }];
    setSavedFilters(next);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next));
    setSaveFilterName("");
    setSaveFilterOpen(false);
    toast.success("Filtre sauvegardé.");
  }

  function deleteSavedFilter(index) {
    const next = savedFilters.filter((_, i) => i !== index);
    setSavedFilters(next);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next));
  }

  const lineActions = {
    onTransfer: (row) => setTransferChooserLigne(row),
    onQrClick: (row) => setQrModalStock(row),
    actionsPending: false,
    rotationMap,
  };

  function selectWorkflow(key) {
    if (!key) {
      setStatut("");
      setAlertFilter("");
    } else if (key === "RUPTURE" || key === "CRITIQUE") {
      setStatut("");
      setAlertFilter(key);
    } else {
      setAlertFilter("");
      setStatut(key);
    }
    setPage(1);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleSort(column) {
    if (sortBy === column) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(column);
      setSortDir(column === "quantite" ? "desc" : "asc");
    }
  }

  function validateLineForm() {
    const err = {};
    if (!lineForm.articleId) err.articleId = "L'article est obligatoire.";
    if (!lineForm.depotId) err.depotId = "Le dépôt est obligatoire.";
    if (lineForm.quantite === "" || lineForm.quantite == null || Number.isNaN(Number(lineForm.quantite))) {
      err.quantite = "Indiquez une quantité valide.";
    }
    setLineFormErrors(err);
    return Object.keys(err).length === 0;
  }

  function submitLineForm() {
    if (!validateLineForm()) return;
    if (lineCompatError) return;
    createLine.mutate({
      articleId: Number(lineForm.articleId),
      depotId: Number(lineForm.depotId),
      emplacementId: lineForm.emplacementId ? Number(lineForm.emplacementId) : undefined,
      quantite: Number(lineForm.quantite) || 0,
    });
  }

  async function exportCsv() {
    setExportLoading(true);
    try {
      await downloadAuthenticatedCsv("stock/export", "stock-export.csv");
      toast.success("Export CSV téléchargé");
    } catch (e) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setExportLoading(false);
    }
  }

  async function exportExcel() {
    setExportLoading(true);
    try {
      await exportStockExcel(api);
      toast.success("Export Excel téléchargé");
    } catch (e) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setExportLoading(false);
    }
  }

  async function exportPdf() {
    setPdfLoading(true);
    try {
      await exportRapportInstantane(displayedItems, clientBranding, {
        totalArticles: stats.totalArticles,
        valeurTotale: stats.valeurTotale,
        ruptures: stats.enRupture,
        critiques: stats.stockCritique,
      });
      toast.success("Rapport PDF téléchargé");
    } catch (e) {
      toast.error(e.message || "Erreur lors de la génération du PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  const visibleTabs = STOCK_TABS.filter((t) => {
    if (t.key === "lots" || t.key === "serie") return canSeeLots;
    if (t.key === "cout") return canSeeCoutStockage;
    return true;
  });

  const workflowActive = alertFilter || statut;

  return (
    <PageShell
      title="Stock"
      subtitle="Quantités, images articles, emplacements et alertes en temps réel"
      icon={Package}
      badge="Temps réel"
      aside={
        <GlassAside
          icon={AlertTriangle}
          label="Alertes"
          value={
            <>
              <span className="tabular-nums text-amber-300">
                {(stats.enRupture || 0) + (stats.stockCritique || 0)}
              </span>
              {" à surveiller"}
            </>
          }
          iconColor="#fbbf24"
          iconBg="rgba(217,119,6,0.22)"
          iconBorder="rgba(251,191,36,0.35)"
        />
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <motion.button
            type="button"
            onClick={exportCsv}
            disabled={exportLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-400/25 bg-white/5 px-3.5 py-2 text-xs font-medium text-sky-50 disabled:opacity-50"
            whileHover={reduceMotion || exportLoading ? undefined : { y: -2 }}
            whileTap={reduceMotion || exportLoading ? undefined : { scale: 0.97 }}
          >
            {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            CSV
          </motion.button>
          <motion.button
            type="button"
            onClick={exportExcel}
            disabled={exportLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-400/25 bg-white/5 px-3.5 py-2 text-xs font-medium text-sky-50 disabled:opacity-50"
            whileHover={reduceMotion || exportLoading ? undefined : { y: -2 }}
            whileTap={reduceMotion || exportLoading ? undefined : { scale: 0.97 }}
          >
            {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Excel
          </motion.button>
          <motion.button
            type="button"
            onClick={exportPdf}
            disabled={pdfLoading}
            className="stokify-btn-action inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-white disabled:opacity-50"
            style={primaryButtonShadowStyle}
            whileHover={reduceMotion || pdfLoading ? undefined : { y: -2 }}
            whileTap={reduceMotion || pdfLoading ? undefined : { scale: 0.97 }}
          >
            {pdfLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <i className="ti ti-file-report" aria-hidden="true" />
            )}
            PDF
          </motion.button>
          {canWrite ? (
            <motion.button
              type="button"
              onClick={() => setEmplTransferPrefill({})}
              className={`inline-flex items-center gap-2 ${PRIMARY_BTN_CLASSES}`}
              style={primaryButtonStyle}
              whileHover={reduceMotion ? undefined : { y: -2, scale: 1.03 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              <i className="ti ti-arrows-transfer-up" aria-hidden="true" />
              Transfert
            </motion.button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        <motion.div
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          custom={0}
        >
          <StockKpiCards stats={stats} />
        </motion.div>

        <StockTrendChart open={trendOpen} onToggle={() => setTrendOpen((o) => !o)} />

        {chartData.length > 0 ? (
          <CommerceChart data={chartData} dataKey="total" title="Valeur CMP par dépôt" />
        ) : null}

        <WorkflowBar
          type="stock"
          steps={WORKFLOW_STOCK}
          activeStatut={workflowActive}
          counts={workflowCounts}
          onSelect={selectWorkflow}
        />

        <motion.div
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          custom={1}
          className="rounded-2xl border border-sky-400/20 p-2"
          style={{
            background:
              "linear-gradient(145deg, rgba(17,34,66,0.55) 0%, var(--bg-card) 70%)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex flex-wrap items-center gap-2 px-2 py-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200/50">
              Modules
            </span>
            {visibleTabs.map((tab) => (
              <NavLink
                key={tab.key}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "text-white shadow-md"
                      : "text-[var(--text-secondary)] hover:bg-white/5"
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        background: "linear-gradient(135deg, #378ADD, #0EA5E9)",
                        boxShadow: "0 4px 14px rgba(55,138,221,0.35)",
                      }
                    : undefined
                }
              >
                <tab.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab.label}
              </NavLink>
            ))}
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          custom={2}
          className="article-filter-panel sticky top-2 z-20"
        >
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-white"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <span className="inline-flex items-center gap-2.5">
              <span
                className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl"
                style={{
                  background: "linear-gradient(135deg, rgba(55,138,221,0.5), rgba(6,182,212,0.28))",
                  color: "#7dd3fc",
                  boxShadow: "0 0 16px rgba(56,189,248,0.3)",
                }}
              >
                <Search className="h-4 w-4" />
              </span>
              Filtres & recherche
            </span>
            <motion.span
              animate={{ rotate: filtersOpen ? 180 : 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
              className="text-sky-200/60"
            >
              ▼
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
          {filtersOpen ? (
            <motion.div
              key="stock-filters"
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="overflow-hidden border-t border-sky-400/10 px-4 pb-4 pt-2"
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="relative min-w-[200px] flex-1">
                  <label className="art-status-tabs-label mb-1 block text-[11px] font-semibold uppercase tracking-wide">
                    Recherche
                  </label>
                  <div className="art-filter-search-wrap relative">
                  <Search className="art-filter-search-icon pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="art-filter-field w-full py-2.5 pl-9 pr-3 text-sm shadow-none"
                    placeholder="Code, libellé ou article…"
                  />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">Dépôt</label>
                  <SearchableSelect
                    value={depotId}
                    onChange={(v) => {
                      setDepotId(v);
                      setEmplacementFilterId("");
                    }}
                    options={depotOptions}
                    placeholder="Tous"
                    clearLabel="Tous"
                    className="min-w-[200px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">Emplacement</label>
                  <SearchableSelect
                    value={emplacementFilterId}
                    onChange={setEmplacementFilterId}
                    options={emplacementsFilter.map((e) => ({
                      value: String(e.id),
                      label: `${e.code} — ${e.libelle}`,
                    }))}
                    placeholder={depotId ? "Tous" : "Choisir un dépôt"}
                    clearLabel="Tous"
                    disabled={!depotId}
                    className="min-w-[200px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">Article</label>
                  <SearchableSelect
                    value={articleId}
                    onChange={setArticleId}
                    options={articleOptions}
                    placeholder="Tous"
                    clearLabel="Tous"
                    className="min-w-[220px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">Famille</label>
                  <SearchableSelect
                    value={familleId}
                    onChange={setFamilleId}
                    options={familleOptions}
                    placeholder="Toutes"
                    clearLabel="Toutes"
                    className="min-w-[180px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">Rotation</label>
                  <select
                    value={rotationFilter}
                    onChange={(e) => setRotationFilter(e.target.value)}
                    className="min-w-[140px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                  >
                    <option value="">Toutes</option>
                    <option value="Fort">Fort</option>
                    <option value="Moyen">Moyen</option>
                    <option value="Faible">Faible</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveFilterOpen(true)}
                  className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  Sauvegarder ce filtre
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  Réinitialiser
                </button>
              </div>
              {savedFilters.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {savedFilters.map((sf, i) => (
                    <span
                      key={`${sf.name}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-500/15 px-2.5 py-1 text-[11px] font-medium text-sky-100 animate-[fadeUp_0.35s_ease_both]"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      {sf.name}
                      <button type="button" className="rounded px-1.5 hover:bg-white/10" onClick={() => applySavedFilter(sf.filters)}>
                        Appliquer
                      </button>
                      <button type="button" className="rounded px-1 hover:bg-white/10" onClick={() => deleteSavedFilter(i)} aria-label="Supprimer">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </motion.div>
          ) : null}
          </AnimatePresence>
        </motion.div>

        {saveFilterOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSaveFilterOpen(false)} role="presentation">
            <div className="w-full max-w-sm rounded-xl border border-[var(--border-default)] bg-[var(--bg-modal)] p-4" style={{ animation: "scaleUp 0.25s ease both" }} onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Sauvegarder ce filtre</h3>
              <input
                value={saveFilterName}
                onChange={(e) => setSaveFilterName(e.target.value)}
                placeholder="Ex. Ruptures Dépôt Nord"
                className="mt-3 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setSaveFilterOpen(false)} className="rounded-lg border px-3 py-1.5 text-sm">Annuler</button>
                <button type="button" onClick={saveCurrentFilter} className={`rounded-lg px-3 py-1.5 text-sm text-white ${PRIMARY_BTN_CLASSES}`} style={primaryButtonStyle}>Enregistrer</button>
              </div>
            </div>
          </div>
        ) : null}

        {canWrite && showAddForm ? (
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-3">
                <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                  Article <span className="text-[#E24B4A]">*</span>
                </label>
                <SearchableSelect
                  value={lineForm.articleId}
                  onChange={(v) => {
                    setLineForm((f) => ({ ...f, articleId: v }));
                    setLineFormErrors((e) => ({ ...e, articleId: undefined }));
                  }}
                  options={articleOptions}
                  placeholder="Sélectionner"
                  allowClear={false}
                  className="w-full"
                />
                {lineFormErrors.articleId ? (
                  <p className="mt-1 text-xs text-[#E24B4A]">{lineFormErrors.articleId}</p>
                ) : null}
              </div>
              <div className="lg:col-span-3">
                <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                  Dépôt <span className="text-[#E24B4A]">*</span>
                </label>
                <SearchableSelect
                  value={lineForm.depotId}
                  onChange={(v) => {
                    setLineForm((f) => ({ ...f, depotId: v, emplacementId: "" }));
                    setLineFormErrors((e) => ({ ...e, depotId: undefined }));
                  }}
                  options={depotLineOptions}
                  placeholder="Sélectionner"
                  allowClear={false}
                  className="w-full"
                />
                {lineFormErrors.depotId ? <p className="mt-1 text-xs text-[#E24B4A]">{lineFormErrors.depotId}</p> : null}
              </div>
              <div className={`lg:col-span-3 ${lineShakeEmplacement ? "animate-shake" : ""}`}>
                <label className="mb-1 block text-xs text-[var(--text-secondary)]">Emplacement</label>
                <SearchableSelect
                  value={lineForm.emplacementId}
                  onChange={(v) => setLineForm((f) => ({ ...f, emplacementId: v }))}
                  options={emplacementLineOptions}
                  placeholder={lineForm.depotId ? "Optionnel" : "Dépôt d'abord"}
                  clearLabel="Aucun"
                  disabled={!lineForm.depotId}
                  className="w-full"
                />
                {lineCompatError ? <p className="mt-1 text-xs text-[#E24B4A]">⚠ {lineCompatError}</p> : null}
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                  Quantité <span className="text-[#E24B4A]">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm focus:border-[var(--border-focus)] focus:outline-none"
                  value={lineForm.quantite}
                  onChange={(e) => {
                    setLineForm((f) => ({ ...f, quantite: e.target.value }));
                    setLineFormErrors((er) => ({ ...er, quantite: undefined }));
                  }}
                />
                {lineFormErrors.quantite ? <p className="mt-1 text-xs text-[#E24B4A]">{lineFormErrors.quantite}</p> : null}
              </div>
              <div className="lg:col-span-1">
                <button
                  type="button"
                  disabled={createLine.isPending}
                  onClick={submitLineForm}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:brightness-110`}
                  style={primaryButtonStyle}
                >
                  {createLine.isPending ? "…" : "Ajouter"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div ref={listRef} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Vue :</span>
              {VIEW_MODES.map((v) => {
                const active = viewMode === v.key;
                const accent = v.color;
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setViewMode(v.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active && accent
                        ? ""
                        : active
                          ? "ring-1"
                          : "border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                    }`}
                    style={
                      active && accent
                        ? {
                            borderColor: `${accent}80`,
                            background: `${accent}18`,
                            color: accent,
                            boxShadow: `0 0 0 1px ${accent}40`,
                          }
                        : active
                          ? {
                              borderColor: `rgba(${STOKIFY_BLUE_RGB}, 0.5)`,
                              ...primaryOptionHighlightStyle,
                              ...primaryOptionSelectedStyle,
                              boxShadow: `0 0 0 1px rgba(${STOKIFY_BLUE_RGB}, 0.3)`,
                            }
                          : undefined
                    }
                  >
                    <v.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {v.label}
                  </button>
                );
              })}
              <motion.button
                type="button"
                onClick={() => setSimOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  borderColor: "rgba(14,165,233,0.4)",
                  background: "rgba(14,165,233,0.12)",
                  color: "#7dd3fc",
                }}
                whileHover={reduceMotion ? undefined : { y: -2 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              >
                <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                Simuler
              </motion.button>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {viewMode === "article"
                ? `${articleTotal} article(s)`
                : viewMode === "depot"
                  ? `${depotTotal} dépôt(s)`
                  : viewMode === "table"
                    ? `${tableTotal} ligne(s)`
                    : `${tableTotal} ligne(s) de stock`}
            </p>
          </div>

          <FilterChips chips={filterChips} onClearAll={resetFilters} />

          {viewMode === "article" && (
            <>
              {isLoading ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[96px] overflow-hidden rounded-2xl border"
                      style={{
                        borderColor: "var(--border-default)",
                        borderLeft: "3px solid rgba(55,138,221,0.35)",
                        background:
                          "linear-gradient(110deg, var(--bg-card) 30%, color-mix(in srgb, #378ADD 14%, var(--bg-card)) 50%, var(--bg-card) 70%)",
                        backgroundSize: "200% 100%",
                        animation: reduceMotion
                          ? undefined
                          : `artCardSkelShine 1.4s ease-in-out infinite`,
                        animationDelay: `${i * 70}ms`,
                      }}
                    />
                  ))}
                  <style>{`
                    @keyframes artCardSkelShine {
                      0% { background-position: 120% 0; }
                      100% { background-position: -40% 0; }
                    }
                  `}</style>
                </div>
              ) : articlesGroupes.length === 0 ? (
                <motion.div
                  className="rounded-2xl border border-dashed px-6 py-16 text-center"
                  style={{
                    background:
                      "linear-gradient(160deg, color-mix(in srgb, #378ADD 10%, var(--bg-card)), var(--bg-card))",
                    borderColor: "rgba(55,138,221,0.28)",
                  }}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Package className="mx-auto h-12 w-12 text-sky-400/45" />
                  <p className="mt-3 font-semibold text-[var(--text-primary)]">Aucun article en stock</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Modifiez vos filtres ou ajoutez une ligne de stock.
                  </p>
                </motion.div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {articlesPageSlice.map((g, i) => (
                      <ArticleStockCard key={g.articleId} groupe={g} index={i} {...lineActions} />
                    ))}
                  </div>
                  <StockPagination
                    page={safePage}
                    totalPages={totalPages}
                    totalResults={articleTotal}
                    pageSize={pageSize}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    unitLabel={paginationUnit}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                  />
                </>
              )}
            </>
          )}

          {viewMode === "depot" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {isLoading ? (
                  <>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-[220px] overflow-hidden rounded-2xl border"
                        style={{
                          borderColor: "var(--border-default)",
                          borderLeft: "3px solid rgba(55,138,221,0.35)",
                          background:
                            "linear-gradient(110deg, var(--bg-card) 30%, color-mix(in srgb, #378ADD 14%, var(--bg-card)) 50%, var(--bg-card) 70%)",
                          backgroundSize: "200% 100%",
                          animation: reduceMotion
                            ? undefined
                            : "depotCardSkelShine 1.4s ease-in-out infinite",
                          animationDelay: `${i * 70}ms`,
                        }}
                      />
                    ))}
                    <style>{`
                      @keyframes depotCardSkelShine {
                        0% { background-position: 120% 0; }
                        100% { background-position: -40% 0; }
                      }
                    `}</style>
                  </>
                ) : depotsAvecStock.length === 0 ? (
                  <motion.div
                    className="col-span-full rounded-2xl border border-dashed px-6 py-16 text-center"
                    style={{
                      background:
                        "linear-gradient(160deg, color-mix(in srgb, #378ADD 10%, var(--bg-card)), var(--bg-card))",
                      borderColor: "rgba(55,138,221,0.28)",
                    }}
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Warehouse className="mx-auto h-12 w-12 text-sky-400/45" />
                    <p className="mt-3 font-semibold text-[var(--text-primary)]">
                      Aucun dépôt avec stock
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Modifiez vos filtres ou ajoutez des lignes de stock.
                    </p>
                  </motion.div>
                ) : (
                  depotsPageSlice.map((depot, i) => (
                    <DepotStockCard
                      key={depot.id}
                      depot={depot}
                      index={i}
                      onViewDepot={(id) => {
                        setViewMode("table");
                        setDepotId(String(id));
                        setEmplacementFilterId("");
                        setPage(1);
                      }}
                    />
                  ))
                )}
              </div>
              {depotTotal > 0 ? (
                <StockPagination
                  page={safePage}
                  totalPages={totalPages}
                  totalResults={depotTotal}
                  pageSize={pageSize}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  unitLabel={paginationUnit}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              ) : null}
            </div>
          )}

          {viewMode === "table" && (
            <>
              <StockTableView
                rows={sortedItems}
                isLoading={isLoading}
                sortBy={sortBy}
                sortDir={sortDir}
                onToggleSort={toggleSort}
                pageSlice={pageSlice}
                hidePagination
                {...lineActions}
              />
              {!isLoading && tableTotal > 0 ? (
                <StockPagination
                  page={safePage}
                  totalPages={totalPages}
                  totalResults={tableTotal}
                  pageSize={pageSize}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  unitLabel={paginationUnit}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              ) : null}
            </>
          )}

          {viewMode === "carte" && (
            <DepotMapView
              onSelectDepot={(id) => {
                setViewMode("table");
                setDepotId(String(id));
                setEmplacementFilterId("");
                setPage(1);
                setSearchParams({ depotId: String(id) });
              }}
            />
          )}

          {viewMode === "calendrier" && <StockCalendarView />}

          {viewMode === "sante" && (
            <StockHealthView stocks={displayedItems} societeScope={societeScope} />
          )}

          {viewMode === "heatmap" && <StockHeatmapView societeScope={societeScope} />}

          {viewMode === "article" && sortedItems.length > 0 && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-center text-xs text-[var(--text-muted)]">
              Astuce : développez un article pour voir le détail par dépôt, ou passez en vue « Tableau » pour toutes les lignes.
            </div>
          )}
        </div>
      </div>

      <TransferChooserModal
        ligne={transferChooserLigne}
        open={Boolean(transferChooserLigne)}
        onClose={() => setTransferChooserLigne(null)}
        onChooseDepot={(row) => {
          setTransferChooserLigne(null);
          setTransferLigne(row);
        }}
        onChooseEmplacement={(row) => {
          setTransferChooserLigne(null);
          setEmplTransferPrefill({
            articleId: row.articleId ?? row.article?.id,
            depotOrigineId: row.depotId,
            emplacementOrigineId: row.emplacementId,
            depotDestId: row.depotId,
            quantite: row.quantite,
          });
        }}
      />

      <TransfertModal
        ligne={transferLigne}
        open={Boolean(transferLigne)}
        onClose={() => setTransferLigne(null)}
      />

      <TransferEmplacementModal
        open={emplTransferPrefill != null}
        prefill={emplTransferPrefill}
        onClose={() => setEmplTransferPrefill(null)}
      />

      <SimulationPanel open={simOpen} onClose={() => setSimOpen(false)} stocks={displayedItems} />

      {qrModalStock &&
        createPortal(
          <QRModal stockLine={qrModalStock} onClose={() => setQrModalStock(null)} />,
          document.body
        )}
    </PageShell>
  );
}
