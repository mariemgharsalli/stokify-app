import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Package,
  Receipt,
  Users,
} from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { hasPermission } from "../../security/permissions";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import DashboardPageBackground from "./components/DashboardPageBackground";
import DashboardCommandHeader from "./components/DashboardCommandHeader";
import DashboardCinematicIntro from "./components/DashboardCinematicIntro";
import CompanyContextBar from "./components/CompanyContextBar";
import DashboardHero from "./components/DashboardHero";
import DashboardStatCards from "./components/DashboardStatCards";
import DashboardCharts from "./components/DashboardCharts";
import DashboardRecentActivity from "./components/DashboardRecentActivity";
import { AnomaliesWidget } from "../stock/AnomaliesDetection";
import {
  persistDashboardViewMode,
  readDashboardViewMode,
} from "./dashboardViewMode";
import { interpolate } from "../../i18n/languages";
import { useLandingLang } from "../landing/LandingLangContext";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const FR_MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

function formatDtKpi(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v).toLocaleString("fr-FR")} DT`;
}

function buildTrendFromVentesMvts(movements, monthsShort) {
  const now = new Date();
  const keys = [];
  const months = monthsShort?.length === 12 ? monthsShort : FR_MONTHS_SHORT;
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      m: months[d.getMonth()],
      valeur: 0,
    });
  }
  const map = new Map(keys.map((k) => [k.key, { ...k }]));
  for (const m of movements || []) {
    if (String(m.type || "").trim().toUpperCase() !== "SORTIE_VENTE") continue;
    const dt = new Date(m.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const row = map.get(ym);
    if (!row) continue;
    row.valeur += Number(m.quantite || 0);
  }
  return Array.from(map.values()).map((r) => ({
    ...r,
    valeur: Math.round(r.valeur * 100) / 100,
  }));
}

function buildBarAggFromMvts(movements) {
  let entrees = 0;
  let sorties = 0;
  let transferts = 0;
  let inventaire = 0;
  for (const m of movements || []) {
    const t = String(m.type || "").trim().toUpperCase();
    const q = Number(m.quantite || 0);
    if (t === "TRANSFERT") transferts += q;
    else if (t === "ENTREE_AJUSTEMENT" || t === "SORTIE_AUTRE") inventaire += q;
    else if (t.startsWith("ENTREE_")) entrees += q;
    else if (t.startsWith("SORTIE_")) sorties += q;
  }
  return [
    { key: "in", qte: Math.round(entrees * 100) / 100 },
    { key: "out", qte: Math.round(sorties * 100) / 100 },
    { key: "transfer", qte: Math.round(transferts * 100) / 100 },
    { key: "inventory", qte: Math.round(inventaire * 100) / 100 },
  ];
}

function formatVentesTrend(trendData) {
  if (!trendData?.length || trendData.length < 2) return null;
  const curr = Number(trendData[trendData.length - 1]?.valeur ?? 0);
  const prev = Number(trendData[trendData.length - 2]?.valeur ?? 0);
  if (prev === 0) return curr > 0 ? `+${curr}` : null;
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct === 0) return "0%";
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function resolveSocieteLabel(user, activeCompany) {
  if (activeCompany) {
    const code = String(activeCompany.code ?? "").trim();
    const nom = String(activeCompany.nom ?? "").trim();
    return code ? `[${code}] — ${nom}` : nom;
  }
  const soc = user?.societe;
  if (!soc) return null;
  const code = String(soc.code ?? "").trim();
  const nom = String(soc.nom ?? "").trim();
  return code ? `[${code}] — ${nom}` : nom || null;
}

/** Survives Dashboard remounts so we only purge React Query when the société actually changes. */
let previousSuperSocieteIdForPurge = null;

/** Full-page placeholder while auth persist rehydrates (avoids wrong société for one frame). */
export function DashboardSkeleton() {
  return (
    <DashboardPageBackground>
      <div className="mx-auto max-w-[1600px] space-y-8 p-6 lg:p-8">
      <style>{`
        @keyframes dashboard-shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .dashboard-sk {
          background: linear-gradient(90deg,
            var(--bg-hover) 25%,
            color-mix(in srgb, var(--bg-card) 55%, var(--bg-hover)) 50%,
            var(--bg-hover) 75%
          );
          background-size: 400px 100%;
          animation: dashboard-shimmer 1.4s ease infinite;
          border-radius: 10px;
        }
      `}</style>
      <div className="dash-glass-card h-24" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="dash-glass-card p-5" style={{ opacity: 1 - i * 0.06 }}>
            <div className="dashboard-sk mb-3 h-3 w-20" />
            <div className="dashboard-sk h-8 w-14" />
          </div>
        ))}
      </div>
      <div className="dash-glass-card p-5">
        <div className="dashboard-sk mb-4 h-4 w-36" />
        <div className="dashboard-sk h-[200px] w-full" />
      </div>
      </div>
    </DashboardPageBackground>
  );
}

export default function Dashboard() {
  const { t } = useLandingLang();
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(readDashboardViewMode);
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const activeSocieteId = useAuthStore((s) => s.activeSocieteId);
  const role = user?.role;
  const isClient = role === "CLIENT";
  const isComptable = role === "COMPTABLE";
  const isSuper = role === "SUPER_ADMIN";
  const isAdminLike = role === "ADMIN" || isSuper;
  const canAlerts = hasPermission(role, "stock:read") && !isClient;
  const canUsersStat = hasPermission(role, "users:read");

  const superSocieteKey =
    isSuper && activeSocieteId != null && String(activeSocieteId).trim() !== ""
      ? Number(activeSocieteId)
      : null;

  useEffect(() => {
    if (!isSuper || superSocieteKey == null) return;
    if (previousSuperSocieteIdForPurge === superSocieteKey) return;
    if (previousSuperSocieteIdForPurge != null) {
      queryClient.removeQueries({ queryKey: ["alerts"] });
      queryClient.removeQueries({ queryKey: ["lots-expiring-soon"] });
      queryClient.removeQueries({ queryKey: ["lots-peremption-risk"] });
      queryClient.removeQueries({ queryKey: ["admin-users"] });
    }
    previousSuperSocieteIdForPurge = superSocieteKey;
  }, [isSuper, superSocieteKey, queryClient]);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies", "dashboard-banner", isSuper ? superSocieteKey : null],
    queryFn: () => api.get("companies").then((r) => r.data),
    enabled: Boolean(isSuper && user),
  });

  const activeCompany = isSuper
    ? companies.find((c) => Number(c.id) === Number(activeSocieteId))
    : null;

  const alertsEnabled = Boolean(canAlerts && (!isSuper || superSocieteKey != null));
  const {
    data: alerts,
    isPending: alertsPending,
    isFetching: alertsFetching,
  } = useQuery({
    queryKey: ["alerts", isSuper ? superSocieteKey : null],
    queryFn: () => api.get("stock/alerts").then((r) => r.data),
    enabled: alertsEnabled,
  });

  const {
    data: lotsExpiring,
    isPending: lotsExpiringPending,
    isFetching: lotsExpiringFetching,
  } = useQuery({
    queryKey: ["lots-expiring-soon", isSuper ? superSocieteKey : null],
    queryFn: () => api.get("lots/expiring-soon", { params: { days: 30, limit: 500 } }).then((r) => r.data),
    enabled: alertsEnabled,
  });

  const {
    data: peremptionRisk,
    isPending: peremptionRiskPending,
    isFetching: peremptionRiskFetching,
  } = useQuery({
    queryKey: ["lots-peremption-risk", "kpi", isSuper ? superSocieteKey : null],
    queryFn: () => api.get("lots/peremption-risk", { params: { days: 30 } }).then((r) => r.data),
    enabled: alertsEnabled,
    staleTime: 60_000,
  });

  const expiringToastKeyRef = useRef(null);
  useEffect(() => {
    if (!alertsEnabled || lotsExpiring == null) return;
    const n = Number(lotsExpiring.total ?? 0);
    if (n <= 0) return;
    const scopeKey = isSuper && superSocieteKey != null ? String(superSocieteKey) : "default";
    const toastKey = `${String(societeScope ?? "")}-${scopeKey}-${n}`;
    if (expiringToastKeyRef.current === toastKey) return;
    expiringToastKeyRef.current = toastKey;
    useToastStore.getState().pushToast(
      interpolate(t.dashLotsToast, { n }),
      "warning"
    );
  }, [alertsEnabled, lotsExpiring, isSuper, superSocieteKey, societeScope, t]);

  const usersQueryEnabled = Boolean(
    canUsersStat && isAdminLike && (!isSuper || superSocieteKey != null)
  );
  const {
    data: teamUsersRaw,
    isPending: usersPending,
    isFetching: usersFetching,
  } = useQuery({
    queryKey: ["admin-users", isSuper ? superSocieteKey : null],
    queryFn: () => api.get("users", { params: { limit: 200 } }).then((r) => r.data),
    enabled: usersQueryEnabled,
  });
  const teamUsers = Array.isArray(teamUsersRaw) ? teamUsersRaw : teamUsersRaw?.items ?? [];

  const movementQueryEnabled = Boolean(
    user && isAdminLike && (user.role !== "SUPER_ADMIN" || societeScope != null)
  );
  const achatsStatsEnabled = Boolean(hasPermission(role, "achats:read") && !isClient && (!isSuper || superSocieteKey != null));
  const { data: achatsStats } = useQuery({
    queryKey: ["achats-stats", "dashboard", isSuper ? superSocieteKey : null],
    queryFn: () => api.get("achats/stats").then((r) => r.data),
    enabled: achatsStatsEnabled,
  });
  const { data: mvtData, isLoading: loadingMvt } = useQuery({
    queryKey: ["mouvements", "dashboard", societeScope],
    queryFn: () => api.get("mouvements", { params: { limit: 300 } }).then((r) => r.data),
    enabled: movementQueryEnabled,
  });

  const articlesQueryEnabled = Boolean(
    isAdminLike && hasPermission(role, "stock:read") && (!isSuper || superSocieteKey != null)
  );
  const {
    data: articlesData,
    isPending: articlesPending,
    isFetching: articlesFetching,
  } = useQuery({
    queryKey: ["articles", "dashboard-count", societeScope],
    queryFn: () => api.get("articles", { params: { statut: "ACTIF", limit: 1 } }).then((r) => r.data),
    enabled: articlesQueryEnabled,
  });

  const trendData = useMemo(() => {
    const raw = Array.isArray(mvtData?.items) ? mvtData.items : [];
    return buildTrendFromVentesMvts(raw, t.monthsShort);
  }, [mvtData, t.monthsShort]);
  const barData = useMemo(() => {
    const raw = Array.isArray(mvtData?.items) ? mvtData.items : [];
    const labels = {
      in: t.dashBarIn,
      out: t.dashBarOut,
      transfer: t.dashBarTransfer,
      inventory: t.dashBarInventory,
    };
    return buildBarAggFromMvts(raw).map((row) => ({ ...row, name: labels[row.key] || row.key }));
  }, [mvtData, t]);
  const rawMvts = Array.isArray(mvtData?.items) ? mvtData.items : [];
  const hasNoMovements = movementQueryEnabled && !loadingMvt && rawMvts.length === 0;

  const showAlertsSkeleton = alertsEnabled && (alertsPending || (alertsFetching && alerts == null));
  const showLotsExpiringSkeleton =
    alertsEnabled &&
    (peremptionRiskPending ||
      (peremptionRiskFetching && peremptionRisk == null) ||
      lotsExpiringPending ||
      (lotsExpiringFetching && lotsExpiring == null));
  const showUsersSkeleton = usersQueryEnabled && (usersPending || (usersFetching && teamUsersRaw == null));
  const showArticlesSkeleton =
    articlesQueryEnabled && (articlesPending || (articlesFetching && articlesData == null));

  const societeLabel = resolveSocieteLabel(user, activeCompany);
  const lastMonthVentes = trendData.length ? trendData[trendData.length - 1]?.valeur : null;
  const ventesTrend = formatVentesTrend(trendData);
  const alertsCount = alerts?.length ?? 0;
  const articlesActifsCount = articlesData?.total;

  const adminStatCards = useMemo(
    () => [
      {
        key: "alerts",
        icon: AlertTriangle,
        label: t.dashAlerts,
        value: canAlerts ? String(alertsCount) : "—",
        numericValue: canAlerts ? alertsCount : undefined,
        hint: t.dashAlertsHint,
        tone: "danger",
        trend: alertsCount > 0 ? String(alertsCount) : null,
        pulse: alertsCount > 0,
      },
      {
        key: "lots",
        icon: CalendarClock,
        label: t.dashMoneyAtStake || t.dashLots,
        value: canAlerts ? (peremptionRisk != null ? formatDtKpi(peremptionRisk.valeurEnJeu) : "—") : "—",
        tone: "warning",
        sub: canAlerts ? (
          <span>
            {interpolate(t.dashLotsRiskHint || "{n}", { n: peremptionRisk?.lotsEleves ?? 0 })}
            {" · "}
            <Link to="/stock/peremption-risk" className="text-[var(--text-link)] hover:underline">
              {t.dashSeeRisk || t.dashSeeLots}
            </Link>
          </span>
        ) : (
          "—"
        ),
        pulse: Number(peremptionRisk?.valeurEnJeu ?? 0) > 0,
      },
      {
        key: "articles",
        icon: Package,
        label: t.dashArticles,
        value:
          articlesQueryEnabled && articlesActifsCount != null
            ? String(articlesActifsCount)
            : "—",
        numericValue:
          articlesQueryEnabled && articlesActifsCount != null ? Number(articlesActifsCount) : undefined,
        hint: t.dashArticlesHint,
        tone: "primary",
        trend: articlesActifsCount != null && articlesActifsCount > 0 ? String(articlesActifsCount) : null,
      },
      {
        key: "ventes",
        icon: Receipt,
        label: t.dashSalesMonth,
        value: lastMonthVentes != null ? String(lastMonthVentes) : "—",
        numericValue: lastMonthVentes != null ? Number(lastMonthVentes) : undefined,
        tone: "success",
        sub: hasPermission(role, "ventes:read") ? (
          <Link to="/ventes" className="text-[var(--text-link)] hover:underline">
            {t.dashSeeSales}
          </Link>
        ) : (
          "—"
        ),
        trend: ventesTrend,
        spark: trendData.map((r) => Number(r.valeur) || 0),
      },
      {
        key: "users",
        icon: Users,
        label: t.dashUsers,
        value: canUsersStat ? String(teamUsers.length) : "—",
        numericValue: canUsersStat ? teamUsers.length : undefined,
        hint: t.dashUsersHint,
        tone: "accent",
        trend: teamUsers.length > 0 ? `+${teamUsers.length}` : null,
      },
    ],
    [
      alertsCount,
      articlesActifsCount,
      articlesQueryEnabled,
      canAlerts,
      canUsersStat,
      lastMonthVentes,
      lotsExpiring?.total,
      peremptionRisk,
      trendData,
      role,
      teamUsers.length,
      ventesTrend,
      t,
    ]
  );

  const adminLoadingIndices = useMemo(() => {
    const indices = [];
    if (showAlertsSkeleton) indices.push(0);
    if (showLotsExpiringSkeleton) indices.push(1);
    if (showArticlesSkeleton) indices.push(2);
    if (showUsersSkeleton) indices.push(4);
    return indices;
  }, [showAlertsSkeleton, showLotsExpiringSkeleton, showArticlesSkeleton, showUsersSkeleton]);

  const nonAdminCards = useMemo(() => {
    const cards = [];
    if (canAlerts) {
      cards.push({
        key: "alerts",
        icon: AlertTriangle,
        label: t.dashAlertsShort,
        value: String(alertsCount),
        numericValue: alertsCount,
        hint: t.dashAlertsStockHint,
        tone: "danger",
        trend: alertsCount > 0 ? String(alertsCount) : null,
        pulse: alertsCount > 0,
      });
      cards.push({
        key: "lots",
        icon: CalendarClock,
        label: t.dashMoneyAtStake || t.dashLotsExpiring,
        value: peremptionRisk != null ? formatDtKpi(peremptionRisk.valeurEnJeu) : "—",
        tone: "warning",
        pulse: Number(peremptionRisk?.valeurEnJeu ?? 0) > 0,
        sub: (
          <span>
            {interpolate(t.dashLotsRiskHint || "{n}", { n: peremptionRisk?.lotsEleves ?? 0 })}
            {" · "}
            <Link to="/stock/peremption-risk" className="text-[var(--text-link)] hover:underline">
              {t.dashSeeRisk || t.dashSeeLots}
            </Link>
          </span>
        ),
      });
    }
    if (!isClient) {
      cards.push({
        key: "api",
        icon: Package,
        label: t.dashApi,
        value: "OK",
        hint: t.dashApiHint,
        tone: "success",
      });
    }
    cards.push({
      key: "ui",
      icon: Users,
      label: t.dashUi,
      value: "Pro",
      hint: "Stokify",
      tone: "accent",
    });
    return cards;
  }, [alertsCount, canAlerts, isClient, lotsExpiring?.total, peremptionRisk, t]);

  const nonAdminLoadingIndices = useMemo(() => {
    const indices = [];
    if (canAlerts && showAlertsSkeleton) indices.push(0);
    if (canAlerts && showLotsExpiringSkeleton) indices.push(1);
    return indices;
  }, [canAlerts, showAlertsSkeleton, showLotsExpiringSkeleton]);

  const reduceMotion = useReducedMotion();

  const openDetails = () => {
    setShowDetails(true);
    persistDashboardViewMode(true);
  };

  const openCinematic = () => {
    setShowDetails(false);
    persistDashboardViewMode(false);
  };

  return (
    <AnimatePresence mode="wait">
      {!showDetails ? (
        <motion.div
          key="cinematic"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-[1600px] p-6 lg:p-8"
        >
          <DashboardCinematicIntro user={user} onShowDetails={openDetails} />
        </motion.div>
      ) : (
        <motion.div
          key="details"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <DashboardPageBackground>
            <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:space-y-8 lg:p-8">
            {isSuper && activeCompany && <CompanyContextBar company={activeCompany} />}

            <DashboardCommandHeader
              title={t.dashTitle}
              subtitle={
                <>
                  {interpolate(t.dashHello, { name: user?.prenom || "" })} —{" "}
                  {new Date().toLocaleDateString(t.localeTag || "fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </>
              }
              societeLabel={societeLabel}
              onCinematic={openCinematic}
            />

      <DashboardHero
        user={user}
        role={role}
        societeLabel={societeLabel}
        isClient={isClient}
        alertsCount={canAlerts ? alertsCount : 0}
        lotsCount={canAlerts ? Number(lotsExpiring?.total ?? 0) : 0}
        lotsAtStake={canAlerts && peremptionRisk != null ? formatDtKpi(peremptionRisk.valeurEnJeu) : ""}
        ventesMonth={lastMonthVentes ?? 0}
      />

      {hasPermission(role, "achats:read") && !isClient && Number(achatsStats?.nbEnRetard) > 0 && (
        <motion.div
          custom={1}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="dash-glass-card flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor: "color-mix(in srgb, var(--accent-danger) 42%, transparent)",
            boxShadow: "0 0 32px -12px color-mix(in srgb, var(--accent-danger) 45%, transparent)",
          }}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--danger-bg)] text-[var(--accent-danger)]">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">
                {interpolate(t.dashLateTitle, {
                  n: achatsStats.nbEnRetard,
                  s: achatsStats.nbEnRetard > 1 ? "s" : "",
                })}
              </p>
              <p className="m-0 mt-1 text-xs text-[var(--text-secondary)]">
                {t.dashLateText}
              </p>
            </div>
          </div>
          <Link
            to="/achats?enRetard=1&statut=BROUILLON"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium text-[var(--accent-danger)] transition-all hover:bg-[var(--bg-hover)]"
            style={{ borderColor: "color-mix(in srgb, var(--accent-danger) 35%, transparent)" }}
          >
            {t.dashSeeOrders} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      )}

      {isClient && (
        <motion.div
          custom={1}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="dash-glass-card p-6 text-sm text-[var(--text-secondary)]"
        >
          <p>
            {t.dashClientSpace.split("{catalog}")[0].replace("{role}", t.roleClient)}
            <Link to="/articles" className="font-medium text-[var(--text-link)] hover:underline">
              {t.dashCatalog}
            </Link>
            {(t.dashClientSpace.split("{catalog}")[1] || "").replace("{role}", t.roleClient)}
          </p>
        </motion.div>
      )}

      {isComptable && (
        <motion.div
          custom={1}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="dash-glass-card p-5 text-sm text-[var(--text-secondary)]"
        >
          <p>
            {t.dashComptableView.split("{link}")[0].replace("{role}", t.roleComptable)}
            <Link to="/comptabilite" className="text-[var(--text-link)] hover:underline">
              {t.dashComptableLink}
            </Link>
            {(t.dashComptableView.split("{link}")[1] || "").replace("{role}", t.roleComptable)}
          </p>
        </motion.div>
      )}

      {role === "MAGASINIER" && (
        <motion.div
          custom={1}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="dash-glass-card flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 text-sm text-[var(--text-secondary)]"
        >
          <span>{t.dashShortcuts}</span>
          <Link className="rounded-lg bg-[var(--bg-hover)] px-2.5 py-1 text-[var(--text-link)] hover:underline" to="/stock">
            {t.navStock}
          </Link>
          <Link className="rounded-lg bg-[var(--bg-hover)] px-2.5 py-1 text-[var(--text-link)] hover:underline" to="/mouvements">
            {t.navMouvements}
          </Link>
          <Link className="rounded-lg bg-[var(--bg-hover)] px-2.5 py-1 text-[var(--text-link)] hover:underline" to="/depots">
            {t.navDepots}
          </Link>
        </motion.div>
      )}

      {role === "RESPONSABLE" && (
        <motion.div
          custom={1}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="dash-glass-card flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 text-sm text-[var(--text-secondary)]"
        >
          <span>{t.dashLogistics}</span>
          <Link className="rounded-lg bg-[var(--bg-hover)] px-2.5 py-1 text-[var(--text-link)] hover:underline" to="/rapports">
            {t.navRapports}
          </Link>
          <Link className="rounded-lg bg-[var(--bg-hover)] px-2.5 py-1 text-[var(--text-link)] hover:underline" to="/ai">
            {t.navAi}
          </Link>
          <Link className="rounded-lg bg-[var(--bg-hover)] px-2.5 py-1 text-[var(--text-link)] hover:underline" to="/ventes">
            {t.navVentes}
          </Link>
        </motion.div>
      )}

      {isAdminLike && (
        <div className="space-y-6">
          <DashboardStatCards cards={adminStatCards} loadingIndices={adminLoadingIndices} />

          <DashboardCharts
            trendData={trendData}
            barData={barData}
            loading={loadingMvt && movementQueryEnabled}
            hasNoMovements={hasNoMovements}
          />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <DashboardRecentActivity movements={rawMvts} loading={loadingMvt && movementQueryEnabled} />
            </div>
            <div className="xl:col-span-5">
              {hasPermission(role, "stock:read") ? <AnomaliesWidget limit={4} /> : null}
            </div>
          </div>
        </div>
      )}

      {!isAdminLike && (
        <DashboardStatCards cards={nonAdminCards} loadingIndices={nonAdminLoadingIndices} />
      )}
            </div>
          </DashboardPageBackground>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
