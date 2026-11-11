import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

export default function SalesVsAchatsChart({ data = [], loading }) {
  const t = useChartTheme();
  const [showMarge, setShowMarge] = useState(false);
  const enriched = useMemo(
    () => data.map((d) => ({ ...d, marge: (d.ventes || 0) - (d.achats || 0) })),
    [data]
  );

  return (
    <ChartCard
      loading={loading}
      icon={Scale}
      title="Ventes vs Achats (mensuel)"
      subtitle={showMarge ? "Marge = ventes − achats" : "Comparaison mensuelle"}
      filters={
        <MetricPill active={showMarge} onClick={() => setShowMarge((v) => !v)}>
          {showMarge ? "Masquer la marge" : "Voir la marge"}
        </MetricPill>
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={enriched}>
            <CartesianGrid stroke={t.gridColor} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: t.tickColor, fontSize: 11 }} />
            <YAxis tick={{ fill: t.tickColor, fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: t.tooltipBg,
                border: `1px solid ${t.tooltipBorder}`,
                borderRadius: 8,
                color: t.tooltipText,
              }}
              formatter={(v) => formatMoney(v)}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: t.legendText }} />
            <Bar dataKey="ventes" name="Ventes" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} animationDuration={800} />
            <Bar dataKey="achats" name="Achats" fill="var(--accent-warning)" radius={[4, 4, 0, 0]} animationDuration={800} />
            {showMarge ? (
              <Bar
                dataKey="marge"
                name="Marge"
                fill="var(--accent-success, #1D9E75)"
                radius={[4, 4, 0, 0]}
                animationDuration={800}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
