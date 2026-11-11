/** Statut et date d'un lot, extraits de LotScanPage (comportement inchangé). */

export function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export function computeStatut(lot) {
  if (!lot) return "ACTIF";
  if (Number(lot.quantiteRestante) <= 0) return "EPUISE";
  if (lot.dateExpiration) {
    const exp = new Date(lot.dateExpiration);
    if (!Number.isNaN(exp.getTime()) && exp < new Date()) return "EXPIRE";
  }
  return lot.statut || "ACTIF";
}

/** Jours calendaires jusqu'à la DLC. Négatif = déjà passé. */
export function daysUntil(value, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86400000
  );
}

/**
 * ACTIF | EXPIRE | EPUISE | PROCHE.
 * PROCHE = encore actif, DLC dans les 30 jours.
 */
export function expiryBand(lot, now = new Date()) {
  const statut = computeStatut(lot);
  if (statut !== "ACTIF") return statut;
  const days = daysUntil(lot?.dateExpiration, now);
  if (days != null && days >= 0 && days <= 30) return "PROCHE";
  return "ACTIF";
}
