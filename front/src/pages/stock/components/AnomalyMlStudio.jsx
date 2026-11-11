import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  IconActivity,
  IconBrain,
  IconChevronDown,
  IconCircleCheck,
  IconClock,
  IconDatabase,
  IconMinus,
  IconShieldCheck,
  IconSparkles,
} from "@tabler/icons-react";

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  gold: "#BA7517",
  success: "#1D9E75",
  warning: "#EF9F27",
  violet: "#7F77DD",
  red: "#E24B4A",
  muted: "var(--text-muted)",
};

const EASE = [0.22, 1, 0.36, 1];

const VOTE_META = [
  { key: "if", label: "IF", color: THEME.accent },
  { key: "lof", label: "LOF", color: THEME.gold },
  { key: "ae", label: "AE", color: THEME.violet },
  { key: "seq", label: "SEQ", color: THEME.cyan },
  { key: "sup", label: "SUP", color: THEME.success },
];

const RELIABILITY_STAGES = [
  { id: "start", label: "Démarrage" },
  { id: "learn", label: "En apprentissage" },
  { id: "ready", label: "Fiable" },
];

function trainCount(studio) {
  return Number(studio?.quality?.n ?? studio?.nTrain ?? 0) || 0;
}

function isOfflineMode(studio) {
  return studio?.mode === "local" || studio?.mode === "error";
}

function detectorsIdle(votes) {
  if (!votes) return true;
  return VOTE_META.every((v) => !(Number(votes[v.key]) > 0));
}

function studioStatusCopy(studio) {
  const n = trainCount(studio);
  if (n === 0) {
    return "Pas encore assez de mouvements enregistrés pour affiner la surveillance — elle s'améliore avec l'usage.";
  }
  if (isOfflineMode(studio)) {
    return "La surveillance fonctionne avec nos règles habituelles en attendant que l'assistant IA se reconnecte.";
  }
  return "L'IA surveille vos mouvements de stock et vous alerte en cas de comportement inhabituel.";
}

function reliabilityMeta(pct, n) {
  const clamped = Math.min(100, Math.max(0, Number(pct) || 0));
  if (!n || clamped < 40) {
    return { stage: 0, label: "Démarrage", color: THEME.warning, pct: n ? clamped : 18 };
  }
  if (clamped < 75) {
    return { stage: 1, label: "En apprentissage", color: THEME.cyan, pct: clamped };
  }
  return { stage: 2, label: "Fiable", color: THEME.success, pct: clamped };
}

function PipelineStep({ step, index }) {
  const ok = step.status === "ok";
  const fallback = step.status === "fallback";
  const color = ok ? THEME.success : fallback ? THEME.warning : THEME.muted;
  return (
    <motion.div
      className="min-w-0 flex-1 rounded-xl border px-3 py-2.5"
      style={{
        borderColor: "var(--border-default)",
        background: `color-mix(in srgb, ${color} 8%, var(--bg-card))`,
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.35, ease: EASE }}
    >
      <div className="flex items-center gap-2">
        {ok ? (
          <IconCircleCheck size={14} style={{ color }} />
        ) : fallback ? (
          <IconActivity size={14} style={{ color }} />
        ) : (
          <IconMinus size={14} style={{ color }} />
        )}
        <p className="text-[11px] font-bold" style={{ color }}>
          {step.label}
        </p>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-[var(--text-secondary)]">{step.detail}</p>
    </motion.div>
  );
}

export function AnomalyPipeline({ pipeline = [] }) {
  if (!pipeline.length) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      {pipeline.map((step, i) => (
        <PipelineStep key={step.id || i} step={step} index={i} />
      ))}
    </div>
  );
}

function LossSpark({ curve = [], label = "Loss MSE" }) {
  if (!curve.length) return null;
  const w = 168;
  const h = 42;
  const min = Math.min(...curve);
  const max = Math.max(...curve);
  const span = max - min || 1e-6;
  const pts = curve
    .map((v, i) => {
      const x = (i / Math.max(1, curve.length - 1)) * w;
      const y = h - 4 - ((v - min) / span) * (h - 8);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <polyline fill="none" stroke={THEME.violet} strokeWidth="1.8" points={pts} />
      </svg>
      <p className="font-mono text-[10px] text-[var(--text-muted)]">
        {curve[0]} → {curve[curve.length - 1]}
      </p>
    </div>
  );
}

function MaturityRing({ pct, label }) {
  const reduce = useReducedMotion();
  const size = 92;
  const r = 34;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, Number(pct) || 0));
  const color = clamped >= 75 ? THEME.success : clamped >= 55 ? THEME.cyan : THEME.warning;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-default)" strokeWidth="7" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
          transition={{ duration: 1.05, ease: EASE }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black tabular-nums" style={{ color }}>
          {Math.round(clamped)}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {label}
        </span>
      </div>
    </div>
  );
}

