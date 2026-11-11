import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { AnimatedNumber } from "./CoutStockageCharts";

const COLORS = ["#1D9E75", "#378ADD", "#BA7517", "#E24B4A", "#7F77DD"];

function fmt(n) {
  return Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

function marginColor(t) {
  if (t >= 20) return "#1D9E75";
  if (t >= 10) return "#BA7517";
  return "#E24B4A";
}

/** Barre de comparaison coût total vs prix de vente */
export function ProfitabilityComparisonBar({ coutTotal = 0, prixVente = 0 }) {
  const [mounted, setMounted] = useState(false);
  const sum = Number(coutTotal) + Number(prixVente) || 1;
  const coutPct = (Number(coutTotal) / sum) * 100;
  const ventePct = (Number(prixVente) / sum) * 100;

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [coutTotal, prixVente]);

  return (
    <div className="cout-chart-card cout-fade-up">
      <p className="cout-chart-card-title">Répartition coût vs vente</p>
      <div className="mb-4 flex items-center justify-between gap-4 text-xs">
        <span className="flex items-center gap-2" style={{ color: "#E24B4A" }}>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "linear-gradient(90deg, #E24B4A, #F06B6A)" }} />
          Coût / unité: <strong>{fmt(coutTotal)} TND</strong>
        </span>
        <span className="flex items-center gap-2" style={{ color: "#1D9E75" }}>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "linear-gradient(90deg, #1D9E75, #2BC492)" }} />
          Prix vente / unité: <strong>{fmt(prixVente)} TND</strong>
        </span>
      </div>
      <div className="cout-stacked-bar" style={{ height: 16 }}>
        <div
          className="cout-stacked-segment"
          style={{
            width: mounted ? `${coutPct}%` : "0%",
            background: "linear-gradient(90deg, #E24B4A, #F06B6A)",
            transition: "width 1.3s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
        <div
          className="cout-stacked-segment"
          style={{
            width: mounted ? `${ventePct}%` : "0%",
            background: "linear-gradient(90deg, #1D9E75, #2BC492)",
            transition: "width 1.3s cubic-bezier(0.22, 1, 0.36, 1) 0.15s",
          }}
        />
      </div>
    </div>
  );
}

