import { AlertTriangle } from "lucide-react";
import { formatDate } from "../../utils/commerceUi";

function fmtQty(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return x % 1 === 0 ? String(x) : x.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

export default function ProgressionReception({ achat, compact = false }) {
  const lignes = achat.lignes || [];
  const totalLignes = lignes.length;

  const qteCommandee = lignes.reduce((s, l) => s + Number(l.quantite || 0), 0);
  const qteRecue = lignes.reduce((s, l) => s + Number(l.quantiteRecue || 0), 0);
  const lignesCompletes = lignes.filter(
    (l) => Number(l.quantiteRecue || 0) + 1e-6 >= Number(l.quantite)
  ).length;

  const pctQty =
    qteCommandee > 0 ? Math.min(100, Math.round((qteRecue / qteCommandee) * 100)) : 0;

  const enRetard =
    achat.dateLivraisonPrevue &&
    achat.statut === "COMMANDE" &&
    new Date() > new Date(achat.dateLivraisonPrevue);

  const hasPartial = qteRecue > 0 && pctQty < 100;

  if (totalLignes === 0) return null;

  return (
    <div className="mt-3 border-t border-[var(--border-default)] pt-3">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
        <span>Progression réception</span>
        <span className="tabular-nums font-medium text-[var(--text-primary)]">
          {fmtQty(qteRecue)} / {fmtQty(qteCommandee)} unités
          {!compact && (
            <span className="ml-1.5 font-normal text-[var(--text-muted)]">
              ({lignesCompletes}/{totalLignes} lignes complètes)
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-default)]">
        <div
          className="progress-bar-fill h-full rounded-full transition-all duration-500"
          style={{
            width: `${pctQty}%`,
            background: pctQty === 100 ? "#1D9E75" : hasPartial ? "#378ADD" : "#888780",
          }}
        />
      </div>
      {!compact ? (
        <ul className="mt-2.5 space-y-1">
          {lignes.map((l) => {
            const cmd = Number(l.quantite || 0);
            const rec = Number(l.quantiteRecue || 0);
            const linePct = cmd > 0 ? Math.min(100, Math.round((rec / cmd) * 100)) : 0;
            const complete = rec + 1e-6 >= cmd;
            return (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]"
              >
                <span className="min-w-0 truncate">{l.article?.libelle || l.article?.code || "Article"}</span>
                <span
                  className="shrink-0 tabular-nums font-medium"
                  style={{ color: complete ? "#1D9E75" : rec > 0 ? "#378ADD" : "var(--text-muted)" }}
                >
                  {fmtQty(rec)} / {fmtQty(cmd)}
                  {rec > 0 && !complete ? ` (${linePct} %)` : null}
                  {complete ? " ✓" : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {enRetard ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#E24B4A]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Livraison prévue le {formatDate(achat.dateLivraisonPrevue)} — En retard
        </p>
      ) : null}
    </div>
  );
}
