import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { interpolate } from "../../../i18n/languages";
import { useLandingLang } from "../../landing/LandingLangContext";
import { FADE_UP, IA, surfaceStyle, tabMeta, toneColor } from "../moduleIaTheme";

function countRuptures(anomalies = [], recos = []) {
  const fromAnomalies = anomalies.filter(
    (a) => a.type === "rupture" || (a.source === "stock" && a.severite === "elevee")
  ).length;
  if (fromAnomalies > 0) return fromAnomalies;
  return recos.filter((r) => r.type === "reapprovisionner" && !r.applied).length;
}

function countUnusual(anomalies = []) {
  return anomalies.filter((a) => a.type !== "rupture" && a.source !== "stock").length;
}

export function buildOverviewStory(data, t) {
  const anomalies = data?.anomalies || [];
  const recos = (data?.optimisation?.recommandations || []).filter((r) => !r.applied);
  const nRupture = countRuptures(anomalies, data?.optimisation?.recommandations || []);
  const nUnusual = countUnusual(anomalies);
  const nReco = recos.length;
  const nExpiry = Number(data?.expiryWaste?.kpis?.lotsARisque) || 0;
  const nForecast = Number(data?.kpis?.previsions) || (data?.prevision?.produits || []).length || 0;

  const sentences = [];
  const chips = [];

  if (nRupture === 1) {
    sentences.push(t.aiStoryRuptureOne);
    chips.push({ tab: "anomalies", label: t.aiStoryAnomaliesTitle, count: 1 });
  } else if (nRupture > 1) {
    sentences.push(interpolate(t.aiStoryRuptureMany, { n: nRupture }));
    chips.push({ tab: "anomalies", label: t.aiStoryAnomaliesTitle, count: nRupture });
  }

  if (nUnusual === 1) {
    sentences.push(t.aiStoryAnomOne);
  } else if (nUnusual > 1) {
    sentences.push(interpolate(t.aiStoryAnomMany, { n: nUnusual }));
  }
  if (nUnusual > 0 && !chips.some((c) => c.tab === "anomalies")) {
    chips.push({ tab: "anomalies", label: t.aiStoryAnomaliesTitle, count: nUnusual });
  }

  if (nExpiry === 1) {
    sentences.push(t.aiStoryExpiryOne);
    chips.push({ tab: "peremption", label: t.aiTabExpiry, count: 1 });
  } else if (nExpiry > 1) {
    sentences.push(interpolate(t.aiStoryExpiryMany, { n: nExpiry }));
    chips.push({ tab: "peremption", label: t.aiTabExpiry, count: nExpiry });
  }

  if (nReco === 1) {
    sentences.push(t.aiStoryRecoOne);
    chips.push({ tab: "optimisation", label: t.aiStoryOptimisationTitle, count: 1 });
  } else if (nReco > 1) {
    sentences.push(interpolate(t.aiStoryRecoMany, { n: nReco }));
    chips.push({ tab: "optimisation", label: t.aiStoryOptimisationTitle, count: nReco });
  }

  if (sentences.length < 2 && nForecast > 0) {
    sentences.push(interpolate(t.aiStoryForecast, { n: nForecast }));
    chips.push({ tab: "prevision", label: t.aiStoryForecastTitle, count: nForecast });
  }

  const tone =
    nRupture > 0 || nUnusual > 0 ? "alert" : nReco > 0 || nExpiry > 0 ? "watch" : "calm";

  return {
    sentences: sentences.slice(0, 3),
    text: (sentences.slice(0, 3).join(" ") || t.aiStoryCalm).trim(),
    chips: chips.slice(0, 3),
    tone,
  };
}

function PulseDial({ score = 0, color }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, Number(score) || 0));
  return (
    <svg className="ia-pulse__dial" width="96" height="96" viewBox="0 0 96 96" aria-hidden>
      <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="7" />
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
        transform="rotate(-90 48 48)"
      />
      <text
        x="48"
        y="53"
        textAnchor="middle"
        fontSize="22"
        fontWeight="800"
        fill="currentColor"
        fontFamily="Syne, sans-serif"
      >
        {Math.round(pct)}
      </text>
    </svg>
  );
}

