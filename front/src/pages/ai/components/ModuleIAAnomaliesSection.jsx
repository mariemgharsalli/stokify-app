import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Eye,
  Package,
  Radar,
  ShieldAlert,
  Warehouse,
  X,
} from "lucide-react";
import ArticleAvatar from "../../../components/ui/ArticleAvatar";
import { getArticleRealImageUrl } from "../../../utils/articleImage";
import { FADE_UP, IA, formatRelativeTime, surfaceStyle } from "../moduleIaTheme";

const SEVERITY_COLORS = { elevee: IA.red, moyenne: IA.yellow, faible: IA.muted };
const SEVERITY_LABELS = { elevee: "Élevée", moyenne: "Moyenne", faible: "Faible" };
const EASE = [0.22, 1, 0.36, 1];
const PER_PAGE = 6;
const DETAIL_BLUE = "#378ADD";
const DETAIL_CYAN = "#0EA5E9";

function articleFromAnomaly(item) {
  return {
    id: item.articleId,
    code: item.articleCode,
    libelle: item.produit,
    imageUrl: item.imageUrl,
  };
}

const TIME_FILTERS = [
  { id: "all", label: "Tout" },
  { id: "today", label: "Aujourd'hui" },
  { id: "7d", label: "7 jours" },
  { id: "month", label: "Ce mois" },
];

function explainAnomaly(item) {
  const isStock = item.source === "stock" || item.type === "rupture";
  const score = Number(item.score) || 0;
  const color = SEVERITY_COLORS[item.severite] || IA.muted;

  let plain =
    item.description ||
    item.recommandation ||
    "Comportement inhabituel détecté par l'IA.";

  if (isStock) {
    plain =
      score >= 90
        ? "Rupture : quantité nulle. Les sorties et commandes sont bloquées jusqu'au réappro ou transfert."
        : "Stock sous le seuil d'alerte. Sans action, une rupture est probable à court terme.";
  } else if (item.type === "pic_demande") {
    plain =
      "Pic de quantité par rapport à l'historique 90 jours. Validez s'il s'agit d'une vraie demande ou d'une erreur de saisie.";
  } else if (item.type === "delai") {
    plain = "Écart de rythme / délai inhabituel détecté sur les mouvements de cet article.";
  }

  const causes = isStock
    ? [
        "Sorties plus rapides que les entrées",
        "Réappro non déclenché à temps",
        "Transfert inter-dépôts non réalisé",
      ]
    : [
        "Pic ou creux de demande réel",
        "Erreur de saisie de quantité",
        "Mouvement exceptionnel (inventaire, retour…)",
      ];

  const actions = isStock
    ? [
        "Réapprovisionner ou transférer depuis un dépôt en surplus",
        "Vérifier les commandes clients en attente",
        "Ajuster le seuil si la rotation a changé",
      ]
    : [
        "Ouvrir le mouvement source et valider la quantité",
        "Comparer avec ventes / achats du jour",
        "Marquer comme normal si le comportement est justifié",
      ];

  const method = isStock
    ? "Règle métier : quantité vs seuilAlerte / stockMin (temps réel)."
    : "Ensemble IsolationForest + LOF + autoencodeur profond (goulot 4) + AE séquence 14j. Calibrateur supervisé persisté (confirmer / marquer normal). Fallback règles locales si FastAPI offline.";

  return { isStock, score, color, plain, causes, actions, method };
}

