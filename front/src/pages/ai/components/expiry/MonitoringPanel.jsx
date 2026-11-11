import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { useReducedMotion } from "framer-motion";
import { useLandingLang } from "../../../landing/LandingLangContext";
import { IA, surfaceStyle } from "../../moduleIaTheme";

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(3);
}

export default function MonitoringPanel({ data, loading }) {
  const { tx } = useLandingLang();
  const reduce = useReducedMotion();
  const labeled = Number(data?.labeled) || 0;
  if (loading) {
    return <div className={reduce ? "h-24 rounded-2xl" : "h-24 animate-pulse rounded-2xl"} style={{ background: IA.fill }} />;
  }
  if (!data || labeled < 5) {
    return (
      <div className="p-4" style={surfaceStyle()}>
        <p className="text-sm font-semibold" style={{ color: IA.text }}>{tx("Suivi réel")}</p>
        <p className="mt-1 text-[12px]" style={{ color: IA.muted }}>
          {tx("Le suivi s'affiche après 5 lots étiquetés à la DLC.")} {labeled}/5
        </p>
      </div>
    );
  }
  const cards = [
    [tx("Brier réel"), fmt(data.brier)],
    [tx("Couverture réelle"), data.coverage == null ? "—" : `${Math.round(data.coverage * 100)} %`],
    [tx("Lots étiquetés"), String(labeled)],
    [tx("Dérive"), data.drift?.delta == null ? "—" : fmt(data.drift.delta)],
  ];
  return (
    <div className="p-4" style={surfaceStyle()}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: IA.muted }}>{tx("Suivi réel")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] uppercase" style={{ color: IA.muted }}>{label}</p>
            <p className="font-mono text-lg font-semibold tabular-nums" style={{ color: IA.text }}>{value}</p>
          </div>
        ))}
      </div>
      {(data.series || []).length > 1 ? (
        <div className="mt-3 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series}>
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="brier"
                stroke="var(--accent-primary)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={!reduce}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
