import {
  Hourglass,
  LayoutDashboard,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Truck,
  Warehouse,
} from "lucide-react";
import { TAB_ITEMS } from "../moduleIaTheme";
import { useLandingLang } from "../../landing/LandingLangContext";

const ICONS = {
  LayoutDashboard,
  TrendingUp,
  ShieldAlert,
  SlidersHorizontal,
  Truck,
  Warehouse,
  Sparkles,
  Hourglass,
};

export default function ModuleIATabs({ active, onChange, counts = {} }) {
  const { t } = useLandingLang();
  const labels = {
    overview: t.aiTabOverview,
    prevision: t.aiTabForecast,
    anomalies: t.aiTabAnomalies,
    optimisation: t.aiTabOptimisation,
    chargement: t.aiTabLoad,
    emplacement: t.aiTabSlot,
    peremption: t.aiTabExpiry,
    insights: t.aiTabInsights,
  };

  return (
    <nav className="ia-nav" aria-label={t.aiNavAria}>
      <div className="ia-nav__rail">
        {TAB_ITEMS.map((tab) => {
          const isActive = active === tab.id;
          const badgeCount = counts[tab.id];
          const Icon = ICONS[tab.icon] || LayoutDashboard;
          const showBadge =
            badgeCount > 0 &&
            (tab.id === "anomalies" ||
              tab.id === "insights" ||
              tab.id === "optimisation" ||
              tab.id === "peremption");
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`ia-nav__tab${isActive ? " is-active" : ""}`}
              style={{ "--tab": tab.color }}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="ia-nav__icon">
                <Icon size={14} strokeWidth={isActive ? 2.25 : 1.75} />
              </span>
              {labels[tab.id] || tab.label}
              {showBadge ? <span className="ia-nav__count">{badgeCount}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