function AnomalyCounter({ count, avgSeverity, page, pages }) {
  const reduceMotion = useReducedMotion();
  const r = 48;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, avgSeverity || count * 8);
  const color = avgSeverity >= 60 ? IA.red : avgSeverity >= 40 ? IA.yellow : IA.accent;

  return (
    <div
      className="sticky top-24 flex flex-col items-center justify-center rounded-2xl p-4"
      style={{
        background: `radial-gradient(ellipse 70% 60% at 50% 30%, ${color}18, transparent 60%), ${IA.bgElevated}`,
        border: `1px solid ${IA.border}`,
      }}
    >
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
        style={{ background: `${color}18`, color }}
      >
        <Radar size={11} /> Radar
      </div>
      <div className="relative">
        {!reduceMotion ? (
          <motion.span
            className="absolute inset-2 rounded-full"
            style={{ border: `1px solid ${color}44` }}
            animate={{ scale: [1, 1.12], opacity: [0.45, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
            aria-hidden
          />
        ) : null}
        <svg viewBox="0 0 120 120" className="h-32 w-32">
          <circle cx="60" cy="60" r={r} fill="none" stroke={IA.track} strokeWidth="7" />
          <motion.circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            whileInView={{ strokeDashoffset: c - (pct / 100) * c }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            transform="rotate(-90 60 60)"
            style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
          />
          <text
            x="60"
            y="56"
            textAnchor="middle"
            fill="white"
            fontSize="28"
            fontWeight="800"
            fontFamily={IA.fontTitle}
          >
            {count}
          </text>
          <text x="60" y="74" textAnchor="middle" fill={IA.muted} fontSize="9">
            score moy. {Math.round(avgSeverity || 0)}
          </text>
        </svg>
      </div>
      {pages > 1 ? (
        <p className="mt-2 text-[11px]" style={{ color: IA.muted }}>
          Page {page + 1}/{pages}
        </p>
      ) : (
        <p className="mt-2 text-center text-[11px]" style={{ color: IA.muted }}>
          Signaux filtrés
        </p>
      )}
    </div>
  );
}

function MiniSparkline({ data, color }) {
  const chartData = (data || []).map((v, i) => ({ i, v: Number(v) || 0 }));
  if (!chartData.length) return null;
  return (
    <div className="h-8 w-[100px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScoreRing({ score, color, size = 56, children }) {
  const stroke = size >= 100 ? 8 : 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const offset = c - (pct / 100) * c;
  const inner = size - stroke * 2 - (size >= 100 ? 10 : 4);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(148,163,184,0.18)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: EASE }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full"
        style={{
          width: inner,
          height: inner,
          background: IA.bgCard,
          boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.12)",
        }}
      >
        {children}
      </div>
      <span
        className="absolute -bottom-0.5 left-1/2 z-[1] -translate-x-1/2 rounded-md px-1.5 py-px text-[9px] font-bold tabular-nums text-white"
        style={{
          background: `linear-gradient(135deg, ${color}, ${IA.accent})`,
          boxShadow: `0 2px 8px -2px ${color}99`,
        }}
      >
        {Math.round(pct)}
      </span>
    </div>
  );
}

function AnomalyArticleThumb({ article, size = 32 }) {
  const imgSrc = getArticleRealImageUrl(article);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    setImgErr(false);
  }, [imgSrc, article?.id, article?.imageUrl]);

  if (imgSrc && !imgErr) {
    return (
      <img
        src={imgSrc}
        alt={article?.libelle || article?.code || "Article"}
        onError={() => setImgErr(true)}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <ArticleAvatar article={article} size={size} className="!rounded-full !border-0 !bg-transparent" />
  );
}

