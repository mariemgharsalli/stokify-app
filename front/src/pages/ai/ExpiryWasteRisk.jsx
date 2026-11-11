import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  AlertTriangle,
  ArrowRight,
  Clock3,
  Filter,
  Hourglass,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Zap,
} from "lucide-react";
import AiModuleShell from "../../components/ai/AiModuleShell";
import ArticleAvatar from "../../components/ui/ArticleAvatar";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useCountUp } from "../../hooks/useCountUp";
import { useLandingLang } from "../landing/LandingLangContext";
import { FADE_UP, IA, surfaceStyle } from "./moduleIaTheme";
import { HudFrame, MiniSpark } from "./components/ModuleIAHud";
import { expiryModeLabel, expiryModeStyle, expiryModeTitle, resolveExpiryMode } from "./components/expiry/ModeBadge";
import { DriverChips, IntervalBar, ProbaGauge } from "./components/expiry/IntervalBar";
import ModelCardDrawer from "./components/expiry/ModelCardDrawer";
import MonitoringPanel from "./components/expiry/MonitoringPanel";
import WhatIfPanel from "./components/expiry/WhatIfPanel";

const ACCENT = "#E24B4A";
const AMBER = "#f97316";
const GOLD = "#BA7517";

const BANDS = {
  critique: { label: "Critique", color: IA.red, hint: "Fenêtre J≤7" },
  eleve: { label: "Élevé", color: AMBER, hint: "J≤14 ou proba élevée" },
  veille: { label: "Veille", color: IA.yellow, hint: "À surveiller" },
  perdu: { label: "Hors DLC", color: "#fb7185", hint: "Déjà périmé, stock restant" },
  couvert: { label: "Couvert", color: IA.accent, hint: "Vitesse actuelle suffirait" },
};

const HORIZON_META = {
  perime: { label: "Hors DLC", color: "#fb7185" },
  j3: { label: "J≤3", color: IA.red },
  j7: { label: "J≤7", color: AMBER },
  j14: { label: "J≤14", color: GOLD },
  j30: { label: "J≤30", color: IA.yellow },
  plus: { label: "J>30", color: IA.muted },
};

const URGENCY = {
  now: { label: "Maintenant", color: IA.red },
  soon: { label: "Cette semaine", color: AMBER },
  watch: { label: "Veille", color: IA.yellow },
};

const FILTERS = ["tous", "critique", "eleve", "veille", "perdu", "couvert"];
const SORTS = [
  { id: "priorite", label: "Priorité" },
  { id: "valeur", label: "Valeur" },
  { id: "dlc", label: "DLC" },
  { id: "proba", label: "Proba" },
];

function money(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} TND`;
}

function qty(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} u.`;
}

function dlcLabel(days) {
  if (days == null) return "—";
  if (days < 0) return `J+${Math.abs(days)}`;
  return `J-${days}`;
}

function bandColor(band) {
  return (BANDS[band] || BANDS.veille).color;
}

function classifyHorizon(j) {
  if (j == null) return "inconnu";
  if (j < 0) return "perime";
  if (j <= 3) return "j3";
  if (j <= 7) return "j7";
  if (j <= 14) return "j14";
  if (j <= 30) return "j30";
  return "plus";
}

