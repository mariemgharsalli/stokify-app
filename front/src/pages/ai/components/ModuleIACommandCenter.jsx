import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Cpu,
  Eye,
  Gauge,
  Layers,
  MapPin,
  Radio,
  Sparkles,
  Timer,
  Warehouse,
  Zap,
} from "lucide-react";
import { useCountUp } from "../../../hooks/useCountUp";
import { useTypewriter } from "../../../hooks/useTypewriter";
import { FADE_UP, IA, formatRelativeTime, surfaceStyle, toneColor } from "../moduleIaTheme";
import ModuleIAJourney from "./ModuleIAJourney";
import ModuleIARadar from "./ModuleIARadar";

const SEVERITY_COLOR = {
  risque: IA.red,
  opportunite: IA.accent,
  tendance: IA.blue,
};

function NeuralMesh({ color }) {
  const nodes = [
    [28, 36],
    [86, 22],
    [148, 40],
    [52, 88],
    [118, 78],
    [178, 96],
    [34, 142],
    [96, 154],
    [164, 138],
  ];
  const links = [
    [0, 1],
    [1, 2],
    [0, 3],
    [1, 4],
    [2, 5],
    [3, 4],
    [4, 5],
    [3, 6],
    [4, 7],
    [5, 8],
    [6, 7],
    [7, 8],
  ];
  return (
    <svg viewBox="0 0 210 180" className="h-full w-full" aria-hidden>
      {links.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a][0]}
          y1={nodes[a][1]}
          x2={nodes[b][0]}
          y2={nodes[b][1]}
          stroke={color}
          strokeWidth="0.7"
          opacity="0.22"
        />
      ))}
      {nodes.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r={i % 3 === 0 ? 2.8 : 1.8}
          fill={color}
          animate={{ opacity: [0.25, 0.85, 0.25], r: [1.6, 2.6, 1.6] }}
          transition={{ duration: 2.4 + (i % 4) * 0.35, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
    </svg>
  );
}

function PulseRing({ score, label, color }) {
  const reduceMotion = useReducedMotion();
  const animated = useCountUp(score, 1100);
  const size = 216;
  const cx = size / 2;
  const r = 78;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, score)) / 100) * c;
  const ticks = Array.from({ length: 72 }, (_, i) => i);

  return (
    <div className="relative mx-auto h-[216px] w-[216px]">
      {!reduceMotion ? (
        <motion.span
          className="absolute inset-6 rounded-full"
          style={{ border: `1px solid ${color}33` }}
          animate={{ scale: [1, 1.08], opacity: [0.4, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeOut" }}
        />
      ) : null}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative z-[1]">
        {ticks.map((i) => {
          const a = ((i / 72) * 360 - 90) * (Math.PI / 180);
          const inner = i % 6 === 0 ? r + 18 : r + 14;
          const outer = r + 24;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * inner}
              y1={cx + Math.sin(a) * inner}
              x2={cx + Math.cos(a) * outer}
              y2={cx + Math.sin(a) * outer}
              stroke={i % 6 === 0 ? `${color}88` : IA.track}
              strokeWidth={i % 6 === 0 ? 1.4 : 0.8}
            />
          );
        })}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={IA.track} strokeWidth="10" />
        <motion.circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ filter: `drop-shadow(0 0 10px ${color}88)` }}
        />
        {!reduceMotion ? (
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: `${cx}px ${cx}px` }}
          >
            <line
              x1={cx}
              y1={cx}
              x2={cx}
              y2={cx - r + 4}
              stroke={color}
              strokeWidth="1.4"
              opacity="0.45"
            />
          </motion.g>
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: IA.muted }}>
          Pulse
        </p>
        <p
          className="text-[42px] font-black leading-none tabular-nums"
          style={{ fontFamily: IA.fontTitle, color }}
        >
          {animated}
        </p>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color }}>
          {label}
        </p>
      </div>
    </div>
  );
}

