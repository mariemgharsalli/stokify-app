import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ClipboardList, Moon, RotateCw } from "lucide-react";
import api from "../../services/api";
import PageShell from "../../components/ui/PageShell";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import { exportRapportExcel, exportRapportPdf } from "../../utils/exportHelpers";
import ReportPeriodSelector from "./components/ReportPeriodSelector";
import ReportSummaryCards from "./components/ReportSummaryCards";
import SalesAreaChart from "./components/SalesAreaChart";
import TopArticlesBarChart from "./components/TopArticlesBarChart";
import SalesVsAchatsChart from "./components/SalesVsAchatsChart";
import StockDonutChart from "./components/StockDonutChart";
import StockByDepotTable from "./components/StockByDepotTable";
import TopArticlesTable from "./components/TopArticlesTable";
import TopClientsSection from "./components/TopClientsSection";
import { dateRangeForPreset, mergeSalesPurchases } from "./rapportUtils";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const QUICK_LINKS = [
  {
    to: "/rapports/rotation",
    title: "Rotation des stocks",
    desc: "Taux de rotation par article et recommandations",
    accent: "var(--accent-success)",
    Icon: RotateCw,
  },
  {
    to: "/rapports/ecarts-inventaire",
    title: "Écarts inventaire",
    desc: "Stock réel vs théorique — inventaires validés",
    accent: "var(--accent-primary)",
    Icon: ClipboardList,
  },
  {
    to: "/cout-stockage",
    title: "Stock dormant",
    desc: "Articles à faible mouvement — export PDF/Excel",
    accent: "var(--accent-warning)",
    Icon: Moon,
  },
];

