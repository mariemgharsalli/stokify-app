import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Archive,
  BarChart3,
  Box,
  Layers,
  MapPin,
  Package,
  Pencil,
  Sparkles,
  Tag,
  Thermometer,
  Trash2,
  TrendingUp,
  Warehouse,
  X,
} from "lucide-react";
import api from "../../../services/api";
import { getArticleImageUrl } from "../ClientCatalog";
import {
  ARTICLE_STATUS_ICONS,
  ARTICLE_STATUS_STYLES,
  ARTICLE_TRANSITIONS,
  ArticleStatutBadge,
  articleStatutLabel,
  parseArticleStatut,
  TransitionTargetIcon,
} from "../articleStatusUi";
import { hasPermission } from "../../../security/permissions";
import { useAuthStore } from "../../../store/authStore";
import { useSocieteQueryScope } from "../../../hooks/useSocieteQueryScope";
import { AnimatedNumber } from "../../stock/CoutStockageCharts";
import { familleGradient } from "../../refs/components/refsUtils";

const MODAL_STYLES = `
  @keyframes admBackdropIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes admModalIn {
    from { opacity: 0; transform: scale(0.92) translateY(24px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes admOrbFloat {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(12px, -18px) scale(1.08); }
  }
  @keyframes admShimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes admPulseRing {
    0% { transform: scale(0.85); opacity: 0.6; }
    70% { transform: scale(1.15); opacity: 0; }
    100% { transform: scale(1.15); opacity: 0; }
  }
  @keyframes admSlideUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes admGaugeDraw {
    from { stroke-dashoffset: 283; }
  }
  .adm-fade-up { animation: admSlideUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .adm-tab-active {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    box-shadow: 0 4px 18px rgba(99, 102, 241, 0.35);
  }
`;

function formatErr(err) {
  const d = err.response?.data;
  if (d?.message) return String(d.message);
  return err.message || "Erreur";
}

function formatMoney(n) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND" }).format(Number(n || 0));
}

const MVT_ENTREE = new Set([
  "ENTREE_ACHAT",
  "ENTREE_INVENTAIRE",
  "ENTREE_AUTRE",
  "ENTREE",
]);

const MVT_SORTIE = new Set([
  "SORTIE_VENTE",
  "SORTIE_PERTE",
  "SORTIE_CASSE",
  "SORTIE_AUTRE",
  "SORTIE",
]);

function buildMovementTrend(items = []) {
  const buckets = new Map();
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const key = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    buckets.set(key, { label: key, entrees: 0, sorties: 0, net: 0 });
  }
  for (const m of items) {
    const dt = m.createdAt ? new Date(m.createdAt) : null;
    if (!dt || Number.isNaN(dt.getTime())) continue;
    const key = dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    if (!buckets.has(key)) {
      buckets.set(key, { label: key, entrees: 0, sorties: 0, net: 0 });
    }
    const row = buckets.get(key);
    const q = Number(m.quantite) || 0;
    const type = String(m.type || "").toUpperCase();
    if (MVT_ENTREE.has(type)) {
      row.entrees += q;
      row.net += q;
    } else if (MVT_SORTIE.has(type)) {
      row.sorties += q;
      row.net -= q;
    }
  }
  return Array.from(buckets.values());
}

function StockGauge({ stock, stockMin, stockMax }) {
  const qty = Number(stock) || 0;
  const min = Number(stockMin) || 0;
  const max = Number(stockMax) || Math.max(qty * 1.5, min + 10, 100);
  const pct = Math.min(100, Math.max(0, (qty / max) * 100));
  const circumference = 283;
  const offset = circumference - (pct / 100) * circumference;
  const color = qty <= min && min > 0 ? "#ef4444" : qty <= min * 1.5 && min > 0 ? "#f59e0b" : "#10b981";

  return (
    <div className="relative flex flex-col items-center">
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="absolute h-36 w-36 rounded-full border-2 opacity-30"
          style={{ borderColor: color, animation: "admPulseRing 2.4s ease-out infinite" }}
        />
      </div>
      <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
            filter: `drop-shadow(0 0 8px ${color}66)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
          <AnimatedNumber value={qty} duration={900} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          en stock
        </span>
      </div>
      <div className="mt-2 flex w-full justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <span>Min {min || "—"}</span>
        <span>Max {stockMax != null ? stockMax : max}</span>
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, accent, delay = 0 }) {
  return (
    <div
      className="adm-fade-up relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-20 blur-2xl"
        style={{ background: accent }}
      />
      <div className="relative flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${accent}22`, color: accent }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-0.5 truncate text-lg font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, accent = "#6366f1", delay = 0 }) {
  return (
    <div
      className="adm-fade-up overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="border-b border-slate-200/60 px-4 py-3 dark:border-white/8"
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        <h4 className="text-sm font-semibold text-slate-800 dark:text-white">{title}</h4>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, delay = 0 }) {
  return (
    <div
      className="adm-fade-up flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-white/6 dark:bg-white/[0.03]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-800 dark:text-slate-100">{value ?? "—"}</span>
    </div>
  );
}

