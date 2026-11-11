import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  IconAlertTriangle,
  IconCalendar,
  IconLayoutGrid,
  IconMessageCircle,
  IconPackage,
  IconTrendingUp,
} from "@tabler/icons-react";
import { ArrowUpRight } from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useLandingLang } from "../landing/LandingLangContext";
import { interpolate } from "../../i18n/languages";

const ACCENTS = ["#38bdf8", "#fb7185", "#fbbf24", "#a78bfa", "#34d399", "#67e8f9"];

export default function AiHub() {
  const { t } = useLandingLang();
  const societeScope = useSocieteQueryScope();

  const { data: anomaliesData, isLoading: anomaliesLoading } = useQuery({
    queryKey: ["stock-anomalies", "hub", societeScope],
    queryFn: () =>
      api.get("stock/anomalies", { params: { statut: "NON_RESOLU" } }).then((r) => r.data),
  });

  const unresolvedCount = (anomaliesData?.items || []).length;
  const anomaliesText =
    unresolvedCount === 0
      ? t.aiAnomNone
      : unresolvedCount === 1
        ? t.aiAnomOne
        : interpolate(t.aiAnomMany, { n: unresolvedCount });

  const modules = [
    {
      to: "/ai?tab=prevision",
      title: t.aiModForecast,
      icon: <IconTrendingUp size={18} />,
      fallback: t.aiModForecastText,
      badge: "N-BEATS",
    },
    {
      to: "/ai?tab=anomalies",
      title: t.aiModAnomalies,
      icon: <IconAlertTriangle size={18} />,
      fallback: t.aiModAnomaliesText,
      badge: "DL",
      live: "anomalies",
    },
    {
      to: "/ai?tab=peremption",
      title: t.aiModExpiry,
      icon: <IconCalendar size={18} />,
      fallback: t.aiModExpiryText,
      badge: "DLC",
    },
    {
      to: "/ai?tab=emplacement",
      title: t.aiModSlotting,
      icon: <IconLayoutGrid size={18} />,
      fallback: t.aiModSlottingText,
      badge: "GMM",
    },
    {
      to: "/ai?tab=chargement",
      title: t.aiModLoad,
      icon: <IconPackage size={18} />,
      fallback: t.aiModLoadText,
      badge: "HAC",
    },
    {
      to: "/ai",
      title: t.aiModLlm,
      icon: <IconMessageCircle size={18} />,
      fallback: t.aiModLlmText,
      badge: "STOKI",
      openChat: true,
    },
  ];

  return (
    <PageShell>
      <header className="ia-hub" style={{ "--ia-accent": "#a78bfa" }}>
        <div className="ia-hub__grid" aria-hidden />
        <span className="ia-hub__wash" aria-hidden />
        <span className="ia-hub__edge" aria-hidden />
        <div className="ia-hub__body">
          <div>
            <p className="ia-hub__kicker">
              <span className="ia-hub__live" aria-hidden />
              Stokify · {t.aiHubTitle}
            </p>
            <h1 className="ia-hub__title">{t.aiHubTitle}</h1>
            <p className="ia-hub__sub">{t.aiHubSubtitle}</p>
            <div className="ia-hub__meta">
              <span className="ia-hub__pill">
                <span className="ia-hub__live" aria-hidden />
                {t.aiIaActive}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="ia-hub__grid-cards">
        {modules.map((mod, index) => {
          const isAnomalies = mod.live === "anomalies";
          const text = isAnomalies ? anomaliesText : mod.fallback;
          const loading = isAnomalies && anomaliesLoading;
          const accent = ACCENTS[index % ACCENTS.length];
          const card = (
            <div className="ia-hub-card" style={{ "--hub": accent }}>
              <span className="ia-hub-card__index" aria-hidden>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="ia-hub-card__top">
                <span className="ia-hub-card__icon">{mod.icon}</span>
                <span className="ia-hub-card__badge">{mod.badge}</span>
              </div>
              <h2 className="ia-hub-card__title">{mod.title}</h2>
              {loading ? (
                <span className="ia-hub-card__skel mt-3" />
              ) : (
                <p className="ia-hub-card__text">{text}</p>
              )}
              <span className="ia-hub-card__go">
                <ArrowUpRight size={14} />
              </span>
            </div>
          );

          if (mod.openChat) {
            return (
              <button
                key={mod.title}
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("stokify:open-stoki"))}
                className="ia-hub-hit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]/60"
              >
                {card}
              </button>
            );
          }

          return (
            <Link
              key={mod.to}
              to={mod.to}
              className="ia-hub-hit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]/60"
            >
              {card}
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
