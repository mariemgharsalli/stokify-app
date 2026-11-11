import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  IconAlertTriangle,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
} from "@tabler/icons-react";
import {
  Activity,
  ArrowRight,
  Check,
  CircleHelp,
  Clock3,
  Eye,
  MapPin,
  Package,
  ShieldAlert,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import AiModuleShell from "../../components/ai/AiModuleShell";
import AiInsightCard from "../../components/ai/AiInsightCard";
import { AnomalyStudio, VoteChips } from "./components/AnomalyMlStudio";
import ArticleAvatar from "../../components/ui/ArticleAvatar";
import StockPagination from "../../components/stock/StockPagination";
import { getArticleRealImageUrl } from "../../utils/articleImage";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useLandingLang } from "../landing/LandingLangContext";
import { useToast } from "../../hooks/useToast";
import { useCountUp } from "../../hooks/useCountUp";

const EASE = [0.22, 1, 0.36, 1];
const PER_PAGE_DEFAULT = 8;
const DETAIL_BLUE = "#378ADD";
const DETAIL_CYAN = "#0EA5E9";

function dayKey(d) {
  const x = new Date(d);
  return x.toISOString().slice(0, 10);
}

function buildLast30Days() {
  const days = [];
  const now = new Date();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

function severityColor(score) {
  if (score >= 70) return "#E24B4A";
  if (score >= 40) return "#BA7517";
  return "#1D9E75";
}

function severityLabel(score) {
  if (score >= 70) return "Élevée";
  if (score >= 40) return "Moyenne";
  return "Faible";
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Construit une explication pédagogique pour chaque anomalie. */
function buildAnomalyExplain(anomaly) {
  const isStock = anomaly.source === "stock";
  const score = Number(anomaly.score) || 0;
  const observed = Number(anomaly.quantiteObservee ?? anomaly.mouvement?.quantite ?? 0);
  const mean = Number(anomaly.moyenneHabituelle || 0);
  const ratio = mean > 0 ? observed / mean : null;
  const delta = observed - mean;
  const absDeltaPct = mean > 0 ? Math.abs((delta / mean) * 100) : null;

  let diagnosis = anomaly.raison || "Comportement inhabituel détecté.";
  let plainLanguage = "";
  let causes = [];
  let actions = [];
  let method = "";

  if (isStock) {
    const isRupture = observed <= 0;
    plainLanguage = isRupture
      ? "Le stock est à zéro dans ce dépôt. Les commandes ou sorties risquent d'être bloquées."
      : `Le stock (${observed}) est passé sous le seuil d'alerte (${mean}). Le risque de rupture est élevé.`;
    causes = isRupture
      ? [
          "Sorties plus rapides que les entrées",
          "Réapprovisionnement non déclenché à temps",
          "Transfert possible depuis un autre dépôt non effectué",
        ]
      : [
          "Consommation récente supérieure à la normale",
          "Seuil d'alerte peut-être trop bas pour la rotation actuelle",
          "Entrées en retard (achat / réception)",
        ];
    actions = isRupture
      ? [
          "Réapprovisionner en urgence ou transférer depuis un dépôt en surplus",
          "Vérifier les commandes clients en attente sur cet article",
          "Contrôler les mouvements récents (erreurs de saisie possibles)",
        ]
      : [
          "Planifier un réapprovisionnement avant rupture",
          "Ajuster le seuil d'alerte si la demande a changé",
          "Surveiller la rotation sur les 7 prochains jours",
        ];
    method =
      "Alerte niveau stock : comparaison quantité disponible vs seuilAlerte (ou stockMin). Pas d'ensemble ML ici — règle métier temps réel.";
  } else {
    if (ratio != null && ratio >= 2) {
      plainLanguage = `La quantité du mouvement (${observed}) est environ ${ratio.toFixed(1)}× plus élevée que la moyenne habituelle (${mean}) sur 90 jours.`;
    } else if (ratio != null && ratio <= 0.25 && observed > 0) {
      plainLanguage = `La quantité observée (${observed}) est anormalement faible face à la moyenne (${mean}) — environ ${(ratio * 100).toFixed(0)}% du volume habituel.`;
    } else if (absDeltaPct != null) {
      plainLanguage = `Écart de ${absDeltaPct.toFixed(0)}% par rapport à la moyenne habituelle (${mean}). Score de gravité ${Math.round(score)}/100.`;
    } else {
      plainLanguage =
        "L'ensemble ML a jugé ce mouvement atypique par rapport au profil article/dépôt des 90 derniers jours.";
    }
    causes = [
      "Pic ou creux de demande réel",
      "Erreur de saisie de quantité",
      "Mouvement exceptionnel (inventaire, retour, transfert groupé)",
      "Changement de process non encore intégré dans l'historique",
    ];
    actions = [
      "Ouvrir le mouvement source et valider la quantité",
      "Comparer avec les ventes / achats du même jour",
      "Si normal : marquer comme résolu — label supervisé 0 (faux positif)",
      "Si anormal : confirmer l'anomalie — label supervisé 1 persisté",
    ];
    const detectors = anomaly.mlMeta?.detectors || anomaly.detectors;
    method =
      "Ensemble non supervisé : IsolationForest + LOF + autoencodeur profond (goulot 4) + AE séquence 14j. Calibrateur supervisé GBC+MLP persisté sur le feedback (confirmer / marquer normal). Cron 03:00 & 15:00, réentraînement 03:20." +
      (detectors?.length ? ` Détecteurs : ${detectors.join(", ")}.` : "");
  }

  return {
    isStock,
    score,
    observed,
    mean,
    ratio,
    delta,
    absDeltaPct,
    diagnosis,
    plainLanguage,
    causes,
    actions,
    method,
    severity: severityLabel(score),
    color: severityColor(score),
    votes: anomaly.mlMeta?.votes || anomaly.votes || null,
    detectors: anomaly.mlMeta?.detectors || anomaly.detectors || [],
    agreement: anomaly.mlMeta?.agreement ?? anomaly.agreement,
    reconstruction: anomaly.mlMeta?.reconstruction ?? anomaly.reconstruction,
    sequenceRecon: anomaly.mlMeta?.sequenceRecon ?? anomaly.sequenceRecon,
    modele: anomaly.modele || anomaly.mlMeta?.modele,
  };
}

function TimelineFrise({ items, selectedDay, onSelectDay, onHoverDay }) {
  const days = useMemo(() => buildLast30Days(), []);
  const byDay = useMemo(() => {
    const map = new Map(days.map((d) => [d, []]));
    for (const a of items || []) {
      const k = dayKey(a.dateDetection);
      if (!map.has(k)) continue;
      map.get(k).push(a);
    }
    return map;
  }, [items, days]);

  const [hoverDay, setHoverDay] = useState(null);

  function setHover(d) {
    setHoverDay(d);
    onHoverDay?.(d);
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Frise des 30 derniers jours
          </h3>
          <p className="text-[11px] text-[var(--text-muted)]">
            Cliquez un point pour filtrer · taille = volume · couleur = gravité
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#1D9E75]" /> Calme
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#BA7517]" /> Activité
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#E24B4A]" /> Critique
          </span>
        </div>
      </div>
      <div className="relative overflow-x-auto pb-2">
        <svg viewBox="0 0 600 70" className="h-20 min-w-[560px] w-full">
          <line x1="10" y1="35" x2="590" y2="35" stroke="var(--border-default)" strokeWidth="2" />
          {days.map((d, i) => {
            const list = byDay.get(d) || [];
            const count = list.length;
            const maxScore = list.reduce((m, a) => Math.max(m, Number(a.score) || 0), 0);
            let fill = "#1D9E75";
            let r = 4;
            if (count >= 3) {
              fill = "#E24B4A";
              r = 9;
            } else if (count >= 1) {
              fill = "#BA7517";
              r = 6 + Math.min(2, count);
            }
            if (maxScore >= 80 && count > 0) fill = "#E24B4A";
            const x = 10 + (i / Math.max(1, days.length - 1)) * 580;
            const selected = selectedDay === d;
            return (
              <g
                key={d}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHover(d)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelectDay(selected ? null : d)}
              >
                <circle
                  cx={x}
                  cy={35}
                  r={selected ? r + 2 : r}
                  fill={fill}
                  opacity={selected ? 1 : 0.85}
                  stroke={selected ? "#378ADD" : "transparent"}
                  strokeWidth={2}
                />
                {i % 5 === 0 && (
                  <text x={x} y={58} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
                    {d.slice(8)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hoverDay && (byDay.get(hoverDay) || []).length > 0 && (
          <div className="mt-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-hover)] p-3 text-xs text-[var(--text-secondary)]">
            <p className="mb-1 font-semibold text-[var(--text-primary)]">{hoverDay}</p>
            <ul className="space-y-1">
              {(byDay.get(hoverDay) || []).slice(0, 5).map((a) => (
                <li key={a.id}>
                  {a.article?.code} — score {Math.round(a.score)} — {a.raison}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {selectedDay && (
        <button
          type="button"
          className="mt-2 text-xs text-[var(--accent-primary)] hover:underline"
          onClick={() => onSelectDay(null)}
        >
          Effacer le filtre ({selectedDay})
        </button>
      )}
    </div>
  );
}

function CompareBars({ observed, mean, isStock, color }) {
  const maxBar = Math.max(observed, mean, 1);
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {isStock ? "Niveau actuel vs seuil" : "Observé vs moyenne 90 jours"}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-2 flex h-28 items-end justify-center rounded-xl bg-[var(--bg-hover)] px-3 pb-2">
            <motion.div
              className="w-12 rounded-t-lg"
              style={{ background: color }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(8, (observed / maxBar) * 96)}px` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            {isStock ? "Stock" : "Observé"}
          </p>
          <p className="text-center text-sm font-bold tabular-nums text-[var(--text-primary)]">
            {observed}
          </p>
        </div>
        <div>
          <div className="mb-2 flex h-28 items-end justify-center rounded-xl bg-[var(--bg-hover)] px-3 pb-2">
            <motion.div
              className="w-12 rounded-t-lg bg-[#1D9E75]"
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(8, (mean / maxBar) * 96)}px` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.08 }}
            />
          </div>
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            {isStock ? "Seuil" : "Moyenne"}
          </p>
          <p className="text-center text-sm font-bold tabular-nums text-[var(--text-primary)]">
            {mean}
          </p>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score, color, size = 64, children }) {
  const large = size >= 100;
  const stroke = large ? 8 : 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const offset = c - (pct / 100) * c;
  const inner = size - stroke * 2 - (large ? 10 : 4);

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
          transition={{ duration: 1.1, ease: EASE }}
          style={{ filter: `drop-shadow(0 0 ${large ? 8 : 6}px ${color}66)` }}
        />
      </svg>
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full"
        style={{
          width: inner,
          height: inner,
          background: "rgba(15,23,42,0.65)",
          boxShadow: "inset 0 0 0 1px rgba(125,211,252,0.15)",
        }}
      >
        {children}
      </div>
      <span
        className={`absolute left-1/2 z-[1] -translate-x-1/2 rounded-md font-bold tabular-nums text-white ${
          large ? "-bottom-1 px-2 py-0.5 text-[11px]" : "-bottom-0.5 px-1.5 py-px text-[9px]"
        }`}
        style={{
          background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #0ea5e9))`,
          boxShadow: `0 2px 8px -2px ${color}99`,
        }}
      >
        {Math.round(pct)}
      </span>
    </div>
  );
}

function AnomalyArticleThumb({ article, size = 34 }) {
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
    <ArticleAvatar
      article={article}
      size={size}
      className="!rounded-full !border-0 !bg-transparent"
    />
  );
}

function AnomalyKpiTile({ icon: Icon, label, value, hint, color, index, pulse }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.4, ease: EASE }}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -6, boxShadow: `0 18px 36px -16px ${color}66` }
      }
      className={`group relative overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-4 ${
        pulse ? "anomaly-kpi-pulse" : ""
      }`}
      style={{
        "--kpi-accent": color,
        borderColor: pulse
          ? `color-mix(in srgb, ${color} 40%, var(--border-default))`
          : "var(--border-default)",
      }}
    >
      <motion.span
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: color }}
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.1 + index * 0.05, duration: 0.45, ease: EASE }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${color}28, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, #0EA5E914, transparent 50%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}88, transparent)`,
        }}
        aria-hidden
      />
      <Icon
        className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-20 opacity-[0.07] transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.12]"
        style={{ color }}
        strokeWidth={1}
        aria-hidden
      />

      <div className="relative pl-2.5">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(145deg, ${color}24, transparent)`,
              color,
              boxShadow: `inset 0 0 0 1px ${color}33`,
            }}
          >
            <Icon size={20} strokeWidth={1.75} />
          </div>
          {hint ? (
            <span className="rounded-md bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              {hint}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </p>
        <p
          className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight"
          style={{ color, fontFamily: "'Syne', sans-serif" }}
        >
          {value}
        </p>
        <motion.div
          className="mt-2.5 h-px origin-left"
          style={{
            background: `linear-gradient(90deg, ${color}66, transparent)`,
          }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.18 + index * 0.06, duration: 0.5, ease: EASE }}
          aria-hidden
        />
      </div>

      <style>{`
        .anomaly-kpi-pulse {
          animation: anomalyKpiPulse 2.4s ease-out infinite;
        }
        @keyframes anomalyKpiPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--kpi-accent) 35%, transparent); }
          50% { box-shadow: 0 0 0 6px transparent; }
        }
      `}</style>
    </motion.div>
  );
}

function DetailMetricChip({ label, value, color, delay = 0, reduceMotion }) {
  return (
    <motion.div
      className="rounded-xl border px-3 py-1.5"
      style={{ borderColor: `${color}33`, background: `${color}14` }}
      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.35, ease: EASE }}
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.03 }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider text-sky-200/45">{label}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
    </motion.div>
  );
}

function DetailActionBtn({ icon: Icon, label, onClick, color, disabled, reduceMotion }) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
      style={{
        borderColor: `${color}55`,
        background: `linear-gradient(135deg, ${color}dd, ${color}99)`,
        boxShadow: `0 6px 16px -6px ${color}66`,
      }}
      whileHover={reduceMotion || disabled ? undefined : { y: -2, scale: 1.02, filter: "brightness(1.08)" }}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.97 }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </motion.button>
  );
}

/** Cockpit détail anomalie — même langage visuel que LotDetailModal */
function AnomalyDetailModal({ anomaly, onClose, onResolve, onConfirm, onInvestigate, resolving }) {
  const explain = buildAnomalyExplain(anomaly);
  const { color, score, isStock } = explain;
  const reduceMotion = useReducedMotion();
  const imgSrc = getArticleRealImageUrl(anomaly.article);
  const [imgErr, setImgErr] = useState(false);
  const [aiDetailsOpen, setAiDetailsOpen] = useState(false);
  const articleLabel = anomaly.article?.libelle || anomaly.article?.code || "Article";
  useEffect(() => {
    setAiDetailsOpen(false);
  }, [anomaly.id]);

  useEffect(() => {
    setImgErr(false);
  }, [imgSrc, anomaly.article?.id, anomaly.article?.imageUrl]);

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
        style={{ background: "rgba(6,10,20,0.72)", backdropFilter: "blur(8px)" }}
        aria-hidden
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="anomaly-detail-title"
        className="relative z-[1] flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background:
            "linear-gradient(165deg, rgba(17,34,66,0.98) 0%, rgba(12,22,40,0.98) 55%, rgba(10,18,32,0.99) 100%)",
          borderColor: "rgba(56,189,248,0.22)",
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

        {/* Cockpit header */}
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
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300/60">
              Cockpit anomalie · diagnostic IA
            </p>
            <motion.button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/20 text-sky-200/70"
              aria-label="Fermer"
              whileHover={
                reduceMotion ? undefined : { scale: 1.05, backgroundColor: "rgba(255,255,255,0.06)" }
              }
              whileTap={reduceMotion ? undefined : { scale: 0.95 }}
            >
              <X className="h-4 w-4" />
            </motion.button>
          </div>

          <div className="relative mt-4 grid gap-5 sm:grid-cols-[120px_1fr] sm:items-center">
            <ScoreRing score={score} color={color} size={112}>
              {imgSrc && !imgErr ? (
                <img
                  src={imgSrc}
                  alt={articleLabel}
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
                  style={{ background: `${color}22`, color }}
                >
                  Gravité {explain.severity}
                </span>
                <span className="rounded-lg bg-sky-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-100/80">
                  {isStock ? "Alerte stock" : anomaly.statut === "CONFIRME" ? "Confirmée ML" : "Mouvement ML"}
                </span>
                {score >= 70 ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${DETAIL_BLUE}, ${DETAIL_CYAN})`,
                      boxShadow: `0 4px 14px -4px ${DETAIL_CYAN}99`,
                    }}
                  >
                    <Zap className="h-3 w-3" />
                    Priorité haute
                  </span>
                ) : null}
              </div>

              <div>
                <h2
                  id="anomaly-detail-title"
                  className="truncate font-mono text-xl font-bold tracking-tight sm:text-2xl"
                  style={{ color: DETAIL_CYAN }}
                >
                  {anomaly.article?.code || "—"}
                </h2>
                <p className="mt-0.5 truncate text-sm font-medium text-sky-50/90">{articleLabel}</p>
              </div>

              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sky-100/55">
                <span className="inline-flex items-center gap-1">
                  <Warehouse className="h-3.5 w-3.5 text-cyan-300" />
                  {anomaly.depot?.libelle || anomaly.depot?.code || "—"}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatDateTime(anomaly.dateDetection)}
                </span>
              </p>

              <div className="flex flex-wrap gap-2">
                <DetailMetricChip
                  label="Score"
                  value={`${Math.round(score)}/100`}
                  color={color}
                  delay={0.05}
                  reduceMotion={reduceMotion}
                />
                <DetailMetricChip
                  label={isStock ? "Stock" : "Observé"}
                  value={explain.observed}
                  color="#7dd3fc"
                  delay={0.1}
                  reduceMotion={reduceMotion}
                />
                <DetailMetricChip
                  label={isStock ? "Seuil" : "Moyenne"}
                  value={explain.mean}
                  color="#6ee7b7"
                  delay={0.15}
                  reduceMotion={reduceMotion}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <motion.div
            className="grid grid-cols-2 gap-2.5"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            {[
              {
                icon: MapPin,
                label: "Dépôt",
                value: anomaly.depot?.libelle || anomaly.depot?.code || "—",
                sub: anomaly.depot?.code && anomaly.depot?.libelle ? anomaly.depot.code : null,
              },
              {
                icon: ShieldAlert,
                label: "Statut",
                value: anomaly.statut === "RESOLU" ? "Résolu" : "Non résolu",
                color: anomaly.statut === "RESOLU" ? "#6ee7b7" : color,
              },
              {
                icon: Clock3,
                label: "Détection",
                value: formatDateTime(anomaly.dateDetection),
              },
              {
                icon: Activity,
                label: isStock ? "Source" : "Mouvement",
                value: isStock
                  ? "Règle stock"
                  : anomaly.mouvement?.type || anomaly.mouvement?.reference || "ML",
                color: DETAIL_CYAN,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border px-3 py-2.5"
                style={{
                  borderColor: "rgba(56,189,248,0.14)",
                  background: "rgba(15,23,42,0.45)",
                }}
              >
                <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-200/45">
                  <item.icon className="h-3 w-3" style={{ color: item.color || DETAIL_CYAN }} />
                  {item.label}
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: item.color || "rgba(241,245,249,0.95)" }}
                >
                  {item.value}
                </p>
                {item.sub ? (
                  <p className="font-mono text-[10px] text-sky-200/40">{item.sub}</p>
                ) : null}
              </div>
            ))}
          </motion.div>

          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
          >
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200/50">
              <ShieldAlert size={11} /> Diagnostic
            </p>
            <p
              className="rounded-xl border p-3 text-[13px] leading-relaxed text-sky-50/90"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(56,189,248,0.14)",
              }}
            >
              {explain.diagnosis}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-sky-100/60">{explain.plainLanguage}</p>
          </motion.section>

          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="mb-1.5 flex justify-between text-[11px] text-sky-200/45">
              <span className="font-semibold uppercase tracking-wider">Score de gravité</span>
              <span className="font-mono font-bold" style={{ color }}>
                {Math.round(score)}/100
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${color}, ${DETAIL_CYAN})` }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, score)}%` }}
                transition={{ duration: 0.7 }}
              />
            </div>
          </motion.section>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <CompareBars
              observed={explain.observed}
              mean={explain.mean}
              isStock={isStock}
              color={color}
            />
          </motion.div>

          {explain.ratio != null ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div
                className="rounded-xl border px-3 py-2.5"
                style={{ borderColor: "rgba(56,189,248,0.14)", background: "rgba(15,23,42,0.45)" }}
              >
                <p className="text-[10px] uppercase text-sky-200/45">Ratio</p>
                <p className="mt-1 text-lg font-bold tabular-nums" style={{ color }}>
                  {explain.ratio.toFixed(2)}×
                </p>
              </div>
              <div
                className="rounded-xl border px-3 py-2.5"
                style={{ borderColor: "rgba(56,189,248,0.14)", background: "rgba(15,23,42,0.45)" }}
              >
                <p className="text-[10px] uppercase text-sky-200/45">Écart</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-sky-50">
                  {explain.delta >= 0 ? "+" : ""}
                  {explain.delta.toFixed(1)}
                </p>
              </div>
            </div>
          ) : null}

          {explain.votes || explain.method ? (
            <section>
              <button
                type="button"
                onClick={() => setAiDetailsOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-200/70"
                aria-expanded={aiDetailsOpen}
              >
                <IconSparkles size={12} />
                {aiDetailsOpen ? "Masquer les détails IA" : "Voir les détails IA"}
              </button>
              <AnimatePresence initial={false}>
                {aiDetailsOpen ? (
                  <motion.div
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: EASE }}
                    className="overflow-hidden"
                  >
                    {explain.votes ? (
                      <div className="mt-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200/50">
                          Votes des détecteurs
                        </p>
                        <VoteChips
                          votes={explain.votes}
                          detectors={explain.detectors}
                          agreement={explain.agreement}
                        />
                        {explain.reconstruction != null || explain.sequenceRecon != null ? (
                          <p className="mt-2 font-mono text-[10px] text-sky-200/40">
                            {explain.reconstruction != null ? `recon AE ${explain.reconstruction}` : ""}
                            {explain.sequenceRecon != null ? ` · seq ${explain.sequenceRecon}` : ""}
                            {explain.modele ? ` · ${explain.modele}` : ""}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {explain.method ? (
                      <div
                        className="mt-3 rounded-xl border border-dashed p-3"
                        style={{ borderColor: "rgba(56,189,248,0.2)" }}
                      >
                        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200/50">
                          <IconSparkles size={12} /> Méthode de détection
                        </p>
                        <p className="text-[11px] leading-relaxed text-sky-200/40">{explain.method}</p>
                      </div>
                    ) : null}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>
          ) : null}

          <section>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200/50">
              Causes possibles
            </p>
            <ul className="space-y-1.5">
              {explain.causes.map((c) => (
                <li key={c} className="flex items-start gap-2 text-[12px] text-sky-100/65">
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
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200/50">
              Que faire maintenant
            </p>
            <ol className="space-y-2">
              {explain.actions.map((a, i) => (
                <li
                  key={a}
                  className="flex gap-2.5 rounded-xl border px-3 py-2.5 text-[12px] text-sky-100/65"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderColor: "rgba(56,189,248,0.14)",
                  }}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${DETAIL_BLUE}, ${DETAIL_CYAN})`,
                    }}
                  >
                    {i + 1}
                  </span>
                  {a}
                </li>
              ))}
            </ol>
          </section>

        </div>

        {/* Actions */}
        <div
          className="shrink-0 space-y-2 border-t px-5 py-4"
          style={{ borderColor: "rgba(56,189,248,0.14)", background: "rgba(8,15,28,0.55)" }}
        >
          <div className="flex flex-wrap gap-2">
            {!isStock && anomaly.statut !== "RESOLU" ? (
              <DetailActionBtn
                icon={Check}
                label="Marquer normal"
                color="#1D9E75"
                disabled={resolving}
                onClick={() => onResolve(anomaly.id)}
                reduceMotion={reduceMotion}
              />
            ) : null}
            {!isStock && anomaly.statut !== "RESOLU" && anomaly.statut !== "CONFIRME" ? (
              <DetailActionBtn
                icon={ShieldAlert}
                label="Confirmer anomalie"
                color="#E24B4A"
                disabled={resolving}
                onClick={() => onConfirm?.(anomaly.id)}
                reduceMotion={reduceMotion}
              />
            ) : null}
            <DetailActionBtn
              icon={IconSearch}
              label={isStock ? "Voir le stock" : "Investiguer"}
              color={DETAIL_BLUE}
              onClick={() => onInvestigate(anomaly)}
              reduceMotion={reduceMotion}
            />
            <DetailActionBtn
              icon={ArrowRight}
              label="Fermer"
              color={DETAIL_CYAN}
              onClick={onClose}
              reduceMotion={reduceMotion}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AnomalyListCard({ anomaly, index, selected, highlighted, onSelect }) {
  const explain = buildAnomalyExplain(anomaly);
  const { color, score, isStock } = explain;
  const reduceMotion = useReducedMotion();
  const articleLabel = anomaly.article?.libelle || anomaly.article?.code || "Article";
  const critical = score >= 70;

  return (
    <motion.article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(anomaly)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(anomaly);
        }
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{
        opacity: highlighted === false ? 0.42 : 1,
        y: 0,
      }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.28), ease: EASE }}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -4,
              boxShadow: `0 18px 36px -16px ${color}66`,
            }
      }
      className="group relative h-full cursor-pointer overflow-hidden rounded-2xl border outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
      style={{
        "--anomaly-accent": color,
        background: "var(--bg-card)",
        borderColor: selected ? `${color}88` : "var(--border-default)",
        borderLeft: `3px solid ${color}`,
        boxShadow: selected
          ? `0 0 0 1px ${color}40, 0 14px 32px -16px ${color}66`
          : "var(--shadow-card)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${color}20, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, #0EA5E912, transparent 50%)`,
        }}
        aria-hidden
      />
      <ShieldAlert
        className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 opacity-[0.06] transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.1]"
        style={{ color }}
        strokeWidth={1}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }}
        aria-hidden
      />

      <div className="relative z-[1] flex h-full items-center gap-2.5 px-3 py-3">
        <ScoreRing score={score} color={color} size={56}>
          <AnomalyArticleThumb article={anomaly.article} size={32} />
        </ScoreRing>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <span
              className="relative rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{
                background: `color-mix(in srgb, ${color} 18%, transparent)`,
                color,
              }}
            >
              {critical && !reduceMotion ? (
                <span
                  className="anomaly-card-live-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: color }}
                  aria-hidden
                />
              ) : null}
              {explain.severity}
            </span>
            <span className="rounded-md bg-[var(--bg-hover)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--text-muted)]">
              {isStock ? "Stock" : "Mvt"}
            </span>
            {anomaly.statut === "CONFIRME" ? (
              <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ color: "#E24B4A", background: "color-mix(in srgb, #E24B4A 16%, transparent)" }}>
                Confirmée
              </span>
            ) : null}
            <span className="truncate font-mono text-[11px] font-semibold" style={{ color }}>
              {anomaly.article?.code || "—"}
            </span>
          </div>

          <h3 className="mt-0.5 truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">
            {articleLabel}
          </h3>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-0.5 truncate">
              <Warehouse className="h-3 w-3 shrink-0 text-[#0EA5E9]" />
              <span className="truncate">{anomaly.depot?.libelle || anomaly.depot?.code || "—"}</span>
            </span>
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              <Clock3 className="h-3 w-3 shrink-0" />
              {formatDateTime(anomaly.dateDetection)}
            </span>
          </p>
        </div>

        <motion.span
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white"
          style={{
            background: "linear-gradient(135deg, #378ADD, #0EA5E9)",
            boxShadow: "0 4px 14px -4px #378ADD99",
          }}
          whileHover={reduceMotion ? undefined : { scale: 1.04, y: -1 }}
        >
          <Eye className="h-3 w-3" />
          Détail
        </motion.span>
      </div>

      <style>{`
        .anomaly-card-live-dot {
          box-shadow: 0 0 6px var(--anomaly-accent);
          animation: anomalyCardPulse 1.6s ease-out infinite;
        }
        @keyframes anomalyCardPulse {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--anomaly-accent) 55%, transparent); opacity: 1; }
          70% { box-shadow: 0 0 0 10px transparent; opacity: 0.35; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 0; }
        }
      `}</style>
    </motion.article>
  );
}

