import { Mail, Phone } from "lucide-react";
import { formatDate, num3 } from "../../utils/commerceUi";
import { hashColorForm, initialsForm } from "../../utils/formHelpers";
import { btnSecondary } from "./formStyles";

export default function MiniCarteClient({ client, stats, onChange }) {
  if (!client) return null;
  const color = hashColorForm(client.nom);
  const fidele = stats?.nbVentes != null && stats.nbVentes > 5;

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
          {initialsForm(client.nom)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--text-primary)]">{client.nom}</span>
            <span className="rounded-full bg-[#1D9E75]/15 px-2 py-0.5 text-[10px] font-medium text-[#1D9E75]">
              ✓ Sélectionné
            </span>
            {fidele ? (
              <span className="rounded-full bg-[#378ADD]/15 px-2 py-0.5 text-[10px] font-medium text-[#378ADD]">
                Client fidèle
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            {client.telephone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {client.telephone}
              </span>
            ) : null}
            {client.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {client.email}
              </span>
            ) : null}
          </p>
          {stats ? (
            <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
              CA total : {stats.caTotal != null ? num3(stats.caTotal) : "—"}
              {stats.derniereVente ? ` · Dernière vente : ${formatDate(stats.derniereVente)}` : ""}
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
