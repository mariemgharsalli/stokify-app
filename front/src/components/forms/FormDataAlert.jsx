import { AlertCircle, Loader2 } from "lucide-react";
import { btnSecondary } from "./formStyles";

export function FormGateBanner({ gate }) {
  if (!gate?.blocked) return null;
  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      role="status"
    >
      {gate.reason === "hydrating" ? (
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{gate.message}</span>
    </div>
  );
}

export function FormLoadError({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className={btnSecondary} onClick={onRetry}>
          Réessayer
        </button>
      ) : null}
    </div>
  );
}

export function FormLoadingHint({ show, label = "Chargement des données…" }) {
  if (!show) return null;
  return (
    <p className="mb-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </p>
  );
}
