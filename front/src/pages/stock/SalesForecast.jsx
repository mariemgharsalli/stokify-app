import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  IconSparkles,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconAlertTriangle,
  IconRefresh,
  IconSearch,
  IconCheck,
  IconChevronDown,
  IconX,
} from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ArticleAvatar from "../../components/ui/ArticleAvatar";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AiModuleShell from "../../components/ai/AiModuleShell";
import AiInsightCard from "../../components/ai/AiInsightCard";
import { ForecastStudio, PortfolioStudio, MODEL_COLOR } from "./components/ForecastMlStudio";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import { useCountUp } from "../../hooks/useCountUp";

const STAGGER_CONTAINER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const STAGGER_ITEM = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const MOIS_COURTS = {
  "01": "Jan",
  "02": "Fév",
  "03": "Mar",
  "04": "Avr",
  "05": "Mai",
  "06": "Juin",
  "07": "Juil",
  "08": "Août",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Déc",
};

async function fetchAllActiveArticles() {
  const pageSize = 100;
  const all = [];
  let page = 1;
  let pages = 1;
  do {
    const { data } = await api.get("articles", {
      params: { limit: pageSize, page, statut: "ACTIF" },
    });
    const items = Array.isArray(data) ? data : data?.items || data?.data || [];
    all.push(...items);
    pages = Number(data?.pages) || 1;
    page += 1;
  } while (page <= pages && page <= 40);
  return all;
}

function articleName(article) {
  return String(article?.libelle || article?.nom || article?.articleLibelle || "").trim() || "Article";
}

