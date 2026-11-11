import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingUp, Package, BarChart3, Layers, FileDown, FileSpreadsheet, ChevronLeft, ChevronRight, LayoutGrid, ArrowRightLeft, Loader2 } from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import SearchableSelect from "../../components/ui/SearchableSelect";
import SimpleSelect from "../../components/ui/SimpleSelect";
import api from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useClientBranding } from "../../hooks/useClientBranding";
import useCountUp from "../../hooks/useCountUp";
import { exportValuationPdf } from "../../utils/stockReports";
import { exportValuationExcel } from "../../utils/exportHelpers";

const METHODE_PRIX = [
  { value: "PAHT", label: "Prix achat HT" },
  { value: "CMP", label: "CMP" },
  { value: "FIFO", label: "FIFO (couche)" },
  { value: "LIFO", label: "LIFO" },
  { value: "DERNIER_PRIX_ACHAT", label: "Dernier Prix d'Achat" },
  { value: "PVHT", label: "Prix vente HT" },
  { value: "COUT_STOCKAGE", label: "Coût stockage" },
];

const VALORISATION_CARDS = ["CMP", "FIFO", "LIFO", "DERNIER_PRIX_ACHAT"];

const cardMotion = {
  hidden: { opacity: 0, y: 18 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

const tableFade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.18 } },
};

const CMP_COLORS = { ancien: "#94a3b8", nouveau: "#38bdf8" };
const ROWS_PER_PAGE = [10, 25, 50, 100];

function asItems(d) {
  if (Array.isArray(d)) return d;
  return d?.items || [];
}

