import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTnd } from "../comptabiliteUtils";

function FluxTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[#1e2130] px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-[var(--text-primary)]">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatTnd(p.value)}
        </p>
      ))}
    </div>
  );
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[#1e2130] px-2 py-1.5 text-[11px]">
      <span style={{ color: payload[0]?.payload?.fill }}>{payload[0]?.name}: </span>
      <span className="text-[var(--text-primary)]">{formatTnd(payload[0]?.value)}</span>
    </div>
  );
}

export default function ComptabiliteCharts({ chartData = [], stats }) {
  const s = stats || {};
  const donutData = [
    { name: "Encaissé", value: Math.max(0, Number(s.encaisse ?? 0)), fill: "#1D9E75" },
    { name: "Impayés clients", value: Math.max(0, Number(s.impayesClients ?? 0)), fill: "#E24B4A" },
    { name: "Dettes fournisseurs", value: Math.max(0, Number(s.dettesFournisseurs ?? 0)), fill: "#EF9F27" },
  ].filter((d) => d.value > 0);

  const donutDisplay =
    donutData.length > 0
      ? donutData
      : [{ name: "Aucune donnée", value: 1, fill: "#374151" }];

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
      <div className="animate-fade-up rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Flux financiers</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Achats vs Ventes vs Solde — 6 derniers mois
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)]">
            {[
              { color: "#378ADD", label: "Achats" },
              { color: "#7F77DD", label: "Ventes" },
              { color: "#1D9E75", label: "Solde" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-2.5 rounded-sm" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradAchatsCompta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#378ADD" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#378ADD" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradVentesCompta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7F77DD" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7F77DD" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSoldeCompta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip content={<FluxTooltip />} />
              <Area
                type="monotone"
                dataKey="achats"
                name="Achats"
                stroke="#378ADD"
                fill="url(#gradAchatsCompta)"
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="ventes"
                name="Ventes"
                stroke="#7F77DD"
                fill="url(#gradVentesCompta)"
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="solde"
                name="Solde"
                stroke="#1D9E75"
                fill="url(#gradSoldeCompta)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="animate-fade-up flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 md:p-5 [animation-delay:80ms]">
        <p className="text-sm font-medium text-[var(--text-primary)]">Répartition du solde</p>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Encaissé vs impayé vs dettes</p>
        <div className="h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutDisplay}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
              >
                {donutDisplay.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-col gap-1.5">
          {[
            { label: "Encaissé", val: s.encaisse, color: "#1D9E75" },
            { label: "Impayés clients", val: s.impayesClients, color: "#E24B4A" },
            { label: "Dettes fournisseurs", val: s.dettesFournisseurs, color: "#EF9F27" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                {item.label}
              </span>
              <span className="text-[11px] font-medium tabular-nums" style={{ color: item.color }}>
                {formatTnd(item.val)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
