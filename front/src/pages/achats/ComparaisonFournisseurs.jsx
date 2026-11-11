import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  IconArrowLeft,
  IconAward,
  IconChartBar,
  IconFilter,
  IconPackage,
  IconScale,
  IconTrendingDown,
  IconUsers,
} from "@tabler/icons-react";
import api from "../../services/api";
import PageShell from "../../components/ui/PageShell";
import SearchableSelect from "../../components/ui/SearchableSelect";
import { formatDate, num3 } from "../../utils/commerceUi";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { STOKIFY_BLUE } from "../../utils/brandStyles";

const SUCCESS = "var(--accent-success)";
const WARNING = "var(--accent-warning)";
const DANGER = "var(--accent-danger)";
const PRIMARY = "var(--accent-primary)";

const CHART_COLORS = [
  "var(--accent-primary)",
  "var(--accent-warning)",
  "#7F77DD",
  "var(--accent-danger)",
  "#EF9F27",
  "#0F6E56",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function yearAgoISO() {
  const d = new Date();
  d.setFullYear(d.getFullYear(), d.getMonth() - 11, 1);
  return d.toISOString().slice(0, 10);
}

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
  visible: { transition: { staggerChildren: 0.05 } },
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

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3.5 py-2.5 shadow-lg">
      <p className="text-xs font-semibold text-[var(--text-primary)]">{d.fullName}</p>
      <p
        className="mt-1 text-sm font-bold tabular-nums"
        style={{ color: d.meilleur ? SUCCESS : "var(--text-primary)" }}
      >
        {num3(d.prixMoyen)} <span className="text-[10px] font-medium text-[var(--text-muted)]">TND HT</span>
      </p>
      {d.meilleur ? (
        <p className="mt-1 text-[10px] font-medium" style={{ color: SUCCESS }}>
          Meilleur prix
        </p>
      ) : null}
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, hint, accent, index, reduceMotion, pulse, isCurrency, isPercent, formatRaw }) {
  const numericTarget = formatRaw ? 0 : Number(value) || 0;
  const animated = useAnimatedNumber(formatRaw ? 0 : numericTarget, 1100);
  const display = formatRaw
    ? value
    : isPercent
      ? `${(Math.round(animated * 10) / 10).toLocaleString("fr-FR")}%`
      : isCurrency
        ? `${Number(animated).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`
        : Math.round(animated).toLocaleString("fr-FR");

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`group relative overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-4 ${
        pulse ? "comp-kpi-pulse" : "border-[var(--border-default)]"
      }`}
      style={pulse ? { "--kpi-accent": accent, borderColor: `${accent}55` } : undefined}
    >
      <motion.span
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: accent }}
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.1 + index * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(135deg, ${accent}0f 0%, transparent 55%)` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.07] blur-2xl transition-opacity group-hover:opacity-[0.14]"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="relative pl-2.5">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(145deg, ${accent}18, transparent)`,
              color: accent,
              boxShadow: `inset 0 0 0 1px ${accent}28`,
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
        <p className="mt-0.5 font-display text-2xl font-bold tabular-nums tracking-tight" style={{ color: accent }}>
          {display}
        </p>
        <motion.div
          className="mt-2.5 h-px origin-left"
          style={{ background: `linear-gradient(90deg, ${accent}66, transparent)` }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.18 + index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />
      </div>
    </motion.div>
  );
}

