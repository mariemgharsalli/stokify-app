/** Format monétaire espace client — dinar tunisien. */
export function formatMoneyTnd(n) {
  const value = Number(n) || 0;
  try {
    return new Intl.NumberFormat("fr-TN", {
      style: "currency",
      currency: "TND",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(value);
  } catch {
    return `${value.toFixed(3)} TND`;
  }
}
