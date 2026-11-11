import { Component, lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useLandingLang } from "../landing/LandingLangContext";
import { useLangStore } from "../../store/langStore";
import { translatePhrase } from "../../i18n/tx";
import ModuleIAHeader from "./components/ModuleIAHeader";
import ModuleIATabs from "./components/ModuleIATabs";
import ModuleIABriefing from "./components/ModuleIABriefing";
import ModuleIAKpiCards from "./components/ModuleIAKpiCards";
import ModuleIAOverviewDeck from "./components/ModuleIAOverviewDeck";
import ModuleIAOptimisationSection from "./components/ModuleIAOptimisationSection";
import ModuleIAInsightsSection from "./components/ModuleIAInsightsSection";
import { EMBEDDED_MODULE_TABS, FILTER_EXIT, IA, STAGGER, TAB_ITEMS, surfaceStyle } from "./moduleIaTheme";

const SalesForecast = lazy(() => import("../stock/SalesForecast"));
const AnomaliesDetection = lazy(() => import("../stock/AnomaliesDetection"));
const LoadOptimization = lazy(() => import("../stock/LoadOptimization"));
const EmplacementOptimization = lazy(() => import("../stock/EmplacementOptimization"));
const ExpiryWasteRisk = lazy(() => import("./ExpiryWasteRisk"));

const VALID_TABS = new Set(TAB_ITEMS.map((t) => t.id));

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function LoadingState({ label }) {
  const { t } = useLandingLang();
  return (
    <div
      className="flex min-h-[320px] flex-col items-center justify-center gap-3"
      style={surfaceStyle()}
    >
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: IA.accent }} />
      <p className="text-sm" style={{ color: IA.muted, fontFamily: IA.fontBody }}>
        {label || t.aiLoading}
      </p>
    </div>
  );
}

function EmbeddedModule({ tab }) {
  const { t } = useLandingLang();
  const fallback = (
    <LoadingState
      label={
        tab === "prevision"
          ? t.aiLoadForecast
          : tab === "anomalies"
            ? t.aiLoadAnom
            : tab === "peremption"
              ? t.aiLoadExpiry
              : tab === "chargement"
              ? t.aiLoadLoad
              : t.aiLoadSlot
      }
    />
  );

  return (
    <EmbeddedErrorBoundary key={tab}>
      <Suspense fallback={fallback}>
        <AnimatePresence mode="wait">
          <motion.div key={tab} {...FILTER_EXIT}>
            {tab === "prevision" ? <SalesForecast embedded /> : null}
            {tab === "anomalies" ? <AnomaliesDetection embedded /> : null}
            {tab === "peremption" ? <ExpiryWasteRisk embedded /> : null}
            {tab === "chargement" ? <LoadOptimization embedded /> : null}
            {tab === "emplacement" ? <EmplacementOptimization embedded /> : null}
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </EmbeddedErrorBoundary>
  );
}

class EmbeddedErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const lang = useLangStore.getState().lang;
      return (
        <div className="p-8 text-center" style={surfaceStyle()}>
          <p className="mb-2 text-sm font-semibold" style={{ color: IA.red }}>
            {translatePhrase("Ce module n’a pas pu s’afficher.", lang)}
          </p>
          <p className="text-xs" style={{ color: IA.muted }}>
            {this.state.error?.message || translatePhrase("Erreur de rendu.", lang)}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ModuleIA() {
  const { t } = useLandingLang();
  const reduceMotion = useReducedMotion();
  const societeScope = useSocieteQueryScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "overview";
  const activeTab = VALID_TABS.has(tabFromUrl) ? tabFromUrl : "overview";
  const [dateRange, setDateRange] = useState(defaultDateRange);

  const handleTabChange = (tab) => {
    if (!tab || tab === "overview") {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  const isEmbeddedModule = EMBEDDED_MODULE_TABS.has(activeTab);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["ia-dashboard", societeScope, dateRange.start, dateRange.end],
    queryFn: () =>
      api
        .get("ia/dashboard", {
          params: { dateFrom: dateRange.start, dateTo: dateRange.end },
          timeout: 120_000,
        })
        .then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
  });

  const tabCounts = useMemo(
    () => ({
      anomalies: data?.anomalies?.length || 0,
      insights: data?.insights?.length || 0,
      optimisation: (data?.optimisation?.recommandations || []).filter((r) => !r.applied).length,
      peremption: data?.expiryWaste?.kpis?.lotsARisque || 0,
    }),
    [data]
  );

  const showOverview = activeTab === "overview";
  const showOptimisation = activeTab === "optimisation";

  return (
    <div
      className="ia-studio relative min-h-full"
      style={{
        background: IA.bg,
        fontFamily: IA.fontBody,
        color: IA.text,
      }}
    >
      <div className="ia-overview-atmosphere" aria-hidden />
      <div className="relative mx-auto max-w-[1240px] space-y-6 p-5 sm:p-6 lg:p-8">
        <ModuleIAHeader
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          meta={data?.meta}
          pulse={data?.commandCenter?.pulse}
          kpis={data?.kpis}
          prevision={data?.prevision}
          onRefresh={() => refetch()}
          refreshing={isFetching}
        />

        <ModuleIATabs active={activeTab} onChange={handleTabChange} counts={tabCounts} />

        {isFetching && !isLoading && !isEmbeddedModule ? (
          <div className="text-right text-[11px]" style={{ color: IA.muted }}>
            {t.aiSync}
          </div>
        ) : null}

        {isEmbeddedModule ? (
          <EmbeddedModule tab={activeTab} />
        ) : isLoading ? (
          <LoadingState />
        ) : isError ? (
          <div className="p-8 text-center" style={surfaceStyle()}>
            <p className="mb-2 text-sm font-semibold" style={{ color: IA.red }}>
              {t.aiDashFail}
            </p>
            <p className="mb-4 text-xs" style={{ color: IA.muted }}>
              {error?.response?.status === 404
                ? t.aiRouteMissing
                : error?.response?.data?.message ||
                  error?.message ||
                  t.aiDashFail}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: IA.accentDim, color: IA.accent, border: `1px solid ${IA.borderStrong}` }}
            >
              {t.aiRetry}
            </button>
          </div>
        ) : (
          <motion.div
            variants={STAGGER}
            initial={reduceMotion ? false : "hidden"}
            animate="show"
            className="space-y-6"
          >
            {showOverview ? (
              <div className="ia-overview">
                <ModuleIABriefing
                  kpis={data?.kpis}
                  prevision={data?.prevision}
                  anomalies={data?.anomalies}
                  optimisation={data?.optimisation}
                  insights={data?.insights}
                  expiryWaste={data?.expiryWaste}
                  commandCenter={data?.commandCenter}
                  onNavigate={handleTabChange}
                />
                {data?.kpis ? <ModuleIAKpiCards kpis={data.kpis} onSelect={handleTabChange} /> : null}
                <ModuleIAOverviewDeck
                  kpis={data?.kpis}
                  prevision={data?.prevision}
                  anomalies={data?.anomalies || []}
                  optimisation={data?.optimisation}
                  insights={data?.insights || []}
                  expiryWaste={data?.expiryWaste}
                  commandCenter={data?.commandCenter}
                  onNavigate={handleTabChange}
                />
              </div>
            ) : null}

            {showOptimisation && data?.optimisation ? (
              <ModuleIAOptimisationSection
                optimisation={data.optimisation}
                onApplied={() => refetch()}
                showJourney={activeTab === "optimisation"}
                onNavigate={handleTabChange}
              />
            ) : null}

            {activeTab === "insights" ? (
              <ModuleIAInsightsSection
                insights={data?.insights || []}
                updatedAt={data?.meta?.updatedAt}
                onNavigate={handleTabChange}
              />
            ) : null}
          </motion.div>
        )}
      </div>
    </div>
  );
}
