import { motion, useReducedMotion } from "framer-motion";
import { Brain, ListChecks, ShieldAlert, TrendingUp } from "lucide-react";
import { useCountUp } from "../../../hooks/useCountUp";
import { useLandingLang } from "../../landing/LandingLangContext";
import { FADE_UP, STAGGER, surfaceStyle } from "../moduleIaTheme";
import { MiniSpark } from "./ModuleIAHud";

function cardConfig(t) {
  return [
    {
      key: "previsions",
      label: t.aiKpiForecast,
      hint: t.aiKpiForecastHint,
      icon: TrendingUp,
      color: "var(--accent-success)",
      tab: "prevision",
      spark: "sparkPrevisions",
      pulse: false,
    },
    {
      key: "anomalies",
      label: t.aiKpiAnomalies,
      hint: t.aiKpiAnomaliesHint,
      icon: ShieldAlert,
      color: "var(--accent-danger)",
      tab: "anomalies",
      spark: "sparkAnomalies",
      pulse: true,
    },
    {
      key: "recommandations",
      label: t.aiKpiActions,
      hint: t.aiKpiActionsHint,
      icon: ListChecks,
      color: "var(--accent-primary)",
      tab: "optimisation",
      spark: "sparkRecommandations",
      pulse: false,
    },
    {
      key: "confiance",
      label: t.aiKpiReliability,
      hint: t.aiKpiReliabilityHint,
      icon: Brain,
      color: "var(--accent-warning)",
      tab: "insights",
      suffix: "%",
      pulse: false,
      ring: true,
    },
  ];
}

function KpiTile({ cfg, value, spark, reduceMotion, onOpen }) {
  const animated = useCountUp(value, 1100);
  const display = `${Math.round(animated).toLocaleString("fr-FR")}${cfg.suffix || ""}`;
  const live = cfg.pulse && Number(value) > 0;

  return (
    <motion.button
      type="button"
      variants={FADE_UP}
      onClick={onOpen}
      whileHover={reduceMotion ? undefined : { backgroundColor: "color-mix(in srgb, var(--kpi-accent) 7%, transparent)" }}
      className="ia-metric"
      style={{ "--kpi-accent": cfg.color }}
    >
      <div className="ia-metric__top">
        <span className="ia-metric__icon" style={{ color: cfg.color }}>
          <cfg.icon size={15} />
        </span>
        <span className="ia-metric__label">{cfg.label}</span>
        {live ? <span className="ia-metric__live" style={{ background: cfg.color }} /> : null}
      </div>
      <div className="ia-metric__row">
        <p className="ia-metric__value" style={{ color: cfg.color }}>
          {display}
        </p>
        {spark?.length ? <MiniSpark values={spark} color={cfg.color} width={72} height={24} /> : null}
      </div>
      <p className="ia-metric__hint">{cfg.hint}</p>
    </motion.button>
  );
}

export default function ModuleIAKpiCards({ kpis, onSelect }) {
  const { t } = useLandingLang();
  const reduceMotion = useReducedMotion();
  if (!kpis) return null;

  const values = {
    previsions: kpis.previsions,
    anomalies: kpis.anomalies,
    recommandations: kpis.recommandations,
    confiance: kpis.confianceMoyenne ?? 0,
  };

  return (
    <motion.section variants={FADE_UP}>
      <motion.div
        className="ia-metric-rail"
        style={surfaceStyle({ borderRadius: 18 })}
        variants={STAGGER}
        initial={reduceMotion ? false : "hidden"}
        animate="show"
      >
        {cardConfig(t).map((cfg) => (
          <KpiTile
            key={cfg.key}
            cfg={cfg}
            reduceMotion={reduceMotion}
            value={values[cfg.key]}
            spark={kpis[cfg.spark]}
            onOpen={() => onSelect?.(cfg.tab)}
          />
        ))}
      </motion.div>
    </motion.section>
  );
}
