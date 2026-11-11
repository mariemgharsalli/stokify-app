import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[#1e2130] px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-[var(--text-primary)]">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Number(p.value || 0).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND
        </p>
      ))}
    </div>
  );
}

export default function ReglementsFluxChart({ data }) {
  const chartData = data?.length ? data : [];

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">Évolution des flux financiers</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Encaissements vs paiements fournisseurs — 6 derniers mois
          </p>
        </div>
        <div className="flex gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-[#1D9E75]">
            <span className="inline-block h-0.5 w-2.5 rounded-sm bg-[#1D9E75]" />
            Encaissements
          </span>
          <span className="flex items-center gap-1.5 text-[#378ADD]">
            <span className="inline-block h-0.5 w-2.5 rounded-sm bg-[#378ADD]" />
            Paiements fournisseurs
          </span>
        </div>
      </div>
      <div className="h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradEncaisse" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPaye" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#378ADD" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#378ADD" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="encaisse"
              name="Encaissements"
              stroke="#1D9E75"
              fill="url(#gradEncaisse)"
              strokeWidth={2}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="paye"
              name="Paiements fournisseurs"
              stroke="#378ADD"
              fill="url(#gradPaye)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