export function AnomaliesWidget({ limit = 3 }) {
  const societeScope = useSocieteQueryScope();
  const { t } = useLandingLang();
  const { data } = useQuery({
    queryKey: ["stock-anomalies", "widget", societeScope],
    queryFn: () =>
      api.get("stock/anomalies", { params: { statut: "NON_RESOLU" } }).then((r) => r.data),
  });
  const items = (data?.items || []).slice(0, limit);

  return (
    <div className="dash-glass-card flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">{t.dashAnomaliesTitle}</h3>
          <p className="text-[11px] text-[var(--text-muted)]">{t.dashActivitySub}</p>
        </div>
        <Link
          to="/stock/anomalies"
          className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
        >
          {t.dashSeeAll}
        </Link>
      </div>
      {!items.length ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--dash-line)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
          {t.dashNoActivity}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((a) => {
            const explain = buildAnomalyExplain(a);
            const score = Math.round(Number(a.score) || 0);
            return (
              <li
                key={a.id}
                className="rounded-2xl border border-[var(--dash-line)] bg-[var(--bg-hover)] px-3.5 py-3"
              >
                <div className="flex items-start gap-2.5">
                  <IconAlertTriangle size={16} style={{ color: explain.color, marginTop: 2 }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {a.article?.code || "Article"}
                      </p>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums" style={{ color: explain.color }}>
                        {score}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-muted)]">{explain.plainLanguage}</p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--bg-card)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, score)}%`,
                          background: explain.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AnomaliesDetection({ embedded = false }) {
  const societeScope = useSocieteQueryScope();
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedDay, setSelectedDay] = useState(null);
  const [hoverDay, setHoverDay] = useState(null);
  const [fadingIds, setFadingIds] = useState(new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PER_PAGE_DEFAULT);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["stock-anomalies", societeScope],
    queryFn: () =>
      api.get("stock/anomalies", { params: { statut: "TOUS" } }).then((r) => r.data),
  });

  const resolveMut = useMutation({
    mutationFn: (id) => api.patch(`stock/anomalies/${id}/resoudre`).then((r) => r.data),
    onSuccess: (_, id) => {
      setFadingIds((prev) => new Set([...prev, id]));
      if (selectedId === id) setSelectedId(null);
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["stock-anomalies"] });
        setFadingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 400);
      toast.success("Anomalie marquée comme normale");
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const detectMut = useMutation({
    mutationFn: () => api.post("stock/anomalies/detect").then((r) => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["stock-anomalies"] });
      const n = Number(res?.persisted ?? 0);
      const mode = res?.mode === "local" ? " (analyse locale — service IA hors ligne)" : "";
      toast.success(
        n > 0
          ? `${n} nouvelle${n > 1 ? "s" : ""} anomalie${n > 1 ? "s" : ""} persistée${n > 1 ? "s" : ""}${mode}`
          : `Analyse terminée — aucune nouvelle anomalie mouvement${mode}`
      );
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const trainMut = useMutation({
    mutationFn: () => api.post("stock/anomalies/train").then((r) => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["stock-anomalies"] });
      if (res?.ok) {
        const sup = res.supervised || {};
        toast.success(
          sup.trained
            ? `Modèle persisté — ${sup.nPos || 0} confirmés / ${sup.nNeg || 0} normaux`
            : `Unsupervised persisté (${res.nTrain || 0} mvts) — labels supervisés encore insuffisants`
        );
      } else {
        toast.error(res?.reason || "Entraînement impossible");
      }
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const confirmMut = useMutation({
    mutationFn: (id) => api.patch(`stock/anomalies/${id}/confirmer`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-anomalies"] });
      toast.success("Anomalie confirmée — label supervisé enregistré");
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const allItems = data?.items || [];
  const unresolved = allItems.filter((a) => a.statut === "NON_RESOLU" && !fadingIds.has(a.id));

  const filtered = useMemo(() => {
    return unresolved.filter((a) => {
      if (selectedDay && dayKey(a.dateDetection) !== selectedDay) return false;
      const score = Number(a.score) || 0;
      if (severityFilter === "elevee" && score < 70) return false;
      if (severityFilter === "moyenne" && (score < 40 || score >= 70)) return false;
      if (severityFilter === "faible" && score >= 40) return false;
      if (sourceFilter === "stock" && a.source !== "stock") return false;
      if (sourceFilter === "mouvement" && a.source === "stock") return false;
      return true;
    });
  }, [unresolved, selectedDay, severityFilter, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [selectedDay, severityFilter, sourceFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const selected =
    filtered.find((a) => a.id === selectedId) ||
    unresolved.find((a) => a.id === selectedId) ||
    null;

  const kpis = data?.kpis || { actives: 0, graviteMoyenne: 0, resoluesCeMois: 0 };
  const activesUp = useCountUp(kpis.actives || 0, 900);
  const graviteUp = useCountUp(kpis.graviteMoyenne || 0, 900, 1);
  const resoluesUp = useCountUp(kpis.resoluesCeMois || 0, 900);

  const insightText =
    (kpis.actives || 0) === 0
      ? "Aucune anomalie active : les mouvements des 30 derniers jours restent dans les seuils habituels."
      : `${kpis.actives} anomalie${kpis.actives > 1 ? "s" : ""} active${kpis.actives > 1 ? "s" : ""} — gravité moyenne ${Number(kpis.graviteMoyenne || 0).toFixed(1)}/100.` +
        (kpis.stockActives
          ? ` Dont ${kpis.stockActives} alerte${kpis.stockActives > 1 ? "s" : ""} stock (rupture/critique).`
          : "") +
        (kpis.confirmees ? ` ${kpis.confirmees} confirmée${kpis.confirmees > 1 ? "s" : ""} (label supervisé).` : "") +
        ` ${kpis.resoluesCeMois || 0} résolue${(kpis.resoluesCeMois || 0) > 1 ? "s" : ""} ce mois. Cliquez une carte pour ouvrir le détail explicatif.`;

  const studio = detectMut.data?.studio || data?.studio || null;

  const handleInvestigate = (row) => {
    if (row.source === "stock") {
      navigate(`/stock?articleId=${row.article?.id || ""}&depotId=${row.depot?.id || ""}`);
      return;
    }
    navigate(`/mouvements?mouvementId=${row.mouvementId || row.mouvement?.id}`);
  };

  return (
    <AiModuleShell
      embedded={embedded}
      title="Détection d'anomalies"
      subtitle="Ensemble IF + LOF + autoencodeur DL — calibrateur supervisé persisté, cron 03:00 / 15:00"
    >
      {/* How it works */}
      <div className="mb-5 grid gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:grid-cols-3 sm:p-5">
        {[
          {
            title: "1. Observer",
            text: "Mouvements 30j + fenêtre 14j + stats 90 jours, puis features 12D.",
            icon: Activity,
          },
          {
            title: "2. Détecter",
            text: "IsolationForest, LOF, autoencodeur profond et AE séquence votent un score 0–100.",
            icon: ShieldAlert,
          },
          {
            title: "3. Apprendre",
            text: "Confirmer ou marquer normal entraîne le calibrateur supervisé persisté sur disque.",
            icon: CircleHelp,
          },
        ].map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                <Icon size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
                  {step.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: "Toutes" },
            { id: "elevee", label: "Élevées" },
            { id: "moyenne", label: "Moyennes" },
            { id: "faible", label: "Faibles" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSeverityFilter(f.id)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              style={
                severityFilter === f.id
                  ? {
                      background: "color-mix(in srgb, var(--accent-primary) 16%, transparent)",
                      color: "var(--accent-primary)",
                      border: "1px solid color-mix(in srgb, var(--accent-primary) 35%, transparent)",
                    }
                  : {
                      background: "var(--bg-card)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-default)",
                    }
              }
            >
              {f.label}
            </button>
          ))}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] outline-none"
          >
            <option value="all">Toutes sources</option>
            <option value="mouvement">Mouvements ML</option>
            <option value="stock">Alertes stock</option>
          </select>
        </div>
        <button
          type="button"
          disabled={detectMut.isPending}
          onClick={() => detectMut.mutate()}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #378ADD, #0EA5E9)" }}
        >
          {detectMut.isPending ? (
            <>
              <IconRefresh size={16} className="animate-spin" />
              Analyse en cours…
            </>
          ) : (
            <>
              <IconSparkles size={16} />
              Analyser maintenant
            </>
          )}
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <AnomalyKpiTile
          index={0}
          icon={ShieldAlert}
          label="Anomalies actives"
          value={Math.round(activesUp)}
          hint="Live"
          color="#378ADD"
          pulse={Math.round(activesUp) > 0}
        />
        <AnomalyKpiTile
          index={1}
          icon={Zap}
          label="Gravité moyenne"
          value={Number(graviteUp).toFixed(1)}
          hint="Score"
          color="#BA7517"
        />
        <AnomalyKpiTile
          index={2}
          icon={Check}
          label="Résolues ce mois"
          value={Math.round(resoluesUp)}
          hint="Mois"
          color="#1D9E75"
        />
      </div>

      <div className="mb-6">
        {studio ? (
          <AnomalyStudio studio={studio} onTrain={() => trainMut.mutate()} training={trainMut.isPending} />
        ) : (
          <div
            className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-5"
            style={{ borderLeft: "3px solid #0EA5E9" }}
          >
            <div className="flex items-start gap-3.5">
              <IconShieldCheck size={22} className="mt-0.5 shrink-0 text-[#0EA5E9]" stroke={1.6} />
              <div>
                <p
                  className="text-lg font-bold text-[var(--text-primary)]"
                  style={{ fontFamily: "Syne, sans-serif" }}
                >
                  Surveillance automatique des mouvements
                </p>
                <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  Pas encore assez de mouvements enregistrés pour affiner la surveillance — elle s&apos;améliore avec
                  l&apos;usage.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {!isLoading && !isError && (
        <div className="mb-6">
          <AiInsightCard
            title="Synthèse IA"
            icon={<IconSparkles size={16} />}
            text={insightText}
            loading={isFetching && !data}
          />
        </div>
      )}

      <div className="mb-6">
        <TimelineFrise
          items={unresolved}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onHoverDay={setHoverDay}
        />
      </div>

      {isError ? (
        <div className="glass rounded-xl p-6 text-center">
          <IconAlertTriangle size={28} className="mx-auto mb-3 text-[#378ADD]" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Analyse temporairement indisponible
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Impossible de charger les anomalies. Réessayez dans un instant.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            <IconRefresh size={16} />
            Réessayer
          </button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="load-opt-skeleton h-[88px] w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] py-16 text-center">
          <IconShieldCheck size={48} className="mb-3 text-[#1D9E75]" stroke={1.5} />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Aucune anomalie pour ces filtres
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Lancez une analyse manuelle ou attendez le cron (03:00 / 15:00)
          </p>
        </div>
      ) : (
        <div className="min-w-0 space-y-3">
          <p className="text-xs text-[var(--text-muted)]">
            {filtered.length} anomalie{filtered.length > 1 ? "s" : ""}
            {filtered.length > pageSize ? ` · page ${safePage}/${totalPages}` : ""} · cliquez
            « Détail » pour le cockpit
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {pageRows.map((a, i) => {
              const day = dayKey(a.dateDetection);
              const highlighted = hoverDay == null ? null : day === hoverDay ? true : false;
              return (
                <AnomalyListCard
                  key={a.id}
                  anomaly={a}
                  index={i}
                  selected={selectedId === a.id}
                  highlighted={highlighted}
                  onSelect={(row) => setSelectedId(row.id)}
                />
              );
            })}
          </div>
          <StockPagination
            className="mt-1"
            page={safePage}
            totalPages={totalPages}
            totalResults={filtered.length}
            pageSize={pageSize}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            unitLabel="anomalie(s)"
            pageSizeOptions={[8, 12, 24, 48]}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </div>
      )}

      <AnimatePresence>
        {selected ? (
          <AnomalyDetailModal
            key={selected.id}
            anomaly={selected}
            onClose={() => setSelectedId(null)}
            resolving={resolveMut.isPending || confirmMut.isPending}
            onResolve={(id) => resolveMut.mutate(id)}
            onConfirm={(id) => confirmMut.mutate(id)}
            onInvestigate={handleInvestigate}
          />
        ) : null}
      </AnimatePresence>
    </AiModuleShell>
  );
}
