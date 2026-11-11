export function formatTnd(n, opts = {}) {
  const { min = 3, max = 3 } = opts;
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toLocaleString("fr-FR", {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })} TND`;
}

export function formatPct(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toFixed(1)} %`;
}

export const PERIODE_OPTIONS = [
  { val: "mois", label: "Ce mois" },
  { val: "trimestre", label: "Trimestre" },
  { val: "semestre", label: "6 mois" },
  { val: "annee", label: "Cette année" },
  { val: "custom", label: "Personnalisé" },
];

export function buildDashboardParams(periode, dateDebut, dateFin) {
  const params = { periode };
  if (periode === "custom") {
    if (dateDebut) params.dateDebut = dateDebut;
    if (dateFin) params.dateFin = dateFin;
  }
  return params;
}
