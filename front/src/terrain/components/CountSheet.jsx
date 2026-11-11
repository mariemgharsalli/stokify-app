import { useState } from "react";
import TerrainSheet from "./TerrainSheet";
import { quantiteComptage, uniteEntiere } from "../lib/inventory";
import { fr } from "../strings/fr";

function texte(modele, valeurs) {
  return Object.entries(valeurs).reduce((label, [cle, valeur]) => label.replace(`{${cle}}`, String(valeur)), modele);
}

export default function CountSheet({ ligne, onSave, onClose, pending = false }) {
  const entier = uniteEntiere(ligne?.article?.unite);
  const [valeur, setValeur] = useState("");
  const [zero, setZero] = useState(false);
  const [remplacer, setRemplacer] = useState(ligne?.qteReelle != null && !ligne?.recomptageDemande);
  const saisie = quantiteComptage(valeur, entier);

  function confirmer(event) {
    event?.preventDefault?.();
    if (!saisie.ok || pending) return;
    if (saisie.zero && !zero) {
      setZero(true);
      return;
    }
    onSave(saisie.quantite);
  }

  return (
    <TerrainSheet title={ligne?.article?.libelle || ligne?.article?.code || fr.inventorySave} onClose={onClose}>
      {remplacer ? (
        <div className="flex flex-col gap-3">
          <p>{texte(fr.inventoryReplace, { n: ligne.qteReelle })}</p>
          <button type="button" onClick={() => setRemplacer(false)} className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation" style={{ background: "var(--accent-primary)" }}>
            {fr.inventoryReplaceYes}
          </button>
        </div>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={confirmer}>
          <p className="text-sm text-text-sub">{ligne?.article?.code}{ligne?.lot?.numero ? ` · ${ligne.lot.numero}` : ""} · {ligne?.article?.unite || ""}</p>
          <input
            inputMode={entier ? "numeric" : "decimal"}
            aria-label={fr.transferQty}
            value={valeur}
            onChange={(event) => { setValeur(event.target.value); setZero(false); }}
            className="min-h-12 rounded-2xl border border-border bg-app-bg px-3 text-center text-2xl text-text-main"
          />
          {zero ? <p>{fr.inventoryZero}</p> : null}
          <button type="submit" disabled={!saisie.ok || pending} className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation disabled:opacity-50" style={{ background: "var(--accent-primary)" }}>
            {pending ? fr.sending : zero ? fr.inventoryZero : fr.inventorySave}
          </button>
        </form>
      )}
    </TerrainSheet>
  );
}
