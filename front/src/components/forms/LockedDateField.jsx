import { Calendar, Lock } from "lucide-react";
import { formatDate } from "../../utils/commerceUi";
import { labelClass } from "./formStyles";

/**
 * Date figée (vente / commande) — affichage uniquement, non modifiable.
 */
export default function LockedDateField({
  label = "Date",
  value,
  hint = "Date du jour — non modifiable",
  accent = "vente",
}) {
  const isAchat = accent === "achat";
  const accentColor = isAchat ? "#1D9E75" : "#7c3aed";
  const accentSoft = isAchat ? "rgba(29,158,117,0.1)" : "rgba(124,58,237,0.1)";
  const borderColor = isAchat ? "rgba(29,158,117,0.28)" : "rgba(124,58,237,0.28)";

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div
        className="commerce-locked-date group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3.5 py-2.5"
        data-accent={isAchat ? "achat" : "vente"}
        style={{
          borderColor,
          background: `linear-gradient(135deg, ${accentSoft}, transparent 70%)`,
        }}
        title={hint}
        aria-readonly="true"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: accentSoft, color: accentColor }}
        >
          <Calendar className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
            {formatDate(value)}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">{hint}</p>
        </div>
        <div
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: accentSoft, color: accentColor }}
        >
          <Lock className="h-3 w-3" />
          Fixée
        </div>
      </div>
    </div>
  );
}
