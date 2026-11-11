export function depotLines(stocks, depotId) {
  return (Array.isArray(stocks) ? stocks : []).filter((row) => {
    if (!row || typeof row !== "object") return false;
    if (row.actif === false) return false;
    if (String(row.statut || "ACTIF").toUpperCase() === "ARCHIVE") return false;
    if (depotId == null || depotId === "") return true;
    return Number(row.depotId) === Number(depotId);
  });
}

export function qtyOf(rows) {
  return (rows || []).reduce((sum, row) => sum + (Number(row?.quantite) || 0), 0);
}

export function reservedOf(rows) {
  return (rows || []).reduce((sum, row) => sum + (Number(row?.qteReservee) || 0), 0);
}

export function formatQty(value) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(number);
}

export function formatDay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** ok | low | out — le seuil article (seuil d'alerte, sinon stock min). */
export function levelFor(qty, article) {
  const onHand = Number(qty) || 0;
  if (onHand <= 0) return "out";
  const seuil = Number(article?.seuilAlerte ?? article?.stockMin);
  if (Number.isFinite(seuil) && seuil > 0 && onHand <= seuil) return "low";
  return "ok";
}

export function initials(label) {
  const parts = String(label || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "·";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
