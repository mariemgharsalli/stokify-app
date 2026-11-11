import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "../../../hooks/useChartTheme";
import { BAR_COLORS, formatMoney } from "../rapportUtils";
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

export default function TopArticlesBarChart({ items = [], loading }) {
  const t = useChartTheme();
  const [metric, setMetric] = useState("qte"); // qte | valeur

  const data = useMemo(
    () =>
      items.map((item, i) => ({
        ...item,
        fill: BAR_COLORS[i % BAR_COLORS.length],
        value: metric === "valeur" ? Number(item.valeur || 0) : Number(item.qte || 0),
      })),
    [items, metric]
  );

  const total = data.reduce((s, d) => s + d.value, 0);
  const top = data[0];
  const topPct = total > 0 && top ? ((top.value / total) * 100).toFixed(0) : null;
  const insight =
    top && topPct != null
      ? `Top article : ${top.article} — ${topPct}% du total (${metric === "valeur" ? "valeur" : "quantité"})`
      : "Aucune donnée de vente";

  return (
    <ChartCard
      loading={loading}
      icon={BarChart3}
      title="Top 5 articles les plus vendus"
      subtitle={insight}
      filters={
        <>
          <MetricPill active={metric === "qte"} onClick={() => setMetric("qte")}>
            Quantité
          </MetricPill>
          <MetricPill active={metric === "valeur"} onClick={() => setMetric("valeur")}>
            Valeur
          </MetricPill>
        </>
      }
    >
      {!data.length ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Aucune donnée de vente.
        </p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="article"
                width={100}
                tick={{ fill: t.tickColor, fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  background: t.tooltipBg,
                  border: `1px solid ${t.tooltipBorder}`,
                  borderRadius: 8,
                  color: t.tooltipText,
                }}
                formatter={(v, _n, p) => [
                  metric === "valeur" ? formatMoney(v) : `${Number(v).toFixed(0)} unités`,
                  p.payload.article,
                ]}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={800}>
                {data.map((entry) => (
                  <Cell key={entry.article} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
