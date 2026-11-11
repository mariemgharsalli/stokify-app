import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconLayoutGrid,
  IconMapPin,
  IconPackage,
  IconSparkles,
  IconTarget,
  IconTrendingUp,
  IconGauge,
  IconBuildingWarehouse,
  IconSearch,
  IconChevronDown,
  IconBrain,
} from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import AiModuleShell from "../../components/ai/AiModuleShell";
import SearchableSelect from "../../components/ui/SearchableSelect";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import { useCountUp } from "../../hooks/useCountUp";
import { useTypewriter } from "../../hooks/useTypewriter";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../security/permissions";
import { MouvementModal } from "../mouvements/Mouvements";
import {
  SlottingStudio,
  ClusterCensus,
  MlPipeline,
  JourneyRail,
  ScoreRadar,
  GmmDonut,
  AffinityOrbit,
  WeightsBar,
  MlRulesGrid,
  GmmFeatureStrip,
  ZoneMigrationMap,
  PosteriorMini,
  resolveSlottingRules,
  SLOTTING_RULES,
} from "./components/SlottingMlStudio";
import {
  ABC_COPY,
  EXPERT_COPY,
  SIMPLE_COPY,
  abcMeta,
  formatPickGain,
  formatTrip,
  persistSlottingViewMode,
  readSlottingViewMode,
  reliabilityFromConfidence,
  rotationPhrase,
  suggestionToMoveRows,
} from "./components/slottingCopy";
import {
  SlottingFlowSummary,
  SlottingPriorityBoard,
  SlottingSimpleKpis,
  SlottingViewToggle,
} from "./components/SlottingRecommendationCard";

const EASE_OUT = [0.22, 1, 0.36, 1];

const suggestListVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const suggestCardVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: EASE_OUT },
  },
};

const planSlotVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.94 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: 0.06 + i * 0.045, duration: 0.4, ease: EASE_OUT },
  }),
};

const ROTATION_VARS = {
  Fort: { color: "var(--accent-success)", bg: "var(--success-bg)", border: "var(--success-border)" },
  Moyen: { color: "var(--accent-info)", bg: "var(--info-bg)", border: "var(--info-border)" },
  Faible: { color: "var(--accent-warning)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
};

const ABC_VARS = {
  A: {
    color: "#fff",
    bg: "linear-gradient(135deg, #BA7517 0%, #EF9F27 100%)",
    border: "#BA7517",
    hint: ABC_COPY.A.hint,
  },
  B: {
    color: "#fff",
    bg: "linear-gradient(135deg, #378ADD 0%, #0EA5E9 100%)",
    border: "#378ADD",
    hint: ABC_COPY.B.hint,
  },
  C: {
    color: "var(--text-primary)",
    bg: "linear-gradient(135deg, var(--bg-hover) 0%, var(--border-default) 100%)",
    border: "var(--border-default)",
    hint: ABC_COPY.C.hint,
  },
};

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  gold: "#BA7517",
  success: "#1D9E75",
  warning: "#EF9F27",
  danger: "#E24B4A",
};

