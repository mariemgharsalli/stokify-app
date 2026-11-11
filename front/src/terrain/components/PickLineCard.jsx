import { pastilleExpiration, quantiteFaite } from "../lib/picking";
import { fillTemplate } from "../lib/dayProgress";
import CompletionBar from "../motion/CompletionBar";
import SwipeRow from "../motion/SwipeRow";
import { fr } from "../strings/fr";

function formatJour(date) {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const PASTILLE = {
  danger: "var(--accent-danger)",
  warning: "var(--accent-warning)",
  ok: "var(--accent-success)",
};

export default function PickLineCard({ ligne, progress, active, onOpen, verrouillee = false, bloquee = false }) {
  const etats = progress?.[ligne.id] || progress?.[String(ligne.id)] || {};
  const strategie = fr.strategyLabel[ligne.strategieAppliquee] || ligne.strategieAppliquee;

  return (
    <SwipeRow enabled={!verrouillee} actionLabel={fr.pickVerify} onAction={onOpen}>
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card-bg p-3" style={active ? { borderColor: "var(--accent-primary)" } : undefined}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{ligne.article?.libelle || ligne.article?.code}</h2>
          <p className="text-sm text-text-sub">{ligne.article?.code}</p>
        </div>
        {bloquee ? (
          <span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold" style={{ color: "var(--accent-danger)" }}>{fr.pickBlockedLine}</span>
        ) : null}
        {ligne.article?.fragile ? (
          <span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold" style={{ color: "var(--accent-warning)" }}>{fr.pickFragile}</span>
        ) : null}
      </header>
      <p className="text-sm">
        {ligne.quantite} {ligne.article?.unite || ""}
        {strategie ? <span className="text-text-sub"> · {fr.pickStrategy} {strategie}</span> : null}
      </p>
      {ligne.article?.poids > 0 || ligne.article?.volume > 0 ? (
        <p className="text-sm text-text-sub">
          {ligne.article.poids > 0 ? `${ligne.article.poids} kg` : ""}
          {ligne.article.poids > 0 && ligne.article.volume > 0 ? " · " : ""}
          {ligne.article.volume > 0 ? `${ligne.article.volume} m³` : ""}
        </p>
      ) : null}
      {ligne.allocationAbsente ? <p className="text-sm" style={{ color: "var(--accent-warning)" }}>{fr.pickNoAllocation}</p> : null}
      <ul className="flex flex-col gap-2">
        {ligne.entries.map((entry) => {
          const faite = quantiteFaite(entry, etats[entry.id]);
          const ton = pastilleExpiration(entry.dateExpiration);
          return (
            <li key={entry.id} className="rounded-xl bg-app-bg px-3 py-2 text-sm">
              <span className="font-semibold">
                {entry.kind === "quantite" ? fr.pickQuantity : entry.lotNumero || entry.numero}
              </span>
              <span className="terrain-mono ms-2">{faite} / {entry.quantite}</span>
              <CompletionBar ratio={Number(entry.quantite) > 0 ? faite / Number(entry.quantite) : 0} label={fillTemplate(fr.meterOf, { done: faite, total: entry.quantite })} />
              {entry.dateExpiration ? (
                <span className="ms-2 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: PASTILLE[ton] || "var(--text-secondary)" }}>
                  {formatJour(entry.dateExpiration)}
                </span>
              ) : null}
              {entry.numerosSerie?.length ? (
                <span className="mt-1 block text-text-sub">{entry.numerosSerie.join(", ")}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {verrouillee ? null : (
        <button type="button" onClick={onOpen} className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation" style={{ background: "var(--accent-primary)" }}>
          {fr.pickVerify}
        </button>
      )}
    </article>
    </SwipeRow>
  );
}