function isoDayFromOffset(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Complète un payload v1.0 pour le cockpit v1.1 (rolling restart API). */
function hydrateExpiryPayload(raw) {
  if (!raw) return raw;
  const items = (raw.items || []).map((row) => {
    const j = row.joursRestants;
    const v = Number(row.vitesseJour) || 0;
    const q = Number(row.quantiteRestante) || 0;
    const proba = Number(row.probaWaste) || 0;
    const qPred = Number(row.qtePrediteDlc) || 0;
    let band = row.band || "veille";
    const trustServer = row.qteP90 != null || row.qteP50 != null;
    if (!trustServer && j != null) {
      if (j < 0 && qPred > 0) band = "perdu";
      else if (qPred <= 0) band = "couvert";
      else if (j <= 7) band = "critique";
      else if (j <= 14 && proba >= 0.8) band = "critique";
      else if (j <= 14 || proba >= 0.5) band = "eleve";
      else if (proba >= 0.8) band = "eleve";
      else band = "veille";
    }
    const fefo =
      row.fefoActif != null ? row.fefoActif : String(row.strategieSortie || "").toUpperCase() === "FEFO";
    const cover =
      row.joursCouverture != null ? row.joursCouverture : v > 0 ? Math.round((q / v) * 100) / 100 : null;
    const priorite =
      row.priorite != null
        ? row.priorite
        : Math.round(
            Math.min(
              100,
              (Number(row.probaWaste) || 0) * 40 +
                (j != null && j < 0 ? 28 : j != null && j <= 7 ? 18 : 4) +
                (Number(row.valeurPredite) > 0 ? 12 : 0)
            )
          );
    return {
      ...row,
      band,
      horizon: row.horizon || classifyHorizon(j),
      joursCouverture: cover,
      fefoActif: fefo,
      velocityQuality:
        row.velocityQuality ||
        (Number(row.ventes30j) > 0 ? (Number(row.ventes30j) < 5 ? "faible" : "solide") : "nulle"),
      valeurRecuperable:
        row.valeurRecuperable != null ? row.valeurRecuperable : band === "perdu" ? 0 : Number(row.valeurPredite) || 0,
      valeurPerdue:
        row.valeurPerdue != null ? row.valeurPerdue : band === "perdu" ? Number(row.valeurPredite) || 0 : 0,
      priorite,
      playbook: row.playbook || {
        code: band === "perdu" ? "isoler" : fefo ? "accelerer" : "fefo",
        label:
          band === "perdu"
            ? "Isoler le lot"
            : fefo
              ? "Sortie prioritaire"
              : "Prioriser FEFO au picking",
        detail: row.action || "",
        owner: band === "perdu" ? "magasin" : "picking",
        urgency: band === "perdu" || band === "critique" ? "now" : band === "eleve" ? "soon" : "watch",
      },
    };
  });

  const kpis = { ...(raw.kpis || {}) };
  kpis.lotsCritique = items.filter((x) => x.band === "critique").length;
  kpis.lotsEleve = items.filter((x) => x.band === "eleve").length;
  kpis.lotsVeille = items.filter((x) => x.band === "veille").length;
  kpis.lotsPerdus = items.filter((x) => x.band === "perdu").length;
  kpis.lotsCouverts = items.filter((x) => x.band === "couvert").length;
  kpis.lotsARisque = items.filter((x) =>
    x.band === "critique" || x.band === "eleve" || x.band === "veille" || x.band === "perdu"
  ).length;
  kpis.valeurRecuperable =
    kpis.valeurRecuperable ?? items.reduce((s, x) => s + (Number(x.valeurRecuperable) || 0), 0);
  kpis.valeurPerdue = kpis.valeurPerdue ?? items.reduce((s, x) => s + (Number(x.valeurPerdue) || 0), 0);
  kpis.lotsSansFefo = kpis.lotsSansFefo ?? items.filter((x) => !x.fefoActif && x.band !== "couvert").length;
  kpis.lotsSansVitesse = kpis.lotsSansVitesse ?? items.filter((x) => x.velocityQuality === "nulle").length;
  kpis.lotsEleve = kpis.lotsEleve ?? items.filter((x) => x.band === "eleve").length;
  kpis.prioriteMoyenne =
    kpis.prioriteMoyenne ||
    (items.length ? Math.round(items.reduce((s, x) => s + (Number(x.priorite) || 0), 0) / items.length) : 0);

  const top = items[0];
  const briefing = raw.briefing?.headline
    ? raw.briefing
    : {
        tone: kpis.lotsPerdus || kpis.lotsCritique ? "critical" : kpis.lotsARisque ? "watch" : "clear",
        headline: kpis.lotsPerdus
          ? `${kpis.lotsPerdus} lot(s) hors DLC encore en stock`
          : kpis.lotsCritique
            ? `${kpis.lotsCritique} lot(s) dans la fenêtre J≤7`
            : kpis.lotsARisque
              ? `${kpis.lotsARisque} lot(s) sur le runway DLC`
              : "Runway DLC sous contrôle",
        summary: top
          ? `${top.articleLibelle || top.numero} concentre le signal · ${money(kpis.valeurPredite)} prévus à la DLC.`
          : "Score déterministe. FEFO choisit le lot ; ici on estime s’il restera invendu.",
      };

  const horizon =
    raw.horizon?.length
      ? raw.horizon
      : Object.entries(HORIZON_META)
          .map(([id, meta]) => {
            const rows = items.filter((x) => x.horizon === id);
            return {
              id,
              label: meta.label,
              lots: rows.length,
              qte: rows.reduce((s, x) => s + (Number(x.qtePrediteDlc) || 0), 0),
              valeur: rows.reduce((s, x) => s + (Number(x.valeurPredite) || 0), 0),
            };
          })
          .filter((h) => h.lots > 0 || h.id === "j7" || h.id === "j14");

  let timeline = raw.timeline;
  if (!timeline?.length) {
    const startKeys = new Map();
    startKeys.set("overdue", { key: "overdue", offset: -1, label: "Hors DLC", lots: 0, qte: 0, valeur: 0 });
    for (let i = 0; i < 21; i += 1) {
      const date = isoDayFromOffset(i);
      startKeys.set(date, {
        key: date,
        offset: i,
        date,
        label: i === 0 ? "Aujourd’hui" : `J-${i}`,
        lots: 0,
        qte: 0,
        valeur: 0,
      });
    }
    for (const x of items) {
      if (!x.dateExpiration) continue;
      const offset = Number(x.joursRestants);
      const key = offset < 0 ? "overdue" : x.dateExpiration;
      const row = startKeys.get(key) || startKeys.get("overdue");
      if (!row) continue;
      row.lots += 1;
      row.qte += Number(x.qtePrediteDlc) || 0;
      row.valeur += Number(x.valeurPredite) || 0;
    }
    timeline = [...startKeys.values()];
  }

  const byBand =
    raw.byBand?.length
      ? raw.byBand
      : ["perdu", "critique", "eleve", "veille", "couvert"]
          .map((id) => {
            const rows = items.filter((x) => x.band === id);
            return {
              id,
              lots: rows.length,
              qte: rows.reduce((s, x) => s + (Number(x.qtePrediteDlc) || 0), 0),
              valeur: rows.reduce((s, x) => s + (Number(x.valeurPredite) || 0), 0),
            };
          })
          .filter((r) => r.lots > 0);

  const byDepot =
    raw.byDepot?.length
      ? raw.byDepot
      : Object.values(
          items.reduce((acc, x) => {
            const id = x.depotId || x.depotCode || "x";
            if (!acc[id]) {
              acc[id] = {
                depotId: x.depotId,
                depotCode: x.depotCode,
                depotLibelle: x.depotLibelle || x.depotCode || "Dépôt",
                lots: 0,
                valeurPredite: 0,
              };
            }
            acc[id].lots += 1;
            acc[id].valeurPredite += Number(x.valeurPredite) || 0;
            return acc;
          }, {})
        ).sort((a, b) => b.valeurPredite - a.valeurPredite);

  const playbook =
    raw.playbook?.length
      ? raw.playbook
      : Object.values(
          items.reduce((acc, x) => {
            if (x.band === "couvert" || !x.playbook) return acc;
            const code = x.playbook.code;
            if (!acc[code]) {
              acc[code] = { ...x.playbook, lots: 0, valeur: 0 };
            }
            acc[code].lots += 1;
            acc[code].valeur += Number(x.valeurPredite) || 0;
            return acc;
          }, {})
        ).sort((a, b) => (a.urgency === "now" ? -1 : 1) || b.valeur - a.valeur);

  const spark = raw.spark?.length ? raw.spark : timeline.filter((d) => d.offset >= 0).map((d) => d.valeur);

  return { ...raw, items, kpis, briefing, horizon, timeline, byBand, byDepot, playbook, spark };
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div
      className="text-xs"
      style={{
        background: "var(--bg-modal)",
        border: `1px solid ${IA.border}`,
        borderRadius: 12,
        padding: "10px 14px",
        fontFamily: IA.fontBody,
      }}
    >
      <p className="mb-1 font-bold" style={{ color: ACCENT }}>
        {row?.label || label}
      </p>
      <p style={{ color: IA.text }}>{money(row?.valeur)}</p>
      <p style={{ color: IA.muted }}>
        {row?.lots || 0} lot(s) · {qty(row?.qte)}
      </p>
    </div>
  );
}

