import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "../../../hooks/useChartTheme";
import { formatMoney } from "../rapportUtils";
import ChartCard from "./ChartCard";

function MetricPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition"
      style={{
        borderColor: active
          ? "color-mix(in srgb, var(--accent-primary) 45%, var(--border-default))"
          : "var(--border-default)",
        background: active
          ? "color-mix(in srgb, var(--accent-primary) 14%, transparent)"
          : "var(--bg-hover)",
        color: active ? "var(--accent-primary)" : "var(--text-muted)",
      }}
    >
      {children}
    </button>
  );
}

export default function SalesAreaChart({ data = [], loading }) {
  const t = useChartTheme();
  const [cumulative, setCumulative] = useState(false);

  const chartData = useMemo(() => {
    if (!cumulative) return data;
    let acc = 0;
    return data.map((d) => {
      acc += Number(d.total || 0);
      return { ...d, total: acc };
    });
  }, [data, cumulative]);

  const total = data.reduce((s, d) => s + (d.total || 0), 0);
  const avg = data.length ? total / data.length : 0;

  const half = Math.floor(data.length / 2) || 1;
  const firstHalfAvg = data.slice(0, half).reduce((s, d) => s + (d.total || 0), 0) / half;
  const secondHalfAvg =
    data.slice(half).reduce((s, d) => s + (d.total || 0), 0) / (data.length - half || 1);
  const trendPct = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;
  const trendUp = trendPct >= 0;

  return (
    <ChartCard
      loading={loading}
      icon={TrendingUp}
      title="Évolution des ventes"
      subtitle={`Total période : ${formatMoney(total)} · Moyenne : ${formatMoney(avg)}/mois`}
      filters={
        <>
          <MetricPill active={!cumulative} onClick={() => setCumulative(false)}>
            Mensuel
          </MetricPill>
          <MetricPill active={cumulative} onClick={() => setCumulative(true)}>
            Cumulé
          </MetricPill>
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{
              background: trendUp ? "var(--success-bg)" : "var(--danger-bg)",
              color: trendUp ? "var(--success-text)" : "var(--danger-text)",
            }}
          >
            {trendUp ? "↑" : "↓"} {Math.abs(trendPct).toFixed(1)}% vs 1ère moitié de période
          </span>
        </>
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="rapportVentesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={t.gridColor} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: t.tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: t.tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: t.tooltipBg,
                border: `1px solid ${t.tooltipBorder}`,
                borderRadius: 12,
                fontSize: 12,
                color: t.tooltipText,
              }}
              formatter={(v) => [formatMoney(v), cumulative ? "Cumul" : "Ventes"]}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--accent-primary)"
              strokeWidth={2.5}
              fill="url(#rapportVentesFill)"
              dot={{ r: 4, fill: "var(--accent-primary)" }}
              activeDot={{ r: 6 }}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