const TABS = [
  { id: "overview", label: "Aperçu", icon: Sparkles },
  { id: "analytics", label: "Analytique", icon: BarChart3 },
  { id: "details", label: "Fiche", icon: Layers },
];

export default function ArticleDetailModal({
  articleId,
  open,
  onClose,
  onEdit,
  initialListItem = null,
}) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const canWrite = hasPermission(user?.role, "stock:write");
  const canDeletePermanent = hasPermission(user?.role, "stock:delete");
  const canReadMvt = hasPermission(user?.role, "mouvements:read");
  const numericId = Number(articleId);
  const valid = open && Number.isInteger(numericId) && numericId > 0;

  const [tab, setTab] = useState("overview");
  const [banner, setBanner] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!open) {
      setMounted(false);
      setTab("overview");
      setBanner("");
      return undefined;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = requestAnimationFrame(() => setMounted(true));
    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(t);
    };
  }, [open, articleId]);

  const { data: article, isLoading, error } = useQuery({
    queryKey: ["articles", "detail", societeScope, numericId],
    queryFn: () => api.get(`articles/${numericId}`).then((r) => r.data),
    enabled: valid,
  });

  const { data: mvtData } = useQuery({
    queryKey: ["mouvements", "article-detail", societeScope, numericId],
    queryFn: () =>
      api.get("mouvements", { params: { articleId: numericId, limit: 80, page: 1 } }).then((r) => r.data),
    enabled: valid && canReadMvt,
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`articles/${numericId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"], exact: false });
      onClose();
    },
    onError: (e) => setBanner(formatErr(e)),
  });

  const setStatutMutation = useMutation({
    mutationFn: ({ statut }) => api.patch(`articles/${numericId}/statut`, { statut }),
    onSuccess: () => {
      setBanner("");
      qc.invalidateQueries({ queryKey: ["articles", "detail", societeScope, numericId] });
      qc.invalidateQueries({ queryKey: ["articles"], exact: false });
    },
    onError: (e) => setBanner(formatErr(e)),
  });

  const merged = article || initialListItem;
  const statutKey = merged ? parseArticleStatut(merged) : "ACTIF";

  const stockQty = useMemo(() => {
    if (!merged) return 0;
    if (merged.totalStock != null) return Number(merged.totalStock) || 0;
    if (merged.stocks?.length) return merged.stocks.reduce((s, x) => s + Number(x?.quantite ?? 0), 0);
    return Number(merged.stock ?? merged.stockActuel ?? 0) || 0;
  }, [merged]);

  const margePct = useMemo(() => {
    if (!merged) return null;
    const pa = Number(merged.prixAchat ?? 0);
    const pv = Number(merged.prixVente ?? merged.prixCatalogue ?? 0);
    if (pa <= 0) return null;
    return (((pv - pa) / pa) * 100).toFixed(1);
  }, [merged]);

  const prixData = useMemo(() => {
    if (!merged) return [];
    const achat = Number(merged.prixAchat ?? 0);
    const vente = Number(merged.prixVente ?? merged.prixCatalogue ?? 0);
    const marge = Math.max(0, vente - achat);
    return [
      { name: "Achat", value: achat, fill: "#ef4444" },
      { name: "Marge", value: marge, fill: "#8b5cf6" },
      { name: "Vente", value: vente, fill: "#10b981" },
    ];
  }, [merged]);

  const stockPieData = useMemo(() => {
    if (!merged?.stocks?.length) {
      return [{ name: "Stock total", value: stockQty, fill: "#6366f1" }];
    }
    return merged.stocks.map((s, i) => ({
      name: s.depot?.libelle || s.depot?.code || `Dépôt ${i + 1}`,
      value: Number(s.quantite) || 0,
      fill: ["#6366f1", "#06b6d4", "#f59e0b", "#ec4899"][i % 4],
    }));
  }, [merged, stockQty]);

  const movementTrend = useMemo(() => buildMovementTrend(mvtData?.items || []), [mvtData]);

  const emplacementLabel = useMemo(() => {
    if (!merged) return "—";
    const s0 = merged.stocks?.[0];
    return (
      s0?.emplacement?.libelle ??
      s0?.emplacement?.nom ??
      merged.emplacement?.libelle ??
      merged.emplacementNom ??
      "—"
    );
  }, [merged]);

  const depotLabel = useMemo(() => {
    if (!merged) return "—";
    const s0 = merged.stocks?.[0];
    return s0?.depot?.libelle ?? s0?.depot?.code ?? merged.depot?.libelle ?? "—";
  }, [merged]);

  const valeurStock = useMemo(() => {
    const pv = Number(merged?.prixVente ?? merged?.prixCatalogue ?? 0);
    return stockQty * pv;
  }, [merged, stockQty]);

  if (!valid) return null;

  const familleNom = merged?.famille?.nom ?? merged?.familleNom ?? "—";
  const familleCode = merged?.famille?.code ?? merged?.familleCode ?? familleNom;
  const marqueNom = merged?.marque?.nom ?? merged?.marqueNom ?? "—";

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
      style={{ animation: mounted ? "admBackdropIn 0.35s ease both" : undefined }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-detail-title"
    >
      <style>{MODAL_STYLES}</style>

      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
        onClick={onClose}
        aria-label="Fermer"
      />

      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl"
          style={{ animation: "admOrbFloat 8s ease-in-out infinite" }}
        />
        <div
          className="absolute -right-16 bottom-1/4 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl"
          style={{ animation: "admOrbFloat 10s ease-in-out infinite reverse" }}
        />
      </div>

      {/* Modal shell */}
      <div
        className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-2xl shadow-violet-900/20 dark:from-[#0c0e14] dark:via-[#111318] dark:to-[#0a0c12]"
        style={{ animation: mounted ? "admModalIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both" : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top shimmer bar */}
        <div
          className="h-1 shrink-0"
          style={{
            background: "linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4, #6366f1)",
            backgroundSize: "200% auto",
            animation: "admShimmer 4s linear infinite",
          }}
        />

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200/70 px-5 py-4 dark:border-white/8 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                <Package className="h-3 w-3" />
                Fiche produit
              </span>
              {merged && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${ARTICLE_STATUS_STYLES[statutKey] ?? ARTICLE_STATUS_STYLES.ACTIF}`}
                >
                  {ARTICLE_STATUS_ICONS[statutKey]}
                  {articleStatutLabel(statutKey)}
                </span>
              )}
            </div>
            <h2 id="article-detail-title" className="mt-2 truncate font-display text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
              {isLoading ? "Chargement…" : merged?.libelle || merged?.designation || "Article"}
            </h2>
            <p className="mt-0.5 font-mono text-sm text-violet-600 dark:text-violet-300">
              {merged?.code || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {banner && (
          <p className="mx-5 mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300 sm:mx-6">
            {banner}
          </p>
        )}

        {error && !isLoading && (
          <p className="mx-6 mt-4 text-sm text-red-500">{formatErr(error)}</p>
        )}

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && !merged ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-violet-500 border-t-transparent" />
            </div>
          ) : merged ? (
            <div className="grid gap-0 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
              {/* Hero column */}
              <div className="relative overflow-hidden border-b border-slate-200/60 dark:border-white/8 lg:border-b-0 lg:border-r">
                <div className="relative aspect-[4/5] min-h-[280px] w-full lg:min-h-[420px]">
                  <img
                    src={getArticleImageUrl(merged)}
                    alt={merged.libelle || merged.designation || ""}
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-600/25 via-transparent to-cyan-500/10" />

                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    {familleNom !== "—" && (
                      <span
                        className="mb-2 inline-block rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-lg"
                        style={{ background: familleGradient(familleCode) }}
                      >
                        {familleNom}
                      </span>
                    )}
                    {merged.description ? (
                      <p className="line-clamp-3 text-sm leading-relaxed text-slate-200/90">{merged.description}</p>
                    ) : null}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur-md">
                        <p className="text-[10px] uppercase text-slate-300">Prix vente</p>
                        <p className="text-sm font-bold text-white">{formatMoney(merged.prixVente ?? merged.prixCatalogue)}</p>
                      </div>
                      <div className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur-md">
                        <p className="text-[10px] uppercase text-slate-300">Stock</p>
                        <p className="text-sm font-bold text-white">{stockQty}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content column */}
              <div className="flex min-h-0 flex-col p-4 sm:p-5">
                {/* Tabs */}
                <div className="mb-4 flex gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-white/[0.04]">
                  {TABS.map((t) => {
                    const Icon = t.icon;
                    const active = tab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 sm:text-sm ${
                          active
                            ? "adm-tab-active text-white"
                            : "text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/8"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {tab === "overview" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <KpiTile icon={Package} label="Stock" value={stockQty} accent="#6366f1" delay={50} />
                      <KpiTile icon={TrendingUp} label="Marge" value={margePct != null ? `${margePct} %` : "—"} accent="#10b981" delay={100} />
                      <KpiTile icon={Tag} label="Marque" value={marqueNom} accent="#f59e0b" delay={150} />
                      <KpiTile icon={Warehouse} label="Valeur stock" value={formatMoney(valeurStock)} accent="#06b6d4" delay={200} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <ChartCard title="Niveau de stock" subtitle="Par rapport aux seuils min / max" accent="#6366f1" delay={250}>
                        <StockGauge stock={stockQty} stockMin={merged.stockMin} stockMax={merged.stockMax} />
                      </ChartCard>

                      <ChartCard title="Structure tarifaire" subtitle="Achat · marge · vente" accent="#10b981" delay={300}>
                        <div className="h-[160px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={prixData} barSize={36}>
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Tooltip
                                formatter={(v) => formatMoney(v)}
                                contentStyle={{
                                  borderRadius: 12,
                                  border: "1px solid rgba(148,163,184,0.2)",
                                  background: "rgba(15,23,42,0.92)",
                                  color: "#f1f5f9",
                                }}
                              />
                              <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={900}>
                                {prixData.map((entry) => (
                                  <Cell key={entry.name} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </ChartCard>
                    </div>
                  </div>
                )}

                {tab === "analytics" && (
                  <div className="space-y-4">
                    <ChartCard
                      title="Flux de stock"
                      subtitle={canReadMvt ? "Entrées vs sorties (6 dernières semaines)" : "Permission mouvements requise"}
                      accent="#06b6d4"
                      delay={80}
                    >
                      {canReadMvt ? (
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={movementTrend}>
                              <defs>
                                <linearGradient id="admEntreeGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="admSortieGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                              <Tooltip
                                contentStyle={{
                                  borderRadius: 12,
                                  border: "1px solid rgba(148,163,184,0.2)",
                                  background: "rgba(15,23,42,0.92)",
                                  color: "#f1f5f9",
                                }}
                              />
                              <Area type="monotone" dataKey="entrees" stroke="#10b981" fill="url(#admEntreeGrad)" strokeWidth={2} isAnimationActive animationDuration={1000} name="Entrées" />
                              <Area type="monotone" dataKey="sorties" stroke="#ef4444" fill="url(#admSortieGrad)" strokeWidth={2} isAnimationActive animationDuration={1000} name="Sorties" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="py-8 text-center text-sm text-slate-500">Accès aux mouvements non autorisé.</p>
                      )}
                    </ChartCard>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <ChartCard title="Répartition par dépôt" subtitle="Quantités en stock" accent="#8b5cf6" delay={160}>
                        <div className="h-[180px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stockPieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={70}
                                paddingAngle={3}
                                isAnimationActive
                                animationDuration={900}
                              >
                                {stockPieData.map((entry) => (
                                  <Cell key={entry.name} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(v) => [`${v} u.`, "Stock"]}
                                contentStyle={{
                                  borderRadius: 12,
                                  border: "1px solid rgba(148,163,184,0.2)",
                                  background: "rgba(15,23,42,0.92)",
                                  color: "#f1f5f9",
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {stockPieData.map((d) => (
                            <span key={d.name} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                              {d.name}: {d.value}
                            </span>
                          ))}
                        </div>
                      </ChartCard>

                      <ChartCard title="Indicateurs clés" subtitle="Synthèse financière" accent="#f59e0b" delay={220}>
                        <div className="space-y-3">
                          <DetailRow label="Prix d'achat" value={formatMoney(merged.prixAchat)} delay={0} />
                          <DetailRow label="Prix de vente" value={formatMoney(merged.prixVente ?? merged.prixCatalogue)} delay={40} />
                          <DetailRow label="Marge brute" value={margePct != null ? `${margePct} %` : "—"} delay={80} />
                          <DetailRow label="Valeur stock (PV)" value={formatMoney(valeurStock)} delay={120} />
                        </div>
                      </ChartCard>
                    </div>
                  </div>
                )}

                {tab === "details" && (
                  <div className="space-y-4">
                    <ChartCard title="Informations générales" accent="#6366f1" delay={50}>
                      <div className="space-y-2">
                        <DetailRow label="Code" value={merged.code} delay={60} />
                        <DetailRow label="Libellé" value={merged.libelle || merged.designation} delay={90} />
                        <DetailRow label="Unité" value={merged.unite || "UN"} delay={120} />
                        <DetailRow label="Statut" value={articleStatutLabel(statutKey)} delay={150} />
                        <DetailRow label="Actif" value={merged.actif ? "Oui" : "Non"} delay={180} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Classification" accent="#8b5cf6" delay={100}>
                      <div className="space-y-2">
                        <DetailRow label="Marque" value={marqueNom} delay={110} />
                        <DetailRow label="Famille" value={familleNom} delay={140} />
                        <DetailRow label="Sous-famille" value={merged.sousFamille?.nom ?? merged.sousFamilleNom ?? "—"} delay={170} />
                        <DetailRow
                          label="Fournisseur"
                          value={
                            merged.fournisseur
                              ? [merged.fournisseur.code, merged.fournisseur.nom].filter(Boolean).join(" — ")
                              : merged.fournisseurs || "—"
                          }
                          delay={200}
                        />
                      </div>
                    </ChartCard>

                    <ChartCard title="Stock & logistique" accent="#06b6d4" delay={150}>
                      <div className="space-y-2">
                        <DetailRow label="Quantité" value={String(stockQty)} delay={160} />
                        <DetailRow label="Dépôt" value={depotLabel} delay={190} />
                        <DetailRow label="Emplacement" value={emplacementLabel} delay={220} />
                        <DetailRow label="Stock min." value={merged.stockMin != null ? String(merged.stockMin) : "—"} delay={250} />
                        <DetailRow label="Stock max." value={merged.stockMax != null ? String(merged.stockMax) : "—"} delay={280} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Règles de stockage" accent="#10b981" delay={200}>
                      <div className="space-y-2">
                        <DetailRow
                          label="Température"
                          value={
                            merged.temperatureMin != null || merged.temperatureMax != null
                              ? `${merged.temperatureMin ?? "—"} °C → ${merged.temperatureMax ?? "—"} °C`
                              : "—"
                          }
                          delay={210}
                        />
                        <DetailRow label="Fragile" value={merged.fragile ? "Oui" : "Non"} delay={240} />
                        <DetailRow label="Chimique dangereux" value={merged.dangereuxChimique ? "Oui" : "Non"} delay={270} />
                      </div>
                      {(merged.poids != null || merged.volume != null) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {merged.poids != null && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-white/8">
                              <Box className="h-3 w-3" /> {Number(merged.poids).toLocaleString("fr-FR")} kg
                            </span>
                          )}
                          {merged.volume != null && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-white/8">
                              <MapPin className="h-3 w-3" /> {Number(merged.volume).toLocaleString("fr-FR")} m³
                            </span>
                          )}
                          {(merged.temperatureMin != null || merged.temperatureMax != null) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-white/8">
                              <Thermometer className="h-3 w-3" /> Contrôle temp.
                            </span>
                          )}
                        </div>
                      )}
                    </ChartCard>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        {merged && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 bg-white/60 px-5 py-3 backdrop-blur-sm dark:border-white/8 dark:bg-black/20 sm:px-6">
            <div className="flex items-center gap-2">
              <ArticleStatutBadge row={merged} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canWrite && statutKey === "ACTIF" && onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(merged)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:scale-[1.02]"
                >
                  <Pencil className="h-4 w-4" />
                  Modifier
                </button>
              )}
              {canWrite &&
                (ARTICLE_TRANSITIONS[statutKey] ?? []).map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    disabled={setStatutMutation.isPending}
                    title={t.label}
                    onClick={() => setStatutMutation.mutate({ statut: t.value })}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 ${t.color}`}
                  >
                    <TransitionTargetIcon value={t.value} className="h-4 w-4" />
                  </button>
                ))}
              {canDeletePermanent && statutKey === "ARCHIVE" && (
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm("Supprimer définitivement cet article archivé ?")) {
                      deleteMutation.mutate();
                    }
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/30 text-red-500 transition hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200/80 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/8"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
