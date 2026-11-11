import {
  BrainCircuit,
  Hourglass,
  ShieldAlert,
  TrendingUp,
  Truck,
  Warehouse,
} from "lucide-react";

const PRESETS = {
  "Prévision des ventes": {
    kicker: "Série temporelle",
    badge: "Deep forecast",
    models: ["Holt-Winters", "N-BEATS", "Hybride"],
    icon: TrendingUp,
    accent: "#38bdf8",
  },
  "Détection d'anomalies": {
    kicker: "Détection profonde",
    badge: "Ensemble DL",
    models: ["IsolationForest", "LOF", "Autoencodeur"],
    icon: ShieldAlert,
    accent: "#fb7185",
  },
  "Optimisation chargement": {
    kicker: "Recherche opérationnelle",
    badge: "HAC + TSP",
    models: ["HAC", "HGB", "2-opt / 3-opt"],
    icon: Truck,
    accent: "#34d399",
  },
  "Optimisation des emplacements": {
    kicker: "Slotting ML",
    badge: "GMM 3 classes",
    models: ["GMM", "HGB", "Affinité"],
    icon: Warehouse,
    accent: "#a78bfa",
  },
  "Risque de péremption": {
    kicker: "Expiry Control Room",
    badge: "Runway DLC",
    models: ["q − v×j", "Runway 21j", "Playbook FEFO"],
    icon: Hourglass,
    accent: "#fbbf24",
  },
};

export default function AiModuleHero({
  title,
  subtitle,
  kicker,
  badge,
  models,
  icon: IconProp,
  accent,
  actions,
  badgeTitle,
  badgeStyle,
}) {
  if (!title && !subtitle) return null;

  const preset = PRESETS[title] || {};
  const Icon = IconProp || preset.icon || BrainCircuit;
  const chips = models?.length ? models : preset.models || [];
  const kickerLabel = kicker || preset.kicker || "Module IA";
  const badgeLabel = badge || preset.badge || "IA";
  const accentColor = accent || preset.accent || "#7dd3fc";

  return (
    <header className="ia-module" style={{ "--ia-accent": accentColor }}>
      <div className="ia-module__grid" aria-hidden />
      <span className="ia-module__wash" aria-hidden />
      <span className="ia-module__edge" aria-hidden />

      <div className="ia-module__body">
        <div className="ia-module__identity">
          <div className="ia-module__mark" aria-hidden>
            <span className="ia-module__orbit" />
            <Icon strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="ia-module__kicker">
              <span className="ia-module__badge-dot" aria-hidden />
              {kickerLabel}
            </p>
            <div className="ia-module__title-row">
              <h1 className="ia-module__title">{title || kickerLabel}</h1>
              <span className="ia-module__badge" title={badgeTitle || undefined} style={badgeStyle}>{badgeLabel}</span>
            </div>
            {subtitle ? <p className="ia-module__sub">{subtitle}</p> : null}
            {chips.length ? (
              <div className="ia-module__chips">
                {chips.map((chip) => (
                  <span key={chip} className="ia-module__chip">
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? <div className="ia-module__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