function DetectorBars({ votes = {}, flags = {} }) {
  const max = Math.max(1, ...VOTE_META.map((v) => Number(votes[v.key]) || 0));
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Score moyen par détecteur
      </p>
      <div className="space-y-2">
        {VOTE_META.map((v) => {
          const val = Number(votes[v.key]) || 0;
          const n = flags?.[v.key];
          return (
            <div key={v.key}>
              <div className="mb-0.5 flex items-center justify-between text-[11px]">
                <span className="font-semibold" style={{ color: v.color }}>
                  {v.label}
                  {n != null ? <span className="ml-1 font-mono text-[var(--text-muted)]">· {n}</span> : null}
                </span>
                <span className="font-mono tabular-nums text-[var(--text-muted)]">{val.toFixed(0)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-input)]">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(6, (val / max) * 100)}%` }}
                  transition={{ duration: 0.7, ease: EASE }}
                  style={{ background: v.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AeBlocks({ neural }) {
  const layers = neural?.hidden || [16, 8, 4, 8, 16];
  const trained = Boolean(neural?.trained);
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        <IconBrain size={12} style={{ color: THEME.violet }} />
        Autoencodeur profond
      </p>
      <div className="flex items-stretch gap-1.5">
        {layers.map((n, i) => {
          const bottle = n <= 4;
          const color = bottle ? THEME.violet : i < layers.length / 2 ? THEME.accent : THEME.cyan;
          return (
            <motion.div
              key={`${n}-${i}`}
              className="flex-1 rounded-xl border px-2 py-2.5 text-center"
              style={{
                borderColor: "var(--border-default)",
                background: `color-mix(in srgb, ${color} 12%, var(--bg-card))`,
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.35, ease: EASE }}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
                {bottle ? "Goulot" : i < layers.length / 2 ? "Enc" : "Dec"}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-primary)]">{n}u</p>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-1.5 font-mono text-[10px] text-[var(--text-muted)]">
        {trained
          ? `${neural.epochs || 0} époques · loss ${neural.finalLoss ?? "—"}`
          : "non entraîné — lancez une analyse"}
      </p>
    </div>
  );
}

function ReliabilityGauge({ pct, n }) {
  const reduce = useReducedMotion();
  const meta = reliabilityMeta(pct, n);
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-[12px] font-semibold text-[var(--text-secondary)]">
        Fiabilité de la détection
      </p>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg-input)]">
        <motion.div
          className="h-full rounded-full"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${Math.max(10, meta.pct)}%` }}
          transition={{ duration: 0.95, ease: EASE }}
          style={{ background: meta.color }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {RELIABILITY_STAGES.map((stage, i) => {
          const active = i === meta.stage;
          return (
            <span
              key={stage.id}
              className="text-[11px] font-semibold tracking-wide"
              style={{
                color: active ? meta.color : "var(--text-muted)",
                opacity: active ? 1 : 0.55,
              }}
            >
              {stage.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function StudioAdvancedPanel({ studio, onTrain, training }) {
  const isMl = studio.mode !== "local" && studio.mode !== "error";
  const quality = studio.quality || {};
  const sup = studio.supervised || {};
  const neural = studio.neural || {};

  return (
    <div className="space-y-5 pt-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Studio anomalies · {isMl ? "ensemble + DL" : "jumeau local"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p
              className="truncate text-lg font-bold text-[var(--text-primary)]"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              IF · LOF · Autoencodeur · Supervisé
            </p>
            <span
              className="rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide"
              style={{
                color: isMl ? THEME.violet : THEME.warning,
                background: `color-mix(in srgb, ${isMl ? THEME.violet : THEME.warning} 16%, transparent)`,
              }}
            >
              {studio.modele || (isMl ? "hybrid_dl" : "local")}
            </span>
            {studio.persisted ? (
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                style={{ color: THEME.success }}
              >
                <IconDatabase size={10} /> persisté
              </span>
            ) : null}
            {sup.trained ? (
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ color: THEME.cyan }}>
                calibrateur AUC {sup.auc ?? "—"}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--text-secondary)]">
            <span>{quality.n ?? studio.nTrain ?? "—"} mvts train</span>
            {sup.nPos != null ? (
              <span>
                · {sup.nPos} confirmés / {sup.nNeg || 0} normaux
              </span>
            ) : null}
            {studio.cron?.detect ? (
              <span className="inline-flex items-center gap-1">
                <IconClock size={11} /> cron {studio.cron.detect} · retrain {studio.cron.retrain}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onTrain ? (
            <button
              type="button"
              disabled={training}
              onClick={onTrain}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #7F77DD, #378ADD)" }}
            >
              <IconSparkles size={13} className={training ? "animate-spin" : ""} />
              {training ? "Entraînement…" : "Réentraîner"}
            </button>
          ) : null}
          <MaturityRing pct={quality.maturity} label="maturité" />
        </div>
      </div>

      <AnomalyPipeline pipeline={studio.pipeline} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_168px]">
        <DetectorBars votes={studio.votes} flags={studio.flags} />
        <AeBlocks neural={neural} />
        <LossSpark curve={neural.lossCurve} label="Loss AE" />
      </div>

      {studio.sequence?.trained && studio.sequence?.lossCurve?.length ? (
        <LossSpark curve={studio.sequence.lossCurve} label="Loss AE séquence 14j" />
      ) : null}

      {studio.story?.length ? (
        <ul className="grid gap-1 sm:grid-cols-2">
          {studio.story.map((line) => (
            <li
              key={line}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-hover)]/40 px-3 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)]"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function VoteChips({ votes, detectors, agreement }) {
  if (!votes) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {VOTE_META.map((v) => {
        const active = Array.isArray(detectors) ? detectors.includes(v.key) : Number(votes[v.key]) >= 60;
        const val = Number(votes[v.key]);
        if (!Number.isFinite(val)) return null;
        return (
          <span
            key={v.key}
            className="rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold"
            style={{
              color: v.color,
              background: `color-mix(in srgb, ${v.color} ${active ? 22 : 10}%, transparent)`,
              opacity: active ? 1 : 0.55,
            }}
          >
            {v.label} {Math.round(val)}
          </span>
        );
      })}
      {agreement != null ? (
        <span className="rounded-md bg-[var(--bg-hover)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-muted)]">
          accord {agreement}
        </span>
      ) : null}
    </div>
  );
}

export function AnomalyStudio({ studio, onTrain, training }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const reduce = useReducedMotion();
  if (!studio) return null;

  const n = trainCount(studio);
  const offline = isOfflineMode(studio);
  const idle = detectorsIdle(studio.votes);
  const accent = offline ? THEME.warning : n === 0 ? THEME.cyan : THEME.success;
  const status = studioStatusCopy(studio);

  return (
    <motion.div
      className="forecast-studio-dock relative overflow-hidden rounded-2xl border"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: "var(--shadow-card)",
      }}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      <div className="forecast-studio-scan pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(ellipse 50% 90% at 0% 0%, ${accent}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 0%, ${THEME.cyan}16, transparent 50%)`,
        }}
        aria-hidden
      />
      <div className="relative z-[1] space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <div
              className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                color: accent,
                background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                boxShadow: `0 0 24px color-mix(in srgb, ${accent} 22%, transparent)`,
              }}
              aria-hidden
            >
              <IconShieldCheck size={22} stroke={1.6} />
            </div>
            <div className="min-w-0">
              <h2
                className="text-lg font-bold tracking-tight text-[var(--text-primary)] sm:text-xl"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                Surveillance automatique des mouvements
              </h2>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)] sm:text-[14px]">
                {status}
              </p>
            </div>
          </div>
          {onTrain ? (
            <button
              type="button"
              disabled={training}
              onClick={onTrain}
              title="Recalcule les alertes à partir des dernières données"
              aria-label="Relancer l'analyse. Recalcule les alertes à partir des dernières données."
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #7F77DD, #378ADD)" }}
            >
              <IconSparkles size={14} className={training ? "animate-spin" : ""} />
              {training ? "Analyse en cours…" : "Relancer l'analyse"}
            </button>
          ) : null}
        </div>

        <ReliabilityGauge pct={studio.quality?.maturity} n={n} />

        {idle ? (
          <p className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-hover)]/40 px-3.5 py-2.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            L&apos;analyse n&apos;a pas encore démarré. Elle se lance automatiquement dès qu&apos;il y a assez de
            données.
          </p>
        ) : null}

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
          >
            {showAdvanced ? "Masquer le détail technique" : "Voir le détail technique"}
            <IconChevronDown
              size={13}
              className="transition-transform duration-300"
              style={{ transform: showAdvanced ? "rotate(180deg)" : undefined }}
            />
          </button>

          <AnimatePresence initial={false}>
            {showAdvanced ? (
              <motion.div
                key="anomaly-studio-advanced"
                initial={reduce ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduce ? undefined : { height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="mt-4 border-t border-[var(--border-default)] pt-5">
                  <StudioAdvancedPanel studio={studio} onTrain={onTrain} training={training} />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

export default AnomalyStudio;
