/** Quantité max autorisée pour une ligne panier / commande client */
export const CLIENT_MAX_QTY = 999_999;

/**
 * Normalise une quantité (évite la concaténation string "1"+"1"="11"
 * après rehydratation localStorage / persist).
 */
export function normalizeQty(value, { min = 1, max = CLIENT_MAX_QTY, allowZero = false } = {}) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return allowZero ? 0 : min;
  if (allowZero && n <= 0) return 0;
  return Math.min(max, Math.max(min, n));
}