/** Coque carte slotting — même langage que ArticleStockCard / CommerceDoc */
function SlottingShell({
  children,
  accent = THEME.accent,
  className = "",
  watermark: WatermarkIcon = null,
  hover = false,
  style,
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${className}`}
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: "var(--shadow-card)",
        ...style,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}18, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${THEME.cyan}10, transparent 50%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
        aria-hidden
      />
      {WatermarkIcon ? (
        <WatermarkIcon
          className={`pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 opacity-[0.06] ${
            hover ? "transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.1]" : ""
          }`}
          style={{ color: accent }}
          stroke={1}
          aria-hidden
        />
      ) : null}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

function SlottingEmpty({ icon: Icon, title, description }) {
  return (
    <SlottingShell accent={THEME.accent} className="px-6 py-14 text-center" watermark={Icon} hover>
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white"
        style={{
          background: `linear-gradient(145deg, ${THEME.accent}, ${THEME.cyan})`,
          boxShadow: `0 14px 28px -12px ${THEME.accent}88`,
        }}
      >
        <Icon size={28} stroke={1.75} />
      </div>
      <p className="mt-4 text-base font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--text-muted)]">{description}</p>
    </SlottingShell>
  );
}

function SlottingSkeleton({ label = "Calcul en cours…" }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-hover)]"
            style={{ animationDelay: `${i * 80}ms`, borderLeft: `3px solid ${THEME.accent}44` }}
          />
        ))}
      </div>
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-[var(--text-muted)]">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: THEME.accent }} />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

function normalizeOccupationRatio(value) {
  const raw = Number(value) || 0;
  return Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw));
}

function hslToHex(h, s, l) {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const clamp = (n) => Math.min(255, Math.max(0, Math.round((n + m) * 255)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;
}

/** Échelle vert → ambre → rouge, teintes claires et saturées. */
function occupationColorVivid(ratioPct) {
  const r = normalizeOccupationRatio(ratioPct);
  let hue;
  if (r < 0.5) {
    hue = 152 - (152 - 45) * (r / 0.5);
  } else {
    hue = 45 - 45 * ((r - 0.5) / 0.5);
  }
  return hslToHex(hue, 78, 68);
}

function occupationColorSoft(ratioPct) {
  const r = normalizeOccupationRatio(ratioPct);
  let hue;
  if (r < 0.5) {
    hue = 152 - (152 - 45) * (r / 0.5);
  } else {
    hue = 45 - 45 * ((r - 0.5) / 0.5);
  }
  return hslToHex(hue, 55, 88);
}

function usePrefersReducedMotion() {
  const framerReduce = useReducedMotion();
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return Boolean(framerReduce || reduced);
}

const TRANSPALETTE_SRC = "/cutouts/transpalette-cutout.png";

/** Transpalette réelle (cutout) — lisible sur la voie du plan. */
function PlanTranspaletteIcon({ className = "" }) {
  return (
    <div className={`relative flex items-end justify-center ${className}`.trim()}>
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 h-2 w-[68%] -translate-x-1/2 rounded-[100%] bg-black/35 blur-sm"
        aria-hidden
      />
      <img
        src={TRANSPALETTE_SRC}
        alt=""
        draggable={false}
        decoding="async"
        className="relative z-[1] block h-[58px] w-auto max-w-[92px] object-contain object-bottom sm:h-[62px]"
        aria-hidden
      />
    </div>
  );
}

function WarehousePlanSvg({
  allEmplacements = [],
  suggestions = [],
  highlightRanks = {},
  currentEmplacementId = null,
  hoveredEmplacementId = null,
  onSelect,
  canWrite = false,
  simple = false,
}) {
  const reduceMotion = usePrefersReducedMotion();
  const sorted = useMemo(
    () => [...allEmplacements].sort((a, b) => (a.distanceQuai ?? 50) - (b.distanceQuai ?? 50)),
    [allEmplacements]
  );

  const patrolDuration = Math.max(18, sorted.length * 3.8);

  const hoverIndex = useMemo(() => {
    if (hoveredEmplacementId == null) return -1;
    return sorted.findIndex((e) => Number(e.emplacementId) === Number(hoveredEmplacementId));
  }, [sorted, hoveredEmplacementId]);

  if (!sorted.length) {
    return (
      <SlottingEmpty
        icon={IconMapPin}
        title="Aucun emplacement"
        description="Ce dépôt n'a pas encore d'emplacements à visualiser sur le plan."
      />
    );
  }

  return (
    <motion.div
      className="slotting-plan group relative overflow-hidden rounded-2xl border"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${THEME.accent}`,
        boxShadow: "var(--shadow-card)",
      }}
      role="img"
      aria-label="Plan schématique du dépôt — distance au quai d'expédition"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(ellipse 50% 70% at 0% 0%, ${THEME.accent}16, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${THEME.cyan}10, transparent 50%), linear-gradient(165deg, color-mix(in srgb, ${THEME.accent} 8%, transparent) 0%, var(--bg-card) 42%, var(--bg-card) 100%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${THEME.accent}77, transparent)` }}
        aria-hidden
      />
      <div className="relative z-[1] overflow-x-auto px-5 pb-2 pt-8">
        <div className="inline-flex min-w-full flex-col">
          <div className="slotting-plan-track flex items-end gap-3">
        <div className="slotting-plan-dock flex w-14 shrink-0 flex-col items-center gap-2">
          <div
            className="slotting-plan-dock-bar flex h-44 w-11 flex-col items-center justify-center gap-1 rounded-xl"
            style={{
              background:
                "linear-gradient(180deg, var(--accent-warning) 0%, var(--commerce-warning) 100%)",
              boxShadow: "0 8px 22px color-mix(in srgb, var(--commerce-warning) 35%, transparent)",
            }}
          >
            <span className="text-lg leading-none" aria-hidden="true">
              🚪
            </span>
            <span
              className="px-0.5 text-center text-[8px] font-bold uppercase leading-tight tracking-wide"
              style={{ color: "var(--text-inverse)", writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Quai
            </span>
          </div>
          <p className="max-w-[4.5rem] text-center text-[9px] font-semibold leading-tight text-[var(--text-secondary)]">
            Quai d&apos;expédition
          </p>
        </div>

        <div className="slotting-plan-flow-rail relative mb-10 h-1 w-8 shrink-0 self-center overflow-hidden rounded-full bg-[var(--border-default)]">
          <div className="slotting-plan-flow-pulse absolute inset-y-0 left-0 w-full" />
        </div>

        <div className="relative flex items-end gap-3">
          <div
            className="slotting-plan-flow-rail pointer-events-none absolute left-0 right-0 top-1/2 z-0 h-0.5 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--border-default)] opacity-50"
            aria-hidden="true"
          >
            <div className="slotting-plan-flow-pulse absolute inset-y-0 left-0 w-1/4" />
          </div>
          {sorted.map((empl, index) => {
            const id = empl.emplacementId;
            const rank = highlightRanks[id];
            const isFull = empl.isFull || normalizeOccupationRatio(empl.occupationRatio) >= 1;
            const isCurrent =
              currentEmplacementId != null && Number(currentEmplacementId) === Number(id);
            const isHovered =
              hoveredEmplacementId != null && Number(hoveredEmplacementId) === Number(id);
            const occPct = Math.round(normalizeOccupationRatio(empl.occupationRatio) * 100);
            const vivid = occupationColorVivid(empl.occupationRatio);
            const soft = occupationColorSoft(empl.occupationRatio);

            let ringClass = "border-[var(--border-default)]";
            let ringStyle = {};
            if (rank === 1) {
              ringClass = "slotting-plan-rank1 border-dashed";
              ringStyle = { borderColor: "#BA7517", borderWidth: 2.5 };
            } else if (rank === 2 || rank === 3) {
              ringClass = "border-[var(--accent-primary)]";
              ringStyle = { borderWidth: 2.5 };
            } else if (isCurrent) {
              ringClass = "border-dashed border-[var(--text-secondary)]";
              ringStyle = { borderWidth: 2 };
            }

            if (isHovered && rank != null) {
              ringStyle = {
                ...ringStyle,
                borderWidth: rank === 1 ? 3 : 2.5,
                boxShadow:
                  rank === 1
                    ? "0 0 0 4px color-mix(in srgb, #BA7517 28%, transparent), 0 12px 28px color-mix(in srgb, #BA7517 22%, transparent)"
                    : "0 0 0 4px var(--accent-soft), 0 12px 28px color-mix(in srgb, var(--accent-primary) 22%, transparent)",
              };
            }

            return (
              <motion.button
                key={id}
                type="button"
                disabled={!canWrite || !onSelect}
                onClick={() => canWrite && onSelect?.(empl)}
                title={
                  simple
                    ? `${empl.code} — occupation ${occPct}% — trajet ${empl.distanceQuai} m`
                    : `${empl.code} — occupation ${occPct}% — distance quai ${empl.distanceQuai}/100`
                }
                className={`slotting-plan-slot group relative z-10 flex w-[5.5rem] shrink-0 flex-col items-center ${
                  canWrite && onSelect ? "cursor-pointer" : "cursor-default"
                }`}
                custom={index}
                variants={planSlotVariants}
                initial={reduceMotion ? false : "hidden"}
                animate="show"
                whileHover={
                  reduceMotion
                    ? undefined
                    : { y: -6, transition: { duration: 0.2, ease: EASE_OUT } }
                }
              >
                {rank != null && (
                  <span
                    className={`absolute -top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-md ${
                      rank === 1 ? "slotting-plan-badge-gold" : "slotting-plan-badge-accent"
                    }`}
                    style={
                      rank === 1
                        ? { background: "#BA7517", color: "#fff", border: "1.5px solid #BA7517" }
                        : {
                            background: "var(--accent-primary)",
                            color: "var(--text-inverse)",
                          }
                    }
                  >
                    {rank}
                  </span>
                )}

                <div
                  className={`relative flex h-44 w-full flex-col overflow-hidden rounded-2xl border bg-[var(--bg-card)] ${ringClass} ${
                    isFull ? "slotting-plan-full" : ""
                  }`}
                  style={ringStyle}
                >
                  <div
                    className="slotting-plan-slot-shine pointer-events-none absolute inset-x-0 top-0 h-10 opacity-70"
                    style={{
                      background:
                        "linear-gradient(180deg, color-mix(in srgb, white 35%, transparent), transparent)",
                    }}
                  />

                  <div
                    className="flex flex-1 flex-col items-center justify-center gap-2 px-2 pt-4"
                    style={{
                      background: isFull
                        ? "var(--bg-hover)"
                        : `linear-gradient(180deg, ${soft} 0%, ${vivid} 100%)`,
                    }}
                  >
                    <p
                      className="text-center text-[11px] font-bold tracking-wide"
                      style={{ color: isFull ? "var(--text-muted)" : "#0f172a" }}
                    >
                      {empl.code || "—"}
                    </p>
                    <p
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                      style={{
                        background: isFull
                          ? "var(--bg-card)"
                          : "color-mix(in srgb, white 55%, transparent)",
                        color: isFull ? "var(--text-muted)" : "#0f172a",
                      }}
                    >
                      {occPct}%
                    </p>
                  </div>

                  <div className="border-t border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-2">
                    <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg-hover)]">
                      <div
                        className="slotting-plan-gauge h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${occPct}%`,
                          background: isFull ? "var(--text-muted)" : vivid,
                        }}
                      />
                    </div>
                    <p className="text-center text-[9px] text-[var(--text-muted)]">
                      {simple ? `${empl.distanceQuai} m` : `d=${empl.distanceQuai}`}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
          </div>

          <div
            className="slotting-plan-lane relative mt-1 h-[4.25rem] w-full"
            aria-hidden="true"
          >
            <div className="pointer-events-none absolute inset-x-2 bottom-5 h-px bg-[var(--border-default)] opacity-50" />

            {reduceMotion ? (
              <div className="absolute bottom-0 left-2">
                <PlanTranspaletteIcon />
              </div>
            ) : hoverIndex >= 0 ? (
              <div
                className="slotting-plan-transpalette slotting-plan-transpalette-hover absolute bottom-0"
                style={{
                  left: `calc(9.75rem + ${hoverIndex} * 6.25rem - 44px)`,
                }}
              >
                <PlanTranspaletteIcon className="slotting-plan-transpalette-bob" />
              </div>
            ) : (
              <div
                className="slotting-plan-transpalette slotting-plan-transpalette-patrol absolute bottom-0"
                style={{ animationDuration: `${patrolDuration}s` }}
              >
                <PlanTranspaletteIcon className="slotting-plan-transpalette-bob" />
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="relative z-[1] px-5 pb-2 text-center text-[10px] font-medium tracking-wide text-[var(--text-muted)]">
        Proche du quai <span className="mx-1" style={{ color: THEME.accent }}>←</span> distance au quai{" "}
        <span className="mx-1" style={{ color: THEME.accent }}>→</span> Loin du quai
      </p>

      <div className="relative z-[1] flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border-default)] bg-[var(--bg-card)]/80 px-4 py-3 text-[10px] text-[var(--text-muted)] backdrop-blur-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-secondary)]">
          {simple ? SIMPLE_COPY.planLegend : "Zones GMM"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <motion.span
            className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold"
            style={{ background: "#BA7517", color: "#fff" }}
            title={simple ? ABC_COPY.A.hint : undefined}
            whileHover={reduceMotion ? undefined : { scale: 1.12 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
          >
            A
          </motion.span>
          {simple ? SIMPLE_COPY.zoneA : "Picking (d≤33)"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <motion.span
            className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-inverse)]"
            style={{ background: "var(--accent-info)" }}
            title={simple ? ABC_COPY.B.hint : undefined}
            whileHover={reduceMotion ? undefined : { scale: 1.12 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
          >
            B
          </motion.span>
          {simple ? SIMPLE_COPY.zoneB : "Mixte (34–66)"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <motion.span
            className="inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold"
            style={{ background: "var(--bg-hover)", borderColor: "var(--border-default)" }}
            title={simple ? ABC_COPY.C.hint : undefined}
            whileHover={reduceMotion ? undefined : { scale: 1.12 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
          >
            C
          </motion.span>
          {simple ? SIMPLE_COPY.zoneC : "Réserve (≥67)"}
        </span>
        <span className="mx-1 h-3 w-px bg-[var(--border-default)]" />
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm shadow-sm"
            style={{ background: occupationColorVivid(15) }}
          />
          Peu occupé
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm shadow-sm"
            style={{ background: occupationColorVivid(55) }}
          />
          Moyen
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm shadow-sm"
            style={{ background: occupationColorVivid(90) }}
          />
          Plein
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-6 rounded-sm border-2 border-dashed"
            style={{ borderColor: "#BA7517", background: "var(--bg-hover)" }}
          />
          1er choix
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-6 rounded-sm border-2"
            style={{ borderColor: "var(--accent-primary)", background: "var(--bg-hover)" }}
          />
          2e / 3e
        </span>
      </div>
    </motion.div>
  );
}

function AbcBadge({ abcClass, size = "md" }) {
  const reduceMotion = useReducedMotion();
  const style = ABC_VARS[abcClass] || ABC_VARS.C;
  const dim = size === "lg" ? "h-12 w-12 text-xl" : "h-8 w-8 text-sm";
  return (
    <span className="group relative inline-flex shrink-0">
      <motion.span
        className={`inline-flex ${dim} items-center justify-center rounded-xl border font-black tracking-tight shadow-sm`}
        style={{
          color: style.color,
          background: style.bg,
          borderColor: style.border,
        }}
        title={style.hint}
        aria-label={style.hint}
        initial={reduceMotion ? false : { scale: 0.55, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={reduceMotion ? undefined : { scale: 1.08 }}
        transition={{ type: "spring", stiffness: 420, damping: 16 }}
      >
        {abcClass}
      </motion.span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-52 -translate-x-1/2 rounded-xl px-3 py-2 text-center text-[11px] font-semibold leading-snug opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
        style={{
          background: "var(--bg-modal)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-default)",
        }}
      >
        {style.hint}
      </span>
    </span>
  );
}

function RotationBadge({ label, score }) {
  const style = ROTATION_VARS[label] || ROTATION_VARS.Faible;
  return (
    <span
      className="slotting-rotation-badge inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
      style={{
        color: style.color,
        background: style.bg,
        borderColor: style.border,
      }}
    >
      <span className="slotting-pulse-dot h-2 w-2 rounded-full" style={{ background: style.color }} />
      Rotation {label}
      {score != null && (
        <span className="font-mono text-[10px] opacity-80">({score} mvt/30j)</span>
      )}
    </span>
  );
}

function ScoreBar({ score, delay = 0 }) {
  const [animated, setAnimated] = useState(false);
  const displayScore = useCountUp(score, 900);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), delay);
    return () => clearTimeout(t);
  }, [score, delay]);

  const pct = Math.min(100, Math.max(0, score));
  const barColor =
    pct >= 70 ? "var(--accent-success)" : pct >= 40 ? "var(--accent-info)" : "var(--accent-warning)";

  return (
    <div className="flex items-center gap-3 min-w-[140px]">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-hover)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
          style={{
            width: animated ? `${pct}%` : "0%",
            background: barColor,
          }}
        />
      </div>
      <span className="w-8 text-right text-xs font-bold tabular-nums text-[var(--text-primary)]">
        {Math.round(displayScore)}
      </span>
    </div>
  );
}

function MiniMetricBar({ label, value, color, delay = 0 }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[var(--text-muted)]">{label}</span>
        <span className="font-semibold tabular-nums text-[var(--text-secondary)]">{pct}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-hover)]">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: ready ? `${pct}%` : "0%", background: color }}
        />
      </div>
    </div>
  );
}

function ScoreBreakdown({ breakdown, delay = 0, className = "mt-3" }) {
  if (!breakdown) return null;
  return (
    <div className={`${className} space-y-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-hover)]/40 p-2.5`}>
      <MiniMetricBar
        label="Alignement distance"
        value={breakdown.proximity}
        color="var(--accent-primary)"
        delay={delay}
      />
      <MiniMetricBar
        label="Capacité libre"
        value={breakdown.capacity}
        color="var(--accent-success)"
        delay={delay + 80}
      />
      <MiniMetricBar
        label="Cohérence zone GMM"
        value={breakdown.zoneAlignment}
        color="var(--accent-info)"
        delay={delay + 160}
      />
      {breakdown.affinity != null ? (
        <MiniMetricBar
          label="Affinité de picking"
          value={breakdown.affinity}
          color="#BA7517"
          delay={delay + 240}
        />
      ) : null}
    </div>
  );
}

function PlacementCompare({ suggestion }) {
  const reduceMotion = useReducedMotion();
  if (!suggestion?.currentEmplacementCode && !suggestion?.suggestions?.[0]) return null;
  const best = suggestion.suggestions?.[0];
  const optimal = suggestion.isOptimal;
  const accent = optimal ? THEME.success : THEME.gold;

  return (
    <SlottingShell accent={accent} className="p-4" watermark={IconArrowRight} hover>
      <div className="slotting-compare grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-input)]/70 p-3.5"
        >
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Emplacement actuel
          </p>
          {suggestion.currentEmplacementCode ? (
            <>
              <p className="font-mono text-lg font-bold text-[var(--text-primary)]">
                {suggestion.currentEmplacementCode}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                {suggestion.currentZone?.label || "—"} · d={suggestion.currentEmplacementDistance ?? "—"}/100
              </p>
              {suggestion.currentScore != null ? (
                <div className="mt-2">
                  <div className="mb-0.5 flex justify-between text-[10px] text-[var(--text-muted)]">
                    <span>Score</span>
                    <span className="font-mono tabular-nums">{suggestion.currentScore}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-input)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, Math.min(100, suggestion.currentScore))}%`,
                        background: THEME.muted,
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Aucun emplacement source</p>
          )}
        </motion.div>

        <div className="flex items-center justify-center">
          <motion.span
            animate={optimal || reduceMotion ? undefined : { x: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border text-white"
            style={{
              background: optimal
                ? `linear-gradient(145deg, ${THEME.success}, #34d399)`
                : `linear-gradient(145deg, ${THEME.accent}, ${THEME.cyan})`,
              borderColor: "transparent",
              boxShadow: `0 10px 22px -10px ${accent}`,
            }}
          >
            {optimal ? <IconCheck size={18} /> : <IconArrowRight size={18} />}
          </motion.span>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: EASE_OUT }}
          className="rounded-xl border p-3.5"
          style={{
            borderColor: optimal
              ? `color-mix(in srgb, ${THEME.success} 40%, var(--border-default))`
              : `color-mix(in srgb, ${THEME.gold} 45%, var(--border-default))`,
            background: optimal
              ? `color-mix(in srgb, ${THEME.success} 12%, transparent)`
              : `color-mix(in srgb, ${THEME.gold} 12%, transparent)`,
          }}
        >
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {optimal ? "Déjà optimal" : "Recommandé ML"}
          </p>
          {best ? (
            <>
              <p className="font-mono text-lg font-bold" style={{ color: accent }}>
                {best.code}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                {best.zone?.label || "—"} · d={best.distanceQuai}/100
              </p>
              <div className="mt-2">
                <div className="mb-0.5 flex justify-between text-[10px] text-[var(--text-muted)]">
                  <span>Score ML</span>
                  <span className="font-mono tabular-nums font-semibold" style={{ color: accent }}>
                    {best.score}
                    {suggestion.potentialScoreGain > 0 ? `  (+${suggestion.potentialScoreGain})` : ""}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-input)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, Math.min(100, best.score))}%`,
                      background: `linear-gradient(90deg, ${accent}, ${THEME.cyan})`,
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Aucune suggestion</p>
          )}
        </motion.div>
      </div>
    </SlottingShell>
  );
}

function SuggestionCard({ suggestion, rank, onApply, canWrite, applying, onHover, abcClass }) {
  const reduceMotion = useReducedMotion();
  const rankLabels = ["1er choix", "2e choix", "3e choix"];
  const isTop = rank === 0;
  const accent = isTop ? THEME.gold : rank === 1 ? THEME.accent : THEME.cyan;

  return (
    <motion.article
      className={`slotting-suggest-card group relative overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-4 ${
        isTop ? "slotting-suggest-top" : ""
      }`}
      style={{
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: isTop
          ? `0 14px 32px -14px ${THEME.gold}55`
          : "var(--shadow-card)",
      }}
      variants={suggestCardVariants}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -6,
              boxShadow: `0 18px 36px -16px ${accent}66`,
              transition: { duration: 0.22, ease: EASE_OUT },
            }
      }
      onMouseEnter={() => onHover?.(suggestion)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(suggestion)}
      onBlur={() => onHover?.(null)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}18, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${THEME.cyan}10, transparent 50%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
        aria-hidden
      />
      <IconMapPin
        className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 opacity-[0.06] transition-transform duration-500 group-hover:scale-110"
        style={{ color: accent }}
        stroke={1}
        aria-hidden
      />

      <div className="relative z-[1]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-white"
              style={{
                background: `linear-gradient(145deg, ${accent}, ${isTop ? THEME.warning : THEME.cyan})`,
                boxShadow: `0 8px 16px -8px ${accent}`,
              }}
            >
              {rank + 1}
            </span>
            <div>
              <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{suggestion.code}</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {suggestion.libelle}
                {suggestion.zone?.short ? ` · ${suggestion.zone.short}` : ""}
              </p>
            </div>
          </div>
          <span
            className="rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{
              color: accent,
              background: `color-mix(in srgb, ${accent} 16%, transparent)`,
            }}
          >
            {rankLabels[rank]}
          </span>
        </div>

        <div className="mb-2 flex flex-wrap gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <span className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-0.5">
            Distance {suggestion.distanceQuai}/100
          </span>
          <span className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-0.5">
            Occ. {suggestion.occupationRatio}%
          </span>
          {suggestion.zone?.key ? (
            <span className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-0.5">
              Zone {suggestion.zone.key}
              {abcClass ? ` · cible ${abcClass}` : ""}
            </span>
          ) : null}
          {suggestion.deltaDistance > 0 ? (
            <span
              className="rounded-md px-2 py-0.5 font-semibold"
              style={{ color: THEME.success, background: `color-mix(in srgb, ${THEME.success} 14%, transparent)` }}
            >
              −{suggestion.deltaDistance} vers le quai
            </span>
          ) : null}
        </div>

        <ScoreBar score={suggestion.score} delay={rank * 120} />
        <ScoreBreakdown breakdown={suggestion.scoreBreakdown} delay={rank * 100} />

        {suggestion.reasons?.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {suggestion.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <IconSparkles size={12} className="mt-0.5 shrink-0" style={{ color: THEME.accent }} />
                {reason}
              </li>
            ))}
          </ul>
        ) : null}

        {canWrite && onApply ? (
          <button
            type="button"
            onClick={() => onApply(suggestion.emplacementId)}
            disabled={applying}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`,
              boxShadow: `0 10px 22px -12px ${THEME.accent}`,
            }}
          >
            {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <IconArrowRight size={14} />}
            Appliquer ce déplacement
          </button>
        ) : null}
      </div>
    </motion.article>
  );
}

