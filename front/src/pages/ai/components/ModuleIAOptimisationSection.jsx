import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  ArrowLeftRight,
  Check,
  Eye,
  Info,
  Loader2,
  PackagePlus,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import api from "../../../services/api";
import StockPagination from "../../../components/stock/StockPagination";
import { APPLY_COPY, FILTER_EXIT, FADE_UP, IA, surfaceStyle } from "../moduleIaTheme";
import ModuleIAJourney from "./ModuleIAJourney";

const EASE = [0.22, 1, 0.36, 1];

const ACTION_META = {
  reapprovisionner: { Icon: PackagePlus, color: "#16a34a", label: "Réappro" },
  reduire: { Icon: TrendingDown, color: "#dc2626", label: "Réduire" },
  transferer: { Icon: ArrowLeftRight, color: "#7c3aed", label: "Transfert" },
  surveiller: { Icon: Eye, color: "#d97706", label: "Veille" },
};

const PRIORITY_STYLES = {
  urgent: { bg: "color-mix(in srgb, var(--accent-danger) 16%, transparent)", color: "var(--accent-danger)", label: "Urgent" },
  normal: { bg: "color-mix(in srgb, var(--accent-warning) 14%, transparent)", color: "var(--accent-warning)", label: "Normal" },
  faible: { bg: "var(--bg-hover)", color: "var(--text-muted)", label: "Faible" },
};

const FACT_STEPS = [
  { key: "problem", label: "Problème" },
  { key: "analysis", label: "Analyse" },
  { key: "recommendation", label: "Reco" },
  { key: "impact", label: "Impact" },
];

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-xl px-4 py-3 text-xs"
      style={{
        background: "var(--bg-modal)",
        border: `1px solid ${IA.border}`,
        color: IA.text,
        fontFamily: IA.fontBody,
      }}
    >
      <p className="font-bold" style={{ color: d.color }}>
        {d.name}
      </p>
      <p>{d.value} action(s)</p>
    </div>
  );
}

function applyLabel(item) {
  const copy = APPLY_COPY[item.type] || APPLY_COPY.surveiller;
  if (item.type === "reapprovisionner") {
    return `${copy.recommendation} · ${item.quantite} u.`;
  }
  if (item.type === "transferer") {
    const from = item.depotSourceNom || "source";
    const to = item.depotCibleNom || item.depotNom || "cible";
    return `Transférer ${item.quantite} u. · ${from} → ${to}`;
  }
  if (item.type === "reduire") {
    return copy.recommendation;
  }
  return copy.recommendation;
}

function factValue(item, copy, key) {
  if (key === "problem") return copy.problem;
  if (key === "analysis") return item.rationale || copy.analysis;
  if (key === "recommendation") return applyLabel(item);
  return copy.impact;
}

