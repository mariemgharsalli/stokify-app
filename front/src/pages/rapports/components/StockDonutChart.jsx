import { useMemo, useState } from "react";
import { PieChart as PieIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import { useChartTheme } from "../../../hooks/useChartTheme";
import { DEPOT_COLORS, formatMoney } from "../rapportUtils";
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

export default function StockDonutChart({ items = [], loading }) {
  const t = useChartTheme();
  const [metric, setMetric] = useState("valeur"); // valeur | quantite
  const [depotFilter, setDepotFilter] = useState("");
  const hasQty = items.some((d) => d.quantite != null);

  const depotOptions = useMemo(
    () =>
      items.map((d) => ({
        value: String(d.depot),
        label: String(d.depot),
      })),
    [items]
  );

  const filtered = useMemo(() => {
    if (!depotFilter) return items;
    return items.filter((d) => String(d.depot) === depotFilter);
  }, [items, depotFilter]);

  const data = filtered.map((d, i) => ({
    name: d.depot,
    value: Number(metric === "quantite" && hasQty ? d.quantite : d.valeur) || 0,
    color: DEPOT_COLORS[i % DEPOT_COLORS.length],
  }));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ChartCard
      loading={loading}
      loadingHeight="h-56"
      icon={PieIcon}
      title="Répartition du stock par dépôt"
      subtitle={
        metric === "quantite" && hasQty
          ? `Total quantité : ${total.toLocaleString("fr-FR")}`
          : `Total valeur : ${formatMoney(total)}`
      }
      filters={
        <>
          {hasQty ? (
            <>
              <MetricPill active={metric === "valeur"} onClick={() => setMetric("valeur")}>
                Valeur
              </MetricPill>
              <MetricPill active={metric === "quantite"} onClick={() => setMetric("quantite")}>
                Quantité
              </MetricPill>
            </>
          ) : null}
          <SearchableSelect
            value={depotFilter}
            onChange={setDepotFilter}
            options={depotOptions}
            placeholder="Tous les dépôts"
            clearLabel="Tous les dépôts"
            searchPlaceholder="Rechercher un dépôt…"
            aria-label="Filtrer le donut par dépôt"
            className="min-w-[180px] sm:min-w-[200px]"
          />
        </>
      }
    >
      {!data.length ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Aucune donnée.
        </p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative h-48 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={50}
                  outerRadius={72}
                  dataKey="value"
                  animationDuration={1000}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: t.tooltipBg,
                    border: `1px solid ${t.tooltipBorder}`,
                    borderRadius: 8,
                    color: t.tooltipText,
                  }}
                  formatter={(v) =>
                    metric === "quantite" && hasQty
                      ? [`${Number(v).toLocaleString("fr-FR")} u.`, "Quantité"]
                      : [formatMoney(v), "Valeur"]
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Total
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {metric === "quantite" && hasQty
                    ? total.toLocaleString("fr-FR")
                    : formatMoney(total)}
                </p>
              </div>
            </div>
          </div>
          <ul className="space-y-2 text-sm sm:w-44">
            {data.map((d) => (
              <li key={d.name} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                <span className="flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                  {d.name}
                </span>
                <span style={{ color: "var(--text-primary)" }}>
                  {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
