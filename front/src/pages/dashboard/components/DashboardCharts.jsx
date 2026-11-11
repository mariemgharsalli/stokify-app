import { motion, useReducedMotion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingUp, Activity } from "lucide-react";
import { DASHBOARD_TONES, MOVEMENT_BAR_HEX } from "./dashboardTones";
import { useLandingLang } from "../../landing/LandingLangContext";
import { useChartTheme } from "../../../hooks/useChartTheme";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

function ChartTooltip({ active, payload, label, localeTag }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--dash-line)] bg-[var(--dash-glass-strong)] px-3.5 py-2.5 shadow-lg backdrop-blur-xl">
      <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--text-primary)]">
        {Number(payload[0].value).toLocaleString(localeTag || "fr-FR", { maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

function ChartCard({ children, title, subtitle, icon: Icon, accent, delay = 0, className = "", reduceMotion }) {
  return (
    <motion.div
      custom={delay / 100}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className={`dash-glass-card p-5 ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${accent} 70%, transparent), transparent)`,
        }}
        aria-hidden
      />
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: `color-mix(in srgb, ${accent} 16%, transparent)`,
              color: accent,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 24%, transparent)`,
            }}
          >
            <Icon size={16} />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold text-[var(--text-primary)] sm:text-base">{title}</h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{subtitle}</p>
          </div>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="dash-skeleton h-[340px] rounded-[1.25rem] lg:col-span-2" />
      <div className="dash-skeleton h-[340px] rounded-[1.25rem]" />
      <style>{`
        .dash-skeleton {
          background: linear-gradient(90deg, var(--bg-hover) 25%, color-mix(in srgb, var(--bg-card) 60%, var(--bg-hover)) 50%, var(--bg-hover) 75%);
          background-size: 200% 100%;
          animation: dashShimmer 1.4s ease-in-out infinite;
        }
        @keyframes dashShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

function FlowMeters({ barData, reduceMotion }) {
  const total = barData.reduce((sum, row) => sum + Number(row.qte || 0), 0) || 1;
  return (
    <div className="flex h-[280px] flex-col justify-center gap-5">
      {barData.map((row, i) => {
        const color = MOVEMENT_BAR_HEX[row.key] ?? DASHBOARD_TONES.primary.chart;
        const pct = Math.max(2, Math.round((Number(row.qte || 0) / total) * 100));
        return (
          <div key={row.key || row.name} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">{row.name}</span>
              <span className="font-semibold tabular-nums" style={{ color }}>
                {Number(row.qte || 0).toLocaleString()}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg-hover)]">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 55%, white))`,
                  boxShadow: `0 0 12px ${color}55`,
                }}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardCharts({ trendData, barData, loading, hasNoMovements }) {
  const reduceMotion = useReducedMotion();
  const { t } = useLandingLang();
  const chartTheme = useChartTheme();
  if (loading) return <ChartsSkeleton />;

  const primaryColor = DASHBOARD_TONES.primary.chart;
  const accentColor = DASHBOARD_TONES.accent.chart;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <ChartCard
        title={t.dashChartSales}
        subtitle={t.dashChartSalesSub}
        icon={TrendingUp}
        accent={DASHBOARD_TONES.primary.accent}
        delay={100}
        className="lg:col-span-2"
        reduceMotion={reduceMotion}
      >
        {hasNoMovements ? (
          <div className="flex h-[280px] w-full items-center justify-center text-sm text-[var(--text-muted)]">
            {t.dashNoMovements}
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardFillVentes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={primaryColor} stopOpacity={0.42} />
                    <stop offset="55%" stopColor={accentColor} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={primaryColor} stopOpacity={0.02} />
                  </linearGradient>
                  <filter id="dashboardGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid stroke={chartTheme.gridColor} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="m"
                  tick={{ fill: chartTheme.tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: chartTheme.tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={(props) => <ChartTooltip {...props} localeTag={t.localeTag} />} />
                <Area
                  type="monotone"
                  dataKey="valeur"
                  stroke={primaryColor}
                  strokeWidth={2.8}
                  fill="url(#dashboardFillVentes)"
                  filter="url(#dashboardGlow)"
                  isAnimationActive={!reduceMotion}
                  animationDuration={900}
                  activeDot={{ r: 6, fill: accentColor, stroke: "var(--bg-card)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title={t.dashChartFlow}
        subtitle={t.dashChartFlowSub}
        icon={Activity}
        accent={DASHBOARD_TONES.success.chart}
        delay={180}
        reduceMotion={reduceMotion}
      >
        {hasNoMovements ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-[var(--text-muted)]">
            {t.dashNoMovements}
          </div>
        ) : (
          <FlowMeters barData={barData} reduceMotion={reduceMotion} />
        )}
      </ChartCard>
    </div>
  );
}
