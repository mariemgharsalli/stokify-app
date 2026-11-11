import { RotationGauge, fmtNum } from "../../pages/stock/CoutStockageCharts";
import { RECO_COLORS, rotationGaugeScore } from "./rotationReportHelpers";

const CARD = {
  background: "var(--color-background-primary, var(--bg-card))",
  border: "0.5px solid var(--color-border-tertiary, var(--border-default))",
  borderRadius: 12,
};

export default function RotationReportTable({ items, isLoading, showDepot }) {
  return (
    <div className="overflow-x-auto rounded-xl" style={{ ...CARD, borderLeft: "3px solid #1D9E75" }}>
      {isLoading ? (
        <p className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>Aucune donnée pour cette période</p>
      ) : (
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary, var(--border-default))" }}>
              {["Article", ...(showDepot ? ["Dépôt"] : []), "Stock moyen", "Qté vendue", "Taux rotation", "Jauge", "Recommandation"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => {
              const color = RECO_COLORS[row.recommandationNiveau] || "#BA7517";
              return (
                <tr
                  key={`${row.articleId}-${row.depotId}`}
                  className="transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    borderBottom: "0.5px solid var(--color-border-tertiary, var(--border-default))",
                    animation: `fadeUp 0.35s ease ${i * 30}ms both`,
                  }}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: "var(--text-primary)" }}>{row.article?.libelle}</p>
                    <p className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{row.article?.code}</p>
                  </td>
                  {showDepot && (
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {row.depot?.code || "—"}
                      {row.depot?.libelle ? (
                        <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{row.depot.libelle}</span>
                      ) : null}
                    </td>
                  )}
                  <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmtNum(row.stockMoyen, 2)}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmtNum(row.qteVendue, 2)}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold" style={{ color }}>{fmtNum(row.taux, 1)}%</td>
                  <td className="px-4 py-3">
                    <div className="w-[80px]">
                      <RotationGauge score={rotationGaugeScore(row.taux)} size={80} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ background: `${color}20`, color, border: `0.5px solid ${color}40` }}
                    >
                      {row.recommandation}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
