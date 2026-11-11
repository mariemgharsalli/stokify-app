import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { INV_THEME } from "../inventaireUtils";

export default function EcartBarChart({ items = [] }) {
  const data = items.slice(0, 5).map((l) => ({
    name: (l.article?.libelle || l.article?.code || "Article").slice(0, 14),
    ecart: Math.abs(Number(l.ecart ?? 0)),
  }));

  if (!data.length) {
    return (
      <div
        className="flex h-40 items-center justify-center text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        Aucun écart
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={72}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{
            background: "var(--bg-card, #0f172a)",
            border: `1px solid ${INV_THEME.accent}44`,
            borderRadius: 10,
            fontSize: 12,
            color: "var(--text-primary, #e2e8f0)",
          }}
        />
        <Bar
          dataKey="ecart"
          fill={INV_THEME.accent}
          radius={[0, 6, 6, 0]}
          animationDuration={900}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
