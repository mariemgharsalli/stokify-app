export function getChartTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  return {
    gridColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    tickColor: isDark ? "#64748b" : "#94a3b8",
    tooltipBg: isDark ? "#1e2130" : "#ffffff",
    tooltipBorder: isDark ? "#2d3148" : "#e2e8f0",
    tooltipText: isDark ? "#f1f5f9" : "#0f172a",
    legendText: isDark ? "#94a3b8" : "#475569",
  };
}
