import { FileText } from "lucide-react";
import { STATUTS_ACHAT, STATUTS_REGLEMENT, STATUTS_STOCK, STATUTS_VENTE } from "../../constants/statuts";

export default function WorkflowBar({ steps, activeStatut, counts = {}, onSelect, type = "achat" }) {
  const palette =
    type === "reglement"
      ? STATUTS_REGLEMENT
      : type === "stock"
        ? STATUTS_STOCK
        : type === "achat"
          ? STATUTS_ACHAT
          : STATUTS_VENTE;

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, idx) => {
          const config = palette[step.key] || palette.BROUILLON;
          const Icon = step.Icon || config.Icon || FileText;
          const count = counts[step.key] ?? 0;
          const isActive =
            activeStatut === step.key ||
            (step.match && step.match.includes(activeStatut)) ||
            (activeStatut === "RECEPTIONNE" && step.key === "CONFIRME");
          const isCancelled = step.key === "ANNULE";

          return (
            <div key={step.key} className="flex items-center gap-2">
              {idx > 0 ? (
                <span className="hidden sm:inline text-[var(--text-muted)]" aria-hidden>
                  →
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onSelect?.(isActive ? "" : step.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive ? "ring-2 ring-offset-1 ring-offset-[var(--bg-card)]" : "hover:opacity-90"
                } ${isCancelled ? "line-through opacity-80" : ""}`}
                style={{
                  background: isActive ? config.bg : "var(--bg-input)",
                  borderColor: isActive ? config.border : "var(--border-default)",
                  color: config.color,
                  ...(isActive ? { ringColor: config.color } : {}),
                }}
              >
                <Icon size={14} stroke={2} aria-hidden />
                <span>{step.label}</span>
                <span
                  className="min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                  style={{ background: `${config.color}22`, color: config.color }}
                >
                  {count}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