function FactorRow({ factor, color }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium" style={{ color: IA.textSecondary }}>
          {factor.label}
        </span>
        <span className="font-mono text-[10px] tabular-nums" style={{ color: IA.muted }}>
          {factor.hint}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: IA.track }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${color}, ${IA.blue})` }}
            initial={{ width: 0 }}
            whileInView={{ width: `${factor.score}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <span className="w-8 text-right font-mono text-[11px] font-semibold tabular-nums" style={{ color }}>
          {factor.score}
        </span>
      </div>
    </div>
  );
}

function HeatRow({ row, max }) {
  const pct = max ? Math.round((row.score / max) * 100) : 0;
  const color = row.score >= 56 ? IA.red : row.score >= 24 ? IA.yellow : IA.accent;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-medium" style={{ color: IA.text }}>
          {row.depot}
        </span>
        <span className="shrink-0 font-mono text-[10px]" style={{ color: IA.muted }}>
          {row.rupture} R · {row.critique} C
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: IA.track }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        />
      </div>
    </div>
  );
}

export function fallbackCommandCenter(data) {
  const kpis = data?.kpis || {};
  const meta = data?.meta || {};
  const insights = data?.insights || [];
  const online = meta.aiServiceOnline !== false;
  const top = insights[0];
  const score = Number(meta.pulseScore ?? kpis.confianceMoyenne ?? 52);
  const band = score >= 80 ? "stable" : score >= 55 ? "attention" : "critique";
  return {
    pulse: {
      score,
      band,
      label: band.toUpperCase(),
      tone: band === "stable" ? "accent" : band === "attention" ? "yellow" : "red",
      factors: [
        { key: "service", label: "Inférence", score: online ? 90 : 48, weight: 0.2, hint: online ? "FastAPI" : "local" },
        { key: "anomalies", label: "Signaux ML", score: 70, weight: 0.2, hint: `${kpis.anomalies ?? 0} ouverts` },
        { key: "forecast", label: "Prévision", score: kpis.confianceMoyenne || 50, weight: 0.2, hint: `${kpis.previsions ?? 0} SKU` },
        { key: "execution", label: "Exécution", score: 65, weight: 0.2, hint: `${kpis.recommandations ?? 0} recos` },
        { key: "stock", label: "Couverture stock", score: 72, weight: 0.2, hint: "—" },
      ],
    },
    runtime: online ? "deep" : "resilience",
    runtimeLabel: online ? "Deep learning · FastAPI" : "Résilience locale · moteurs Node",
    latencyMs: meta.aiLatencyMs ?? null,
    coverage: {
      articlesModeled: kpis.previsions || 0,
      articlesTotal: meta.articlesTotal || 0,
      modeledPct: meta.articlesTotal ? Math.round(((kpis.previsions || 0) / meta.articlesTotal) * 100) : 0,
      depots: (data?.optimisation?.depots || []).length,
      stockPositions: 0,
      mlAnomalies: kpis.anomalies || 0,
      stockAlerts: 0,
      recosOpen: kpis.recommandations || 0,
      recosApplied: meta.decisionsAppliquees || 0,
      transfers: meta.transferCount || 0,
    },
    stack: [
      { id: "forecast", label: "Forecast", model: "N-BEATS + Holt-Winters", status: online ? "live" : "fallback", metric: `${kpis.confianceMoyenne || 0}% conf.`, tab: "prevision" },
      { id: "anomalies", label: "Anomalies", model: "IF + LOF + autoencodeur", status: online ? "live" : "fallback", metric: `${kpis.anomalies || 0} signal(s)`, tab: "anomalies" },
      { id: "expiry", label: "Péremption", model: "Runway DLC v1.1", status: online ? "live" : "fallback", metric: `${meta.expiryAtRisk || 0} lot(s)`, tab: "peremption" },
      { id: "optimisation", label: "Décision", model: "Règles + ledger", status: "live", metric: `${kpis.recommandations || 0} ouverte(s)`, tab: "optimisation" },
      { id: "load", label: "Chargement", model: "HAC + HGB Pareto", status: online ? "live" : "fallback", metric: "3D LIFO", tab: "chargement" },
      { id: "slotting", label: "Slotting", model: "GMM 3 classes", status: online ? "live" : "fallback", metric: "ABC quai", tab: "emplacement" },
      { id: "llm", label: "LLM", model: meta.groqConfigured ? "Groq · Stella" : "Non configuré", status: meta.groqConfigured ? "live" : "offline", metric: "chat", tab: "insights" },
    ],
    briefing: {
      headline: top?.titre || "Cockpit IA",
      severity: top?.type || "tendance",
      summary: top?.description || "En attente du briefing serveur.",
      impact: top?.impact || null,
      nextAction: top?.cta || { label: "Explorer", tab: "insights", why: "" },
    },
    heat: [],
    timeline: [],
  };
}

