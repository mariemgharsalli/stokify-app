import { AlertTriangle, Check, Loader2 } from "lucide-react";

export default function StockIndicateur({ disponible, loading, quantite }) {
  const q = Number(quantite) || 0;

  if (loading) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Chargement…
      </span>
    );
  }

  if (disponible == null) return null;

  if (disponible === 0) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[#E24B4A]">
        <AlertTriangle className="h-3 w-3" />
        Rupture de stock
      </span>
    );
  }

  if (q > disponible) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[#E24B4A]">
        <AlertTriangle className="h-3 w-3" />
        Stock insuffisant (dispo : {disponible})
      </span>
    );
  }

  return (
    <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[#1D9E75]">
      <Check className="h-3 w-3" />
      Dispo : {disponible}
    </span>
  );
}
