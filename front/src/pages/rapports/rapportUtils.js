export const THEME = {
  bg: "var(--bg-app)",
  card: "var(--bg-card)",
  border: "var(--border-default)",
};

export const BAR_COLORS = ["#378ADD", "#1D9E75", "#BA7517", "#E24B4A", "#0F6E56"];

export const DEPOT_COLORS = ["#378ADD", "#1D9E75", "#BA7517", "#22d3ee", "#E24B4A", "#0F6E56"];

export const PERIOD_PRESETS = [
  { id: "7d", label: "7J", days: 7 },
  { id: "30d", label: "30J", days: 30 },
  { id: "90d", label: "90J", days: 90 },
  { id: "6m", label: "6M", days: 183 },
  { id: "1y", label: "1AN", days: 365 },
  { id: "custom", label: "Personnalisé", days: null },
];

export function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    maximumFractionDigits: 2,
  }).format(Number(n));
}

export function dateRangeForPreset(presetId) {
  const preset = PERIOD_PRESETS.find((p) => p.id === presetId);
  if (!preset?.days) return { dateDebut: "", dateFin: "" };
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - preset.days);
  return {
    dateDebut: start.toISOString().slice(0, 10),
    dateFin: end.toISOString().slice(0, 10),
  };
}

export function buildMonthlySeries(items, dateField, valueField, months = 6) {
  const now = new Date();
  const keys = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      ventes: 0,
      achats: 0,
      total: 0,
    });
  }
  const map = new Map(keys.map((k) => [k.key, { ...k }]));
  items.forEach((row) => {
    const d = new Date(row[dateField] || row.createdAt);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) return;
    const val = Number(row[valueField] || 0);
    const entry = map.get(key);
    entry.total += val;
    map.set(key, entry);
  });
  return Array.from(map.values());
}

export function mergeSalesPurchases(ventes, achats) {
  const now = new Date();
  const keys = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("fr-FR", { month: "short" }),
      ventes: 0,
      achats: 0,
    });
  }
  const map = new Map(keys.map((k) => [k.key, { ...k }]));
  ventes.forEach((v) => {
    const d = new Date(v.dateVente || v.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (map.has(key)) map.get(key).ventes += Number(v.totalTTC || v.totalHT || 0);
  });
  achats.forEach((a) => {
    const d = new Date(a.dateCommande || a.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (map.has(key)) map.get(key).achats += Number(a.totalTTC || a.totalHT || 0);
  });
  return Array.from(map.values());
}