/** Tableau de décomposition rentabilité */
export function ProfitabilityBreakdown({ rows = [], margePct = 0 }) {
  const margeColor = margePct >= 0 ? "#1D9E75" : "#E24B4A";
  return (
    <div className="cout-chart-card overflow-hidden !p-0 cout-fade-up" style={{ animationDelay: "80ms" }}>
      <div className="cout-table-header px-4 py-3">
        <p className="cout-chart-card-title !mb-0">Décomposition détaillée</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "var(--bg-input)" }}>
            {["Composant", "Montant", "% du total"].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.label}
              className="cout-row-enter cout-data-row"
              style={{
                borderTop: "1px solid var(--border-default)",
                animationDelay: `${i * 50}ms`,
                fontWeight: row.bold ? 700 : 400,
                color: row.bold ? margeColor : "var(--text-primary)",
                "--row-accent": row.color || margeColor,
              }}
            >
              <td className="px-4 py-3">
                <span className="inline-flex flex-wrap items-center gap-2">
                  {row.label}
                  {row.badge || null}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs" style={{ color: row.color || "var(--text-primary)" }}>
                {row.amount}
              </td>
              <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                {row.pct ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Bannière verdict rentabilité — conclusion visuelle dominante de l'onglet */
export function ProfitabilityVerdict({ tauxMarge = 0, ringSlot = null }) {
  let border;
  let text;
  let message;
  let hint;
  let icon;
  let label;
  if (tauxMarge > 20) {
    border = "#1D9E75";
    text = "#1D9E75";
    label = "Verdict positif";
    message = "Article rentable — marge excellente";
    hint = "La marge nette couvre largement les coûts de stockage.";
    icon = "✓";
  } else if (tauxMarge >= 10) {
    border = "#BA7517";
    text = "#BA7517";
    label = "Verdict mitigé";
    message = "Rentabilité correcte — marge acceptable";
    hint = "Surveillez les coûts dépôt pour préserver cette marge.";
    icon = "!";
  } else {
    border = "#E24B4A";
    text = "#E24B4A";
    label = "Verdict négatif";
    message = "Attention — marge insuffisante";
    hint = "Revoir le prix de vente ou réduire les coûts de stockage.";
    icon = "✕";
  }

  return (
    <div className="flex flex-wrap items-stretch gap-4" style={{ animationDelay: "120ms" }}>
      {ringSlot ? <div className="flex shrink-0 items-center">{ringSlot}</div> : null}
      <div
        className="cout-verdict-banner cout-verdict-banner--hero min-w-0 flex-1"
        style={{
          background: "var(--bg-card)",
          borderColor: border,
          color: text,
        }}
        role="status"
        aria-live="polite"
      >
        <div className="cout-verdict-banner__icon" style={{ background: border }} aria-hidden>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="cout-verdict-banner__label">{label}</p>
          <p className="cout-verdict-banner__msg">{message}</p>
          <p className="cout-verdict-banner__hint" style={{ color: "var(--text-secondary)" }}>
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RentabiliteCharts({ items = [], evolutionMensuelle = [], onArticleClick }) {
  const top10 = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.margeNette - a.margeNette)
        .slice(0, 10)
        .map((r) => ({
          name: (r.article?.code || "").slice(0, 12),
          fullName: r.article?.libelle,
          margeNette: r.margeNette,
          tauxMarge: r.tauxMarge,
        })),
    [items]
  );

  const scatter = items.map((r) => ({
    cmp: r.cmp,
    tauxMarge: r.tauxMarge,
    libelle: r.article?.libelle,
    id: r.article?.id,
  }));

  const tooltipStyle = {
    background: "var(--bg-modal)",
    border: "1px solid var(--border-default)",
    borderRadius: 10,
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="cout-chart-card lg:col-span-2" style={{ animationDelay: "0ms" }}>
        <h3 className="cout-chart-card-title">Top 10 — Marge nette</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={top10} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" opacity={0.5} />
            <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={72} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => [`${fmt(v)} TND`, "Marge nette"]}
              labelFormatter={(_, p) => p?.[0]?.payload?.fullName}
            />
            <Bar dataKey="margeNette" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={900}>
              {top10.map((entry, i) => (
                <Cell key={i} fill={marginColor(entry.tauxMarge)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="cout-chart-card" style={{ animationDelay: "60ms" }}>
        <h3 className="cout-chart-card-title">CMP vs Taux marge %</h3>
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" opacity={0.5} />
            <XAxis type="number" dataKey="cmp" name="CMP" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <YAxis type="number" dataKey="tauxMarge" name="Marge %" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <ZAxis range={[40, 400]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={tooltipStyle}
              formatter={(v, name) => [
                name === "tauxMarge" ? `${v}%` : `${fmt(v)} TND`,
                name === "tauxMarge" ? "Marge" : "CMP",
              ]}
              labelFormatter={(_, p) => p?.payload?.libelle}
            />
            <Scatter
              data={scatter}
              fill="#378ADD"
              onClick={(d) => onArticleClick?.(d?.id)}
              style={{ cursor: onArticleClick ? "pointer" : "default" }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="cout-chart-card" style={{ animationDelay: "120ms" }}>
        <h3 className="cout-chart-card-title">Évolution marge mensuelle</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={evolutionMensuelle}>
            <defs>
              <linearGradient id="margeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1D9E75" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#1D9E75" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" opacity={0.5} />
            <XAxis dataKey="mois" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="marge"
              stroke="#1D9E75"
              fill="url(#margeAreaGrad)"
              strokeWidth={2.5}
              isAnimationActive
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export { fmt, marginColor, AnimatedNumber };