export default function ModuleIABriefing({
  kpis,
  prevision,
  anomalies,
  optimisation,
  insights,
  expiryWaste,
  commandCenter,
  onNavigate,
}) {
  const { t } = useLandingLang();
  const reduceMotion = useReducedMotion();
  const story = useMemo(
    () =>
      buildOverviewStory(
        { kpis, prevision, anomalies, optimisation, insights, expiryWaste },
        t
      ),
    [kpis, prevision, anomalies, optimisation, insights, expiryWaste, t]
  );

  const accent = story.tone === "alert" ? IA.red : story.tone === "watch" ? IA.yellow : IA.accent;
  const pulse = commandCenter?.pulse;
  const pulseColor = toneColor(pulse?.tone) || accent;
  const next = commandCenter?.briefing?.nextAction;
  const factors = pulse?.factors || [];

  return (
    <motion.section
      variants={FADE_UP}
      className="ia-brief ia-story-briefing relative overflow-hidden p-5 sm:p-6"
      style={{
        ...surfaceStyle({
          background: `radial-gradient(ellipse 70% 120% at 0% 0%, color-mix(in srgb, ${accent} 14%, transparent), transparent 58%), ${IA.bgCard}`,
        }),
        "--brief": accent,
      }}
    >
      <div className="ia-story-briefing-border" aria-hidden />
      <div className="ia-situation relative z-[1]">
        <div className="min-w-0">
          <p className="ia-brief__kicker" style={{ color: accent }}>
            <Sparkles size={13} />
            {t.aiStoryKicker}
            {!reduceMotion ? (
              <span className="ai-hero-live-dot h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
            ) : null}
          </p>
          <h2 className="ia-brief__title" style={{ fontFamily: IA.fontTitle, color: IA.text }}>
            {t.aiStoryTitle}
          </h2>
          <p className="ia-brief__quote" style={{ color: IA.textSecondary, fontFamily: IA.fontBody }}>
            {story.text}
          </p>

          {story.chips.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {story.chips.map((chip) => {
                const meta = tabMeta(chip.tab);
                return (
                  <button
                    key={chip.tab}
                    type="button"
                    onClick={() => onNavigate?.(chip.tab)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
                    style={{
                      color: meta.color,
                      background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${meta.color} 28%, transparent)`,
                    }}
                  >
                    {chip.label}
                    <span className="font-mono text-[11px] opacity-80">{chip.count}</span>
                    <ArrowRight size={12} />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {pulse ? (
          <aside className="ia-pulse" style={{ color: IA.text }}>
            <div className="ia-pulse__head">
              <PulseDial score={pulse.score} color={pulseColor} />
              <div>
                <p className="ia-pulse__kicker">Santé du réseau</p>
                <p className="ia-pulse__band" style={{ color: pulseColor }}>
                  {pulse.label || "VEILLE"}
                </p>
                <p className="ia-pulse__hint">
                  Inférence, couverture, signaux, prévision, péremption et exécution.
                </p>
              </div>
            </div>
            {factors.length ? (
              <ul className="ia-pulse__factors">
                {factors.map((factor) => (
                  <li key={factor.key}>
                    <span>{factor.label}</span>
                    <i aria-hidden>
                      <b style={{ width: `${Math.min(100, Number(factor.score) || 0)}%`, background: pulseColor }} />
                    </i>
                    <em>{Math.round(Number(factor.score) || 0)}</em>
                  </li>
                ))}
              </ul>
            ) : null}
            {next?.label ? (
              <button
                type="button"
                className="ia-pulse__next"
                onClick={() => onNavigate?.(next.tab)}
              >
                <span>
                  <strong>{next.label}</strong>
                  {next.why ? <small>{next.why}</small> : null}
                </span>
                <ArrowRight size={16} />
              </button>
            ) : null}
          </aside>
        ) : null}
      </div>
    </motion.section>
  );
}