function KpiTile({ label, value, suffix = "", icon: Icon, accent = THEME.accent, index = 0 }) {
  const animated = useCountUp(value, 1000);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: EASE_OUT }}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -6, boxShadow: `0 18px 36px -16px ${accent}55` }
      }
    >
      <SlottingShell accent={accent} className="p-4" watermark={Icon} hover>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {label}
          </p>
          {Icon ? (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{
                background: `linear-gradient(145deg, ${accent}, ${THEME.cyan})`,
                boxShadow: `0 8px 16px -10px ${accent}`,
              }}
            >
              <Icon size={16} stroke={2} />
            </span>
          ) : null}
        </div>
        <p className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: accent }}>
          {Math.round(animated)}
          <span className="ml-0.5 text-sm font-semibold text-[var(--text-muted)]">{suffix}</span>
        </p>
        <div
          className="mt-3 h-1 overflow-hidden rounded-full"
          style={{ background: "color-mix(in srgb, var(--border-default) 70%, transparent)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${accent}, ${THEME.cyan})`,
              boxShadow: `0 0 8px ${accent}55`,
            }}
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${Math.min(100, Math.abs(Number(value)) || 12)}%` }}
            transition={{ duration: 0.85, ease: EASE_OUT, delay: 0.1 + index * 0.05 }}
          />
        </div>
      </SlottingShell>
    </motion.div>
  );
}

function MethodologyBanner({ methodology, idealDistance, abcClass, modele, mode, confidence }) {
  const hint = ABC_VARS[abcClass]?.hint;
  const showTarget = idealDistance != null && Number.isFinite(Number(idealDistance));
  const isMl = Boolean(modele) && !String(modele).includes("local") && mode !== "local";
  return (
    <SlottingShell accent={isMl ? THEME.accent : THEME.gold} className="px-4 py-3.5" watermark={IconTarget} hover>
      <div className="flex flex-wrap items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{
            background: `linear-gradient(145deg, ${isMl ? THEME.accent : THEME.gold}, ${isMl ? THEME.cyan : THEME.warning})`,
            boxShadow: `0 8px 18px -10px ${isMl ? THEME.accent : THEME.gold}`,
          }}
        >
          <IconSparkles size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              {methodology ||
                "GMM 3 classes + HistGradientBoosting + affinité de co-picking"}
            </p>
            {modele ? (
              <span
                className="rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide"
                style={{
                  color: isMl ? THEME.accent : THEME.warning,
                  background: `color-mix(in srgb, ${isMl ? THEME.accent : THEME.warning} 16%, transparent)`,
                }}
              >
                {mode === "local" ? "local" : modele}
              </span>
            ) : null}
            {confidence != null ? (
              <span className="text-[10px] tabular-nums text-[var(--text-muted)]">
                confiance {confidence}%
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {isMl
              ? "Classes A/B/C apprises par mélange gaussien (pas des seuils 33/67). Le score combine vélocité prédite, zone, capacité et voisins co-pickés."
              : "Fallback local : percentiles ABC 20/30/50 + affinité. Relancez le micro-service FastAPI pour le GMM."}{" "}
            {hint ? `${hint}. ` : ""}
            {showTarget ? (
              <>
                Distance cible :{" "}
                <span className="font-semibold tabular-nums" style={{ color: THEME.accent }}>
                  {idealDistance}/100
                </span>{" "}
                (0 = quai, 100 = fond).
              </>
            ) : null}
          </p>
        </div>
      </div>
    </SlottingShell>
  );
}

function ArticleSimpleResults({
  suggestion,
  canWrite,
  transferFromId,
  hoveredSuggestion,
  onHover,
  onApply,
}) {
  const trip = formatTrip(
    suggestion.currentEmplacementDistance,
    suggestion.suggestions?.[0]?.distanceQuai
  );
  const rel = reliabilityFromConfidence(suggestion.confidence);
  const pick = formatPickGain(suggestion.estimatedPickGainSec);
  const moveRows = suggestionToMoveRows(suggestion);

  return (
    <>
      <SlottingSimpleKpis
        tiles={[
          {
            label: SIMPLE_COPY.kpiPickGain,
            value: pick.value > 0 ? pick.headline : "—",
            hint: pick.sentence,
            icon: IconClock,
            accent: "var(--accent-success)",
          },
          {
            label: "Réduction de trajet",
            value: trip?.pct > 0 ? `−${trip.pct}` : "0",
            suffix: "%",
            hint: trip?.sentence || "Le trajet reste équivalent.",
            icon: IconMapPin,
            accent: "var(--accent-info)",
          },
          {
            label: SIMPLE_COPY.reliability,
            value: rel.label,
            hint: "Basée sur l'historique de rotation et des commandes.",
            icon: IconGauge,
            accent: "var(--accent-warning)",
          },
          {
            label: "Rotation",
            value: rotationPhrase(suggestion.rotationLabel),
            hint: abcMeta(suggestion.abcClass).hint,
            icon: IconTrendingUp,
            accent: "var(--accent-warning)",
          },
        ]}
      />

      {suggestion.isOptimal ? (
        <SlottingEmpty
          icon={IconCheck}
          title={SIMPLE_COPY.alreadyOptimalTitle}
          description={SIMPLE_COPY.alreadyOptimal}
        />
      ) : suggestion.suggestions?.length ? (
        <SlottingPriorityBoard
          items={moveRows}
          canWrite={canWrite}
          onApply={(id) => onApply(id)}
          onHover={(row) =>
            onHover(row ? { emplacementId: row.emplacementId } : null)
          }
        />
      ) : (
        <div
          className="rounded-2xl border p-4 text-sm"
          style={{
            borderColor: `color-mix(in srgb, ${THEME.warning} 40%, var(--border-default))`,
            background: `color-mix(in srgb, ${THEME.warning} 10%, transparent)`,
            color: "var(--warning-text)",
            borderLeft: `3px solid ${THEME.warning}`,
          }}
        >
          {SIMPLE_COPY.noCompatible}
        </div>
      )}

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
            style={{ background: `linear-gradient(145deg, ${THEME.accent}, ${THEME.cyan})` }}
          >
            <IconMapPin size={14} />
          </span>
          {SIMPLE_COPY.planTitle}
        </h3>
        <WarehousePlanSvg
          allEmplacements={suggestion.allEmplacements || []}
          suggestions={suggestion.suggestions || []}
          highlightRanks={Object.fromEntries(
            (suggestion.suggestions || []).map((s, i) => [s.emplacementId, i + 1])
          )}
          currentEmplacementId={transferFromId}
          hoveredEmplacementId={hoveredSuggestion?.emplacementId ?? null}
          onSelect={canWrite ? (empl) => onApply(empl.emplacementId) : undefined}
          canWrite={canWrite}
          simple
        />
      </div>
    </>
  );
}

function ArticleSuggestionView({ canWrite, initialDepotId = "", expert = false }) {
  const societeScope = useSocieteQueryScope();
  const toast = useToast();
  const [articleId, setArticleId] = useState("");
  const [depotId, setDepotId] = useState(initialDepotId || "");
  const [stockLine, setStockLine] = useState(null);
  const [mouvementPrefill, setMouvementPrefill] = useState(null);
  const [mouvementModalOpen, setMouvementModalOpen] = useState(false);
  const [hoveredSuggestion, setHoveredSuggestion] = useState(null);

  const { data: articlesData } = useQuery({
    queryKey: ["articles-select", societeScope],
    queryFn: () => api.get("articles", { params: { limit: 500, actif: true } }).then((r) => r.data),
  });

  const { data: depotsData } = useQuery({
    queryKey: ["depots", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 100, statut: "ACTIF" } }).then((r) => r.data),
  });

  const articles = articlesData?.items ?? articlesData ?? [];
  const depots = depotsData?.items ?? depotsData ?? [];

  const articleOptions = useMemo(
    () =>
      articles.map((a) => ({
        value: String(a.id),
        label: `${a.code} — ${a.libelle}`,
      })),
    [articles]
  );

  const depotOptions = useMemo(
    () =>
      depots.map((d) => ({
        value: String(d.id),
        label: `${d.code} — ${d.libelle}`,
      })),
    [depots]
  );

  const { data: suggestion, isLoading, isFetching } = useQuery({
    queryKey: ["emplacement-suggestions", societeScope, articleId, depotId],
    queryFn: () =>
      api
        .get("stock/emplacement-suggestions", { params: { articleId, depotId } })
        .then((r) => r.data),
    enabled: Boolean(articleId && depotId),
  });

  useQuery({
    queryKey: ["stock-line-for-reslot", societeScope, articleId, depotId],
    queryFn: () =>
      api
        .get("stock", { params: { articleId, depotId, limit: 10 } })
        .then((r) => {
          const lines = r.data?.data ?? r.data?.items ?? [];
          const withEmpl = lines.find((l) => l.emplacementId && Number(l.quantite) > 0);
          setStockLine(withEmpl ?? lines[0] ?? null);
          return lines;
        }),
    enabled: Boolean(articleId && depotId),
  });

  const typedExplanation = useTypewriter(suggestion?.explication ?? "");

  const transferFromId = suggestion?.currentEmplacementId ?? stockLine?.emplacementId ?? null;

  const handleApply = (emplacementDestId) => {
    if (!stockLine?.emplacementId) {
      toast.error("Aucun emplacement source trouvé pour cet article dans ce dépôt");
      return;
    }
    setMouvementPrefill({
      operation: "TRANSFERT_EMPLACEMENT",
      articleId: Number(articleId),
      depotOrigineId: Number(depotId),
      emplacementOrigineId: stockLine.emplacementId,
      depotDestId: Number(depotId),
      emplacementDestId: Number(emplacementDestId),
      quantite: stockLine.quantite,
      commentaire: expert
        ? "Déplacement suggéré par le slotting ML (GMM + affinité)"
        : SIMPLE_COPY.moveComment,
    });
    setMouvementModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fadeUp">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            {SIMPLE_COPY.articleLabel}
          </label>
          <SearchableSelect
            options={articleOptions}
            value={articleId}
            onChange={setArticleId}
            placeholder="Rechercher un article…"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            {SIMPLE_COPY.depotLabel}
          </label>
          <SearchableSelect
            options={depotOptions}
            value={depotId}
            onChange={setDepotId}
            placeholder="Sélectionner un dépôt…"
          />
        </div>
      </div>

      {!articleId || !depotId ? (
        <SlottingEmpty
          icon={IconPackage}
          title={expert ? "Suggestion slotting ML" : SIMPLE_COPY.emptyArticleTitle}
          description={
            expert
              ? "Sélectionnez un article et un dépôt. Un GMM classe la rotation (A/B/C), puis le score combine zone, capacité et affinité de co-picking."
              : SIMPLE_COPY.emptyArticle
          }
        />
      ) : isLoading || isFetching ? (
        <SlottingSkeleton
          label={expert ? "GMM · demande HGB · affinité de picking…" : SIMPLE_COPY.loadingArticle}
        />
      ) : suggestion ? (
        expert ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiTile
                label="Gain de score"
                value={suggestion.potentialScoreGain ?? 0}
                suffix=" pts"
                icon={IconTrendingUp}
                accent={THEME.success}
                index={0}
              />
              <KpiTile
                label="Gain parcours estimé"
                value={suggestion.estimatedPickGainSec ?? 0}
                suffix=" s"
                icon={IconClock}
                accent={THEME.accent}
                index={1}
              />
              <KpiTile
                label="Distance cible"
                value={suggestion.idealDistance ?? 0}
                suffix="/100"
                icon={IconMapPin}
                accent={THEME.cyan}
                index={2}
              />
              <KpiTile
                label="Maturité modèle"
                value={suggestion.quality?.maturity ?? suggestion.confidence ?? 0}
                suffix="%"
                icon={IconGauge}
                accent={THEME.gold}
                index={3}
              />
            </div>

            {suggestion?.fallbackReason ? (
              <p
                className="rounded-lg border px-3 py-2 text-xs"
                style={{
                  color: "var(--text-secondary)",
                  borderColor: "var(--border-default)",
                  background: "var(--bg-hover)",
                }}
              >
                {suggestion.fallbackReason}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <RotationBadge label={suggestion.rotationLabel} score={suggestion.rotationScore} />
              {suggestion.demand?.used && suggestion.demand?.predicted90 != null ? (
                <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                  HGB {suggestion.demand.predicted90} mvt/90j
                  {suggestion.demand.r2 != null ? ` · R² ${suggestion.demand.r2}` : ""}
                </span>
              ) : null}
              {suggestion.quality?.certainty != null ? (
                <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                  certitude {Math.round(suggestion.quality.certainty * 100)}%
                </span>
              ) : null}
            </div>

            <SlottingStudio
              suggestion={suggestion}
              abcBadge={<AbcBadge abcClass={suggestion.abcClass || "C"} size="lg" />}
            />

            <PlacementCompare suggestion={suggestion} />

            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                  style={{ background: `linear-gradient(145deg, ${THEME.accent}, ${THEME.cyan})` }}
                >
                  <IconMapPin size={14} />
                </span>
                Plan du dépôt — zones A / B / C
              </h3>
              <WarehousePlanSvg
                allEmplacements={suggestion.allEmplacements || []}
                suggestions={suggestion.suggestions || []}
                highlightRanks={Object.fromEntries(
                  (suggestion.suggestions || []).map((s, i) => [s.emplacementId, i + 1])
                )}
                currentEmplacementId={transferFromId}
                hoveredEmplacementId={hoveredSuggestion?.emplacementId ?? null}
                onSelect={canWrite ? (empl) => handleApply(empl.emplacementId) : undefined}
                canWrite={canWrite}
              />
            </div>

            <SlottingShell accent={THEME.accent} className="p-5" watermark={IconTarget} hover>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                  style={{
                    background: `linear-gradient(145deg, ${THEME.gold}, ${THEME.warning})`,
                    boxShadow: `0 8px 16px -10px ${THEME.gold}`,
                  }}
                >
                  <IconTarget size={16} />
                </span>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Explication ML</h3>
              </div>
              <p className="min-h-[3rem] text-sm leading-relaxed text-[var(--text-secondary)]">
                {typedExplanation}
                {typedExplanation.length < (suggestion.explication?.length ?? 0) && (
                  <span
                    className="slotting-cursor ml-0.5 inline-block h-4 w-0.5"
                    style={{ background: THEME.accent }}
                  />
                )}
              </p>
            </SlottingShell>

            {suggestion.suggestions?.length > 0 ? (
              <motion.div
                className="grid gap-4 md:grid-cols-3"
                variants={suggestListVariants}
                initial="hidden"
                animate="show"
              >
                {suggestion.suggestions.map((s, i) => (
                  <SuggestionCard
                    key={s.emplacementId}
                    suggestion={s}
                    rank={i}
                    abcClass={suggestion.abcClass}
                    canWrite={canWrite}
                    onApply={handleApply}
                    applying={false}
                    onHover={setHoveredSuggestion}
                  />
                ))}
              </motion.div>
            ) : (
              <div className="rounded-2xl border p-4 text-sm" style={{
                borderColor: `color-mix(in srgb, ${THEME.warning} 40%, var(--border-default))`,
                background: `color-mix(in srgb, ${THEME.warning} 10%, transparent)`,
                color: "var(--warning-text)",
                borderLeft: `3px solid ${THEME.warning}`,
              }}>
                Aucun emplacement compatible disponible dans ce dépôt.
              </div>
            )}
          </>
        ) : (
          <ArticleSimpleResults
            suggestion={suggestion}
            canWrite={canWrite}
            transferFromId={transferFromId}
            hoveredSuggestion={hoveredSuggestion}
            onHover={setHoveredSuggestion}
            onApply={handleApply}
          />
        )
      ) : null}

      <MouvementModal
        open={mouvementModalOpen}
        onClose={() => {
          setMouvementModalOpen(false);
          setMouvementPrefill(null);
        }}
        articles={articles}
        depots={depots}
        initialValues={mouvementPrefill}
        restrictToOperation="TRANSFERT_EMPLACEMENT"
        onSuccess={() => toast.success("Transfert d'emplacement enregistré")}
      />
    </div>
  );
}

function AuditReslotCard({ row, index, expanded, onToggle, onApply, canWrite }) {
  const reduceMotion = useReducedMotion();
  const accent =
    row.abcClass === "A" ? THEME.gold : row.abcClass === "B" ? THEME.accent : THEME.cyan;
  const radar =
    row.radar ||
    (row.scoreBreakdown
      ? {
          proximity: row.scoreBreakdown.proximity,
          zone: row.scoreBreakdown.zoneAlignment,
          capacity: row.scoreBreakdown.capacity,
          affinity: row.scoreBreakdown.affinity,
        }
      : null);

  return (
    <motion.article
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.28), duration: 0.38, ease: EASE_OUT }}
      className="overflow-hidden rounded-2xl border"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: expanded ? `0 16px 32px -18px ${accent}66` : "var(--shadow-card)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--bg-hover)]/50"
      >
        <AbcBadge abcClass={row.abcClass || "C"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{row.articleCode}</p>
            {row.mismatch ? (
              <span
                className="rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold"
                style={{
                  color: THEME.warning,
                  background: `color-mix(in srgb, ${THEME.warning} 16%, transparent)`,
                }}
              >
                {row.mismatch}
              </span>
            ) : null}
            {row.confidence != null ? (
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                {row.confidence}% conf.
              </span>
            ) : null}
          </div>
          <p className="truncate text-[11px] text-[var(--text-muted)]">{row.articleLibelle}</p>
          <p className="mt-1.5 font-mono text-[11px] text-[var(--text-secondary)]">
            {row.currentEmplacementCode}
            <span className="mx-1" style={{ color: THEME.accent }}>
              →
            </span>
            <span className="font-semibold" style={{ color: THEME.accent }}>
              {row.recommendedEmplacementCode}
            </span>
            <span className="ml-1.5 text-[var(--text-muted)]">
              d={row.currentEmplacementDistance}→{row.recommendedDistance}
            </span>
          </p>
        </div>
        <div className="hidden sm:block">
          <PosteriorMini posterior={row.posterior} abcClass={row.abcClass} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold"
            style={{
              color: THEME.success,
              background: `color-mix(in srgb, ${THEME.success} 14%, transparent)`,
            }}
          >
            +{row.scoreGain} pts
          </span>
          {row.estimatedPickGainSec > 0 ? (
            <span className="text-[10px] text-[var(--text-muted)]">~{row.estimatedPickGainSec} s</span>
          ) : null}
          <IconChevronDown
            size={16}
            className="mt-1 text-[var(--text-muted)] transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : undefined }}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="overflow-hidden border-t border-[var(--border-default)]"
          >
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_140px]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <RotationBadge label={row.rotationLabel} score={row.rotationScore} />
                  {row.demand?.used && row.demand?.predicted90 != null ? (
                    <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                      HGB {row.demand.predicted90} mvt/90j
                      {row.demand.r2 != null ? ` · R² ${row.demand.r2}` : ""}
                    </span>
                  ) : null}
                </div>
                <JourneyRail
                  fromDistance={row.currentEmplacementDistance}
                  toDistance={row.recommendedDistance}
                  fromCode={row.currentEmplacementCode}
                  toCode={row.recommendedEmplacementCode}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {row.currentBreakdown ? (
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Score actuel
                      </p>
                      <ScoreBreakdown breakdown={row.currentBreakdown} className="" />
                    </div>
                  ) : null}
                  {row.scoreBreakdown ? (
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Score cible GMM
                      </p>
                      <ScoreBreakdown breakdown={row.scoreBreakdown} className="" />
                    </div>
                  ) : null}
                </div>
                {row.reasons?.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {row.reasons.map((reason) => (
                      <li
                        key={reason}
                        className="rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1 text-[10px] text-[var(--text-secondary)]"
                      >
                        {reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {row.affinityNeighbors?.length ? (
                  <AffinityOrbit neighbors={row.affinityNeighbors} />
                ) : null}
                {canWrite ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onApply(row);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110"
                    style={{
                      background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`,
                      boxShadow: `0 8px 16px -10px ${THEME.accent}`,
                    }}
                  >
                    <IconArrowRight size={13} />
                    Reslotter
                  </button>
                ) : null}
              </div>
              <div className="flex flex-col items-center justify-center gap-1">
                <ScoreRadar radar={radar} size={132} />
                <p className="text-[10px] text-[var(--text-muted)]">radar cible</p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