export default function ModuleIACommandCenter({
  commandCenter,
  onNavigate,
  kpis,
  prevision,
  anomalies,
  optimisation,
  insights,
  meta,
  expiryWaste,
}) {
  const reduceMotion = useReducedMotion();
  const pulse = commandCenter?.pulse;
  const color = toneColor(pulse?.tone);
  const headline = commandCenter?.briefing?.headline || "Cockpit IA";
  const typed = useTypewriter(headline, 18);
  const heat = commandCenter?.heat || [];
  const maxHeat = useMemo(() => Math.max(...heat.map((h) => h.score), 1), [heat]);
  const coverage = commandCenter?.coverage || {};
  const briefing = commandCenter?.briefing || {};
  const severityColor = SEVERITY_COLOR[briefing.severity] || IA.accent;

  if (!commandCenter) return null;

  const chips = [
    { icon: Layers, label: "SKU", value: `${coverage.articlesModeled || 0}/${coverage.articlesTotal || 0}` },
    { icon: Warehouse, label: "Dépôts", value: coverage.depots ?? "—" },
    { icon: Gauge, label: "Couverture", value: `${coverage.modeledPct ?? 0}%` },
    { icon: Radio, label: "ML / stock", value: `${coverage.mlAnomalies ?? 0} / ${coverage.stockAlerts ?? 0}` },
    { icon: Zap, label: "Recos", value: `${coverage.recosOpen ?? 0} ouvertes` },
    { icon: Timer, label: "Latence", value: commandCenter.latencyMs != null ? `${commandCenter.latencyMs} ms` : "—" },
  ];

  return (
    <motion.section
      variants={FADE_UP}
      initial="hidden"
      animate="show"
      className="relative overflow-hidden p-5 sm:p-6"
      style={surfaceStyle()}
    >
      <div className="relative mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: IA.accent }}
          >
            <Cpu size={12} /> Smart Warehouse
          </p>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl" style={{ fontFamily: IA.fontTitle }}>
            Cockpit décisionnel
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: IA.textSecondary }}>
            Stock → analyse IA → recommandation → décision → action métier
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold"
          style={{
            background: commandCenter.runtime === "deep" ? IA.accentDim : "rgba(240,201,77,0.1)",
            border: `1px solid ${commandCenter.runtime === "deep" ? IA.borderStrong : `${IA.yellow}44`}`,
            color: commandCenter.runtime === "deep" ? IA.accent : IA.yellow,
          }}
        >
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40"
              style={{ background: "currentColor" }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "currentColor" }} />
          </span>
          {commandCenter.runtimeLabel}
        </div>
      </div>

      <div className="relative mb-5">
        <ModuleIAJourney active="analyse" onNavigate={onNavigate} />
      </div>

      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <div
          className="relative overflow-hidden rounded-2xl p-4"
          style={{ background: IA.panel, border: `1px solid ${IA.border}` }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <NeuralMesh color={color} />
          </div>
          <PulseRing score={pulse?.score ?? 0} label={pulse?.label || "—"} color={color} />
          <div className="relative mt-4 space-y-3">
            {(pulse?.factors || []).map((f) => (
              <FactorRow key={f.key} factor={f} color={color} />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div
            className="relative flex-1 overflow-hidden rounded-2xl p-5"
          style={{
            background: IA.panel,
            border: `1px solid ${IA.border}`,
          }}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Sparkles size={14} style={{ color: severityColor }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: IA.muted }}>
                Briefing
              </span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase"
                style={{ background: `${severityColor}22`, color: severityColor }}
              >
                {briefing.severity || "ops"}
              </span>
            </div>
            <h3
              className="min-h-[2.4rem] text-lg font-extrabold leading-snug sm:text-xl"
              style={{ fontFamily: IA.fontTitle, color: IA.text }}
            >
              {typed}
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse align-middle" style={{ background: color }} />
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: IA.textSecondary }}>
              {briefing.summary}
            </p>
            {briefing.impact ? (
              <p className="mt-2 font-mono text-[11px]" style={{ color: severityColor }}>
                Impact · {briefing.impact}
              </p>
            ) : null}
            {briefing.nextAction ? (
              <motion.button
                type="button"
                onClick={() => onNavigate?.(briefing.nextAction.tab)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold"
                style={{
                  background: IA.accent,
                  color: IA.onAccent,
                }}
                whileHover={reduceMotion ? undefined : { y: -1 }}
              >
                <Eye size={14} />
                {briefing.nextAction.label}
                <ArrowRight size={13} />
              </motion.button>
            ) : null}
            {briefing.nextAction?.why ? (
              <p className="mt-2 text-[11px]" style={{ color: IA.muted }}>
                {briefing.nextAction.why}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {chips.map((chip) => {
              const Icon = chip.icon;
              return (
                <div
                  key={chip.label}
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: IA.fill, border: `1px solid ${IA.border}` }}
                >
                  <p className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: IA.muted }}>
                    <Icon size={10} /> {chip.label}
                  </p>
                  <p className="font-mono text-[13px] font-semibold" style={{ color: IA.text }}>
                    {chip.value}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative mt-6">
        <ModuleIARadar
          commandCenter={commandCenter}
          kpis={kpis}
          prevision={prevision}
          anomalies={anomalies}
          optimisation={optimisation}
          insights={insights}
          meta={meta}
          expiryWaste={expiryWaste}
          onNavigate={onNavigate}
        />
      </div>

      <div className="relative mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl p-4" style={{ background: IA.panel, border: `1px solid ${IA.border}` }}>
          <div className="mb-3 flex items-center gap-2">
            <MapPin size={14} style={{ color: IA.orange }} />
            <h3 className="text-sm font-bold" style={{ fontFamily: IA.fontTitle }}>
              Heat dépôts
            </h3>
          </div>
          {heat.length === 0 ? (
            <p className="py-6 text-center text-[12px]" style={{ color: IA.muted }}>
              Aucune tension stock sur le réseau.
            </p>
          ) : (
            <div className="space-y-3">
              {heat.map((row) => (
                <HeatRow key={row.depotId || row.depot} row={row} max={maxHeat} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl p-4" style={{ background: IA.panel, border: `1px solid ${IA.border}` }}>
          <div className="mb-3 flex items-center gap-2">
            <Activity size={14} style={{ color: IA.violet }} />
            <h3 className="text-sm font-bold" style={{ fontFamily: IA.fontTitle }}>
              Timeline
            </h3>
          </div>
          {(commandCenter.timeline || []).length === 0 ? (
            <p className="py-6 text-center text-[12px]" style={{ color: IA.muted }}>
              Pas encore d&apos;événement ledger ou détection.
            </p>
          ) : (
            <ol className="space-y-3">
              {commandCenter.timeline.map((ev) => {
                const isDecision = ev.kind === "decision";
                const evColor = isDecision ? IA.accent : IA.red;
                return (
                  <li key={ev.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: evColor }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="truncate text-[12px] font-semibold" style={{ color: IA.text }}>
                          {ev.label}
                        </p>
                        <span className="font-mono text-[10px]" style={{ color: IA.muted }}>
                          {formatRelativeTime(ev.at)}
                        </span>
                      </div>
                      <p className="truncate text-[11px]" style={{ color: IA.textSecondary }}>
                        {ev.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </motion.section>
  );
}
