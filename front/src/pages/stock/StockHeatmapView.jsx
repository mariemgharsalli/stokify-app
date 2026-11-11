import { useEffect, useState } from "react";
import api from "../../services/api";

export default function StockHeatmapView({ societeScope }) {
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [metric, setMetric] = useState("quantite");

  useEffect(() => {
    if (societeScope == null) {
      setHeatmapData([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    async function fetchHeatmap() {
      try {
        const res = await api.get("/stock/heatmap", {
          params: { months: 12, metric },
        });
        if (!cancelled) {
          setHeatmapData(res.data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setHeatmapData([]);
          setLoading(false);
        }
      }
    }
    fetchHeatmap();
    return () => {
      cancelled = true;
    };
  }, [metric, societeScope]);

  const months = heatmapData[0]?.months?.map((m) => m.month) || [];
  const maxVal = Math.max(1, ...heatmapData.flatMap((a) => a.months.map((m) => m.value)));

  function cellColor(value) {
    if (value === 0) return "var(--bg-input)";
    const ratio = value / maxVal;
    if (ratio < 0.33) return `rgba(55,138,221,${0.2 + ratio * 0.6})`;
    if (ratio < 0.66) return `rgba(186,117,23,${0.3 + ratio * 0.5})`;
    return `rgba(226,75,74,${0.4 + ratio * 0.5})`;
  }

  function formatMonth(m) {
    const [y, mo] = m.split("-");
    return new Date(y, mo - 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  }

  return (
    <div style={{ animation: "fadeUp 0.4s ease" }}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-medium text-[var(--text-primary)]">Heatmap temporelle — 12 mois</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Intensité colorée par article et période. Rouge = forte activité, bleu = faible.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--bg-input)" }}>
          {[
            { key: "quantite", label: "Quantité" },
            { key: "entrees", label: "Entrées" },
            { key: "sorties", label: "Sorties" },
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: metric === m.key ? "rgba(55,138,221,0.2)" : "transparent",
                color: metric === m.key ? "#378ADD" : "var(--text-secondary)",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border-default)" }}>
        <table className="w-full border-collapse" style={{ minWidth: "700px" }}>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 p-3 text-left text-[10px] font-medium uppercase tracking-wide"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-secondary)",
                  minWidth: "140px",
                }}
              >
                Article
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  className="p-2 text-center text-[10px] font-medium uppercase tracking-wide"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-secondary)",
                    minWidth: "52px",
                  }}
                >
                  {formatMonth(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(8)
                .fill(0)
                .map((_, i) => (
                  <tr key={i}>
                    <td className="p-3">
                      <div
                        className="h-4 w-24 rounded"
                        style={{ background: "var(--bg-input)", animation: "shimmer 1.4s ease infinite" }}
                      />
                    </td>
                    {Array(12)
                      .fill(0)
                      .map((_, j) => (
                        <td key={j} className="p-1">
                          <div
                            className="h-8 w-full rounded-md"
                            style={{
                              background: "var(--bg-input)",
                              animation: `shimmer 1.4s ease ${j * 50}ms infinite`,
                            }}
                          />
                        </td>
                      ))}
                  </tr>
                ))
            ) : heatmapData.length === 0 ? (
              <tr>
                <td colSpan={months.length + 1} className="p-8 text-center text-sm text-[var(--text-muted)]">
                  Aucune donnée disponible pour la heatmap.
                </td>
              </tr>
            ) : (
              heatmapData.map((article, rowIdx) => (
                <tr
                  key={article.articleId}
                  className="transition-colors"
                  style={{
                    background: rowIdx % 2 === 0 ? "var(--bg-card)" : "var(--bg-input)",
                  }}
                >
                  <td
                    className="sticky left-0 z-10 p-3"
                    style={{
                      background: rowIdx % 2 === 0 ? "var(--bg-card)" : "var(--bg-input)",
                    }}
                  >
                    <p className="max-w-[120px] truncate text-xs font-medium text-[var(--text-primary)]">
                      {article.articleLibelle}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">{article.articleCode}</p>
                  </td>

                  {article.months.map((cell, colIdx) => {
                    const isHovered = hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx;
                    return (
                      <td key={cell.month} className="p-1">
                        <div
                          onMouseEnter={() =>
                            setHoveredCell({
                              row: rowIdx,
                              col: colIdx,
                              article: article.articleLibelle,
                              month: cell.month,
                              value: cell.value,
                            })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                          className="relative flex items-center justify-center rounded-md transition-all duration-150"
                          style={{
                            height: "36px",
                            background: cellColor(cell.value),
                            transform: isHovered ? "scale(1.15)" : "scale(1)",
                            outline: isHovered ? "2px solid rgba(255,255,255,0.4)" : "none",
                            cursor: "pointer",
                            animation: `cellFadeIn 0.3s ease ${(rowIdx * months.length + colIdx) * 8}ms both`,
                          }}
                        >
                          {cell.value > 0 && (
                            <span className="text-[9px] font-semibold text-white/80">
                              {cell.value >= 1000 ? `${(cell.value / 1000).toFixed(0)}k` : cell.value}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hoveredCell && (
        <div
          className="fixed bottom-6 left-1/2 z-[400] -translate-x-1/2 rounded-xl border px-4 py-2.5 shadow-2xl"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-default)",
            animation: "fadeUp 0.15s ease",
          }}
        >
          <div className="flex items-center gap-3 text-xs">
            <span className="font-medium text-[var(--text-primary)]">{hoveredCell.article}</span>
            <span className="text-[var(--text-secondary)]">{formatMonth(hoveredCell.month)}</span>
            <span className="font-semibold" style={{ color: "#378ADD" }}>
              {hoveredCell.value.toLocaleString("fr-FR")} {metric === "quantite" ? "UN" : "mvts"}
            </span>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-4">
        <span className="text-[10px] text-[var(--text-muted)]">Faible</span>
        <div className="flex gap-1">
          {[0.1, 0.25, 0.4, 0.6, 0.8, 1.0].map((r, i) => (
            <div key={i} className="h-3 w-6 rounded" style={{ background: cellColor(r * maxVal) }} />
          ))}
        </div>
        <span className="text-[10px] text-[var(--text-muted)]">Élevé</span>
      </div>
    </div>
  );
}