function fmtNum(v, digits = 3) {
  return Number(v || 0).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtDateShort(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-navy-950 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 text-slate-400">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: {fmtNum(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function Valuation() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const clientBranding = useClientBranding();
  const canRead = hasPermission(user?.role, "valorisation:read");

  const [mainView, setMainView] = useState("stock");
  const [comparaisonDepot, setComparaisonDepot] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [revalidating, setRevalidating] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [depotId, setDepotId] = useState("");
  const [cmpDepotId, setCmpDepotId] = useState("");
  const [methodePrix, setMethodePrix] = useState("CMP");
  const [articleId, setArticleId] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const { data: depotsData } = useQuery({
    queryKey: ["depots", "valuation", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 100 } }).then((r) => r.data),
    enabled: canRead,
  });

  const { data: articlesData } = useQuery({
    queryKey: ["articles", "valuation", societeScope],
    queryFn: () => api.get("articles", { params: { limit: 500 } }).then((r) => r.data),
    enabled: canRead,
  });

  const depots = asItems(depotsData);
  const articles = asItems(articlesData);

  const { data: stockVal, isLoading: loadingStock, dataUpdatedAt } = useQuery({
    queryKey: ["valuation-stock", societeScope, depotId, methodePrix, page, limit],
    queryFn: () =>
      api
        .get("valuation/stock", {
          params: {
            methodePrix,
            page,
            limit,
            ...(depotId ? { depotId } : {}),
          },
        })
        .then((r) => r.data),
    enabled: canRead && !!user,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: comparaisonData, isLoading: loadingComparaison } = useQuery({
    queryKey: ["valuation-comparaison", societeScope, comparaisonDepot],
    queryFn: () =>
      api.get("valuation/comparaison", { params: { ...(comparaisonDepot ? { depotId: comparaisonDepot } : {}) } }).then((r) => r.data),
    enabled: canRead && !!user && mainView === "comparatif",
    staleTime: 30000,
  });

  const { data: cmpHistory, isLoading: loadingCmp } = useQuery({
    queryKey: ["valuation-cmp", societeScope, articleId, cmpDepotId],
    queryFn: () =>
      api
        .get(`valuation/history/${articleId}`, {
          params: { depotId: cmpDepotId, limit: 40 },
        })
        .then((r) => r.data),
    enabled: canRead && !!articleId && !!cmpDepotId,
  });

  const { data: compareData, isLoading: loadingCompare } = useQuery({
    queryKey: ["valuation-compare", societeScope, articleId, cmpDepotId],
    queryFn: () =>
      api.get(`valuation/compare/${articleId}`, { params: { depotId: cmpDepotId } }).then((r) => r.data),
    enabled: canRead && !!articleId && !!cmpDepotId,
  });

  const cmpChartData = useMemo(() => {
    const rows = [...(cmpHistory?.items || [])].reverse();
    return rows.map((h) => ({
      date: fmtDate(h.dateCalcul),
      ancien: Number(h.ancienCMP),
      nouveau: Number(h.nouveauCMP),
    }));
  }, [cmpHistory]);


  const secAgo = dataUpdatedAt ? Math.max(0, Math.floor((nowTick - dataUpdatedAt) / 1000)) : null;
  const lignes = stockVal?.lignes || stockVal?.data || [];
  const totalRows = stockVal?.total ?? lignes.length;
  const totalPages = stockVal?.totalPages ?? 1;
  const valeurTotale = stockVal?.valeurTotale ?? 0;
  const animatedTotal = useCountUp(valeurTotale, 600);

  const compareCards = useMemo(() => {
    const items = compareData?.items || [];
    const primary = VALORISATION_CARDS.map((m) => items.find((c) => c.methode === m)).filter(Boolean);
    const rest = items.filter((c) => !VALORISATION_CARDS.includes(c.methode));
    return [...primary, ...rest];
  }, [compareData]);

  const depotLabel = depotId ? depots.find((d) => String(d.id) === depotId)?.code : "Tous";

  async function fetchAllForExport() {
    const r = await api.get("valuation/stock", {
      params: { methodePrix, limit: 5000, page: 1, ...(depotId ? { depotId } : {}) },
    });
    return r.data?.lignes || r.data?.data || [];
  }

  async function onExportPdf() {
    const all = await fetchAllForExport();
    await exportValuationPdf({
      depotLabel,
      methode: methodePrix,
      lignes: all,
      valeurTotale: stockVal?.valeurTotale ?? all.reduce((s, l) => s + Number(l.valeur || 0), 0),
      clientBranding,
    });
  }

  async function onExportExcel() {
    await exportValuationExcel(api, {
      methodePrix,
      ...(depotId ? { depotId } : {}),
    });
  }

  async function handleRevalidateAll() {
    const rows = comparaisonData?.items || [];
    if (!rows.length) return;
    setRevalidating(true);
    try {
      for (const r of rows) {
        await api.post("valuation/revalidate", { articleId: r.articleId, depotId: r.depotId });
      }
      await qc.invalidateQueries({ queryKey: ["valuation-comparaison", societeScope] });
      await qc.invalidateQueries({ queryKey: ["valuation-stock", societeScope] });
    } finally {
      setRevalidating(false);
    }
  }

  if (!canRead) {
    return (
      <PageShell title="Valorisation" subtitle="">
        <p className="text-sm text-slate-400">Accès refusé.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Valorisation du stock"
      subtitle="CMP, FIFO, LIFO, Dernier Prix d'Achat et comparaison des méthodes"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:text-white"
          >
            <FileDown className="h-4 w-4" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-600/30"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      }
    >
      <div className="space-y-8 text-slate-200">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMainView("stock")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              mainView === "stock"
                ? "border-accent-500/50 bg-accent-600/20 text-accent-300"
                : "border-white/10 text-slate-400 hover:border-white/20"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Valorisation
          </button>
          <button
            type="button"
            onClick={() => setMainView("comparatif")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              mainView === "comparatif"
                ? "border-accent-500/50 bg-accent-600/20 text-accent-300"
                : "border-white/10 text-slate-400 hover:border-white/20"
            }`}
          >
            <ArrowRightLeft className="h-4 w-4" />
            Comparaison méthodes
          </button>
        </div>

        {mainView === "comparatif" && (
          <section className="rounded-2xl border border-white/10 bg-navy-900 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">Comparaison FIFO / CMP / LIFO / Dernier Prix</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-full sm:w-48">
                  <SearchableSelect
                    value={comparaisonDepot}
                    onChange={setComparaisonDepot}
                    options={depots.map((d) => ({ value: String(d.id), label: `${d.code} — ${d.libelle || d.nom}` }))}
                    placeholder="Tous dépôts"
                    clearLabel="Tous"
                  />
                </div>
                <button
                  type="button"
                  disabled={revalidating}
                  onClick={() => handleRevalidateAll()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-white/20 disabled:opacity-50"
                >
                  {revalidating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Actualiser
                </button>
              </div>
            </div>
            {loadingComparaison ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-[1100px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-navy-950/50 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      <th className="px-3 py-2">Article</th>
                      <th className="px-3 py-2 text-right">Qté</th>
                      <th className="px-3 py-2 text-right">CMP</th>
                      <th className="px-3 py-2 text-right">FIFO</th>
                      <th className="px-3 py-2 text-right">LIFO</th>
                      <th className="px-3 py-2 text-right">Dernier Prix d'Achat</th>
                      <th className="px-3 py-2 text-right">PA HT</th>
                      <th className="px-3 py-2 text-right">Diff CMP/FIFO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(comparaisonData?.items || []).map((row) => {
                      const diff = Number(row.diff_cmp_fifo || 0);
                      const pct =
                        Number(row.val_cmp) !== 0 ? Math.round((diff / Number(row.val_cmp)) * 1000) / 10 : 0;
                      const pos = diff > 0;
                      const neg = diff < 0;
                      const prixDate = fmtDateShort(row.dernier_prix_date);
                      return (
                        <tr
                          key={`${row.articleId}-${row.depotId}`}
                          className="cursor-pointer border-b border-white/5 transition-colors hover:bg-accent-500/5"
                        >
                          <td className="px-3 py-2">
                            <p className="text-slate-200">{row.libelle}</p>
                            <p className="font-mono text-[10px] text-slate-500">{row.code}</p>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{fmtNum(row.qte, 2)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{fmtNum(row.val_cmp)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-sky-300">{fmtNum(row.val_fifo)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-violet-300">{fmtNum(row.val_lifo)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-amber-300" title={prixDate ? `Prix du ${prixDate}` : undefined}>
                            {fmtNum(row.val_dernier_prix)}
                            {prixDate && (
                              <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                                {fmtNum(row.dernier_prix_unitaire)} · {prixDate}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{fmtNum(row.val_paht)}</td>
                          <td className="px-3 py-2 text-right">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                pos
                                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                                  : neg
                                    ? "border-red-500/30 bg-red-500/15 text-red-300"
                                    : "border-white/10 bg-white/5 text-slate-400"
                              }`}
                            >
                              {fmtNum(diff)} ({pct}%)
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {mainView === "stock" && (
          <>
            <section className="rounded-2xl border border-white/10 bg-navy-900 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <TrendingUp className="h-5 w-5 text-accent-400" />
            <h2 className="text-sm font-semibold text-white">Valorisation globale</h2>
          </div>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="w-full sm:w-48">
              <SearchableSelect
                value={depotId}
                onChange={(v) => {
                  setDepotId(v);
                  setPage(1);
                }}
                options={depots.map((d) => ({ value: String(d.id), label: `${d.code} — ${d.libelle || d.nom}` }))}
                placeholder="Tous dépôts"
                clearLabel="Tous"
              />
            </div>
            <SimpleSelect
              value={methodePrix}
              onChange={(v) => {
                setMethodePrix(v);
                setPage(1);
              }}
              options={METHODE_PRIX}
              aria-label="Méthode de valorisation"
              className="w-full sm:w-52"
            />
            <SimpleSelect
              value={String(limit)}
              onChange={(v) => {
                setLimit(Number(v));
                setPage(1);
              }}
              options={ROWS_PER_PAGE.map((n) => ({ value: String(n), label: `${n} / page` }))}
              aria-label="Lignes par page"
              className="w-28"
            />
          </div>

          <div className="mb-4 flex items-center gap-3 rounded-xl border border-accent-500/30 bg-accent-600/10 p-4">
            <Package className="h-8 w-8 text-accent-400" />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Valeur totale ({methodePrix})</p>
              {loadingStock ? (
                <div className="mt-1 h-8 w-48 animate-pulse rounded-lg bg-white/10" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-accent-300">
                  {fmtNum(animatedTotal)} TND
                </p>
              )}
              <p className="text-xs text-slate-500">
                {totalRows} ligne(s) · page {page}/{totalPages}
                {secAgo != null && (
                  <span className="ml-2 text-slate-600">
                    · Mis à jour il y a {secAgo}s
                  </span>
                )}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${methodePrix}-${depotId}-${page}-${loadingStock}`}
              variants={tableFade}
              initial="initial"
              animate="animate"
              exit="exit"
              className="overflow-x-auto rounded-xl border border-white/10"
            >
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-navy-950/50">
                  {["Article", "Dépôt", "Qté", "P.U.", "Valeur"].map((h) => (
                    <th
                      key={h}
                      className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 ${
                        h === "Valeur" || h === "P.U." ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingStock
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        {Array.from({ length: 5 }).map((__, j) => (
                          <td key={j} className="px-3 py-2">
                            <div className="h-4 animate-pulse rounded bg-white/10" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : lignes.length === 0
                    ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                            Aucun stock valorisable
                          </td>
                        </tr>
                      )
                    : lignes.map((l) => (
                        <tr
                          key={`${l.articleId}-${l.depotId}`}
                          className="cursor-pointer border-b border-white/5 transition-colors hover:bg-accent-500/5"
                        >
                          <td className="px-3 py-2">
                            <p className="text-slate-200">{l.articleLibelle}</p>
                            <p className="font-mono text-[10px] text-slate-500">{l.articleCode}</p>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-400">{l.depotCode}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{fmtNum(l.quantite, 2)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-amber-300">{fmtNum(l.prixUnitaire)}</td>
                          <td className="px-3 py-2 text-right font-mono text-sm font-semibold text-emerald-300">
                            {fmtNum(l.valeur)}
                          </td>
                        </tr>
                      ))}
              </tbody>
            </table>
            </motion.div>
          </AnimatePresence>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-slate-400">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-navy-900 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <BarChart3 className="h-5 w-5 text-sky-400" />
            <h2 className="text-sm font-semibold text-white">Historique CMP</h2>
          </div>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="w-full sm:w-64">
              <SearchableSelect
                value={articleId}
                onChange={setArticleId}
                options={articles.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.libelle}` }))}
                placeholder="Choisir un article"
                allowClear={false}
              />
            </div>
            <div className="w-full sm:w-48">
              <SearchableSelect
                value={cmpDepotId}
                onChange={setCmpDepotId}
                options={depots.map((d) => ({ value: String(d.id), label: d.code }))}
                placeholder="Dépôt CMP"
                clearLabel="—"
              />
            </div>
          </div>

          {!cmpDepotId ? (
            <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-white/10 bg-navy-950/30">
              <p className="text-center text-sm text-slate-400">
                Veuillez sélectionner un dépôt pour afficher le graphique CMP
              </p>
            </div>
          ) : !articleId ? (
            <p className="py-8 text-center text-sm text-slate-500">Sélectionnez un article</p>
          ) : loadingCmp ? (
            <div className="h-72 animate-pulse rounded-xl bg-white/5" />
          ) : cmpChartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aucun mouvement CMP enregistré</p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cmpChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="ancien"
                    name="Ancien CMP"
                    stroke={CMP_COLORS.ancien}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                    animationDuration={800}
                  />
                  <Line
                    type="monotone"
                    dataKey="nouveau"
                    name="Nouveau CMP"
                    stroke={CMP_COLORS.nouveau}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive
                    animationDuration={800}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-navy-900 p-5">
          <div className="mb-4 flex items-center gap-3">
            <Layers className="h-5 w-5 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Comparaison des méthodes</h2>
          </div>
          {!articleId || !cmpDepotId ? (
            <p className="text-sm text-slate-500">Choisissez un article et un dépôt ci-dessus</p>
          ) : loadingCompare ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {compareCards.map((c, i) => {
                const isSelected = methodePrix === c.methode;
                const isPrimary = VALORISATION_CARDS.includes(c.methode);
                const prixDate = c.methode === "DERNIER_PRIX_ACHAT" ? fmtDateShort(c.dateAchat) : null;
                const label =
                  METHODE_PRIX.find((m) => m.value === c.methode)?.label ||
                  c.methode.replace(/_/g, " ");

                return (
                  <motion.div
                    key={c.methode}
                    custom={isPrimary ? VALORISATION_CARDS.indexOf(c.methode) : i}
                    variants={cardMotion}
                    initial="hidden"
                    animate="visible"
                    onClick={() => setMethodePrix(c.methode)}
                    className={`relative cursor-pointer rounded-xl border bg-navy-950/50 p-4 transition-colors hover:border-violet-500/30 ${
                      isSelected
                        ? "border-accent-500/60 bg-accent-600/10"
                        : "border-white/10"
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        className="pointer-events-none absolute -inset-px rounded-xl border-2 border-accent-400/60"
                        animate={{ opacity: [0.25, 0.85, 0.25] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                        aria-hidden
                      />
                    )}
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
                    <p className="mt-1 font-mono text-lg font-bold text-violet-300">{fmtNum(c.valeurUnit)}</p>
                    {prixDate && (
                      <p className="mt-0.5 text-[10px] text-slate-500">Prix du {prixDate}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-400">
                      Qté {fmtNum(c.quantite, 2)} · Total{" "}
                      <span className="font-semibold text-emerald-300">{fmtNum(c.valeurTotale)}</span>
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
        </>
        )}
      </div>
    </PageShell>
  );
}