function RecommendationRow({ item, onApply, applied, applying, feedback, index }) {
  const reduceMotion = useReducedMotion();
  const meta = ACTION_META[item.type] || ACTION_META.surveiller;
  const ActionIcon = meta.Icon;
  const prio = PRIORITY_STYLES[item.priorite] || PRIORITY_STYLES.normal;
  const copy = APPLY_COPY[item.type] || APPLY_COPY.surveiller;
  const depotLine =
    item.type === "transferer" && item.depotSourceNom
      ? `${item.depotSourceNom} → ${item.depotCibleNom || item.depotNom}`
      : item.depotNom || "";
  const confidence = Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : null;
  const urgency = item.urgence || 50;

  return (
    <motion.article
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.24), duration: 0.38, ease: EASE }}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -4, boxShadow: `0 18px 36px -16px ${meta.color}66` }
      }
      className="ia-studio-card group relative overflow-hidden rounded-2xl p-4"
      style={{
        "--card-accent": meta.color,
        background: IA.bgCard,
        border: `1px solid ${applied ? `${meta.color}44` : IA.border}`,
        borderLeft: `3px solid ${meta.color}`,
        opacity: applied ? 0.78 : 1,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${meta.color}22, transparent 55%)`,
        }}
        aria-hidden
      />
      <ActionIcon
        className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 opacity-[0.07] transition-transform duration-500 group-hover:scale-110"
        style={{ color: meta.color }}
        strokeWidth={1}
        aria-hidden
      />

      <div className="relative z-[1] flex gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: `linear-gradient(145deg, ${meta.color}24, transparent)`,
            color: meta.color,
            boxShadow: `inset 0 0 0 1px ${meta.color}33`,
          }}
        >
          <ActionIcon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: IA.text }}>
                {item.titre}
              </p>
              <p className="text-xs" style={{ color: IA.muted }}>
                {item.produit}
                {depotLine ? ` · ${depotLine}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ background: `${meta.color}18`, color: meta.color }}
              >
                {meta.label}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ background: prio.bg, color: prio.color }}
              >
                {item.priorite === "urgent" && !reduceMotion ? (
                  <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: prio.color }} />
                ) : null}
                {prio.label}
              </span>
            </div>
          </div>

          <ol className="mt-3 grid gap-2 sm:grid-cols-4">
            {FACT_STEPS.map((step, i) => (
              <li
                key={step.key}
                className="relative rounded-xl px-2.5 py-2"
                style={{ background: IA.fill, border: `1px solid ${IA.border}` }}
              >
                <p className="mb-0.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: IA.muted }}>
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black"
                    style={{ background: `${meta.color}22`, color: meta.color }}
                  >
                    {i + 1}
                  </span>
                  {step.label}
                </p>
                <p className="text-[11px] leading-snug" style={{ color: IA.textSecondary }}>
                  {factValue(item, copy, step.key)}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-[140px] flex-1">
              <div className="mb-1 flex justify-between text-[10px]">
                <span style={{ color: IA.muted }}>Priorité opérationnelle</span>
                <span className="font-mono" style={{ color: meta.color }}>
                  {urgency}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: IA.track }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}99)` }}
                  initial={reduceMotion ? false : { width: 0 }}
                  whileInView={{ width: `${urgency}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: EASE }}
                />
              </div>
            </div>
            <span className="font-mono text-[11px]" style={{ color: IA.muted }}>
              {confidence != null ? `Confiance ${confidence}%` : "Confiance non exposée"}
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={applied || applying}
              onClick={() => onApply(item)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed"
              style={{
                background: applied ? `${meta.color}14` : IA.accent,
                color: applied ? meta.color : IA.onAccent,
                border: `1px solid ${applied ? `${meta.color}44` : "transparent"}`,
              }}
            >
              {applying ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Application…
                </>
              ) : applied ? (
                <>
                  <Check size={14} /> Appliqué
                </>
              ) : (
                "Appliquer"
              )}
            </button>
            <p className="text-[11px] leading-snug" style={{ color: IA.muted }}>
              {applied ? feedback || copy.done : copy.actionHint}
            </p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function ModuleIAOptimisationSection({
  optimisation,
  onApplied,
  showJourney = false,
  onNavigate,
}) {
  const reduceMotion = useReducedMotion();
  const [depotId, setDepotId] = useState("all");
  const [action, setAction] = useState("all");
  const [priority, setPriority] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [applied, setApplied] = useState(() => {
    const initial = new Set();
    for (const r of optimisation?.recommandations || []) {
      if (r.applied) initial.add(r.fingerprint || r.id);
    }
    return initial;
  });
  const [applyingId, setApplyingId] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");

  const donut = optimisation?.donut || [];
  const depots = optimisation?.depots || [];
  const recommandations = optimisation?.recommandations || [];

  const total = useMemo(() => donut.reduce((s, d) => s + d.value, 0), [donut]);
  const openCount = useMemo(
    () => recommandations.filter((r) => !r.applied && !applied.has(r.fingerprint || r.id)).length,
    [recommandations, applied]
  );

  const filtered = useMemo(() => {
    return recommandations.filter((r) => {
      if (depotId !== "all" && String(r.depotId) !== String(depotId) && String(r.depotSourceId) !== String(depotId)) {
        return false;
      }
      if (action !== "all" && r.type !== action) return false;
      if (priority !== "all" && r.priorite !== priority) return false;
      return true;
    });
  }, [recommandations, depotId, action, priority]);

  const filterKey = `${depotId}-${action}-${priority}`;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filtered.length);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleApply = async (item) => {
    const key = item.fingerprint || item.id;
    const copy = APPLY_COPY[item.type] || APPLY_COPY.surveiller;
    setError("");
    setBanner("");
    setApplyingId(key);
    try {
      const { data } = await api.post("ia/recommandations/apply", {
        type: item.type,
        articleId: item.articleId,
        depotId: item.depotId,
        depotSourceId: item.depotSourceId,
        depotCibleId: item.depotCibleId || item.depotId,
        quantite: item.quantite,
        fingerprint: item.fingerprint,
      });
      const message = data?.message || copy.done;
      setApplied((s) => new Set(s).add(key));
      setFeedback((prev) => ({ ...prev, [key]: message }));
      setBanner(message);
      onApplied?.();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Impossible d'enregistrer la décision."
      );
    } finally {
      setApplyingId(null);
    }
  };

  const toggleAction = (key) => {
    setAction((prev) => (prev === key ? "all" : key));
  };

  return (
    <motion.section
      variants={FADE_UP}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className="relative overflow-hidden p-5"
      style={surfaceStyle()}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 50% 80% at 0% 0%, color-mix(in srgb, var(--accent-primary) 12%, transparent), transparent 55%), radial-gradient(ellipse 40% 50% at 100% 0%, color-mix(in srgb, var(--accent-info) 10%, transparent), transparent 50%)",
        }}
        aria-hidden
      />

      <div className="relative z-[1]">
        {showJourney ? (
          <div className="mb-4">
            <ModuleIAJourney active="decision" onNavigate={onNavigate} />
          </div>
        ) : null}

        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: IA.muted }}>
              Organisation du stock
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-bold" style={{ fontFamily: IA.fontTitle, color: IA.text }}>
              <Sparkles size={18} style={{ color: IA.accent }} />
              Comment mieux s&apos;organiser
            </h2>
            <p className="mt-0.5 max-w-xl text-[12px]" style={{ color: IA.muted }}>
              Appliquer journalise une décision IA. Cela n’exécute ni achat, ni mouvement, ni
              transfert de stock.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-3 py-1.5 font-mono text-[12px] font-bold"
              style={{ background: IA.accentDim, color: IA.accent, border: `1px solid ${IA.borderStrong}` }}
            >
              {openCount} ouverte{openCount > 1 ? "s" : ""}
            </span>
            <select
              value={depotId}
              onChange={(e) => setDepotId(e.target.value)}
              className="rounded-full px-3 py-1.5 text-xs outline-none"
              style={{ background: IA.bgElevated, border: `1px solid ${IA.border}`, color: IA.text }}
            >
              <option value="all">Tous les dépôts</option>
              {depots.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.libelle || d.code}
                </option>
              ))}
            </select>
            {["all", "urgent", "normal", "faible"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
                style={
                  priority === p
                    ? { background: IA.accentDim, color: IA.accent, border: `1px solid ${IA.borderStrong}` }
                    : { background: IA.fill, color: IA.muted, border: `1px solid ${IA.border}` }
                }
              >
                {p === "all" ? "Toutes" : p}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.4fr)]">
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-2xl p-4"
            style={{ background: IA.panel, border: `1px solid ${IA.border}` }}
          >
            <div className="relative h-52 w-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donut.length ? donut : [{ name: "Vide", value: 1, color: IA.track }]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={donut.length ? 4 : 0}
                    onClick={(_, idx) => {
                      const row = donut[idx];
                      if (row?.key) toggleAction(row.key);
                    }}
                    style={{ cursor: donut.length ? "pointer" : "default" }}
                  >
                    {(donut.length ? donut : [{ color: IA.track }]).map((entry, i) => (
                      <Cell key={entry.key || entry.name || i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: IA.muted }}>
                  Mix
                </span>
                <span className="text-3xl font-black tabular-nums" style={{ fontFamily: IA.fontTitle, color: IA.text }}>
                  {total}
                </span>
                <span className="text-[11px]" style={{ color: IA.muted }}>
                  ouvertes
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {Object.entries(ACTION_META).map(([key, meta], i) => {
              const Icon = meta.Icon;
              const count = donut.find((d) => d.key === key)?.value || 0;
              const pct = total ? Math.round((count / total) * 100) : 0;
              const active = action === key;
              return (
                <motion.button
                  key={key}
                  type="button"
                  onClick={() => toggleAction(key)}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.35, ease: EASE }}
                  whileHover={reduceMotion ? undefined : { y: -3 }}
                  className="relative overflow-hidden rounded-2xl p-3.5 text-left"
                  style={{
                    background: active ? `${meta.color}14` : IA.bgCard,
                    border: `1px solid ${active ? meta.color : IA.border}`,
                  }}
                  aria-pressed={active}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: `${meta.color}18`, color: meta.color }}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="font-mono text-lg font-bold tabular-nums" style={{ color: meta.color }}>
                      {count}
                    </span>
                  </div>
                  <p className="text-[12px] font-semibold" style={{ color: IA.text }}>
                    {meta.label}
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: IA.track }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: meta.color }}
                      initial={reduceMotion ? false : { width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: EASE }}
                    />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {banner ? (
          <div
            className="mb-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px]"
            style={{ background: IA.accentDim, border: `1px solid ${IA.borderStrong}`, color: IA.accent }}
            role="status"
          >
            <Check size={14} className="mt-0.5 shrink-0" />
            {banner}
          </div>
        ) : null}

        {error ? (
          <p className="mb-3 text-xs" style={{ color: IA.red }} role="alert">
            {error}
          </p>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div key={`${filterKey}-${safePage}-${pageSize}`} {...FILTER_EXIT} className="space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl px-4 py-14 text-center" style={{ border: `1px dashed ${IA.border}` }}>
                <Info size={18} className="mx-auto mb-2" style={{ color: IA.muted }} />
                <p className="text-sm font-medium" style={{ color: IA.textSecondary }}>
                  Aucune recommandation pour ces filtres.
                </p>
                <p className="mt-1 text-[12px]" style={{ color: IA.muted }}>
                  Élargissez le dépôt, le type d’action ou la priorité.
                </p>
              </div>
            ) : (
              pageRows.map((item, i) => {
                const key = item.fingerprint || item.id;
                return (
                  <RecommendationRow
                    key={key}
                    item={item}
                    index={i}
                    applied={applied.has(key) || item.applied}
                    applying={applyingId === key}
                    feedback={feedback[key]}
                    onApply={handleApply}
                  />
                );
              })
            )}
          </motion.div>
        </AnimatePresence>

        {filtered.length > 0 ? (
          <StockPagination
            className="mt-4"
            page={safePage}
            totalPages={totalPages}
            totalResults={filtered.length}
            pageSize={pageSize}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            unitLabel="recommandation(s)"
            pageSizeOptions={[4, 6, 8, 12]}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        ) : null}
      </div>
    </motion.section>
  );
}
