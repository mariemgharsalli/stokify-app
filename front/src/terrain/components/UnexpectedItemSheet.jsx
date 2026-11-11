import { useState } from "react";
import TerrainSheet from "./TerrainSheet";
import TerrainScanner from "./TerrainScanner";
import { resolveScan } from "../lib/resolveScan";
import { quantiteComptage, uniteEntiere } from "../lib/inventory";
import { resolveModeTracage, tracksLot } from "../../utils/formHelpers";
import { fr } from "../strings/fr";

export default function UnexpectedItemSheet({ depotId, onSave, onClose, pending = false }) {
  const [article, setArticle] = useState(null);
  const [lot, setLot] = useState(null);
  const [valeur, setValeur] = useState("");
  const [zero, setZero] = useState(false);
  const [scanner, setScanner] = useState(true);
  const [erreur, setErreur] = useState("");
  const entier = uniteEntiere(article?.unite);
  const saisie = quantiteComptage(valeur, entier);
  const lotRequis = tracksLot(resolveModeTracage(article)) && !lot;

  async function lire(raw) {
    setErreur("");
    const resolu = await resolveScan(raw, { depotId });
    if (resolu.kind === "lot") {
      const art = resolu.data?.article;
      if (!article && art?.id) setArticle({ id: art.id, code: art.code || "", libelle: art.libelle || "", unite: art.unite || "", modeTracage: art.modeTracage || "LOT" });
      setLot({ id: resolu.data.id, numero: resolu.data.numero || "" });
      setScanner(false);
      return;
    }
    if (resolu.kind === "article") {
      setArticle(resolu.data);
      setScanner(false);
      return;
    }
    setErreur(fr.scanUnknown);
  }

  function confirmer(event) {
    event.preventDefault();
    if (!article?.id || !saisie.ok || pending || lotRequis) return;
    if (saisie.zero && !zero) {
      setZero(true);
      return;
    }
    onSave({ article, lot, quantite: saisie.quantite });
  }

  return (
    <TerrainSheet title={fr.inventoryUnexpected} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={confirmer}>
        <p>{article ? `${article.libelle || article.code}${lot?.numero ? ` · ${lot.numero}` : ""}` : fr.scanNow}</p>
        {lotRequis ? <p className="text-sm text-text-sub">{fr.pickLotQty}</p> : null}
        <button type="button" onClick={() => setScanner(true)} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border text-base font-semibold touch-manipulation">
          {fr.scanNow}
        </button>
        <input
          inputMode={entier ? "numeric" : "decimal"}
          aria-label={fr.transferQty}
          value={valeur}
          onChange={(event) => { setValeur(event.target.value); setZero(false); }}
          className="min-h-12 rounded-2xl border border-border bg-app-bg px-3 text-center text-2xl text-text-main"
        />
        {erreur ? <p role="alert">{erreur}</p> : null}
        {zero ? <p>{fr.inventoryZero}</p> : null}
        <button type="submit" disabled={!article?.id || !saisie.ok || pending || lotRequis} className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation disabled:opacity-50" style={{ background: "var(--accent-primary)" }}>
          {pending ? fr.sending : fr.inventorySave}
        </button>
      </form>
      {scanner ? <TerrainScanner elevated title={fr.inventoryUnexpected} onClose={() => setScanner(false)} onDetected={lire} /> : null}
    </TerrainSheet>
  );
}
