export const RECO_COLORS = {
  danger: "#E24B4A",
  warning: "#BA7517",
  success: "#1D9E75",
};

export function rotationGaugeScore(taux) {
  return Math.min(100, Math.max(0, Math.round(Number(taux) || 0)));
}

export function rotationBadgeFromTaux(taux) {
  const n = Number(taux) || 0;
  if (n > 50) {
    return { label: "Forte rotation", labelLines: ["Forte", "rotation"], color: "#1D9E75", gradientTo: "#2BC492" };
  }
  if (n >= 10) {
    return { label: "Rotation moyenne", labelLines: ["Moyenne", "rotation"], color: "#BA7517", gradientTo: "#E8A020" };
  }
  return { label: "Faible rotation", labelLines: ["Faible", "rotation"], color: "#E24B4A", gradientTo: "#F06B6A" };
}

export function rowAccentColor(row) {
  return RECO_COLORS[row.recommandationNiveau] || rotationBadgeFromTaux(row.taux).color;
}
