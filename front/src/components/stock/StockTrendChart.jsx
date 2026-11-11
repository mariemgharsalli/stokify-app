import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";

function formatDay(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const entrees = payload.find((p) => p.dataKey === "entrees")?.value ?? 0;
  const sorties = payload.find((p) => p.dataKey === "sorties")?.value ?? 0;
  const solde = Number(entrees) - Number(sorties);
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tooltip)] px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-[var(--text-primary)]">{formatDay(label)}</p>
      <p className="text-[#1D9E75]">Entrées : {Number(entrees).toLocaleString("fr-FR")}</p>
      <p className="text-[#E24B4A]">Sorties : {Number(sorties).toLocaleString("fr-FR")}</p>
      <p className="text-[var(--text-secondary)]">Solde net : {solde.toLocaleString("fr-FR")}</p>
    </div>
  );
}

export default function StockTrendChart({ open, onToggle }) {
  const societeScope = useSocieteQueryScope();
  const { data = [], isLoading } = useQuery({
    queryKey: ["stock-tendance", societeScope],
    queryFn: () => api.get("stock/tendance", { params: { days: 30 } }).then((r) => r.data),
  });

  const chartData = useMemo(
    () =>
      (data || []).map((d) => ({
        ...d,
        label: formatDay(d.date),
      })),
    [data]
  );

  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)]"
      >
        Tendance stock — 30 derniers jours
        {open ? <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />}
      </button>
      {open ? (
        <div className="border-t border-[var(--border-default)] px-2 pb-4 pt-2 animate-[fadeUp_0.4s_ease_both]">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">Chargement…</p>
          ) : chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">Aucun mouvement sur la période.</p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stockTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1D9E75" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={48} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="entrees"
                    name="Entrées"
                    stroke="#1D9E75"
                    fill="url(#stockTrendFill)"
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={1200}
                  />
                  <Area
                    type="monotone"
                    dataKey="sorties"
                    name="Sorties"
                    stroke="#E24B4A"
                    fill="transparent"
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={1200}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
