import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#1D9E75", "#E24B4A", "#D97706"];

export default function DonutChart({ conformes = 0, manquants = 0, surplus = 0 }) {
  const data = [
    { name: "Conformes", value: conformes },
    { name: "Manquants", value: manquants },
    { name: "Surplus", value: surplus },
  ].filter((d) => d.value > 0);

  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-slate-500">Aucune donnée</div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          innerRadius={52}
          outerRadius={72}
          paddingAngle={2}
          dataKey="value"
          animationDuration={1000}
          animationEasing="ease-out"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            fontSize: 12,
            color: "var(--text-primary)",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