function DetailMetric({ label, value, color }) {
  return (
    <div
      className="rounded-xl border px-3 py-1.5"
      style={{ borderColor: `${color}33`, background: `${color}14` }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "rgba(125,211,252,0.45)" }}>
        {label}
      </p>
      <p className="text-sm font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function DetailDrawer({ item, onClose }) {
  const ex = explainAnomaly(item);
  const article = articleFromAnomaly(item);
  const reduceMotion = useReducedMotion();
  const imgSrc = getArticleRealImageUrl(article);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    setImgErr(false);
  }, [imgSrc, article?.id, article?.imageUrl]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="pointer-events-auto fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: "color-mix(in srgb, var(--text-primary) 45%, transparent)", backdropFilter: "blur(8px)" }}
        aria-hidden
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="anomaly-detail-title"
        className="relative z-[1] flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: "var(--bg-modal)",
          borderColor: IA.border,
          boxShadow:
            "0 24px 64px -16px rgba(0,0,0,0.65), inset 0 1px 0 rgba(125,211,252,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
        initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(125,211,252,0.5), transparent)",
          }}
          aria-hidden
        />

        {/* Cockpit header — même langage que LotDetailModal */}
        <div
          className="relative shrink-0 border-b px-5 pb-5 pt-5"
          style={{ borderColor: "rgba(56,189,248,0.14)" }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 50% 80% at 0% 50%, rgba(55,138,221,0.22), transparent 55%), radial-gradient(ellipse 40% 50% at 100% 0%, rgba(6,182,212,0.12), transparent 50%)",
            }}
            aria-hidden
          />

          <div className="relative flex items-start justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: IA.muted }}>
              Cockpit anomalie · diagnostic IA
            </p>
            <motion.button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border"
              style={{ borderColor: IA.border, color: IA.textSecondary }}
              aria-label="Fermer"
              whileHover={reduceMotion ? undefined : { scale: 1.05, backgroundColor: "var(--bg-hover)" }}
              whileTap={reduceMotion ? undefined : { scale: 0.95 }}
            >
              <X className="h-4 w-4" />
            </motion.button>
          </div>

          <div className="relative mt-4 grid gap-5 sm:grid-cols-[120px_1fr] sm:items-center">
            <ScoreRing score={ex.score} color={ex.color} size={112}>
              {imgSrc && !imgErr ? (
                <img
                  src={imgSrc}
                  alt={article.libelle || "Article"}
                  onError={() => setImgErr(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="h-8 w-8" style={{ color: DETAIL_CYAN }} aria-hidden />
              )}
            </ScoreRing>

            <div className="min-w-0 space-y-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: `${ex.color}22`, color: ex.color }}
                >
                  {SEVERITY_LABELS[item.severite] || "—"}
                </span>
                <span
                  className="rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: IA.accentDim, color: IA.accent }}
                >
                  {ex.isStock ? "Alerte stock" : "Mouvement ML"}
                </span>
              </div>

              <div>
                <h2
                  id="anomaly-detail-title"
                  className="truncate font-mono text-xl font-bold tracking-tight sm:text-2xl"
                  style={{ color: DETAIL_CYAN }}
                >
                  {item.articleCode || "—"}
                </h2>
                <p className="mt-0.5 truncate text-sm font-medium" style={{ color: IA.text }}>
                  {item.produit || item.titre}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[12px]" style={{ color: IA.muted }}>{item.titre}</p>
              </div>

              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: IA.textSecondary }}>
                <span className="inline-flex items-center gap-1">
                  <Warehouse className="h-3.5 w-3.5 text-cyan-300" />
                  {item.depot || "—"}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatRelativeTime(item.timestamp)}
                </span>
              </p>

              <div className="flex flex-wrap gap-2">
                <DetailMetric label="Score" value={`${Math.round(ex.score)}/100`} color={ex.color} />
                <DetailMetric
                  label="Source"
                  value={ex.isStock ? "Stock" : "ML"}
                  color={DETAIL_CYAN}
                />
                <DetailMetric
                  label="Type"
                  value={item.type?.replace("_", " ") || "—"}
                  color="#7dd3fc"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: IA.muted }}>
              <ShieldAlert size={11} /> Diagnostic
            </p>
            <p
              className="rounded-xl border p-3 text-[13px] leading-relaxed"
              style={{ background: IA.fill, borderColor: IA.border, color: IA.text }}
            >
              {item.description || item.titre}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: IA.textSecondary }}>{ex.plain}</p>
          </section>

          <section>
            <div className="mb-1.5 flex justify-between text-[11px]" style={{ color: IA.muted }}>
              <span>Gravité</span>
              <span className="font-mono font-bold" style={{ color: ex.color }}>
                {Math.round(ex.score)}/100
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: IA.track }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${ex.color}, ${DETAIL_CYAN})` }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, ex.score)}%` }}
                transition={{ duration: 0.7 }}
              />
            </div>
          </section>

          {item.sparkline?.length ? (
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: IA.muted }}>
                <Activity size={11} /> Activité récente
              </p>
              <div
                className="rounded-xl border p-3"
                style={{ borderColor: IA.border, background: IA.fill }}
              >
                <MiniSparkline data={item.sparkline} color={DETAIL_CYAN} />
              </div>
            </section>
          ) : null}

          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: IA.muted }}>
              Causes possibles
            </p>
            <ul className="space-y-1.5">
              {ex.causes.map((c) => (
                <li key={c} className="flex items-start gap-2 text-[12px]" style={{ color: IA.textSecondary }}>
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: DETAIL_CYAN }}
                  />
                  {c}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: IA.muted }}>
              Que faire
            </p>
            <ol className="space-y-2">
              {ex.actions.map((a, i) => (
                <li
                  key={a}
                  className="flex gap-2.5 rounded-xl border px-3 py-2 text-[12px]"
                  style={{
                    background: IA.fill,
                    borderColor: IA.border,
                    color: IA.textSecondary,
                  }}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${DETAIL_BLUE}, ${DETAIL_CYAN})` }}
                  >
                    {i + 1}
                  </span>
                  {a}
                </li>
              ))}
            </ol>
          </section>

          {item.recommandation ? (
            <section
              className="rounded-xl border p-3 text-[12px] leading-relaxed"
              style={{
                background: IA.accentDim,
                borderColor: IA.borderStrong,
                color: IA.textSecondary,
              }}
            >
              <p className="mb-1 font-semibold" style={{ color: DETAIL_CYAN }}>
                Recommandation IA
              </p>
              {item.recommandation}
            </section>
          ) : null}

          <section
            className="rounded-xl border border-dashed p-3"
            style={{ borderColor: "rgba(56,189,248,0.2)" }}
          >
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: IA.muted }}>
              <CircleHelp size={11} /> Méthode
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: IA.muted }}>{ex.method}</p>
          </section>
        </div>

        <div
          className="flex flex-wrap gap-2 border-t p-4"
          style={{ borderColor: "rgba(56,189,248,0.14)" }}
        >
          <motion.button
            type="button"
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white"
            style={{
              background: `linear-gradient(135deg, ${DETAIL_BLUE}, ${DETAIL_CYAN})`,
              boxShadow: "0 10px 24px -12px #378ADD99",
            }}
            whileHover={reduceMotion ? undefined : { y: -1, filter: "brightness(1.08)" }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          >
            Compris <ArrowRight size={13} />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AnomalyCard({ item, index, onOpen }) {
  const reduceMotion = useReducedMotion();
  const ex = explainAnomaly(item);
  const color = ex.color;
  const article = articleFromAnomaly(item);
  const critical = item.severite === "elevee";

  return (
    <motion.article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.28), duration: 0.3, ease: EASE }}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -4, boxShadow: `0 18px 36px -16px ${color}66` }
      }
      className="ia-studio-card group relative h-full cursor-pointer overflow-hidden rounded-2xl outline-none focus-visible:ring-2"
      style={{
        "--anomaly-accent": color,
        "--card-accent": color,
        background: IA.bgCard,
        border: `1px solid ${IA.border}`,
        borderLeft: `3px solid ${color}`,
        boxShadow: "none",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${color}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${IA.accent}12, transparent 50%)`,
        }}
        aria-hidden
      />
      <ShieldAlert
        className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 opacity-[0.07] transition-transform duration-500 group-hover:scale-110"
        style={{ color }}
        strokeWidth={1}
        aria-hidden
      />

      <div className="relative z-[1] flex h-full items-center gap-2.5 px-3 py-3">
        <ScoreRing score={ex.score} color={color} size={56}>
          <AnomalyArticleThumb article={article} size={32} />
        </ScoreRing>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <span
              className="relative rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ background: `${color}22`, color }}
            >
              {critical && !reduceMotion ? (
                <span
                  className="ia-anomaly-live-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: color }}
                  aria-hidden
                />
              ) : null}
              {SEVERITY_LABELS[item.severite] || item.severite}
            </span>
            <span
              className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase"
              style={{ background: IA.fill, color: IA.muted }}
            >
              {ex.isStock ? "Stock" : "Mvt"}
            </span>
            <span className="truncate font-mono text-[11px] font-semibold" style={{ color }}>
              {item.articleCode || "—"}
            </span>
          </div>

          <h3
            className="mt-0.5 truncate text-sm font-semibold tracking-tight"
            style={{ color: IA.text }}
          >
            {item.produit || item.titre}
          </h3>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px]" style={{ color: IA.muted }}>
            <span className="inline-flex items-center gap-0.5 truncate">
              <Warehouse className="h-3 w-3 shrink-0" style={{ color: IA.accent }} />
              <span className="truncate">{item.depot || "—"}</span>
            </span>
            <span className="inline-flex items-center gap-0.5">
              <Clock3 className="h-3 w-3 shrink-0" />
              {formatRelativeTime(item.timestamp)}
            </span>
          </p>
        </div>

        <motion.span
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white"
          style={{
            background: `linear-gradient(135deg, ${DETAIL_BLUE}, ${DETAIL_CYAN})`,
            boxShadow: "0 4px 14px -4px #378ADD99",
          }}
          whileHover={reduceMotion ? undefined : { scale: 1.04, y: -1 }}
        >
          <Eye className="h-3 w-3" />
          Détail
        </motion.span>
      </div>

      <style>{`
        .ia-anomaly-live-dot {
          box-shadow: 0 0 6px var(--anomaly-accent);
          animation: iaAnomalyPulse 1.6s ease-out infinite;
        }
        @keyframes iaAnomalyPulse {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--anomaly-accent) 55%, transparent); opacity: 1; }
          70% { box-shadow: 0 0 0 10px transparent; opacity: 0.35; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 0; }
        }
      `}</style>
    </motion.article>
  );
}