export default function Rapports() {
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const reduceMotion = useReducedMotion();
  const canRead = hasPermission(user?.role, "rapports:read");
  const canAccounting = hasPermission(user?.role, "accounting:read");
  const societeGate = user?.role === "SUPER_ADMIN" ? societeScope != null : Boolean(user?.societeId);

  const [preset, setPreset] = useState("30d");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [depotId, setDepotId] = useState("");
  const [userId, setUserId] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (preset !== "custom") {
      const { dateDebut: d1, dateFin: d2 } = dateRangeForPreset(preset);
      setDateDebut(d1);
      setDateFin(d2);
    }
  }, [preset]);

  const { data: depotsData } = useQuery({
    queryKey: ["depots", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 100 } }).then((r) => r.data),
    enabled: canRead,
  });
  const depots = depotsData?.items ?? depotsData ?? [];

  const { data: usersData } = useQuery({
    queryKey: ["users-rapports", societeScope],
    queryFn: () => api.get("users", { params: { limit: 100 } }).then((r) => r.data),
    enabled: canRead && hasPermission(user?.role, "users:read"),
  });
  const users = usersData?.items ?? usersData ?? [];

  const exportParams = useMemo(
    () => ({
      dateDebut,
      dateFin,
      ...(depotId ? { depotId } : {}),
      ...(userId ? { userId } : {}),
    }),
    [dateDebut, dateFin, depotId, userId]
  );

  async function handleExportPdf() {
    if (!dateDebut || !dateFin) return toast.error("Sélectionnez une période");
    setExportLoading(true);
    try {
      await exportRapportPdf(api, exportParams);
      toast.success("PDF téléchargé");
    } catch {
      toast.error("Erreur export PDF");
    } finally {
      setExportLoading(false);
    }
  }

  async function handleExportExcel() {
    if (!dateDebut || !dateFin) return toast.error("Sélectionnez une période");
    setExportLoading(true);
    try {
      await exportRapportExcel(api, exportParams);
      toast.success("Excel téléchargé");
    } catch {
      toast.error("Erreur export Excel");
    } finally {
      setExportLoading(false);
    }
  }

  const { data: ventesData, isLoading: loadingVentes } = useQuery({
    queryKey: ["ventes", "rapports", societeScope, dateDebut, dateFin],
    queryFn: () =>
      api.get("ventes", { params: { limit: 500, dateDebut, dateFin } }).then((r) => r.data),
    enabled: canRead && !!dateDebut && !!dateFin,
  });

  const { data: achatsData, isLoading: loadingAchats } = useQuery({
    queryKey: ["achats", "rapports", societeScope, dateDebut, dateFin],
    queryFn: () =>
      api.get("achats", { params: { limit: 500, dateDebut, dateFin } }).then((r) => r.data),
    enabled: canRead && !!dateDebut && !!dateFin,
  });

  const { data: accountingSummary, isLoading: loadingAccounting } = useQuery({
    queryKey: ["accounting", "summary", societeScope, dateDebut, dateFin],
    queryFn: () =>
      api.get("accounting/summary", { params: { dateDebut, dateFin } }).then((r) => r.data),
    enabled: canAccounting && societeGate && !!dateDebut && !!dateFin,
  });

  const { data: synthese, isLoading: loadingSynthese } = useQuery({
    queryKey: ["accounting", "synthese", societeScope, dateDebut, dateFin, depotId],
    queryFn: () =>
      api
        .get("accounting/synthese", {
          params: { dateDebut, dateFin, depotId: depotId || undefined },
        })
        .then((r) => r.data),
    enabled: canAccounting && societeGate && !!dateDebut && !!dateFin,
  });

  const { data: evolutionMensuelle, isLoading: loadingEvolution } = useQuery({
    queryKey: ["accounting", "evolution", societeScope, depotId],
    queryFn: () =>
      api
        .get("accounting/evolution-mensuelle", {
          params: { mois: 12, depotId: depotId || undefined },
        })
        .then((r) => r.data),
    enabled: canAccounting && societeGate,
  });

  const { data: topArticlesApi, isLoading: loadingTopArticles } = useQuery({
    queryKey: ["accounting", "top-articles", societeScope, dateDebut, dateFin, depotId],
    queryFn: () =>
      api
        .get("accounting/top-articles", {
          params: { dateDebut, dateFin, limit: 10, depotId: depotId || undefined },
        })
        .then((r) => r.data),
    enabled: canAccounting && societeGate && !!dateDebut && !!dateFin,
  });

  const { data: topClientsApi, isLoading: loadingTopClients } = useQuery({
    queryKey: ["accounting", "top-clients", societeScope, dateDebut, dateFin],
    queryFn: () =>
      api.get("accounting/top-clients", { params: { dateDebut, dateFin, limit: 10 } }).then((r) => r.data),
    enabled: canAccounting && societeGate && !!dateDebut && !!dateFin,
  });

  const { data: stockParDepotApi, isLoading: loadingStockDepot } = useQuery({
    queryKey: ["accounting", "stock-depot", societeScope],
    queryFn: () => api.get("accounting/stock-par-depot").then((r) => r.data),
    enabled: canAccounting && societeGate,
  });

  /** Liste stock complète (avec article.imageUrl) — nécessaire pour TopArticlesTable. */
  const { data: stockData, isLoading: loadingStock } = useQuery({
    queryKey: ["stock", "rapports", societeScope, depotId],
    queryFn: async () => {
      const r = await api.get("stock", {
        params: { limit: 1000, depotId: depotId || undefined },
      });
      return { mode: "stock", data: r.data };
    },
    enabled: canRead,
  });

  const ventes = (ventesData?.items ?? ventesData ?? []).filter(Boolean);
  const achats = (achatsData?.items ?? achatsData ?? []).filter(Boolean);

  const summaryForCards = useMemo(() => {
    if (synthese) {
      return {
        ventes: { totalHT: synthese.ventesHT, totalTTC: synthese.ventesTTC },
        achats: { totalHT: synthese.achatsHT, totalTTC: synthese.achatsTTC },
        indicateurs: { margeBruteApproxHT: synthese.margeGlobale },
        evolutionVs: synthese.evolutionVs,
      };
    }
    return accountingSummary;
  }, [synthese, accountingSummary]);

  const ventesSixMois = useMemo(() => {
    if (Array.isArray(evolutionMensuelle) && evolutionMensuelle.length) {
      return evolutionMensuelle.map((row) => ({
        key: row.mois,
        label: row.mois,
        total: row.ventesTTC ?? row.totalTTC ?? 0,
      }));
    }
    const now = new Date();
    const keys = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
        total: 0,
      });
    }
    const map = new Map(keys.map((k) => [k.key, { ...k }]));
    ventes.forEach((v) => {
      const d = new Date(v.dateVente || v.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (map.has(key)) map.get(key).total += Number(v.totalTTC || 0);
    });
    return Array.from(map.values());
  }, [ventes, evolutionMensuelle]);

  const salesVsAchats = useMemo(() => {
    if (Array.isArray(evolutionMensuelle) && evolutionMensuelle.length) {
      return evolutionMensuelle.map((row) => ({
        label: row.mois,
        ventes: row.ventesHT ?? row.ventesTTC ?? 0,
        achats: row.achatsHT ?? 0,
      }));
    }
    return mergeSalesPurchases(ventes, achats);
  }, [ventes, achats, evolutionMensuelle]);

  const topArticles = useMemo(() => {
    if (Array.isArray(topArticlesApi) && topArticlesApi.length) {
      return topArticlesApi.slice(0, 5).map((a) => ({
        article: a.libelle,
        qte: a.qteVendue,
        valeur: a.chiffreAffairesHT,
      }));
    }
    const agg = new Map();
    ventes.forEach((v) => {
      (v.lignes || []).forEach((l) => {
        const key = `${l.articleId}`;
        const prev = agg.get(key) || {
          article: l.article?.libelle || l.article?.code || `#${l.articleId}`,
          qte: 0,
          valeur: 0,
        };
        prev.qte += Number(l.quantite || 0);
        prev.valeur += Number(l.montantTTC || l.prixUnitaire * l.quantite || 0);
        agg.set(key, prev);
      });
    });
    return Array.from(agg.values()).sort((a, b) => b.qte - a.qte).slice(0, 5);
  }, [ventes, topArticlesApi]);

  const stockParDepot = useMemo(() => {
    if (Array.isArray(stockParDepotApi) && stockParDepotApi.length) {
      return stockParDepotApi.map((d) => ({
        depot: d.libelle,
        valeur: d.valeurCMP,
        quantite: d.quantite,
        pct: d.pctDuTotal,
      }));
    }
    const mode = stockData?.mode;
    const data = stockData?.data;
    if (!data) return [];
    if (mode === "valeur") {
      const lines = Array.isArray(data?.lignes) ? data.lignes : [];
      const map = new Map();
      lines.forEach((ln) => {
        const k = ln.depotId ?? ln.depotCode ?? "NA";
        const prev = map.get(k) || {
          depot: ln.depotLibelle || ln.depotCode || "—",
          valeur: 0,
          quantite: 0,
        };
        prev.valeur += Number(ln.valeur || 0);
        prev.quantite += Number(ln.quantite || 0);
        map.set(k, prev);
      });
      return Array.from(map.values());
    }
    const rows = Array.isArray(data?.items) ? data.items : [];
    const map = new Map();
    rows.forEach((s) => {
      const k = s.depot?.id ?? s.depotId ?? "NA";
      const prev = map.get(k) || {
        depot: s.depot?.libelle || s.depot?.code || "—",
        valeur: 0,
        quantite: 0,
      };
      prev.valeur += Number(s.valeurStock || s.quantite * (s.article?.prixAchat || 0) || 0);
      prev.quantite += Number(s.quantite || 0);
      map.set(k, prev);
    });
    return Array.from(map.values());
  }, [stockData, stockParDepotApi]);

  const stockRows = useMemo(() => {
    const data = stockData?.data;
    if (!data) return [];
    if (stockData.mode === "stock") return Array.isArray(data?.items) ? data.items : [];
    return [];
  }, [stockData]);

  if (!canRead) {
    return (
      <PageShell>
        <p className="text-sm text-[var(--text-muted)]">Accès refusé.</p>
      </PageShell>
    );
  }

  const chartsLoading = loadingVentes || loadingAchats || loadingEvolution;
  const accountingLoading = loadingAccounting || loadingSynthese;

  return (
    <PageShell>
      <div className="space-y-5">
        <ReportPeriodSelector
          preset={preset}
          onPresetChange={setPreset}
          dateDebut={dateDebut}
          dateFin={dateFin}
          onDateDebut={setDateDebut}
          onDateFin={setDateFin}
          onApply={() => setPreset("custom")}
          depotId={depotId}
          depots={depots}
          onDepotChange={setDepotId}
          userId={userId}
          users={users}
          onUserChange={setUserId}
          onExportPdf={handleExportPdf}
          onExportExcel={handleExportExcel}
          exportLoading={exportLoading}
        />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((card, i) => (
            <motion.div
              key={card.to}
              custom={i}
              variants={fadeUp}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              whileHover={reduceMotion ? undefined : { y: -3 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <Link
                to={card.to}
                className="group relative flex h-full overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 transition-colors hover:bg-[var(--bg-hover)]"
                style={{ borderLeft: `3px solid ${card.accent}` }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${card.accent} 8%, transparent) 0%, transparent 55%)`,
                  }}
                  aria-hidden
                />
                <div className="relative flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in srgb, ${card.accent} 14%, transparent)`,
                      color: card.accent,
                    }}
                  >
                    <card.Icon size={20} strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{card.title}</p>
                    <p className="mt-1 text-xs leading-snug text-[var(--text-muted)]">{card.desc}</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </section>

        {canAccounting && societeGate ? (
          <motion.section
            custom={3}
            variants={fadeUp}
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
            className="space-y-3"
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Synthèse comptable
            </h2>
            <ReportSummaryCards summary={summaryForCards} loading={accountingLoading} />
          </motion.section>
        ) : null}

        <motion.div
          custom={4}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="grid grid-cols-1 gap-5 xl:grid-cols-2"
        >
          <SalesAreaChart data={ventesSixMois} loading={chartsLoading} />
          <TopArticlesBarChart items={topArticles} loading={chartsLoading || loadingTopArticles} />
        </motion.div>

        <motion.div
          custom={5}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
        >
          <SalesVsAchatsChart data={salesVsAchats} loading={chartsLoading} />
        </motion.div>

        <motion.div
          custom={6}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="grid grid-cols-1 gap-5 xl:grid-cols-2"
        >
          <StockDonutChart items={stockParDepot} loading={loadingStock || loadingStockDepot} />
          <StockByDepotTable items={stockParDepot} loading={loadingStock || loadingStockDepot} />
        </motion.div>

        <motion.div
          custom={7}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
        >
          <TopClientsSection clients={topClientsApi} loading={loadingTopClients} />
        </motion.div>

        <motion.div
          custom={8}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
        >
          <TopArticlesTable stockRows={stockRows} loading={loadingStock} />
        </motion.div>
      </div>
    </PageShell>
  );
}
