import {
  Bar,
  BarChart,
  Cell,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";
import { formatMoisLabel } from "../../utils/commerceUi";

export default function CommerceChart({ data, dataKey = "total", title }) {
  const chartData = (data || []).map((x) => ({
    ...x,
    moisLabel: formatMoisLabel(x.mois),
    [dataKey]: Number(x[dataKey] ?? x.total ?? x.ca ?? 0),
  }));
  const lastIdx = chartData.length - 1;

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
      {title ? <p className="mb-3 text-xs text-[var(--text-muted)]">{title}</p> : null}
      <div className="h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradCommerce" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7F77DD" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#378ADD" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <XAxis dataKey="moisLabel" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "#1e2130",
                border: "1px solid rgba(127,119,221,0.25)",
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(v) => [
                `${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND`,
                "Total TTC",
              ]}
            />
            <Bar dataKey={dataKey} radius={[6, 6, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === lastIdx ? "#7F77DD" : "#378ADD"}
                  opacity={0.8 + (i / Math.max(chartData.length, 1)) * 0.2}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="#EF9F27"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 4"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
