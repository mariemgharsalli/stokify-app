import { useState } from "react";
import TerrainScanner from "./TerrainScanner";
import { ajouterSerie } from "../lib/reception";
import { feedback } from "../lib/feedback";
import { fr } from "../strings/fr";

export default function SerialCapture({ max, value, onChange }) {
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [scanning, setScanning] = useState(false);
  const liste = value || [];

  function ajouter(raw) {
    const resultat = ajouterSerie(liste, raw, max);
    if (!resultat.ok) {
      setNotice(resultat.reason === "doublon" ? fr.serialDuplicate : fr.serialPlaceholder);
      feedback.warn();
      return;
    }
    setNotice("");
    setDraft("");
    onChange(resultat.liste);
    feedback.success();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{fr.serialTitle}</p>
        <p className="text-sm font-semibold" style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
          {liste.length} / {max}
        </p>
      </div>
      <div className="flex gap-2">
        <input
          aria-label={fr.serialPlaceholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              ajouter(draft);
            }
          }}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-app-bg px-3 text-base text-text-main"
        />
        <button
          type="button"
          onClick={() => ajouter(draft)}
          className="inline-flex min-h-12 items-center rounded-xl border border-border px-3 text-sm font-semibold touch-manipulation"
        >
          {fr.scanSubmit}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setScanning(true)}
        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border text-sm font-semibold touch-manipulation"
      >
        {fr.scanOrder}
      </button>
      {notice ? <p className="text-sm" style={{ color: "var(--accent-warning)" }}>{notice}</p> : null}
      <ul className="flex flex-col gap-2">
        {liste.map((numero) => (
          <li key={numero} className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-app-bg px-3">
            <span className="truncate font-semibold">{numero}</span>
            <button
              type="button"
              onClick={() => onChange(liste.filter((item) => item !== numero))}
              className="inline-flex min-h-12 items-center text-sm font-semibold touch-manipulation"
            >
              {fr.remove}
            </button>
          </li>
        ))}
      </ul>
      {scanning ? (
        <TerrainScanner
          elevated
          continuous
          title={fr.serialTitle}
          onClose={() => setScanning(false)}
          onDetected={(code) => ajouter(code)}
        />
      ) : null}
    </div>
  );
}
