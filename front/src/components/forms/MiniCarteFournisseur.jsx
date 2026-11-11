import { MapPin, Phone } from "lucide-react";
import { formatDate, num3 } from "../../utils/commerceUi";
import { hashColorForm, initialsForm } from "../../utils/formHelpers";
import { btnSecondary } from "./formStyles";

export default function MiniCarteFournisseur({ fournisseur, stats, onChange }) {
  if (!fournisseur) return null;
  const color = hashColorForm(fournisseur.nom);

  return (
    <div
      className="rounded-xl border border-[var(--border-default)] p-4"
      style={{ background: "var(--bg-card)", borderLeft: "3px solid #7c3aed" }}
    >
      <div className="flex gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ background: color }}
        >
          {initialsForm(fournisseur.nom)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--text-primary)]">{fournisseur.nom}</span>
            <span className="rounded-full bg-[#1D9E75]/15 px-2 py-0.5 text-[10px] font-medium text-[#1D9E75]">
              ✓ Sélectionné
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            {fournisseur.telephone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {fournisseur.telephone}
              </span>
            ) : null}
            {fournisseur.ville || fournisseur.adresse ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {fournisseur.ville || fournisseur.adresse}
              </span>
            ) : null}
          </p>
          {stats ? (
            <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
              Dernier achat : {stats.dernierAchat ? formatDate(stats.dernierAchat) : "—"}
              {stats.totalAchats != null ? ` · Total achats : ${num3(stats.totalAchats)}` : ""}
            </p>
          ) : null}
        </div>
        {onChange ? (
          <button type="button" onClick={onChange} className={`${btnSecondary} !px-2 !py-1 text-[11px]`}>
            Changer
          </button>
        ) : null}
      </div>
    </div>
  );
}
