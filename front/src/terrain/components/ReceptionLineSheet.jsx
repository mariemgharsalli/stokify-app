import { useEffect, useRef, useState } from "react";
import api, { getAxiosErrorMessage } from "../../services/api";
import { tracksLot, tracksSerie } from "../../utils/formHelpers";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { useRecevoirLigne } from "../lib/useReceptionMutations";
import {
  boundQuantite,
  buildReceptionBody,
  classeErreur,
  fefoSansDate,
  messageBackend,
  resteLigne,
  traceOf,
} from "../lib/reception";
import { feedback } from "../lib/feedback";
import TerrainSheet from "./TerrainSheet";
import SerialCapture from "./SerialCapture";
import EmplacementPicker from "./EmplacementPicker";
import { fr } from "../strings/fr";

function texte(modele, valeurs) {
  return Object.entries(valeurs).reduce((label, [cle, valeur]) => label.replace(`{${cle}}`, String(valeur)), modele);
}

export default function ReceptionLineSheet({ ligne, achat, sessionDepotId, extra = 0, onClose, onApplied, onVerified }) {
  const reste = resteLigne(ligne);
  const trace = traceOf(ligne?.article);
  const entier = tracksSerie(trace.mode);
  const online = useOnlineStatus();
  const mutation = useRecevoirLigne();
  const guard = useRef(false);
  const [qty, setQty] = useState(() => String(boundQuantite(1, reste, { entier })));
  const [numeroLot, setNumeroLot] = useState("");
  const [dateExpiration, setDateExpiration] = useState("");
  const [series, setSeries] = useState([]);
  const [emplacement, setEmplacement] = useState(null);
  const [step, setStep] = useState("saisie");
  const [erreur, setErreur] = useState("");
  const [confirmeDepot, setConfirmeDepot] = useState(false);
  const depotDifferent = sessionDepotId != null && Number(achat?.depotId) !== Number(sessionDepotId);
  const depotLabel = achat?.depot?.libelle || achat?.depot?.code || "";

  useEffect(() => {
    setQty(String(boundQuantite(1, resteLigne(ligne), { entier: tracksSerie(traceOf(ligne?.article).mode) })));
    setNumeroLot("");
    setDateExpiration("");
    setSeries([]);
    setEmplacement(null);
    setStep("saisie");
    setErreur("");
    setConfirmeDepot(false);
  }, [ligne?.id]);

  const extraVu = useRef(extra);
  useEffect(() => {
    if (extraVu.current === extra) return;
    extraVu.current = extra;
    setQty((current) => String(boundQuantite((Number(current) || 0) + 1, reste, { entier })));
    setStep("saisie");
  }, [extra, reste, entier]);

  function changerQty(raw) {
    setQty(String(boundQuantite(raw, reste, { entier })));
    setErreur("");
  }

  function preparer() {
    const construit = buildReceptionBody({
      article: ligne.article,
      reste,
      quantiteRecue: qty,
      numeroLot,
      dateExpiration,
      numerosSerie: series,
      emplacementId: emplacement?.id,
    });
    if (!construit.ok) {
      setErreur(
        construit.reason === "lot"
          ? fr.lotNumber
          : construit.reason === "entier"
            ? fr.qtyReceived
            : construit.reason === "count" || construit.reason === "vide" || construit.reason === "doublon"
              ? fr.serialTitle
              : fr.qtyReceived
      );
      feedback.warn();
      return null;
    }
    return construit.body;
  }

  async function envoyer() {
    if (guard.current || mutation.isPending || !online) return;
    if (depotDifferent && !confirmeDepot) return;
    const body = preparer();
    if (!body) return;
    guard.current = true;
    setErreur("");
    try {
      const data = await mutation.mutateAsync({ achatId: achat.id, ligneId: ligne.id, body });
      let frais = data;
      try {
        frais = (await api.get(`achats/${achat.id}`)).data || data;
      } catch {
        frais = data;
      }
      feedback.success();
      onApplied?.({
        statut: data?.statut,
        achat: frais,
        faites: [{ id: ligne.id, quantiteRecue: body.quantiteRecue, article: ligne.article }],
      });
    } catch (error) {
      if (classeErreur(error) === "validation") {
        setErreur(messageBackend(error) || getAxiosErrorMessage(error));
        setStep("confirm");
      } else {
        setStep("verifier");
        setErreur(fr.verifyBeforeRetry);
        try {
          const { data } = await api.get(`achats/${achat.id}`);
          onVerified?.(data);
        } catch {
          /* l'état affiché reste celui déjà connu */
        }
      }
    } finally {
      guard.current = false;
    }
  }

  const quantite = Number(qty) || 0;
  const avertissement = trace.needsLot && fefoSansDate(ligne.article, dateExpiration);

  return (
    <TerrainSheet title={ligne?.article?.libelle || fr.openLine} onClose={onClose}>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-sub">{ligne?.article?.code}</p>
      <h2 className="text-xl font-semibold">{ligne?.article?.libelle}</h2>
      <p className="mt-1 text-sm text-text-sub">
        {fr.ordered} {ligne?.quantite} · {fr.received} {ligne?.quantiteRecue || 0} · {fr.remaining} {reste}
      </p>

      {step === "verifier" ? (
        <p className="mt-4 text-base font-semibold" style={{ color: "var(--accent-warning)" }}>{erreur}</p>
      ) : null}

      {step === "saisie" ? (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor="qte-recue" className="text-sm font-semibold">{fr.qtyReceived}</label>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-border text-xl touch-manipulation" onClick={() => changerQty(quantite - 1)}>-</button>
              <input
                id="qte-recue"
                inputMode="numeric"
                value={qty}
                onChange={(event) => changerQty(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-border bg-app-bg px-3 text-center text-2xl font-semibold text-text-main"
              />
              <button type="button" className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-border text-xl touch-manipulation" onClick={() => changerQty(quantite + 1)}>+</button>
            </div>
          </div>

          {trace.needsLot ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="numero-lot" className="text-sm font-semibold">{fr.lotNumber}</label>
              <input id="numero-lot" value={numeroLot} onChange={(event) => setNumeroLot(event.target.value)} className="min-h-12 rounded-xl border border-border bg-app-bg px-3 text-base text-text-main" />
              <label htmlFor="date-exp" className="text-sm font-semibold">{fr.expiry}</label>
              <input id="date-exp" type="date" value={dateExpiration} onChange={(event) => setDateExpiration(event.target.value)} className="min-h-12 rounded-xl border border-border bg-app-bg px-3 text-base text-text-main" />
              {avertissement ? <p className="text-sm" style={{ color: "var(--accent-warning)" }}>{fr.fefoWarning}</p> : null}
            </div>
          ) : null}
          {tracksLot(trace.mode) && trace.auto ? <p className="rounded-xl bg-app-bg px-3 py-3 text-sm">{fr.lotGenerated}</p> : null}
          {trace.needsSerie ? <SerialCapture max={Math.round(quantite) || 0} value={series} onChange={setSeries} /> : null}
          {tracksSerie(trace.mode) && trace.auto ? <p className="rounded-xl bg-app-bg px-3 py-3 text-sm">{fr.seriesGenerated}</p> : null}

          <EmplacementPicker
            depotId={achat?.depotId}
            articleId={ligne?.article?.id ?? ligne?.articleId}
            value={emplacement}
            onChange={setEmplacement}
          />
          {erreur ? <p className="text-sm" style={{ color: "var(--accent-danger)" }}>{erreur}</p> : null}
          <button
            type="button"
            onClick={() => {
              if (!preparer()) return;
              setStep("confirm");
            }}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation"
            style={{ background: "var(--accent-primary)" }}
          >
            {fr.validateLine}
          </button>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-base font-semibold">{ligne?.article?.libelle}</p>
          <p>{fr.qtyReceived} : {quantite}</p>
          {trace.needsLot ? <p>{fr.lotNumber} : {numeroLot}</p> : null}
          {tracksLot(trace.mode) && trace.auto ? <p>{fr.lotGenerated}</p> : null}
          {trace.needsSerie ? <p>{texte(fr.seriesCount, { n: series.length })}</p> : null}
          {tracksSerie(trace.mode) && trace.auto ? <p>{texte(fr.seriesGeneratedCount, { n: quantite })}</p> : null}
          <p>{emplacement?.code || fr.noPlaceChosen}</p>
          <p>{fr.destination} : {depotLabel}</p>
          {avertissement ? <p className="text-sm" style={{ color: "var(--accent-warning)" }}>{fr.fefoWarning}</p> : null}
          {depotDifferent ? (
            <label className="flex min-h-12 items-center gap-3 text-base">
              <input type="checkbox" checked={confirmeDepot} onChange={(event) => setConfirmeDepot(event.target.checked)} />
              <span>{texte(fr.depotConfirm, { depot: depotLabel })}</span>
            </label>
          ) : null}
          {erreur ? <p className="text-sm font-semibold" style={{ color: "var(--accent-danger)" }}>{erreur}</p> : null}
          {!online ? (
            <>
              <p className="text-sm font-semibold">{fr.offlineRequired}</p>
              <p className="text-sm">{fr.queueBlocked}</p>
            </>
          ) : null}
          <button
            type="button"
            disabled={!online || mutation.isPending || (depotDifferent && !confirmeDepot)}
            onClick={envoyer}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation disabled:opacity-50"
            style={{ background: "var(--accent-primary)" }}
          >
            {mutation.isPending ? fr.sending : fr.confirmReceipt}
          </button>
          <button type="button" onClick={() => setStep("saisie")} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border text-base font-semibold touch-manipulation">
            {fr.back}
          </button>
        </div>
      ) : null}
    </TerrainSheet>
  );
}
