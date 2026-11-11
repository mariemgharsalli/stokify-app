import { motion, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  Boxes,
  ShoppingCart,
  ArrowRight,
  AlertTriangle,
  CalendarClock,
  Receipt,
  Activity,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { hasPermission } from "../../../security/permissions";
import { roleLabel } from "../../../security/roleLabels";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../../utils/brandStyles";
import { useLandingLang } from "../../landing/LandingLangContext";
import { DASHBOARD_TONES } from "./dashboardTones";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

function GaugeRing({ value = 0, color, label, hint, reduceMotion }) {
  const size = 92;
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = c - (pct / 100) * c;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-[92px] w-[92px]">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(148,163,184,0.28)"
            strokeWidth="7"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={reduceMotion ? false : { strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold tabular-nums"
          style={{ color }}
        >
          {Math.round(pct)}
        </span>
      </div>
      <p className="max-w-[92px] truncate text-center text-[11px] font-semibold text-[var(--text-primary)]">{label}</p>
      {hint ? <p className="text-[10px] text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}

export default function DashboardHero({
  user,
  role,
  societeLabel,
  isClient,
  alertsCount = 0,
  lotsCount = 0,
  lotsAtStake = "",
  ventesMonth = 0,
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const canVentes = hasPermission(role, "ventes:read");
  const canStock = hasPermission(role, "stock:read");
  const { t } = useLandingLang();

  const health =
    alertsCount > 0 ? "alert" : lotsCount > 0 ? "watch" : "ok";
  const healthMeta = {
    ok: { label: t.dashHealthOk, color: DASHBOARD_TONES.success.chart },
    watch: { label: t.dashHealthWatch, color: DASHBOARD_TONES.warning.chart },
    alert: { label: t.dashHealthAlert, color: DASHBOARD_TONES.danger.chart },
  }[health];

  const alertPct = Math.min(100, alertsCount * 12);
  const lotsPct = Math.min(100, lotsCount * 8);
  const ventesPct = Math.min(100, Number(ventesMonth) > 0 ? 35 + Math.min(65, Number(ventesMonth)) : 8);

  return (
    <motion.section
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className="grid grid-cols-1 gap-4 lg:grid-cols-12"
    >
      <div className="group/hero relative isolate min-h-[280px] overflow-hidden rounded-[1.75rem] border border-[var(--dash-line)] shadow-[var(--dash-shadow)] sm:min-h-[320px] lg:col-span-7 lg:min-h-[360px]">
        <div className="absolute inset-0 overflow-hidden bg-slate-950" aria-hidden>
          <video
            src="/home-assets/dashboard-hero.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover object-center brightness-[1.05] contrast-[1.05]"
          />
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(6,10,22,0.78) 0%, rgba(6,10,22,0.42) 38%, rgba(6,10,22,0.12) 68%, transparent 100%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-black/10" aria-hidden />
        <motion.div
          className="absolute inset-x-0 top-0 z-[1] h-[2px]"
          style={{
            background: "linear-gradient(90deg, transparent, #22d3ee, #60a5fa, transparent)",
          }}
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />

        <div className="relative z-[2] flex min-h-[280px] flex-col justify-end gap-5 p-6 sm:min-h-[320px] lg:min-h-[360px] lg:p-8">
          <div className="max-w-xl min-w-0 space-y-3">
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18, duration: 0.45 }}
              className="inline-flex items-center gap-2 text-xs font-medium tracking-wide text-cyan-100 drop-shadow"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
              {t.dashHeroEyebrow}
            </motion.p>
            <motion.h2
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26, duration: 0.5 }}
              className="font-display text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)] sm:text-4xl lg:leading-tight"
            >
              {isClient ? t.dashHeroWelcome : t.dashHeroTitle}
            </motion.h2>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.36, duration: 0.45 }}
              className="max-w-md text-sm leading-relaxed text-white/90 drop-shadow"
            >
              {user?.prenom} {user?.nom}
              <span className="text-white/55"> · </span>
              <span className="font-medium text-cyan-200">{roleLabel(role)}</span>
              {societeLabel ? (
                <>
                  <span className="text-white/55"> · </span>
                  <span className="text-white">{societeLabel}</span>
                </>
              ) : null}
            </motion.p>
          </div>

          {!isClient && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.45 }}
              className="flex flex-wrap gap-3"
            >
              {canStock ? (
                <motion.button
                  type="button"
                  onClick={() => navigate("/stock")}
                  whileHover={reduceMotion ? undefined : { scale: 1.03, y: -2 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  className="group inline-flex items-center gap-2 rounded-xl border border-white/30 bg-slate-900/45 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-md transition-colors hover:bg-slate-900/60"
                >
                  <Boxes className="h-4 w-4 text-cyan-200" />
                  {t.navStock}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </motion.button>
              ) : null}
              {canVentes ? (
                <motion.button
                  type="button"
                  onClick={() => navigate("/ventes")}
                  whileHover={reduceMotion ? undefined : { scale: 1.03, y: -2 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  className={PRIMARY_BTN_CLASSES}
                  style={primaryButtonStyle}
                >
                  <ShoppingCart className="h-4 w-4" />
                  {t.navVentes}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </motion.button>
              ) : null}
            </motion.div>
          )}
        </div>
      </div>

      <motion.aside
        initial={reduceMotion ? false : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.22, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="dash-glass-card flex flex-col justify-between p-5 sm:p-6 lg:col-span-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <Activity className="h-3.5 w-3.5 text-cyan-500" />
              {t.dashOpsPulse}
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-[var(--text-primary)]">
              {healthMeta.label}
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: `color-mix(in srgb, ${healthMeta.color} 14%, transparent)`,
              color: healthMeta.color,
              border: `1px solid color-mix(in srgb, ${healthMeta.color} 32%, transparent)`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: healthMeta.color, boxShadow: `0 0 8px ${healthMeta.color}` }}
            />
            {t.dashLive}
          </span>
        </div>

        <div className="mt-6 flex items-end justify-around gap-2">
          <GaugeRing
            value={alertPct}
            color={DASHBOARD_TONES.danger.chart}
            label={t.dashAlertsShort}
            hint={String(alertsCount)}
            reduceMotion={reduceMotion}
          />
          <GaugeRing
            value={lotsPct}
            color={DASHBOARD_TONES.warning.chart}
            label={t.dashLotsExpiring}
            hint={lotsAtStake || String(lotsCount)}
            reduceMotion={reduceMotion}
          />
          <GaugeRing
            value={ventesPct}
            color={DASHBOARD_TONES.success.chart}
            label={t.dashSalesMonth}
            hint={String(ventesMonth ?? "—")}
            reduceMotion={reduceMotion}
          />
        </div>

        {!isClient ? (
          <div className="mt-6 grid grid-cols-3 gap-2">
            {[
              { icon: AlertTriangle, label: t.dashAlertsShort, to: "/stock", color: DASHBOARD_TONES.danger.chart },
              { icon: CalendarClock, label: t.navLots, to: "/stock/peremption-risk", color: DASHBOARD_TONES.warning.chart },
              { icon: Receipt, label: t.navRapports, to: "/rapports", color: DASHBOARD_TONES.primary.chart },
            ].map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => navigate(item.to)}
                className="group flex flex-col items-center gap-1.5 rounded-2xl border border-[var(--dash-line)] bg-[var(--bg-hover)] px-2 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent-info)_35%,transparent)]"
              >
                <item.icon className="h-4 w-4" style={{ color: item.color }} />
                <span className="text-[10px] font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/articles")}
            className="mt-6 w-full rounded-2xl border border-[var(--dash-line)] bg-[var(--bg-hover)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition-all hover:-translate-y-0.5"
          >
            {t.dashCatalog}
          </button>
        )}
      </motion.aside>
    </motion.section>
  );
}
