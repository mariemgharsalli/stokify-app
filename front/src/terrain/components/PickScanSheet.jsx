import { useState } from "react";
import TerrainScanner from "./TerrainScanner";
import TerrainSheet from "./TerrainSheet";
import { fr } from "../strings/fr";

export function AnomalyForm({ onSubmit }) {
  const [motif, setMotif] = useState("mauvais-lot");
  const [detail, setDetail] = useState("");
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(motif, detail.trim());
      }}
    >
      {Object.entries(fr.pickAnomalyMotif).map(([id, label]) => (
        <label key={id} className="flex min-h-12 items-center gap-2 text-base">
          <input type="radio" name="motif" value={id} checked={motif === id} onChange={() => setMotif(id)} />
          {label}
        </label>
      ))}
      <textarea
        aria-label={fr.pickAnomalyNote}
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        className="min-h-12 rounded-2xl border border-border bg-app-bg px-3 py-2 text-base text-text-main"
      />
      <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border text-base font-semibold touch-manipulation">
        {fr.pickReportSend}
      </button>
    </form>
  );
}

export default function PickScanSheet({ title, message, proposition, bloquant = false, onSignaler, onCode, onSwitch, onClose }) {
  const [saisie, setSaisie] = useState("");
  const [scanner, setScanner] = useState(false);
  const [anomalie, setAnomalie] = useState(false);

  function soumettre(event) {
    event?.preventDefault?.();
    const code = saisie.trim();
    if (!code) return;
    onCode(code);
    setSaisie("");
  }

  return (
    <>
      <TerrainSheet title={title} onClose={onClose}>
        <form onSubmit={soumettre} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm">
            {fr.pickManual}
            <input
              value={saisie}
              onChange={(event) => setSaisie(event.target.value)}
              className="min-h-12 rounded-2xl border border-border bg-app-bg px-3 text-base text-text-main"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border text-base font-semibold touch-manipulation">
            {fr.scanSubmit}
          </button>
          <button type="button" onClick={() => setScanner(true)} className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation" style={{ background: "var(--accent-primary)" }}>
            {fr.pickOpenScanner}
          </button>
          {message ? <p role="alert" className="text-sm">{message}</p> : null}
          {bloquant ? (
            <button type="button" onClick={() => setAnomalie(true)} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border text-base font-semibold touch-manipulation">
              {fr.pickReport}
            </button>
          ) : null}
          {proposition ? (
            <button type="button" onClick={() => onSwitch(proposition.ligneId)} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border text-base font-semibold touch-manipulation">
              {fr.pickSwitch}{proposition.libelle ? ` · ${proposition.libelle}` : ""}
            </button>
          ) : null}
        </form>
        {anomalie ? <AnomalyForm onSubmit={onSignaler} /> : null}
      </TerrainSheet>
      {scanner ? (
        <TerrainScanner
          elevated
          continuous
          title={title}
          onClose={() => setScanner(false)}
          onDetected={(code) => onCode(code)}
        />
      ) : null}
    </>
  );
}
