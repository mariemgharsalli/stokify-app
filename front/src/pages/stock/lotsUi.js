/** Helpers partagés Lots / LotCard — ne pas dupliquer daysLeft / fmtDate / STATUT_CFG. */

export const STATUT_CFG = {
  ACTIF: { label: "Actif", cls: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" },
  EXPIRE: { label: "Expiré", cls: "bg-red-500/20 border-red-500/30 text-red-300" },
  EPUISE: { label: "Épuisé", cls: "bg-slate-500/20 border-slate-500/30 text-slate-400" },
  DESACTIVE: {
    label: "Désactivé",
    cls: "bg-slate-500/25 border-slate-400/40 text-slate-300 dark:text-slate-400",
  },
};

export function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function daysLeft(v) {
  if (!v) return null;
  const d = new Date(v);
  const now = new Date();
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86400000
  );
}

export function computeStatut(lot) {
  if (!lot) return "ACTIF";
  if (String(lot.statut || "").toUpperCase() === "DESACTIVE") return "DESACTIVE";
  if (Number(lot.quantiteRestante) <= 0) return "EPUISE";
  if (lot.dateExpiration) {
    const exp = new Date(lot.dateExpiration);
    if (!Number.isNaN(exp.getTime()) && exp < new Date()) return "EXPIRE";
  }
  return "ACTIF";
}

/** Couleur barre de fraîcheur alignée sur les seuils DlcBadge (7j / 30j). */
export function freshnessColor(dateExpiration) {
  const days = daysLeft(dateExpiration);
  if (days === null) return "#64748b";
  if (days < 0) return "#E24B4A";
  if (days <= 7) return "#E24B4A";
  if (days <= 30) return "#EF9F27";
  return "#1D9E75";
}

export function freshnessGradient(dateExpiration) {
  const days = daysLeft(dateExpiration);
  if (days === null) return "linear-gradient(90deg, #64748b, #94a3b8)";
  if (days < 0) return "linear-gradient(90deg, #E24B4A, #b91c1c)";
  if (days <= 7) return "linear-gradient(90deg, #EF9F27, #E24B4A)";
  if (days <= 30) return "linear-gradient(90deg, #1D9E75, #EF9F27)";
  return "linear-gradient(90deg, #1D9E75, #34d399)";
}
