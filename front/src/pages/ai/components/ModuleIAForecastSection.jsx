import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { ArrowDownUp, Package, Search } from "lucide-react";
import { resolveArticleImageUrl } from "../../../utils/articleImage";
import { FILTER_EXIT, FADE_UP, IA, hashColor, initials } from "../moduleIaTheme";

const DETAIL_BLUE = "#378ADD";
const DETAIL_CYAN = "#0EA5E9";

const PERIODS = [
  { id: "7j", days: 7, label: "7j" },
  { id: "14j", days: 14, label: "14j" },
  { id: "30j", days: 30, label: "30j" },
  { id: "3mois", days: 90, label: "3mois" },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="text-xs"
      style={{
        background: "var(--bg-modal)",
        border: `1px solid ${IA.border}`,
        borderRadius: 12,
        padding: "12px 16px",
        boxShadow: "0 8px 32px color-mix(in srgb, var(--text-primary) 18%, transparent)",
        fontFamily: IA.fontBody,
      }}
    >
      <p className="mb-2 font-bold" style={{ color: IA.accent }}>
        {label}
      </p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value ?? "—"}
        </p>
      ))}
    </div>
  );
}

function ProductImage({ produit }) {
  const [hover, setHover] = useState(false);
  const [failed, setFailed] = useState(false);
  const url = produit.image_url ? resolveArticleImageUrl(produit.image_url) : null;
  const color = hashColor(produit.nom);

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full"
        style={{
          boxShadow: `0 0 0 2px ${DETAIL_CYAN}33, 0 8px 18px -10px ${DETAIL_BLUE}88`,
          background: IA.bgCard,
        }}
      >
        {url && !failed ? (
          <img
            src={url}
            alt={produit.nom}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${color}55, ${DETAIL_BLUE}33)`,
            }}
          >
            {initials(produit.nom)}
          </div>
        )}
      </div>
      <AnimatePresence>
        {hover && url && !failed ? (
          <motion.img
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.25, duration: 0.2 }}
            src={url}
            alt=""
            className="absolute left-14 top-0 z-20 h-[120px] w-[120px] rounded-xl object-cover shadow-xl"
            style={{ border: `1px solid ${DETAIL_CYAN}55` }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const color = pct > 80 ? DETAIL_CYAN : pct >= 60 ? IA.yellow : IA.red;
  return (
    <div className="flex min-w-[110px] items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full"
        style={{ background: IA.track }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${DETAIL_BLUE})` }}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <span className="w-8 text-right text-xs font-semibold tabular-nums" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

function TrendBadge({ tendance }) {
  const t = Number(tendance) || 0;
  const config =
    t > 0
      ? { arrow: "↑", bg: "rgba(14,165,233,0.14)", color: DETAIL_CYAN, label: `+${t}%` }
      : t < 0
        ? { arrow: "↓", bg: "rgba(255,107,122,0.12)", color: IA.red, label: `${t}%` }
        : { arrow: "→", bg: "rgba(107,114,128,0.12)", color: IA.muted, label: "0%" };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
      style={{ background: config.bg, color: config.color }}
    >
      {config.arrow} {config.label}
    </span>
  );
}