function ForecastArticleCatalog({
  articles = [],
  loading,
  query = "",
  onQuery,
  compareMode,
  selectedId,
  selectedIds,
  onPick,
}) {
  const selectedList = useMemo(() => {
    const ids = compareMode ? selectedIds || [] : selectedId ? [selectedId] : [];
    return ids
      .map((id) => (Array.isArray(articles) ? articles : []).find((a) => String(a.id) === String(id)))
      .filter(Boolean);
  }, [articles, compareMode, selectedId, selectedIds]);

  const hasSelection = selectedList.length > 0;
  const [browse, setBrowse] = useState(!hasSelection);

  useEffect(() => {
    if (!hasSelection) setBrowse(true);
  }, [hasSelection]);

  const filtered = useMemo(() => {
    const list = Array.isArray(articles) ? articles : [];
    const q = String(query || "").trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) => articleName(a).toLowerCase().includes(q) || String(a.code || "").toLowerCase().includes(q)
    );
  }, [articles, query]);

  function handlePick(id) {
    onPick(id);
    if (!compareMode) setBrowse(false);
  }

  return (
    <div className="space-y-3">
      {hasSelection ? (
        <div className="flex flex-wrap items-center gap-2">
          {selectedList.map((a) => (
            <div
              key={a.id}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 sm:flex-none sm:min-w-[240px]"
            >
              <ArticleAvatar article={a} size={40} className="!rounded-xl" />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[15px] font-bold tracking-tight text-[var(--text-primary)]"
                  style={{ fontFamily: "Syne, sans-serif" }}
                >
                  {articleName(a)}
                </p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">
                  {a.famille?.nom || a.famille?.libelle || "Catalogue actif"}
                </p>
              </div>
              {compareMode ? (
                <button
                  type="button"
                  onClick={() => onPick(String(a.id))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-danger)]"
                  aria-label={`Retirer ${articleName(a)}`}
                >
                  <IconX size={16} />
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setBrowse((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-2 text-[12px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            {browse ? "Fermer" : compareMode ? "Ajouter" : "Changer"}
            <IconChevronDown
              size={14}
              style={{ transform: browse ? "rotate(180deg)" : "none", transition: "transform .2s" }}
            />
          </button>
        </div>
      ) : (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Article à prévoir
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">Choisissez un produit</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {browse ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
              <label className="mb-2 flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2">
                <IconSearch size={16} className="shrink-0 text-[var(--text-muted)]" />
                <input
                  value={query}
                  onChange={(e) => onQuery(e.target.value)}
                  placeholder="Rechercher un article…"
                  className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
              </label>
              <div className="max-h-[280px] overflow-y-auto pr-0.5" role="listbox" aria-label="Articles">
                {loading ? (
                  <p className="px-2 py-8 text-center text-sm text-[var(--text-muted)]">Chargement du catalogue…</p>
                ) : filtered.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-[var(--text-muted)]">Aucun article ne correspond.</p>
                ) : (
                  filtered.map((a) => {
                    const id = String(a.id);
                    const selected = compareMode ? (selectedIds || []).includes(id) : selectedId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => handlePick(id)}
                        className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left last:mb-0 hover:bg-[var(--bg-hover)]"
                        style={{
                          background: selected
                            ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)"
                            : undefined,
                        }}
                      >
                        <div className="relative">
                          <ArticleAvatar article={a} size={36} className="!rounded-xl" />
                          {selected ? (
                            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white">
                              <IconCheck size={10} />
                            </span>
                          ) : null}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--text-primary)]">
                          {articleName(a)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function formatMoisLabel(mois) {
  if (!mois || typeof mois !== "string") return mois;
  const parts = mois.split("-");
  if (parts.length >= 2) return `${MOIS_COURTS[parts[1]] || parts[1]} ${parts[0].slice(2)}`;
  return mois;
}

function gaugeColor(pct) {
  if (pct >= 80) return "#1D9E75";
  if (pct >= 50) return "#BA7517";
  return "#E24B4A";
}

function CircularGauge({ label, pct }) {
  const [animated, setAnimated] = useState(false);
  const r = 42;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const color = gaugeColor(clamped);
  const displayPct = useCountUp(clamped, 1100);

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(t);
  }, [pct]);

  return (
    <div
      className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-center count-up-fade"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <svg viewBox="0 0 120 120" className="mx-auto h-28 w-28">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--bg-hover)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={animated ? c - (clamped / 100) * c : c}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 1.2s ease" }}
        />
        <text x="60" y="64" textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="700">
          {Math.round(displayPct)}%
        </text>
      </svg>
    </div>
  );
}

function TrendBadge({ tendance, variationPct }) {
  const t = String(tendance || "stable").toLowerCase();
  const color = t === "hausse" ? "#1D9E75" : t === "baisse" ? "#E24B4A" : "#BA7517";
  const Icon = t === "hausse" ? IconTrendingUp : t === "baisse" ? IconTrendingDown : IconMinus;
  const label = t === "hausse" ? "Hausse" : t === "baisse" ? "Baisse" : "Stable";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <Icon size={16} className="forecast-trend-pulse" />
      {label}
      {variationPct != null ? ` ${variationPct > 0 ? "+" : ""}${variationPct}%` : ""}
    </span>
  );
}

function ConfidencePill({ result }) {
  const label = result?.confidenceLabel || (result?.confidence == null ? "insuffisant" : null);
  const minH = result?.minHistory || 4;
  const tone = {
    fiable: "var(--accent-success)",
    moyen: "var(--accent-warning)",
    faible: "var(--accent-danger)",
    insuffisant: "var(--text-muted)",
  }[label] || "var(--text-muted)";
  const text = label === "insuffisant" || (result?.confidence == null && !result?.confidenceLabel)
    ? `Historique insuffisant (< ${minH} mois)`
    : label;
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
      style={{
        color: tone,
        borderColor: `color-mix(in srgb, ${tone} 40%, transparent)`,
        background: `color-mix(in srgb, ${tone} 12%, transparent)`,
      }}
    >
      {text}
    </span>
  );
}

function modelLabel(modele) {
  const m = String(modele || "");
  if (m === "hybrid_nbeats_hw" || m === "hybrid") return "Hybride HW + N-BEATS";
  if (m === "nbeats") return "N-BEATS";
  if (m === "holt_winters") return "Holt-Winters AIC";
  if (m === "holt_local") return "Holt local";
  if (m.includes("moyenne")) return "Moyenne pondérée";
  return m || "—";
}

function buildChartData(result) {
  const hist = result.historique || [];
  const preds = result.predictions || [];
  const models = result.comparaison?.models || [];
  const byId = Object.fromEntries(models.map((m) => [m.id, m.preds || []]));
  const rows = hist.map((h, i) => ({
    mois: formatMoisLabel(h.mois),
    moisKey: h.mois,
    historique: Number(h.valeur),
    isLastReal: i === hist.length - 1,
  }));
  if (hist.length) {
    const last = rows[rows.length - 1];
    last.prediction = last.historique;
    last.min = last.historique;
    last.max = last.historique;
    last.hw = last.historique;
    last.nbeats = last.historique;
    last.hybrid = last.historique;
  }
  for (let i = 0; i < preds.length; i += 1) {
    const p = preds[i];
    rows.push({
      mois: formatMoisLabel(p.mois),
      moisKey: p.mois,
      prediction: Number(p.valeur),
      min: p.min == null && p.lower == null ? null : Number(p.min ?? p.lower ?? p.p10),
      max: p.max == null && p.upper == null ? null : Number(p.max ?? p.upper ?? p.p90),
      hw: byId.hw?.[i] != null ? Number(byId.hw[i]) : undefined,
      nbeats: byId.nbeats?.[i] != null ? Number(byId.nbeats[i]) : undefined,
      hybrid: byId.hybrid?.[i] != null ? Number(byId.hybrid[i]) : undefined,
      isLastReal: false,
    });
  }
  return rows;
}

function PulsingDot({ cx, cy }) {
  if (cx == null || cy == null) return null;
  return (
    <g className="forecast-marker-pulse">
      <circle cx={cx} cy={cy} r={10} fill="#1D9E75" opacity={0.2} />
      <circle cx={cx} cy={cy} r={5} fill="#1D9E75" stroke="#fff" strokeWidth={2} />
    </g>
  );
}

export default function SalesForecast({ embedded = false }) {
  const societeScope = useSocieteQueryScope();
  const toast = useToast();
  const [compareMode, setCompareMode] = useState(false);
  const [articleId, setArticleId] = useState("");
  const [articleIds, setArticleIds] = useState([]);
  const [result, setResult] = useState(null);
  const [compareResults, setCompareResults] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [selectedCompareId, setSelectedCompareId] = useState(null);
  const [scenario, setScenario] = useState("p90");
  const [hiddenSeries, setHiddenSeries] = useState(new Set());
  const [bandVisible, setBandVisible] = useState(false);
  const [overlays, setOverlays] = useState({ hw: true, nbeats: true, hybrid: false });
  const [articleQuery, setArticleQuery] = useState("");

  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ["articles", "forecast-all", societeScope],
    queryFn: fetchAllActiveArticles,
  });

  const forecastMut = useMutation({
    mutationFn: async () => {
      if (compareMode) {
        return api
          .post("stock/forecast/compare", { articleIds: articleIds.map(Number) })
          .then((r) => r.data);
      }
      return api.get(`stock/forecast/${articleId}`).then((r) => r.data);
    },
    onSuccess: (data) => {
      setBandVisible(false);
      if (compareMode) {
        setCompareResults(data.items || []);
        setPortfolio(data.portfolio || null);
        setSelectedCompareId(data.items?.[0]?.articleId ?? null);
        setResult(null);
        setHiddenSeries(new Set());
        toast.success("Portefeuille généré");
      } else {
        setResult(data);
        setCompareResults(null);
        const ch = data.champion;
        setOverlays({
          hw: ch !== "hw" && ch !== "holt_winters",
          nbeats: ch !== "nbeats",
          hybrid: ch !== "hybrid",
        });
        toast.success("Prévision générée");
        setTimeout(() => setBandVisible(true), 1800);
      }
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  function addCompareArticle(val) {
    if (!val || articleIds.includes(val)) return;
    if (articleIds.length >= 8) {
      toast.warning("Maximum 8 articles");
      return;
    }
    setArticleIds((prev) => [...prev, val]);
  }

  function removeCompareArticle(val) {
    setArticleIds((prev) => prev.filter((id) => id !== val));
  }

  function runForecast() {
    if (compareMode) {
      if (!articleIds.length) {
        toast.warning("Sélectionnez au moins un article");
        return;
      }
    } else if (!articleId) {
      toast.warning("Sélectionnez un article");
      return;
    }
    forecastMut.mutate();
  }

  const chartData = useMemo(() => (result ? buildChartData(result) : []), [result]);

  const stockActuel = result?.stockActuel ?? 0;
  const recommended = result?.recommendedStock ?? 0;
  const reorder = result?.reorderPoint ?? 0;
  const delta = recommended - stockActuel;
  const stockDisplay = useCountUp(stockActuel, 900);
  const recoDisplay = useCountUp(recommended, 900);
  const reorderDisplay = useCountUp(reorder, 900);
  const needsReorder = stockActuel < reorder;
  const reduceMotion = useReducedMotion();

  const lastRealPoint = useMemo(() => {
    const idx = chartData.findIndex((d) => d.isLastReal);
    return idx >= 0 ? idx : -1;
  }, [chartData]);

  return (
    <AiModuleShell
      embedded={embedded}
      title="Prévision des ventes"
      subtitle="Holt-Winters AIC + N-BEATS global + hybride — champion walk-forward, portefeuille P90 et stock de service"
    >
      <div className="mb-6 space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => {
                setCompareMode(e.target.checked);
                setResult(null);
                setCompareResults(null);
                setPortfolio(null);
                setSelectedCompareId(null);
              }}
              className="accent-[var(--accent-primary)]"
            />
            Comparer plusieurs articles
          </label>
        </div>

        <ForecastArticleCatalog
          articles={articles}
          loading={articlesLoading}
          query={articleQuery}
          onQuery={setArticleQuery}
          compareMode={compareMode}
          selectedId={articleId}
          selectedIds={articleIds}
          onPick={(id) => {
            if (compareMode) {
              if (articleIds.includes(id)) removeCompareArticle(id);
              else addCompareArticle(id);
            } else {
              setArticleId(id);
            }
          }}
        />

        <button
          type="button"
          onClick={runForecast}
          disabled={forecastMut.isPending}
          className="relative overflow-hidden inline-flex items-center justify-center rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
        >
          {forecastMut.isPending && (
            <span
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                animation: "shimmer-slide 1.1s linear infinite",
              }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            {forecastMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calcul de la prévision…
              </>
            ) : (
              <>
                <IconTrendingUp size={18} />
                Générer la prévision
              </>
            )}
          </span>
        </button>
      </div>

      {forecastMut.isPending && (
        <div className="mb-6 space-y-4" aria-busy="true" aria-label="Calcul de la prévision">
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="load-opt-skeleton h-28 rounded-xl"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
          <div className="load-opt-skeleton h-40 w-full rounded-xl" />
          <div className="load-opt-skeleton h-80 w-full rounded-xl" />
        </div>
      )}

      {forecastMut.isError && !forecastMut.isPending && (
        <div
          className="glass mb-6 rounded-xl p-6 text-center"
          style={{
            borderColor: "color-mix(in srgb, #7F77DD 45%, transparent)",
          }}
        >
          <IconAlertTriangle size={28} className="mx-auto mb-3 text-[#7F77DD]" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Analyse temporairement indisponible
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Le service de prévision n&apos;a pas répondu. Réessayez dans un instant.
          </p>
          <button
            type="button"
            onClick={runForecast}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            <IconRefresh size={16} />
            Réessayer
          </button>
        </div>
      )}

      {result && !compareMode && (
        <div className="space-y-5 animate-fadeUp">
          {needsReorder && (
            <div className="rounded-xl border border-[#BA7517]/40 bg-[#BA7517]/10 px-4 py-3 text-sm text-[#BA7517]">
              <span className="inline-flex items-center gap-2 font-medium">
                <IconAlertTriangle size={16} />
                Stock actuel ({stockActuel}) inférieur au point de réappro ({reorder}) — réapprovisionnement conseillé
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <TrendBadge tendance={result.tendance} variationPct={result.variationPct} />
            <ConfidencePill result={result} />
            {result.picSaisonnier?.mois && (
              <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                Pic attendu en {result.picSaisonnier.mois}
              </span>
            )}
            {result.modele && (
              <span className="text-[11px] text-[var(--text-muted)]">
                Modèle : {modelLabel(result.modele)}
                {result.champion ? ` · champion ${result.champion}` : ""}
              </span>
            )}
          </div>

          <motion.div
            className="grid gap-4 sm:grid-cols-3"
            variants={STAGGER_CONTAINER}
            initial="hidden"
            animate="show"
          >
            <motion.div
              variants={STAGGER_ITEM}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 count-up-fade"
            >
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Stock actuel vs P90</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                {Math.round(stockDisplay)} → {Math.round(recoDisplay)}
              </p>
              <p
                className="mt-1 text-sm font-medium"
                style={{ color: delta >= 0 ? "#BA7517" : "#1D9E75" }}
              >
                Delta {delta >= 0 ? "+" : ""}
                {Math.round(delta)}
              </p>
            </motion.div>
            <motion.div
              variants={STAGGER_ITEM}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 count-up-fade"
            >
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Point de réappro (P90)</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                {Math.round(reorderDisplay)}
              </p>
            </motion.div>
            <motion.div
              variants={STAGGER_ITEM}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 count-up-fade"
            >
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Qualité</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {result.mase == null ? "MASE —" : `MASE ${Number(result.mase).toFixed(2)}`}
                {result.smape == null ? "" : ` · sMAPE ${Number(result.smape).toFixed(1)}`}
              </p>
            </motion.div>
          </motion.div>

          <AiInsightCard
            title={result.articleLibelle || "Lecture de la demande"}
            icon={<IconSparkles size={16} />}
            text={result.explication || ""}
            badge="Brief"
          />

          <ForecastStudio result={result} />

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Historique & prédiction</h3>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "hw", label: "HW" },
                  { id: "nbeats", label: "N-BEATS" },
                  { id: "hybrid", label: "Hybride" },
                ].map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOverlays((prev) => ({ ...prev, [o.id]: !prev[o.id] }))}
                    className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-opacity"
                    style={{
                      borderColor: MODEL_COLOR[o.id],
                      color: MODEL_COLOR[o.id],
                      opacity: overlays[o.id] ? 1 : 0.35,
                      background: overlays[o.id]
                        ? `color-mix(in srgb, ${MODEL_COLOR[o.id]} 12%, transparent)`
                        : "transparent",
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7F77DD" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#7F77DD" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1D9E75" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#1D9E75" stopOpacity={0.12} />
                    </linearGradient>
                    <linearGradient id="predFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1D9E75" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#1D9E75" stopOpacity={0} />
                    </linearGradient>
                    <pattern
                      id="predHatch"
                      width="6"
                      height="6"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(35)"
                    >
                      <line x1="0" y1="0" x2="0" y2="6" stroke="#1D9E75" strokeWidth="1.2" opacity="0.35" />
                    </pattern>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                    }}
                  />
                  {bandVisible && (
                    <Area
                      type="monotone"
                      dataKey="max"
                      stroke="none"
                      fill="var(--accent-primary)"
                      fillOpacity={0.15}
                      animationDuration={800}
                      legendType="none"
                    />
                  )}
                  {bandVisible && (
                    <Area
                      type="monotone"
                      dataKey="min"
                      stroke="none"
                      fill="var(--bg-card)"
                      fillOpacity={1}
                      animationDuration={800}
                      legendType="none"
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="historique"
                    name="Historique"
                    stroke="#1D9E75"
                    fill="url(#histFill)"
                    strokeWidth={2.5}
                    animationDuration={1200}
                    animationBegin={0}
                    dot={(props) => {
                      const { index, cx, cy } = props;
                      if (index === lastRealPoint) return <PulsingDot key={`pulse-${index}`} cx={cx} cy={cy} />;
                      return (
                        <circle key={`d-${index}`} cx={cx} cy={cy} r={3} fill="#1D9E75" />
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="prediction"
                    name="Prédiction"
                    stroke="#1D9E75"
                    fill="url(#predFill)"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    animationDuration={1200}
                    animationBegin={900}
                    connectNulls
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="prediction"
                    stroke="none"
                    fill="url(#predHatch)"
                    fillOpacity={1}
                    animationDuration={1200}
                    animationBegin={900}
                    connectNulls
                    legendType="none"
                    tooltipType="none"
                  />
                  {overlays.hw ? (
                    <Line
                      type="monotone"
                      dataKey="hw"
                      name="Holt-Winters"
                      stroke={MODEL_COLOR.hw}
                      strokeWidth={1.6}
                      strokeDasharray="4 3"
                      dot={false}
                      connectNulls
                      legendType="plainline"
                    />
                  ) : null}
                  {overlays.nbeats ? (
                    <Line
                      type="monotone"
                      dataKey="nbeats"
                      name="N-BEATS"
                      stroke={MODEL_COLOR.nbeats}
                      strokeWidth={1.6}
                      strokeDasharray="2 4"
                      dot={false}
                      connectNulls
                      legendType="plainline"
                    />
                  ) : null}
                  {overlays.hybrid ? (
                    <Line
                      type="monotone"
                      dataKey="hybrid"
                      name="Hybride"
                      stroke={MODEL_COLOR.hybrid}
                      strokeWidth={1.8}
                      dot={false}
                      connectNulls
                      legendType="plainline"
                    />
                  ) : null}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {compareResults?.length > 0 && (
        <div className="space-y-4 animate-fadeUp">
          <PortfolioStudio
            items={compareResults}
            portfolio={portfolio}
            hiddenIds={hiddenSeries}
            onToggle={(key) => {
              setHiddenSeries((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
            selectedId={selectedCompareId}
            onSelect={setSelectedCompareId}
            scenario={scenario}
            onScenario={setScenario}
          />
          {compareResults.find((it) => Number(it.articleId) === Number(selectedCompareId)) ? (
            <ForecastStudio
              result={compareResults.find((it) => Number(it.articleId) === Number(selectedCompareId))}
            />
          ) : null}
        </div>
      )}
    </AiModuleShell>
  );
}
