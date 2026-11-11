import { useState } from "react";
import TerrainSheet from "./TerrainSheet";
import { AnomalyForm } from "./PickScanSheet";
import { resteAllocation } from "../lib/picking";
import { fr } from "../strings/fr";

export default function PickQuantitySheet({ entry, etat, onConfirm, onSignaler, onClose }) {
  const reste = resteAllocation(entry, etat);
  const [valeur, setValeur] = useState(String(reste));
  const [bloque, setBloque] = useState(false);

  function changer(suivant) {
    const n = Number(suivant);
    if (!Number.isFinite(n)) {
      setValeur(String(suivant));
      return;
    }
    const borne = Math.min(reste, Math.max(0, n));
    setValeur(String(Math.round(borne * 1000) / 1000));
  }

  return (
    <TerrainSheet title={entry?.lotNumero || fr.pickLotQty} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const resultat = onConfirm(valeur);
          if (resultat === false) setBloque(true);
        }}
      >
        <p className="text-sm text-text-sub">{fr.pickLotQty}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => changer(Number(valeur) - 1)} className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-2xl border border-border text-xl touch-manipulation" aria-label={fr.qtyDecrease}>−</button>
          <input
            inputMode="decimal"
            aria-label={fr.pickLotQty}
            value={valeur}
            onChange={(event) => setValeur(event.target.value)}
            className="min-h-12 min-w-0 flex-1 rounded-2xl border border-border bg-app-bg px-3 text-center text-2xl text-text-main"
          />
          <button type="button" onClick={() => changer(Number(valeur) + 1)} className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-2xl border border-border text-xl touch-manipulation" aria-label={fr.qtyIncrease}>+</button>
        </div>
        <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation" style={{ background: "var(--accent-primary)" }}>
          {fr.pickVerify}
        </button>
      </form>
      {bloque ? <AnomalyForm onSubmit={onSignaler} /> : null}
    </TerrainSheet>
  );
}