function SupplierRankCard({ supplier, rank, maxPrice, index, reduceMotion }) {
  const pct = maxPrice > 0 ? (supplier.prixMoyen / maxPrice) * 100 : 0;
  const isBest = supplier.meilleurPrix;

  return (
    <motion.div
      variants={rowFade}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      transition={{ delay: index * 0.05 }}
      className={`group relative rounded-2xl border p-4 transition-colors ${
        isBest
          ? "border-[color-mix(in_srgb,var(--accent-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent-success)_8%,var(--bg-card))]"
          : "border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[color-mix(in_srgb,var(--accent-primary)_35%,transparent)]"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              isBest ? "text-white" : "bg-[var(--bg-hover)] text-[var(--text-secondary)]"
            }`}
            style={isBest ? { background: SUCCESS } : undefined}
          >
            {isBest ? <IconAward size={16} /> : `#${rank}`}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{supplier.nom}</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {supplier.nbCommandes} commande{supplier.nbCommandes > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className="font-display text-lg font-bold tabular-nums"
            style={{ color: isBest ? SUCCESS : "var(--text-primary)" }}
          >
            {num3(supplier.prixMoyen)}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">TND HT moy.</p>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-hover)]">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: isBest
              ? `linear-gradient(90deg, ${SUCCESS}, color-mix(in srgb, var(--accent-success) 70%, white))`
              : `linear-gradient(90deg, ${PRIMARY}, color-mix(in srgb, var(--accent-primary) 70%, white))`,
          }}
          initial={reduceMotion ? { width: `${pct}%` } : { width: 0 }}
          animate={{ width: `${Math.max(pct, 4)}%` }}
          transition={{ duration: 0.7, delay: 0.15 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
        <span>
          Min <span className="font-medium tabular-nums text-[var(--text-primary)]">{num3(supplier.prixMin)}</span>
        </span>
        <span className="text-[var(--border-default)]">·</span>
        <span>
          Max <span className="font-medium tabular-nums text-[var(--text-primary)]">{num3(supplier.prixMax)}</span>
        </span>
        {supplier.derniereCommande ? (
          <>
            <span className="text-[var(--border-default)]">·</span>
            <span>Dernier {formatDate(supplier.derniereCommande)}</span>
          </>
        ) : null}
      </div>
    </motion.div>
  );
}

export default function ComparaisonFournisseurs() {
  const navigate = useNavigate();
  const societeScope = useSocieteQueryScope();
  const reduceMotion = useReducedMotion();
  const [familleId, setFamilleId] = useState("");
  const [dateDebut, setDateDebut] = useState(yearAgoISO());
  const [dateFin, setDateFin] = useState(todayISO());
  const [selectedArticleId, setSelectedArticleId] = useState("");

  const { data: famillesData } = useQuery({
    queryKey: ["familles", societeScope],
    queryFn: () => api.get("familles", { params: { limit: 200 } }).then((r) => r.data),
  });

  const params = useMemo(
    () => ({
      ...(familleId ? { familleId } : {}),
      ...(dateDebut ? { dateDebut } : {}),
      ...(dateFin ? { dateFin } : {}),
    }),
    [familleId, dateDebut, dateFin]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["achats-comparaison", societeScope, params],
    queryFn: () => api.get("achats/comparaison-fournisseurs", { params }).then((r) => r.data),
  });

  const articles = data?.articles || [];
  const summary = data?.summary || [];
  const familles = Array.isArray(famillesData) ? famillesData : famillesData?.items || [];

  const activeArticle = useMemo(() => {
    if (!articles.length) return null;
    if (selectedArticleId) return articles.find((a) => String(a.articleId) === selectedArticleId) || articles[0];
    return articles[0];
  }, [articles, selectedArticleId]);

  const chartData = useMemo(() => {
    if (!activeArticle?.fournisseurs?.length) return [];
    return activeArticle.fournisseurs.map((f) => ({
      name: f.nom.length > 14 ? `${f.nom.slice(0, 12)}…` : f.nom,
      fullName: f.nom,
      prixMoyen: f.prixMoyen,
      meilleur: f.meilleurPrix,
    }));
  }, [activeArticle]);

  const stats = useMemo(() => {
    const fournisseurIds = new Set(summary.map((r) => r.fournisseurId));
    const best = activeArticle?.fournisseurs?.find((f) => f.meilleurPrix);
    const worst = activeArticle?.fournisseurs?.length
      ? activeArticle.fournisseurs[activeArticle.fournisseurs.length - 1]
      : null;
    const ecart =
      best && worst && worst.prixMoyen > 0
        ? ((worst.prixMoyen - best.prixMoyen) / worst.prixMoyen) * 100
        : 0;
    return {
      articles: articles.length,
      fournisseurs: fournisseurIds.size,
      commandes: summary.reduce((s, r) => s + (r.nbCommandes || 0), 0),
      ecart: Math.round(ecart * 10) / 10,
      bestNom: best?.nom || "—",
      bestPrix: best?.prixMoyen,
    };
  }, [articles, summary, activeArticle]);

  const maxPrix = useMemo(() => {
    if (!activeArticle?.fournisseurs?.length) return 0;
    return Math.max(...activeArticle.fournisseurs.map((f) => f.prixMoyen || 0));
  }, [activeArticle]);

  const articleCodeById = useMemo(() => {
    const map = new Map();
    for (const a of articles) map.set(String(a.articleId), a.articleCode);
    return map;
  }, [articles]);

  return (
    <PageShell
      title="Comparaison fournisseurs"
      subtitle="Analyse dynamique des prix d'achat et identification du meilleur fournisseur"
      actions={
        <button
          type="button"
          onClick={() => navigate("/achats")}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-all duration-150 hover:bg-[var(--bg-hover)]"
        >
          <IconArrowLeft size={16} />
          Retour aux achats
        </button>
      }
    >
      <style>{`
        @keyframes compShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes compKpiPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--kpi-accent) 18%, transparent); }
          50% { box-shadow: 0 0 22px 2px color-mix(in srgb, var(--kpi-accent) 28%, transparent); }
        }
        .comp-skeleton {
          background: linear-gradient(
            90deg,
            var(--bg-hover) 25%,
            color-mix(in srgb, var(--bg-card) 60%, var(--bg-hover)) 50%,
            var(--bg-hover) 75%
          );
          background-size: 200% 100%;
          animation: compShimmer 1.4s ease-in-out infinite;
        }
        .comp-kpi-pulse { animation: compKpiPulse 2.4s ease-in-out infinite; }
        .comp-article-scroll::-webkit-scrollbar { height: 4px; }
        .comp-article-scroll::-webkit-scrollbar-thumb {
          background: var(--border-default);
          border-radius: 4px;
        }
        @media (prefers-reduced-motion: reduce) {
          .comp-skeleton,
          .comp-kpi-pulse { animation: none !important; }
        }
      `}</style>

      <div className="space-y-5">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="comp-skeleton h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              index={0}
              reduceMotion={reduceMotion}
              icon={IconPackage}
              label="Articles analysés"
              value={stats.articles}
              hint="période"
              accent={PRIMARY}
            />
            <KpiTile
              index={1}
              reduceMotion={reduceMotion}
              icon={IconUsers}
              label="Fournisseurs"
              value={stats.fournisseurs}
              hint={`${stats.commandes} cmd`}
              accent={STOKIFY_BLUE}
            />
            <KpiTile
              index={2}
              reduceMotion={reduceMotion}
              icon={IconAward}
              label="Meilleur prix"
              value={stats.bestPrix != null ? num3(stats.bestPrix) : "—"}
              hint={stats.bestNom}
              accent={SUCCESS}
              formatRaw
            />
            <KpiTile
              index={3}
              reduceMotion={reduceMotion}
              icon={IconTrendingDown}
              label="Écart max / min"
              value={stats.ecart}
              isPercent
              hint="économie"
              accent={stats.ecart >= 15 ? DANGER : WARNING}
              pulse={stats.ecart >= 15}
            />
          </div>
        )}

        <motion.section
          custom={4}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${PRIMARY}88, ${SUCCESS}88, transparent)`,
            }}
            aria-hidden
          />
          <div className="mb-3 flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: `${PRIMARY}18`, color: PRIMARY }}
            >
              <IconFilter size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Filtres d&apos;analyse</p>
              <p className="text-[11px] text-[var(--text-muted)]">Période, famille et article</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                Famille
              </label>
              <SearchableSelect
                value={familleId}
                onChange={setFamilleId}
                options={familles.map((f) => ({ value: String(f.id), label: f.nom }))}
                placeholder="Toutes les familles"
                clearLabel="Toutes"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                Du
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent-primary)_20%,transparent)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                Au
              </label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent-primary)_20%,transparent)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                Article
              </label>
              <SearchableSelect
                value={selectedArticleId || (articles[0] ? String(articles[0].articleId) : "")}
                onChange={setSelectedArticleId}
                options={articles.map((a) => ({
                  value: String(a.articleId),
                  label: `${a.articleCode} — ${a.articleLibelle}`,
                }))}
                placeholder="Sélectionner un article"
              />
            </div>
          </div>
        </motion.section>

        {isLoading ? (
          <div className="comp-skeleton h-80 rounded-2xl" />
        ) : !activeArticle ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-20 text-center"
          >
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: `${PRIMARY}14`, color: PRIMARY }}
            >
              <IconChartBar size={32} stroke={1.5} />
            </div>
            <p className="font-display text-lg font-semibold text-[var(--text-primary)]">Aucune donnée d&apos;achat</p>
            <p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">
              Modifiez la période ou la famille pour comparer les prix fournisseurs.
            </p>
          </motion.div>
        ) : (
          <>
            {articles.length > 1 ? (
              <motion.div
                custom={5}
                variants={fadeUp}
                initial={reduceMotion ? false : "hidden"}
                animate="visible"
                className="comp-article-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
              >
                {articles.slice(0, 12).map((a) => {
                  const active = String(activeArticle.articleId) === String(a.articleId);
                  return (
                    <button
                      key={a.articleId}
                      type="button"
                      onClick={() => setSelectedArticleId(String(a.articleId))}
                      className={`relative shrink-0 overflow-hidden rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "text-white"
                          : "bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {active ? (
                        <motion.span
                          layoutId={reduceMotion ? undefined : "article-chip"}
                          className="absolute inset-0 rounded-full"
                          style={{ background: PRIMARY }}
                          transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        />
                      ) : null}
                      <span className="relative z-[1]">{a.articleCode}</span>
                    </button>
                  );
                })}
                {articles.length > 12 ? (
                  <span className="shrink-0 self-center text-[11px] text-[var(--text-muted)]">
                    +{articles.length - 12}
                  </span>
                ) : null}
              </motion.div>
            ) : null}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeArticle.articleId}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="grid gap-5 lg:grid-cols-5"
              >
                <section className="space-y-3 lg:col-span-2">
                  <div className="flex items-center gap-2">
                    <IconScale size={18} style={{ color: PRIMARY }} />
                    <div>
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Classement fournisseurs</h2>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {activeArticle.articleLibelle}
                        {activeArticle.famille ? ` · ${activeArticle.famille}` : ""}
                      </p>
                    </div>
                  </div>
                  <motion.div
                    variants={listStagger}
                    initial={reduceMotion ? false : "hidden"}
                    animate="visible"
                    className="space-y-3"
                  >
                    {activeArticle.fournisseurs?.map((f, i) => (
                      <SupplierRankCard
                        key={f.fournisseurId}
                        supplier={f}
                        rank={i + 1}
                        maxPrice={maxPrix}
                        index={i}
                        reduceMotion={reduceMotion}
                      />
                    ))}
                  </motion.div>
                </section>

                <section className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5 lg:col-span-3">
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
                    style={{
                      background: `linear-gradient(90deg, transparent 0%, ${SUCCESS} 35%, ${PRIMARY} 65%, transparent 100%)`,
                    }}
                    aria-hidden
                  />
                  <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                        {activeArticle.articleLibelle}
                      </h2>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        <span className="font-mono">{activeArticle.articleCode}</span>
                        {activeArticle.famille ? ` · ${activeArticle.famille}` : ""}
                        {" · "}Prix moyen HT par fournisseur
                      </p>
                    </div>
                    {activeArticle.fournisseurs?.find((f) => f.meilleurPrix) ? (
                      <motion.span
                        initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                        style={{
                          background: "color-mix(in srgb, var(--accent-success) 14%, transparent)",
                          color: SUCCESS,
                        }}
                      >
                        <IconAward size={14} />
                        {activeArticle.fournisseurs.find((f) => f.meilleurPrix)?.nom}
                      </motion.span>
                    ) : null}
                  </div>
                  <div className="relative h-[300px] w-full sm:h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 12, right: 8, left: -8, bottom: 4 }} barCategoryGap="28%">
                        <defs>
                          <linearGradient id="barBest" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3DDC97" />
                            <stop offset="100%" stopColor="#1D9E75" />
                          </linearGradient>
                          <linearGradient id="barStd" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#5BA3E8" />
                            <stop offset="100%" stopColor="#378ADD" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 6" stroke="var(--border-default)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                          axisLine={false}
                          tickLine={false}
                          width={48}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--bg-hover)", opacity: 0.5 }} />
                        <Bar
                          dataKey="prixMoyen"
                          name="Prix moyen HT"
                          radius={[8, 8, 4, 4]}
                          animationDuration={reduceMotion ? 0 : 900}
                          animationEasing="ease-out"
                        >
                          {chartData.map((entry, i) => (
                            <Cell
                              key={`cell-${entry.fullName}`}
                              fill={entry.meilleur ? "url(#barBest)" : CHART_COLORS[i % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </motion.div>
            </AnimatePresence>

            <motion.section
              custom={6}
              variants={fadeUp}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] px-4 py-3 sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Tableau récapitulatif</h2>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {summary.length} ligne{summary.length > 1 ? "s" : ""} article × fournisseur
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-app)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="px-4 py-3 font-semibold">Article</th>
                      <th className="px-4 py-3 font-semibold">Fournisseur</th>
                      <th className="px-4 py-3 text-right font-semibold">Cmd</th>
                      <th className="px-4 py-3 text-right font-semibold">Prix moyen</th>
                      <th className="px-4 py-3 font-semibold">Fourchette</th>
                      <th className="px-4 py-3 font-semibold">Dernière cmd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row, i) => {
                      const span = (row.prixMax || 0) - (row.prixMin || 0);
                      const mid = row.prixMoyen - (row.prixMin || 0);
                      const midPct = span > 0 ? (mid / span) * 100 : 50;
                      const isBestForArticle =
                        activeArticle &&
                        String(row.articleId) === String(activeArticle.articleId) &&
                        activeArticle.meilleurFournisseurId === row.fournisseurId;

                      return (
                        <motion.tr
                          key={`${row.articleId}-${row.fournisseurId}`}
                          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.025, 0.4), duration: 0.28 }}
                          className="border-b border-[var(--border-default)]/50 transition-colors hover:bg-[var(--bg-hover)]"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--text-primary)]">{row.articleLibelle}</p>
                            <p className="font-mono text-[10px] text-[var(--text-muted)]">
                              {articleCodeById.get(String(row.articleId)) || "—"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                              {isBestForArticle ? <IconAward size={14} style={{ color: SUCCESS }} /> : null}
                              {row.fournisseurNom}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                            {row.nbCommandes}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className="font-semibold tabular-nums"
                              style={{ color: isBestForArticle ? SUCCESS : "var(--text-primary)" }}
                            >
                              {num3(row.prixMoyen)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-12 text-right text-[10px] tabular-nums text-[var(--text-muted)]">
                                {num3(row.prixMin)}
                              </span>
                              <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-[var(--bg-hover)]">
                                <div
                                  className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-white shadow"
                                  style={{
                                    left: `calc(${Math.min(Math.max(midPct, 8), 92)}% - 5px)`,
                                    background: isBestForArticle ? SUCCESS : PRIMARY,
                                  }}
                                />
                              </div>
                              <span className="w-12 text-[10px] tabular-nums text-[var(--text-muted)]">
                                {num3(row.prixMax)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">
                            {formatDate(row.derniereCommande)}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.section>
          </>
        )}
      </div>
    </PageShell>
  );
}
