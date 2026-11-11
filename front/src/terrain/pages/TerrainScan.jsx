import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getAxiosErrorMessage } from "../../services/api";
import { useTerrainStore } from "../store/terrainStore";
import { feedback } from "../lib/feedback";
import { resolveScan } from "../lib/resolveScan";
import { useTerrainSessionKey } from "../lib/useTerrainSessionKey";
import TerrainScanner from "../components/TerrainScanner";
import TerrainScanResult from "../components/TerrainScanResult";
import ErrorShake from "../motion/ErrorShake";
import { fr } from "../strings/fr";

function scanLabel(resolved) {
  const data = resolved?.data || {};
  if (resolved?.kind === "stock-line") return data.article?.libelle || data.article?.code || "";
  if (resolved?.kind === "lot") return data.numero || data.article?.libelle || "";
  if (resolved?.kind === "emplacement") return data.code || data.libelle || "";
  if (resolved?.kind === "article") return data.libelle || data.code || "";
  return "";
}

function formatHour(at) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(at));
  } catch {
    return "";
  }
}

export default function TerrainScan() {
  const navigate = useNavigate();
  const location = useLocation();
  const preset = useRef(location.state?.code);
  const queryClient = useQueryClient();
  const sessionKey = useTerrainSessionKey();
  const depotId = useTerrainStore((s) => s.depotId);
  const recentScans = useTerrainStore((s) => s.recentScans);
  const pushScan = useTerrainStore((s) => s.pushScan);
  const [phase, setPhase] = useState("scan");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [session, setSession] = useState(0);
  const [history, setHistory] = useState(false);

  async function onDetected(code) {
    const value = String(code || "").trim();
    setPending(value);
    setHistory(false);
    setPhase("resolving");
    setError("");
    try {
      const resolved = await resolveScan(value, { depotId, queryClient, sessionKey });
      pushScan({ code: value, kind: resolved.kind, label: scanLabel(resolved) });
      setResult(resolved);
      if (resolved.kind === "unknown") feedback.warn();
      setPhase("result");
    } catch (err) {
      feedback.error();
      setError(getAxiosErrorMessage(err));
      setResult(null);
      setPhase("error");
    }
  }

  useEffect(() => {
    const code = String(preset.current || "").trim();
    if (!code) return;
    preset.current = "";
    onDetected(code);
  }, []);

  function rescan() {
    setResult(null);
    setError("");
    setPending("");
    setSession((value) => value + 1);
    setPhase("scan");
  }

  if (history) {
    return (
      <div className="flex flex-col gap-3 px-4 pb-6 pt-4 text-text-main">
        <h1 className="text-xl font-semibold">{fr.recentScans}</h1>
        {recentScans.length === 0 ? <p className="text-base text-text-sub">{fr.recentEmpty}</p> : null}
        <ul className="flex flex-col gap-2">
          {recentScans.map((row) => (
            <li key={`${row.kind}-${row.code}-${row.at}`}>
              <button
                type="button"
                onClick={() => onDetected(row.code)}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card-bg px-3 text-start touch-manipulation"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{row.label || row.code}</span>
                  <span className="block truncate text-sm text-text-sub">{row.code}</span>
                </span>
                <span className="shrink-0 text-sm text-text-sub">{formatHour(row.at)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setHistory(false)}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent-500 px-4 text-base font-semibold text-white touch-manipulation"
        >
          {fr.scanTitle}
        </button>
      </div>
    );
  }

  return (
    <>
      {phase === "scan" ? (
        <TerrainScanner
          key={session}
          title={fr.scanTitle}
          hint={fr.scanHint}
          onClose={() => navigate("/terrain")}
          onHistory={() => setHistory(true)}
          onDetected={onDetected}
        />
      ) : null}

      {phase === "resolving" ? (
        <article className="mx-4 mt-4 rounded-3xl border border-border bg-card-bg p-5" role="status">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-sub">{fr.scanResolving}</p>
          <p className="mt-2 break-all text-2xl font-semibold">{pending || "—"}</p>
        </article>
      ) : null}

      {phase === "error" ? (
        <ErrorShake active>
          <div className="mx-4 mt-4 flex flex-col gap-3 rounded-3xl border border-border bg-card-bg p-4" role="alert">
            <p className="text-base">{error}</p>
            <button
              type="button"
              onClick={rescan}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent-500 px-4 text-base font-semibold text-white touch-manipulation"
            >
              {fr.rescan}
            </button>
          </div>
        </ErrorShake>
      ) : null}

      <TerrainScanResult
        open={phase === "result" && Boolean(result)}
        kind={result?.kind}
        data={result?.data}
        raw={result?.parsed?.value || pending}
        depotId={depotId}
        onClose={rescan}
      />
    </>
  );
}