function Pagination({ page, pages, total, onPage }) {
  if (pages <= 1) return null;
  const windowSize = 5;
  let start = Math.max(0, page - Math.floor(windowSize / 2));
  let end = Math.min(pages, start + windowSize);
  start = Math.max(0, end - windowSize);
  const nums = Array.from({ length: end - start }, (_, i) => start + i);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[11px]" style={{ color: IA.muted }}>
        {total} anomalie{total > 1 ? "s" : ""} · page {page + 1}/{pages}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl disabled:opacity-35"
          style={{ border: `1px solid ${IA.border}`, color: IA.textSecondary, background: IA.bgElevated }}
          aria-label="Page précédente"
        >
          <ChevronLeft size={15} />
        </button>
        {nums.map((n) => {
          const active = n === page;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              className="relative inline-flex h-8 min-w-8 items-center justify-center rounded-xl px-2 text-[12px] font-semibold"
              style={{
                background: active ? IA.accentDim : "transparent",
                color: active ? IA.accent : IA.muted,
                border: active ? `1px solid ${IA.borderStrong}` : `1px solid transparent`,
              }}
            >
              {n + 1}
              {active ? (
                <motion.span
                  layoutId="anomaly-page-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{ border: `1px solid ${IA.accent}44` }}
                />
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
          className="inline-flex h-8 items-center gap-1 rounded-xl px-3 text-[12px] font-semibold text-black disabled:opacity-35"
          style={{ background: `linear-gradient(135deg, ${IA.accent}, #5eead4)` }}
          aria-label="Page suivante"
        >
          Suiv. <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function ModuleIAAnomaliesSection({ anomalies = [] }) {
  const [severity, setSeverity] = useState("all");
  const [type, setType] = useState("all");
  const [time, setTime] = useState("7d");
  const [detail, setDetail] = useState(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const now = new Date();
    return anomalies.filter((a) => {
      if (severity !== "all" && a.severite !== severity) return false;
      if (type !== "all" && a.type !== type) return false;
      if (time !== "all" && a.timestamp) {
        const d = new Date(a.timestamp);
        if (time === "today" && d.toDateString() !== now.toDateString()) return false;
        if (time === "7d" && now - d > 7 * 86400000) return false;
        if (
          time === "month" &&
          (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())
        ) {
          return false;
        }
      }
      return true;
    });
  }, [anomalies, severity, type, time]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pages - 1);
  const pageRows = filtered.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

  useEffect(() => {
    setPage(0);
  }, [severity, type, time]);

  const avgSeverity =
    filtered.length > 0
      ? filtered.reduce((s, a) => s + (Number(a.score) || 0), 0) / filtered.length
      : 0;

  return (
    <>
      <motion.section
        variants={FADE_UP}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        className="relative overflow-hidden p-5"
        style={surfaceStyle()}
      >
        <div
          className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full blur-3xl"
          style={{ background: `${IA.red}14` }}
          aria-hidden
        />

        <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              className="flex items-center gap-2 text-lg font-bold"
              style={{ fontFamily: IA.fontTitle, color: IA.text }}
            >
              Ce qui sort de l&apos;ordinaire
              <motion.span
                key={filtered.length}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-md px-2 py-0.5 text-xs font-bold"
                style={{ background: `${IA.red}33`, color: IA.red }}
              >
                {filtered.length}
              </motion.span>
            </h2>
            <p className="mt-1 text-[12px]" style={{ color: IA.muted }}>
              Diagnostic IA · {PER_PAGE} par page · cliquez une carte pour le détail.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["all", "elevee", "moyenne", "faible"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className="rounded-full px-3 py-1 text-xs font-semibold transition"
                style={
                  severity === s
                    ? { background: IA.accentDim, color: IA.accent, border: `1px solid ${IA.borderStrong}` }
                    : { background: IA.fill, border: `1px solid ${IA.border}`, color: IA.muted }
                }
              >
                {s === "all" ? "Toutes" : SEVERITY_LABELS[s]}
              </button>
            ))}
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-xs outline-none"
              style={{
                background: IA.bgElevated,
                border: `1px solid ${IA.border}`,
                color: IA.textSecondary,
              }}
            >
              <option value="all">Tous types</option>
              <option value="rupture">Rupture</option>
              <option value="pic_demande">Pic demande</option>
              <option value="delai">Délai</option>
              <option value="variation">Variation</option>
            </select>
            {TIME_FILTERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTime(t.id)}
                className="rounded-full px-2.5 py-1 text-[11px]"
                style={{
                  color: time === t.id ? IA.accent : IA.muted,
                  border: time === t.id ? `1px solid ${IA.accent}44` : "1px solid transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_168px]">
          <div className="min-w-0">
            {pageRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <ShieldAlert className="mb-2 h-8 w-8" style={{ color: IA.muted }} />
                <p className="text-sm" style={{ color: IA.muted }}>
                  Aucune anomalie pour ces filtres.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {pageRows.map((item, i) => (
                  <AnomalyCard
                    key={item.id ?? `${item.titre}-${i}`}
                    item={item}
                    index={i}
                    onOpen={setDetail}
                  />
                ))}
              </div>
            )}
            <Pagination
              page={safePage}
              pages={pages}
              total={filtered.length}
              onPage={setPage}
            />
          </div>
          <AnomalyCounter
            count={filtered.length}
            avgSeverity={avgSeverity}
            page={safePage}
            pages={pages}
          />
        </div>
      </motion.section>

      <AnimatePresence>
        {detail ? <DetailDrawer item={detail} onClose={() => setDetail(null)} /> : null}
      </AnimatePresence>
    </>
  );
}