function DlcRing({ days, band, size = 72 }) {
  const meta = BANDS[band] || BANDS.veille;
  const r = 24;
  const c = 2 * Math.PI * r;
  const capped = days == null ? 0 : Math.max(0, Math.min(30, Number(days)));
  const pct = days == null ? 0 : days < 0 ? 1 : 1 - capped / 30;
  const offset = c - pct * c;
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke={IA.track} strokeWidth="6" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={meta.color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
        style={{ filter: `drop-shadow(0 0 7px ${meta.color}66)` }}
      />
      <text
        x="36"
        y="34"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill={IA.text}
        fontFamily="JetBrains Mono, monospace"
      >
        {dlcLabel(days)}
      </text>
      <text x="36" y="48" textAnchor="middle" fontSize="8" fill={IA.muted} fontFamily="DM Sans, sans-serif">
        DLC
      </text>
    </svg>
  );
}

function CoverageRace({ joursRestants, joursCouverture, band }) {
  const dlc = joursRestants == null ? 0 : Math.max(0, Number(joursRestants));
  const cover = joursCouverture == null ? null : Math.max(0, Number(joursCouverture));
  const max = Math.max(dlc, cover || 0, 7);
  const leftover = cover == null ? joursRestants != null && joursRestants >= 0 : cover > dlc && dlc >= 0;
  const color = leftover ? bandColor(band) : IA.accent;

  if (joursRestants != null && joursRestants < 0) {
    return (
      <p className="text-[11px] font-semibold" style={{ color: "#fb7185" }}>
        DLC dépassée — stock encore présent
      </p>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide">
        <span style={{ color: IA.muted }}>Runway</span>
        <span style={{ color }}>
          {cover == null ? "vitesse nulle" : leftover ? `${Math.round(cover - dlc)} j de trop` : "absorbe avant DLC"}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full" style={{ background: IA.track }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${Math.min(100, (dlc / max) * 100)}%`,
            background: `linear-gradient(90deg, ${ACCENT}55, ${ACCENT})`,
          }}
        />
        {cover != null ? (
          <span
            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full"
            style={{
              left: `calc(${Math.min(98, (cover / max) * 100)}% - 7px)`,
              background: leftover ? AMBER : IA.accent,
              boxShadow: `0 0 0 2px ${IA.bgCard}`,
            }}
            title="Couverture à la vitesse actuelle"
          />
        ) : null}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px]" style={{ color: IA.muted }}>
        <span>aujourd’hui</span>
        <span>DLC {dlc} j</span>
      </div>
    </div>
  );
}