function AuditGlobalView({ canWrite, initialDepotId = "", expert = false }) {
  const societeScope = useSocieteQueryScope();
  const toast = useToast();
  const [depotId, setDepotId] = useState(initialDepotId || "");
  const [mouvementPrefill, setMouvementPrefill] = useState(null);
  const [mouvementModalOpen, setMouvementModalOpen] = useState(false);
  const [abcFilter, setAbcFilter] = useState("all");
  const [flowFilter, setFlowFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const { data: depotsData } = useQuery({
    queryKey: ["depots", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 100, statut: "ACTIF" } }).then((r) => r.data),
  });

  const { data: articlesData } = useQuery({
    queryKey: ["articles-audit-empl", societeScope],
    queryFn: () => api.get("articles", { params: { limit: 500, actif: true } }).then((r) => r.data),
  });
  const depots = depotsData?.items ?? depotsData ?? [];
  const articles = articlesData?.items ?? articlesData ?? [];

  const depotOptions = useMemo(
    () =>
      depots.map((d) => ({
        value: String(d.id),
        label: `${d.code} — ${d.libelle}`,
      })),
    [depots]
  );

  const selectedDepot = useMemo(
    () => depots.find((d) => String(d.id) === String(depotId)) || null,
    [depots, depotId]
  );

  const { data: audit, isLoading } = useQuery({
    queryKey: ["emplacement-audit", societeScope, depotId],
    queryFn: () => api.get(`stock/emplacement-audit/${depotId}`).then((r) => r.data),
    enabled: Boolean(depotId),
  });

  const applyReslot = (row) => {
    if (!row.currentEmplacementId) {
      toast.error("Emplacement source inconnu pour cet article");
      return;
    }
    setMouvementPrefill({
      operation: "TRANSFERT_EMPLACEMENT",
      articleId: row.articleId,
      depotOrigineId: Number(depotId),
      emplacementOrigineId: row.currentEmplacementId,
      depotDestId: Number(depotId),
      emplacementDestId: row.recommendedEmplacementId,
      commentaire: expert
        ? "Reslotting ML depuis l'audit global des emplacements"
        : SIMPLE_COPY.moveComment,
    });
    setMouvementModalOpen(true);
  };

  const stats = audit?.stats ?? {};
  const items = audit?.items ?? [];
  const rules = resolveSlottingRules(audit);
  const censusPosterior = useMemo(() => {
    const n = Math.max(1, Number(audit?.census?.n) || 0);
    if (!audit?.census) return null;
    return {
      A: (audit.census.A || 0) / n,
      B: (audit.census.B || 0) / n,
      C: (audit.census.C || 0) / n,
    };
  }, [audit?.census]);
  const censusWinner =
    audit?.census &&
    ["A", "B", "C"].sort((a, b) => (audit.census[b] || 0) - (audit.census[a] || 0))[0];

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((row) => {
      if (abcFilter !== "all" && row.abcClass !== abcFilter) return false;
      if (flowFilter === "dock") {
        const from = Number(row.currentEmplacementDistance);
        const to = Number(row.recommendedDistance);
        if (!(Number.isFinite(from) && Number.isFinite(to) && to < from)) return false;
      }
      if (flowFilter === "reserve") {
        const from = Number(row.currentEmplacementDistance);
        const to = Number(row.recommendedDistance);
        if (!(Number.isFinite(from) && Number.isFinite(to) && to > from)) return false;
      }
      if (q) {
        const hay = `${row.articleCode || ""} ${row.articleLibelle || ""} ${row.currentEmplacementCode || ""} ${row.recommendedEmplacementCode || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, abcFilter, flowFilter, query]);

  const filters = expert
    ? [
        { id: "all", label: "Tous" },
        { id: "A", label: "Classe A" },
        { id: "B", label: "Classe B" },
        { id: "C", label: "Classe C" },
      ]
    : [
        { id: "all", label: SIMPLE_COPY.allItems },
        { id: "A", label: SIMPLE_COPY.filterA },
        { id: "B", label: SIMPLE_COPY.filterB },
        { id: "C", label: SIMPLE_COPY.filterC },
      ];
  const flowFilters = expert
    ? [
        { id: "all", label: "Tous flux" },
        { id: "dock", label: "Vers quai" },
        { id: "reserve", label: "Vers réserve" },
      ]
    : [
        { id: "all", label: SIMPLE_COPY.flowAll },
        { id: "dock", label: SIMPLE_COPY.flowDock },
        { id: "reserve", label: SIMPLE_COPY.flowReserve },
      ];

  return (
    <div className="space-y-6 animate-fadeUp">
      <SlottingShell accent={THEME.gold} className="p-4 sm:p-5" watermark={IconBuildingWarehouse} hover>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              <IconBrain size={13} style={{ color: THEME.gold }} />
              {expert ? "Cockpit slotting dépôt" : SIMPLE_COPY.auditLead}
            </p>
            <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
              {selectedDepot
                ? `${selectedDepot.code} — ${selectedDepot.libelle}`
                : expert
                  ? "Audit ML du dépôt"
                  : "Vue d'ensemble du dépôt"}
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
              {expert
                ? "GMM 3 classes, HGB 90 j, affinité de co-picking et politique de zone — un scan, les SKU hors gaussienne ressortent."
                : SIMPLE_COPY.auditHint}
            </p>
          </div>
          <div className="w-full max-w-md">
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Dépôt à auditer
            </label>
            <SearchableSelect
              options={depotOptions}
              value={depotId}
              onChange={(v) => {
                setDepotId(v);
                setExpandedId(null);
                setQuery("");
                setAbcFilter("all");
                setFlowFilter("all");
              }}
              placeholder="Sélectionner un dépôt…"
            />
          </div>
        </div>
        {audit ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
            {expert ? (
              <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-0.5 font-mono">
                {audit.modele || "gmm"}
              </span>
            ) : null}
            <span>
              {expert
                ? `${audit.placedCount ?? stats.placedCount ?? 0} SKU scannés · ${stats.misalignedCount ?? 0} hors zone`
                : `${audit.placedCount ?? stats.placedCount ?? 0} articles passés en revue · ${stats.misalignedCount ?? 0} à déplacer`}
            </span>
            {stats.underutilizedEmplacements != null ? (
              <span>
                {expert
                  ? `${stats.underutilizedEmplacements} empl. sous-utilisés`
                  : `${stats.underutilizedEmplacements} emplacements peu occupés`}
              </span>
            ) : null}
          </div>
        ) : null}
      </SlottingShell>

      {!depotId ? (
        <div className="space-y-4">
          <SlottingEmpty
            icon={IconLayoutGrid}
            title={expert ? "Audit slotting du dépôt" : SIMPLE_COPY.emptyAuditTitle}
            description={
              expert
                ? "Choisissez un dépôt. Le GMM classe le catalogue, le HGB projette la demande, l'affinité rapproche les co-pickés — les SKU A restent près du quai."
                : SIMPLE_COPY.emptyAudit
            }
          />
          {expert ? (
            <>
              <GmmFeatureStrip />
              <MlRulesGrid rules={SLOTTING_RULES} />
            </>
          ) : null}
        </div>
      ) : isLoading ? (
        <SlottingSkeleton
          label={expert ? "GMM · HGB · affinité · scan des emplacements…" : SIMPLE_COPY.loadingAudit}
        />
      ) : (
        <>
          {expert ? (
            <>
              {audit?.fallbackReason ? (
                <p
                  className="rounded-lg border px-3 py-2 text-xs"
                  style={{
                    color: "var(--text-secondary)",
                    borderColor: "var(--border-default)",
                    background: "var(--bg-hover)",
                  }}
                >
                  {audit.fallbackReason}
                </p>
              ) : null}
              {audit?.methodology && (
                <MethodologyBanner
                  methodology={audit.methodology}
                  modele={audit.modele}
                  mode={audit.mode}
                  confidence={audit.quality?.maturity}
                />
              )}
              <MlRulesGrid rules={rules} />
              <GmmFeatureStrip />
              {audit?.pipeline?.length ? <MlPipeline pipeline={audit.pipeline} /> : null}

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_168px]">
                <div className="space-y-4">
                  {audit?.census ? <ClusterCensus census={audit.census} quality={audit.quality} /> : null}
                  {audit?.weights ? <WeightsBar weights={audit.weights} /> : null}
                  {audit?.quality ? (
                    <div className="flex flex-wrap gap-3 font-mono text-[10px] text-[var(--text-muted)]">
                      {audit.quality.silhouette != null ? <span>silhouette {audit.quality.silhouette}</span> : null}
                      {audit.gmmBic != null ? <span>BIC {Math.round(audit.gmmBic)}</span> : null}
                      {audit.quality.maturity != null ? <span>maturité {audit.quality.maturity}%</span> : null}
                      {audit.gmmMode ? <span>{audit.gmmMode}</span> : null}
                    </div>
                  ) : null}
                </div>
                {censusPosterior ? (
                  <div className="flex flex-col items-center justify-center">
                    <GmmDonut
                      posterior={censusPosterior}
                      abcClass={censusWinner || "C"}
                      confidence={audit?.quality?.maturity}
                      size={148}
                    />
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">mix catalogue</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {expert ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiTile
                label="Articles mal placés"
                value={stats.misalignedCount ?? 0}
                icon={IconPackage}
                accent={THEME.danger}
                index={0}
              />
              <KpiTile
                label="Gain moyen"
                value={stats.avgPotentialGain ?? 0}
                suffix=" pts"
                icon={IconTrendingUp}
                accent={THEME.success}
                index={1}
              />
              <KpiTile
                label="Classe A à reslotter"
                value={stats.classACount ?? 0}
                icon={IconTarget}
                accent={THEME.gold}
                index={2}
              />
              <KpiTile
                label="Gain parcours total"
                value={stats.totalPickGainSec ?? 0}
                suffix=" s"
                icon={IconClock}
                accent={THEME.cyan}
                index={3}
              />
            </div>
          ) : (
            <SlottingSimpleKpis
              tiles={[
                {
                  label: SIMPLE_COPY.kpiMisaligned,
                  value: stats.misalignedCount ?? 0,
                  icon: IconPackage,
                  accent: "var(--accent-danger)",
                },
                {
                  label: SIMPLE_COPY.kpiPickGain,
                  value: stats.totalPickGainSec ?? 0,
                  suffix: " s",
                  hint: "Temps de préparation économisé si tous les déplacements sont appliqués.",
                  icon: IconClock,
                  accent: "var(--accent-success)",
                },
                {
                  label: SIMPLE_COPY.kpiPriority,
                  value: stats.classACount ?? 0,
                  hint: ABC_COPY.A.hint,
                  icon: IconTarget,
                  accent: "var(--accent-warning)",
                },
                {
                  label: SIMPLE_COPY.kpiTrip,
                  value: stats.towardsDock ?? audit?.zoneFlows?.towardsDock ?? 0,
                  icon: IconMapPin,
                  accent: "var(--accent-info)",
                },
              ]}
            />
          )}

          {expert ? (
            <ZoneMigrationMap items={items} flows={audit?.zoneFlows} />
          ) : (
            <SlottingFlowSummary
              towardsDock={stats.towardsDock ?? audit?.zoneFlows?.towardsDock ?? 0}
              towardsReserve={stats.towardsReserve ?? audit?.zoneFlows?.towardsReserve ?? 0}
            />
          )}

          {items.length === 0 ? (
            <SlottingShell accent={THEME.success} className="px-6 py-10 text-center" watermark={IconCheck} hover>
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white"
                style={{
                  background: `linear-gradient(145deg, ${THEME.success}, #34d399)`,
                  boxShadow: `0 12px 24px -12px ${THEME.success}`,
                }}
              >
                <IconCheck size={24} />
              </div>
              <p className="mt-4 text-sm font-semibold" style={{ color: THEME.success }}>
                {expert ? "Emplacements optimaux" : SIMPLE_COPY.optimalDepotTitle}
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-secondary)]">
                {expert
                  ? "Tous les articles sont dans le top-3 GMM de leur zone. Aucun reslotting prioritaire."
                  : SIMPLE_COPY.optimalDepot}
              </p>
            </SlottingShell>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {filters.map((f) => {
                    const active = abcFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setAbcFilter(f.id)}
                        className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
                        style={{
                          color: active ? "#fff" : "var(--text-secondary)",
                          background: active
                            ? `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`
                            : "var(--bg-input)",
                          boxShadow: active ? `0 8px 16px -10px ${THEME.accent}` : undefined,
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                  <span className="mx-1 hidden h-6 w-px bg-[var(--border-default)] sm:inline" />
                  {flowFilters.map((f) => {
                    const active = flowFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFlowFilter(f.id)}
                        className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
                        style={{
                          color: active ? "#fff" : "var(--text-secondary)",
                          background: active ? THEME.gold : "var(--bg-input)",
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                <label className="relative block w-full sm:max-w-xs">
                  <IconSearch
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={expert ? "SKU, emplacement…" : SIMPLE_COPY.searchPlaceholder}
                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] py-2 pl-8 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                  />
                </label>
              </div>

              {filteredItems.length === 0 ? (
                <p className="rounded-2xl border border-[var(--border-default)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                  {expert ? "Aucun SKU ne correspond à ce filtre." : SIMPLE_COPY.noMatch}
                </p>
              ) : expert ? (
                <div className="space-y-2.5">
                  {filteredItems.map((row, i) => {
                    const key = `${row.articleId}-${row.stockLineId}`;
                    return (
                      <AuditReslotCard
                        key={key}
                        row={row}
                        index={i}
                        expanded={expandedId === key}
                        onToggle={() => setExpandedId((prev) => (prev === key ? null : key))}
                        onApply={applyReslot}
                        canWrite={canWrite}
                      />
                    );
                  })}
                </div>
              ) : (
                <SlottingPriorityBoard
                  items={filteredItems}
                  canWrite={canWrite}
                  onApply={(_id, row) => applyReslot(row)}
                />
              )}
            </div>
          )}
        </>
      )}
      <MouvementModal
        open={mouvementModalOpen}
        onClose={() => {
          setMouvementModalOpen(false);
          setMouvementPrefill(null);
        }}
        articles={articles}
        depots={depots}
        initialValues={mouvementPrefill}
        restrictToOperation="TRANSFERT_EMPLACEMENT"
        onSuccess={() => toast.success("Transfert d'emplacement enregistré")}
      />
    </div>
  );
}

export default function EmplacementOptimization({ embedded = false }) {
  const user = useAuthStore((s) => s.user);
  const canWrite = hasPermission(user?.role, "stock:write");
  const [searchParams] = useSearchParams();
  const initialDepotId = searchParams.get("depotId") || "";
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "audit" ? "audit" : "article");
  const [viewMode, setViewMode] = useState(readSlottingViewMode);
  const reduceMotion = useReducedMotion();
  const expert = viewMode === "expert";

  useEffect(() => {
    persistSlottingViewMode(viewMode);
  }, [viewMode]);

  const tabs = [
    { id: "article", label: expert ? EXPERT_COPY.articleTab : SIMPLE_COPY.articleTab, icon: IconPackage },
    { id: "audit", label: expert ? EXPERT_COPY.auditTab : SIMPLE_COPY.auditTab, icon: IconLayoutGrid },
  ];

  return (
    <AiModuleShell
      embedded={embedded}
      title="Optimisation des emplacements"
      subtitle={expert ? EXPERT_COPY.pageSubtitle : SIMPLE_COPY.pageSubtitle}
      kicker={expert ? undefined : SIMPLE_COPY.kicker}
      badge={expert ? undefined : SIMPLE_COPY.badge}
      models={expert ? undefined : SIMPLE_COPY.chips}
      actions={<SlottingViewToggle mode={viewMode} onChange={setViewMode} />}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border-default)] p-1.5"
          style={{
            background: "var(--bg-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className="relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
                style={{
                  color: active ? "#fff" : "var(--text-muted)",
                  background: active
                    ? `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`
                    : "transparent",
                  boxShadow: active ? `0 10px 22px -12px ${THEME.accent}` : undefined,
                }}
              >
                {!reduceMotion && active ? (
                  <motion.span
                    layoutId="slotting-tab-glow"
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{ boxShadow: `0 0 0 1px color-mix(in srgb, ${THEME.cyan} 40%, transparent)` }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                ) : null}
                <Icon size={16} className="relative z-[1]" />
                <span className="relative z-[1]">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "article" ? (
        <ArticleSuggestionView canWrite={canWrite} initialDepotId={initialDepotId} expert={expert} />
      ) : (
        <AuditGlobalView canWrite={canWrite} initialDepotId={initialDepotId} expert={expert} />
      )}
    </AiModuleShell>
  );
}
