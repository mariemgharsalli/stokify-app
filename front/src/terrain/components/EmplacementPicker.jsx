import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api, { getAxiosErrorMessage } from "../../services/api";
import { useTerrainSessionKey } from "../lib/useTerrainSessionKey";
import { resoudreEmplacement } from "../lib/reception";
import { feedback } from "../lib/feedback";
import TerrainScanner from "./TerrainScanner";
import { fr } from "../strings/fr";

export default function EmplacementPicker({ depotId, articleId, value, onChange }) {
  const sessionKey = useTerrainSessionKey();
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [scanning, setScanning] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [suggestError, setSuggestError] = useState("");

  const query = useQuery({
    queryKey: ["terrain", sessionKey, "reception", "emplacements", depotId ?? null],
    enabled: Boolean(sessionKey) && depotId != null,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await api.get("emplacements", { params: { depotId, statut: "ACTIF" } });
      return Array.isArray(data) ? data : [];
    },
  });

  function appliquer(raw) {
    const resultat = resoudreEmplacement(query.data || [], raw, depotId);
    if (!resultat.ok) {
      setNotice(resultat.reason === "autre" ? fr.placeOtherDepot : fr.placeUnknown);
      onChange(null);
      feedback.warn();
      return;
    }
    setNotice("");
    setCode(resultat.emplacement.code || "");
    onChange({ id: resultat.emplacement.id, code: resultat.emplacement.code || "" });
    feedback.success();
  }

  async function suggerer() {
    if (suggesting || articleId == null || depotId == null) return;
    setSuggesting(true);
    setSuggestError("");
    try {
      const { data } = await api.get("stock/emplacement-suggestions", {
        params: { articleId, depotId },
      });
      setSuggestions((data?.suggestions || []).slice(0, 3));
    } catch (error) {
      setSuggestions([]);
      setSuggestError(error?.response?.status === 429 ? fr.suggestLimited : getAxiosErrorMessage(error));
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="rangement" className="text-sm font-semibold">{fr.placeLabel}</label>
        <button
          type="button"
          onClick={suggerer}
          disabled={suggesting}
          className="inline-flex min-h-12 items-center rounded-xl border border-border px-3 text-sm font-semibold touch-manipulation disabled:opacity-50"
        >
          {suggesting ? fr.suggesting : fr.suggest}
        </button>
      </div>
      <div className="flex gap-2">
        <input
          id="rangement"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-app-bg px-3 text-base text-text-main"
        />
        <button
          type="button"
          onClick={() => appliquer(code)}
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
        {fr.placeScan}
      </button>
      {value?.code ? <p className="text-sm text-text-sub">{value.code}</p> : null}
      {notice ? <p className="text-sm" style={{ color: "var(--accent-danger)" }}>{notice}</p> : null}
      {query.isError ? <p className="text-sm" style={{ color: "var(--accent-danger)" }}>{getAxiosErrorMessage(query.error)}</p> : null}
      {suggestError ? <p className="text-sm" style={{ color: "var(--accent-danger)" }}>{suggestError}</p> : null}
      {suggestions && suggestions.length === 0 && !suggestError ? <p className="text-sm text-text-sub">{fr.suggestEmpty}</p> : null}
      {suggestions && suggestions.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {suggestions.map((item) => (
            <li key={item.emplacementId}>
              <button
                type="button"
                onClick={() => {
                  setNotice("");
                  setCode(item.code || "");
                  onChange({ id: item.emplacementId, code: item.code || "" });
                }}
                className="flex min-h-12 w-full flex-col items-start justify-center rounded-xl bg-app-bg px-3 text-start touch-manipulation"
              >
                <span className="font-semibold">{item.code || item.libelle}</span>
                <span className="text-sm text-text-sub">{(item.reasons || []).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {scanning ? (
        <TerrainScanner
          elevated
          title={fr.placeLabel}
          onClose={() => setScanning(false)}
          onDetected={(raw) => {
            setScanning(false);
            appliquer(raw);
          }}
        />
      ) : null}
    </div>
  );
}