function KpiTile({ label, value, hint, color, suffix = "", spark }) {
  const n = useCountUp(Number(value) || 0, 900);
  return (
    <div className="rounded-2xl p-4" style={surfaceStyle({ background: IA.panel })}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: IA.muted }}>
        {label}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="font-mono text-2xl font-semibold tabular-nums" style={{ color }}>
          {Math.round(n).toLocaleString("fr-FR")}
          {suffix}
        </p>
        {spark?.length ? <MiniSpark values={spark} color={color} width={72} height={26} /> : null}
      </div>
      <p className="mt-1 text-[11px]" style={{ color: IA.textSecondary }}>
        {hint}
      </p>
    </div>
  );
}

export default function ExpiryWasteRisk({ embedded = false }) {
  const { t, tx } = useLandingLang();
  const societeScope = useSocieteQueryScope();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState("tous");
  const [horizon, setHorizon] = useState("tous");
  const [depotId, setDepotId] = useState("tous");
  const [sort, setSort] = useState("priorite");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [cardOpen, setCardOpen] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["expiry-waste", societeScope],
    queryFn: () => api.get("stock/expiry-waste").then((r) => r.data),
    staleTime: 45_000,
  });
  const modelQuery = useQuery({
    queryKey: ["expiry-waste-model", societeScope],
    queryFn: () => api.get("stock/expiry-waste/model").then((r) => r.data),
    staleTime: 60_000,
  });
  const monitorQuery = useQuery({
    queryKey: ["expiry-waste-monitor", societeScope],
    queryFn: () => api.get("stock/expiry-waste/monitoring").then((r) => r.data),
    staleTime: 60_000,
  });

  const view = useMemo(() => hydrateExpiryPayload(data), [data]);
  const items = view?.items || [];
  const kpis = view?.kpis || {};
  const briefing = view?.briefing || {};
  const tone = briefing.tone === "critical" ? IA.red : briefing.tone === "watch" ? AMBER : IA.accent;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = items.filter((row) => {
      if (filter !== "tous" && row.band !== filter) return false;
      if (horizon !== "tous" && row.horizon !== horizon) return false;
      if (depotId !== "tous" && String(row.depotId) !== String(depotId)) return false;
      if (!q) return true;
      return [row.numero, row.articleCode, row.articleLibelle, row.depotLibelle, row.familleNom]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    const copy = rows.slice();
    copy.sort((a, b) => {
      if (sort === "valeur") return (b.valeurPredite || 0) - (a.valeurPredite || 0);
      if (sort === "dlc") return (a.joursRestants ?? 9999) - (b.joursRestants ?? 9999);
      if (sort === "proba") return (b.probaWaste || 0) - (a.probaWaste || 0);
      return (b.priorite || 0) - (a.priorite || 0);
    });
    return copy;
  }, [items, filter, horizon, depotId, query, sort]);

  const timelineChart = useMemo(
    () => (view?.timeline || []).filter((d) => d.offset < 0 || d.lots > 0 || d.offset <= 14),
    [view]
  );

  const mode = resolveExpiryMode(data);
  const badge = tx(expiryModeLabel(mode));
  const realCount = Number(data?.model?.data?.real) || 0;

  return (
    <AiModuleShell
      embedded={embedded}
      title="Risque de péremption"
      subtitle="Runway DLC : quantité et valeur encore en stock le jour de l’expiration. Complète FEFO — l’IA n’écrit pas le stock."
      kicker="Expiry Control Room"
      badge={badge}
      badgeTitle={expiryModeTitle(data, tx)}
      badgeStyle={expiryModeStyle(mode)}
      models={["GBM résiduel", "GRU", "CQR P10–P90"]}
      accent={ACCENT}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCardOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={{ background: IA.fill, color: IA.text, border: `1px solid ${IA.border}` }}
          >
            {tx("Carte du modèle")}
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={{ background: IA.accentDim, color: IA.accent, border: `1px solid ${IA.borderStrong}` }}
          >
            <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
            {isFetching ? t.aiSync || "Sync…" : "Recalculer"}
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={reduceMotion ? "h-28 rounded-2xl" : "h-28 animate-pulse rounded-2xl"}
              style={{ background: IA.fill, border: `1px solid ${IA.border}` }}
            />
          ))}
        </div>
      ) : isError ? (
        <div className="p-6 text-center" style={surfaceStyle()}>
          <p className="text-sm font-semibold" style={{ color: IA.red }}>
            Impossible de scorer les lots.
          </p>
          <button type="button" className="mt-3 text-sm underline" onClick={() => refetch()}>
            {tx("Réessayer")}
          </button>
        </div>
      ) : (
        <motion.div
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          initial={reduceMotion ? false : "hidden"}
          animate="show"
          className="space-y-5"
        >
          <MonitoringPanel data={monitorQuery.data} loading={monitorQuery.isLoading} />
          <HudFrame color={tone} className="p-5" style={surfaceStyle()}>
            <div className="relative z-[1] grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div>
                <p
                  className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em]"
                  style={{ color: tone }}
                >
                  <Hourglass size={12} />
                  Briefing live
                  <span className="ai-hero-live-dot h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
                </p>
                <h3 className="text-xl font-extrabold tracking-tight sm:text-2xl" style={{ fontFamily: IA.fontTitle }}>
                  {briefing.headline || "Runway DLC"}
                </h3>
                <p className="mt-1 max-w-xl text-[13px] leading-relaxed" style={{ color: IA.textSecondary }}>
                  {briefing.summary || "Score déterministe. FEFO choisit le lot ; ici on estime s’il restera invendu."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(view?.horizon || []).slice(0, 5).map((h) => {
                    const meta = HORIZON_META[h.id] || HORIZON_META.j30;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setHorizon(horizon === h.id ? "tous" : h.id)}
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{
                          background: horizon === h.id ? `${meta.color}22` : IA.fill,
                          color: meta.color,
                          border: `1px solid ${horizon === h.id ? meta.color : IA.border}`,
                        }}
                      >
                        {h.label} · {h.lots}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3" style={{ background: IA.fill, border: `1px solid ${IA.border}` }}>
                  <p className="text-[10px] font-bold uppercase" style={{ color: IA.muted }}>
                    Récupérable
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold" style={{ color: IA.accent }}>
                    {money(kpis.valeurRecuperable)}
                  </p>
                </div>
                <div className="rounded-xl p-3" style={{ background: IA.fill, border: `1px solid ${IA.border}` }}>
                  <p className="text-[10px] font-bold uppercase" style={{ color: IA.muted }}>
                    Hors DLC
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold" style={{ color: kpis.valeurPerdue ? IA.red : IA.text }}>
                    {money(kpis.valeurPerdue)}
                  </p>
                </div>
                <div className="rounded-xl p-3" style={{ background: IA.fill, border: `1px solid ${IA.border}` }}>
                  <p className="text-[10px] font-bold uppercase" style={{ color: IA.muted }}>
                    Sans FEFO
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold">{kpis.lotsSansFefo || 0}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: IA.fill, border: `1px solid ${IA.border}` }}>
                  <p className="text-[10px] font-bold uppercase" style={{ color: IA.muted }}>
                    Vitesse nulle
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold">{kpis.lotsSansVitesse || 0}</p>
                </div>
              </div>
            </div>
          </HudFrame>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              label="Valeur à risque"
              value={kpis.valeurPredite}
              suffix=" TND"
              hint="q_pred × prix unitaire"
              color={kpis.valeurPredite > 0 ? IA.red : IA.accent}
              spark={view?.spark}
            />
            <KpiTile
              label="Quantité prévue à la DLC"
              value={kpis.qtePredite}
              suffix=" u."
              hint="Restant − vitesse × jours"
              color={IA.yellow}
            />
            <KpiTile
              label="Lots critiques"
              value={kpis.lotsCritique}
              hint={`${kpis.lotsPerdus || 0} déjà hors DLC · ${kpis.lotsEleve || 0} élevés`}
              color={IA.red}
            />
            <KpiTile
              label="Lots suivis"
              value={kpis.lotsSuivis}
              hint={`${kpis.lotsCouverts || 0} couverts · prio. moy. ${kpis.prioriteMoyenne || 0}`}
              color={IA.accent}
            />
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
            <div className="p-4" style={surfaceStyle({ background: IA.panel })}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: IA.muted }}>
                  Runway 21 jours
                </p>
                <span className="text-[11px]" style={{ color: IA.muted }}>
                  Valeur prévue le jour de la DLC
                </span>
              </div>
              <div className="h-[180px] w-full">
                {timelineChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timelineChart} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke={IA.track} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval={2}
                      />
                      <YAxis hide />
                      <Tooltip content={<ChartTip />} cursor={{ fill: `${ACCENT}14` }} />
                      <Bar dataKey="valeur" radius={[6, 6, 0, 0]} maxBarSize={18}>
                        {timelineChart.map((d) => (
                          <Cell
                            key={d.key}
                            fill={d.offset < 0 ? "#fb7185" : d.offset <= 7 ? ACCENT : d.offset <= 14 ? AMBER : GOLD}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-[12px]" style={{ color: IA.muted }}>
                    Pas de DLC sur les 21 prochains jours.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4" style={surfaceStyle({ background: IA.panel })}>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: IA.muted }}>
                  Composition
                </p>
                <ul className="space-y-2">
                  {(view?.byBand || []).map((row) => {
                    const meta = BANDS[row.id] || BANDS.veille;
                    const max = Math.max(1, kpis.valeurPredite || 1);
                    return (
                      <li key={row.id}>
                        <div className="mb-0.5 flex items-center justify-between text-[12px]">
                          <span style={{ color: meta.color }}>{meta.label}</span>
                          <span className="font-mono" style={{ color: IA.muted }}>
                            {row.lots} · {money(row.valeur)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: IA.track }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, (row.valeur / max) * 100)}%`, background: meta.color }}
                          />
                        </div>
                      </li>
                    );
                  })}
                  {!(view?.byBand || []).length ? (
                    <li className="text-[12px]" style={{ color: IA.muted }}>
                      Aucune bande à afficher.
                    </li>
                  ) : null}
                </ul>
              </div>
              <div className="p-4" style={surfaceStyle({ background: IA.panel })}>
                <p className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: IA.muted }}>
                  <MapPin size={11} /> Concentration dépôts
                </p>
                <ul className="space-y-2">
                  {(view?.byDepot || []).slice(0, 4).map((d) => (
                    <li key={d.depotId || d.depotCode}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 text-left text-[12px]"
                        onClick={() => setDepotId(String(depotId) === String(d.depotId) ? "tous" : String(d.depotId))}
                      >
                        <span className="truncate font-medium">{d.depotLibelle}</span>
                        <span className="shrink-0 font-mono" style={{ color: d.valeurPredite ? ACCENT : IA.muted }}>
                          {money(d.valeurPredite)}
                        </span>
                      </button>
                    </li>
                  ))}
                  {kpis.depotLeader ? (
                    <li className="pt-1 text-[11px]" style={{ color: IA.muted }}>
                      {kpis.concentrationDepotPct || 0}% du risque sur {kpis.depotLeader.libelle}
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          </div>

          {(view?.playbook || []).length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {view.playbook.slice(0, 3).map((p, i) => {
                const u = URGENCY[p.urgency] || URGENCY.watch;
                return (
                  <motion.article key={p.code} variants={FADE_UP} className="ia-studio-card p-4" style={{ ...surfaceStyle(), "--card-accent": u.color }}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold" style={{ color: u.color }}>
                        0{i + 1} · {u.label}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: IA.fill, color: IA.muted }}>
                        {p.owner}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold">{p.label}</h4>
                    <p className="mt-1 text-[12px] leading-relaxed" style={{ color: IA.textSecondary }}>
                      {p.detail}
                    </p>
                    <p className="mt-2 font-mono text-[11px]" style={{ color: ACCENT }}>
                      {p.lots} lot(s) · {money(p.valeur)}
                    </p>
                  </motion.article>
                );
              })}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((id) => {
              const active = filter === id;
              const meta = id === "tous" ? { label: "Tous", color: IA.accent } : BANDS[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className="rounded-full px-3 py-1 text-[12px] font-semibold"
                  style={{
                    background: active ? `${meta.color}22` : IA.fill,
                    color: active ? meta.color : IA.muted,
                    border: `1px solid ${active ? meta.color : IA.border}`,
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
            <span className="mx-1 hidden h-4 w-px sm:block" style={{ background: IA.border }} />
            <label className="inline-flex items-center gap-1 text-[11px]" style={{ color: IA.muted }}>
              <Filter size={12} />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-lg px-2 py-1 text-[12px] outline-none"
                style={{ background: IA.bgElevated, border: `1px solid ${IA.border}`, color: IA.text }}
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="relative ml-auto min-w-[180px] flex-1 sm:max-w-[240px]">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: IA.muted }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Lot, article, dépôt…"
                className="w-full rounded-xl py-1.5 pl-8 pr-3 text-[13px] outline-none"
                style={{ background: IA.bgElevated, border: `1px solid ${IA.border}`, color: IA.text }}
              />
            </div>
            <Link to="/lots" className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: IA.accent }}>
              Lots <ArrowRight size={14} />
            </Link>
          </div>

          {!filtered.length ? (
            <div className="p-8 text-center" style={surfaceStyle()}>
              <ShieldCheck className="mx-auto mb-2" style={{ color: IA.accent }} />
              <p className="text-sm font-semibold">Rien à afficher sur ce filtre.</p>
              <p className="mt-1 text-[12px]" style={{ color: IA.muted }}>
                Lots legacy sans DLC exclus. Seuls les lots avec expiration et stock restant sont scorés.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              <AnimatePresence mode="popLayout">
              {filtered.map((row) => {
                const meta = BANDS[row.band] || BANDS.veille;
                const open = openId === row.lotId;
                return (
                  <motion.article
                    key={row.lotId}
                    variants={FADE_UP}
                    layout={!reduceMotion}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                    className="overflow-hidden"
                    style={{
                      ...surfaceStyle(),
                      borderLeft: `3px solid ${meta.color}`,
                    }}
                  >
                    <button
                      type="button"
                      className="w-full p-4 text-left"
                      onClick={() => setOpenId(open ? null : row.lotId)}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <ArticleAvatar
                          article={{
                            id: row.articleId,
                            code: row.articleCode,
                            libelle: row.articleLibelle,
                            imageUrl: row.imageUrl,
                          }}
                          size={44}
                          className="!rounded-xl"
                        />
                        <DlcRing days={row.joursRestants} band={row.band} size={64} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate text-sm font-bold" style={{ color: IA.text }}>
                              {row.articleLibelle || row.articleCode}
                            </h4>
                            <span
                              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
                              style={{ background: `${meta.color}22`, color: meta.color }}
                            >
                              {row.veilleRenforcee ? tx("Veille renforcée") : meta.label}
                            </span>
                            <span className="font-mono text-[11px]" style={{ color: IA.muted }}>
                              {row.numero} · {row.articleCode}
                            </span>
                            {!row.fefoActif ? (
                              <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${AMBER}22`, color: AMBER }}>
                                hors FEFO
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[12px]" style={{ color: IA.textSecondary }}>
                            {row.depotLibelle || row.depotCode}
                            {row.familleNom ? ` · ${row.familleNom}` : ""} · DLC {row.dateExpiration || "—"} · restant{" "}
                            {qty(row.quantiteRestante)} / {qty(row.quantiteInitiale)}
                          </p>
                          <div className="mt-2 max-w-md space-y-2">
                            <CoverageRace
                              joursRestants={row.joursRestants}
                              joursCouverture={row.joursCouverture}
                              band={row.band}
                            />
                            <IntervalBar p10={row.qteP10} p50={row.qteP50 ?? row.qtePrediteDlc} p90={row.qteP90} />
                            <DriverChips drivers={row.drivers} />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <MiniStat icon={Zap} label="Priorité" value={`${row.priorite || 0}`} warn={row.priorite >= 70} />
                        <div className="rounded-xl px-3 py-2" style={{ background: IA.fill, border: `1px solid ${IA.border}` }}>
                          <ProbaGauge proba={row.probaWaste} />
                        </div>
                        <MiniStat icon={AlertTriangle} label="Valeur P50" value={money(row.valeurPredite)} warn={row.valeurPredite > 0} />
                        <MiniStat icon={Hourglass} label="Valeur P90" value={money(row.valeurP90)} warn={(row.valeurP90 || 0) > (row.valeurPredite || 0)} />
                      </div>
                    </button>
                    <AnimatePresence>
                      {open ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-3" style={{ borderColor: IA.border }}>
                            <div>
                              <p className="text-[10px] font-bold uppercase" style={{ color: IA.muted }}>
                                Playbook
                              </p>
                              <p className="mt-1 text-[13px] font-semibold">{row.playbook?.label}</p>
                              <p className="mt-0.5 text-[12px]" style={{ color: IA.textSecondary }}>
                                {row.playbook?.detail || row.action}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase" style={{ color: IA.muted }}>
                                Formule
                              </p>
                              <p className="mt-1 font-mono text-[12px]" style={{ color: IA.textSecondary }}>
                                {qty(row.quantiteRestante)} − {row.vitesseJour} × {Math.max(row.joursRestants || 0, 0)} ={" "}
                                {qty(row.qtePrediteDlc)}
                              </p>
                              <p className="mt-1 text-[11px]" style={{ color: IA.muted }}>
                                Ventes 30 j : {qty(row.ventes30j)} · qualité {row.velocityQuality} · {row.strategieSortie || "—"}
                              </p>
                            </div>
                            <div>
                              <WhatIfPanel lotId={row.lotId} baselineProba={row.probaWaste} />
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.article>
                );
              })}
              </AnimatePresence>
            </div>
          )}

          <p className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: IA.muted }}>
            <Sparkles size={12} />
            {realCount < 30
              ? tx("Modèle pré-entraîné sur simulation, affiné au fil de vos lots réels")
              : tx("Affiné sur les lots réels observés à la DLC")}
            {" "}· {badge} · v{view?.version || data?.version || "2.0.0"}
            <Clock3 size={12} className="ml-1" />
            {tx("lots simulés")} {Number(data?.model?.data?.synthetic) || 0} · {tx("lots réels")} {realCount}
          </p>
        </motion.div>
      )}
      <ModelCardDrawer open={cardOpen} onClose={() => setCardOpen(false)} card={modelQuery.data} />
    </AiModuleShell>
  );
}

function MiniStat({ icon: Icon, label, value, warn }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: IA.fill, border: `1px solid ${IA.border}` }}>
      <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase" style={{ color: IA.muted }}>
        <Icon size={11} /> {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums" style={{ color: warn ? IA.red : IA.text }}>
        {value}
      </p>
    </div>
  );
}