export default function ModuleIAForecastSection({ prevision }) {
  const [period, setPeriod] = useState("30j");
  const [productId, setProductId] = useState("all");
  const [showConfidence, setShowConfidence] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "prevision4sem", dir: "desc" });

  const produits = prevision?.produits || [];
  const chartSource = prevision?.data || [];

  const filteredChart = useMemo(() => {
    const slice = PERIODS.find((p) => p.id === period)?.days || 30;
    return chartSource.slice(-Math.min(slice, chartSource.length));
  }, [chartSource, period]);

  const maxPrevision = useMemo(
    () => Math.max(...produits.map((p) => p.prevision4sem || 0), 1),
    [produits]
  );

  const filteredProducts = useMemo(() => {
    let rows = [...produits];
    if (productId !== "all") rows = rows.filter((p) => String(p.id) === String(productId));
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) => p.nom?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string") return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === "asc" ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
    });
    return rows;
  }, [produits, productId, search, sort]);

  const toggleSort = useCallback((key) => {
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "desc" ? "asc" : "desc",
    }));
  }, []);

  const filterKey = `${period}-${productId}-${showConfidence}`;

  return (
    <motion.section
      variants={FADE_UP}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className="rounded-2xl p-5"
      style={{
        background: `linear-gradient(135deg, ${IA.bgCard} 0%, ${IA.bgCardEnd} 100%)`,
        border: `1px solid ${IA.border}`,
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          className="flex items-center gap-2 text-lg font-bold"
          style={{ fontFamily: IA.fontTitle, color: IA.text }}
        >
          Ce qui va se vendre
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                style={
                  period === p.id
                    ? {
                        background: `linear-gradient(135deg, ${IA.accent}, ${IA.violet})`,
                        color: IA.onAccent,
                      }
                    : {
                        background: IA.fill,
                        border: `1px solid ${IA.border}`,
                        color: IA.muted,
                      }
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-xs outline-none"
            style={{
              background: IA.bgElevated,
              border: `1px solid ${IA.border}`,
              color: IA.text,
              fontFamily: IA.fontBody,
            }}
          >
            <option value="all">Tous les produits</option>
            {produits.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom} ({p.tendance > 0 ? "↑" : p.tendance < 0 ? "↓" : "→"})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowConfidence((v) => !v)}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ fontFamily: IA.fontBody, color: IA.text }}
          >
            <span
              className="relative inline-flex h-5 w-9 items-center rounded-full transition"
              style={{ background: showConfidence ? IA.accent : IA.track }}
            >
              <motion.span
                className="inline-block h-4 w-4 rounded-full bg-white shadow"
                animate={{ x: showConfidence ? 18 : 2 }}
                transition={{ duration: 0.2 }}
              />
            </span>
            Intervalle de confiance
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={filterKey}
          {...FILTER_EXIT}
          className="h-72 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredChart}>
              <CartesianGrid stroke={IA.track} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: IA.muted, fontSize: 11, fontFamily: IA.fontBody }}
              />
              <YAxis tick={{ fill: IA.muted, fontSize: 11, fontFamily: IA.fontBody }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, fontFamily: IA.fontBody, color: IA.muted }}
              />
              {showConfidence ? (
                <Area
                  type="monotone"
                  dataKey="confMax"
                  stroke="none"
                  fill="rgba(0,245,196,0.06)"
                  name="Intervalle max"
                  legendType="none"
                />
              ) : null}
              {showConfidence ? (
                <Area
                  type="monotone"
                  dataKey="confMin"
                  stroke="none"
                  fill={IA.bgCard}
                  name="Intervalle min"
                  legendType="none"
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="prevision"
                stroke={IA.accent}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, fill: IA.accent, stroke: IA.bg, strokeWidth: 2 }}
                name="Prévision"
              />
              <Line
                type="monotone"
                dataKey="reel"
                stroke={IA.violet}
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                name="Demande réelle"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>
      </AnimatePresence>

      {/* Table produits — style cockpit Lots */}
      <div
        className="relative mt-6 overflow-hidden rounded-2xl border"
        style={{
          borderColor: "rgba(56,189,248,0.18)",
          background:
            "linear-gradient(165deg, rgba(17,34,66,0.92) 0%, rgba(12,22,40,0.96) 100%)",
          boxShadow: "0 16px 40px -20px rgba(0,0,0,0.55)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(125,211,252,0.45), transparent)",
          }}
          aria-hidden
        />

        <div
          className="flex flex-wrap items-center gap-3 border-b px-4 py-3.5"
          style={{ borderColor: "rgba(56,189,248,0.12)" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{
                background: "rgba(55,138,221,0.16)",
                color: DETAIL_CYAN,
                boxShadow: "inset 0 0 0 1px rgba(56,189,248,0.25)",
              }}
            >
              <Package size={15} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: IA.textSecondary }}>
                Catalogue prévisionnel
              </p>
              <p className="text-[11px]" style={{ color: IA.muted }}>
                Aperçu {filteredProducts.length} SKU — le catalogue complet est dans l&apos;onglet Prévision
              </p>
            </div>
          </div>

          <label
            className="ml-auto flex min-w-[200px] items-center gap-2 rounded-xl border px-3 py-2"
            style={{
              background: IA.bgElevated,
              borderColor: IA.border,
            }}
          >
            <Search size={14} style={{ color: DETAIL_CYAN }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-placeholder)]"
              style={{ fontFamily: IA.fontBody, color: IA.text }}
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm" style={{ fontFamily: IA.fontBody }}>
            <thead>
              <tr
                className="text-[10px] uppercase tracking-wider"
                style={{ color: IA.muted }}
              >
                {[
                  { key: "image", label: "Article", sortable: false },
                  { key: "nom", label: "Produit", sortable: true },
                  { key: "prevision4sem", label: "Prévision 4 sem.", sortable: true },
                  { key: "tendance", label: "Tendance", sortable: true },
                  { key: "confiance", label: "Confiance", sortable: true },
                ].map((col) => (
                  <th key={col.key} className="px-4 py-3 font-semibold">
                    {col.sortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 transition"
                        onClick={() => toggleSort(col.key)}
                        style={{
                          color: sort.key === col.key ? IA.accent : IA.muted,
                        }}
                      >
                        {col.label}
                        <ArrowDownUp size={12} className="opacity-70" />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: IA.muted }}>
                    Aucun produit pour cette recherche.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.25) }}
                    className="group border-t transition-colors"
                    style={{ borderColor: "rgba(56,189,248,0.08)" }}
                    whileHover={{ backgroundColor: "rgba(55,138,221,0.08)" }}
                  >
                    <td className="px-4 py-3">
                      <ProductImage produit={p} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold" style={{ color: IA.text }}>{p.nom}</p>
                      <p className="font-mono text-[11px]" style={{ color: DETAIL_CYAN }}>
                        {p.code}
                      </p>
                      {p.modele ? (
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide" style={{ color: IA.muted }}>
                          {String(p.modele).replace(/_/g, " ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold tabular-nums" style={{ color: DETAIL_CYAN }}>
                        {Number(p.prevision4sem || 0).toLocaleString("fr-FR")}
                      </p>
                      <div
                        className="mt-1.5 h-1 w-28 overflow-hidden rounded-full"
                        style={{ background: "rgba(56,189,248,0.12)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${((p.prevision4sem || 0) / maxPrevision) * 100}%`,
                            background: `linear-gradient(90deg, ${DETAIL_BLUE}, ${DETAIL_CYAN})`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TrendBadge tendance={p.tendance} />
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBar value={p.confiance} />
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.section>
  );
}
