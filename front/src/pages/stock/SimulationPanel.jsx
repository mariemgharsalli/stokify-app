import { useEffect, useState } from "react";
import { getLineStockMin } from "../../hooks/useStockGroupes";

const STATUS_CONFIG = {
  idle: { color: "var(--border-default)", bg: "transparent", text: null },
  ok: { color: "#1D9E75", bg: "rgba(29,158,117,0.06)", text: "OK" },
  critique: { color: "#BA7517", bg: "rgba(186,117,23,0.06)", text: "Critique" },
  rupture: { color: "#E24B4A", bg: "rgba(226,75,74,0.06)", text: "Rupture !" },
};

function getLineKey(s) {
  return s.articleId ?? s.article?.id;
}

function getRowStatus(current, sellVal, seuil) {
  if (sellVal === 0) return "idle";
  const after = current - sellVal;
  if (after <= 0) return "rupture";
  if (after <= seuil) return "critique";
  return "ok";
}

export default function SimulationPanel({ open, onClose, stocks }) {
  const [simQty, setSimQty] = useState({});
  const [simResult, setSimResult] = useState(null);

  function runSimulation() {
    const results = stocks.map((s) => {
      const aid = getLineKey(s);
      const sellQty = Number(simQty[aid] || 0);
      const current = Number(s.quantite);
      const after = current - sellQty;
      const seuil = getLineStockMin(s) ?? 0;
      return {
        ...s,
        sellQty,
        after,
        status: after <= 0 ? "RUPTURE" : after <= seuil ? "CRITIQUE" : "OK",
        changed: sellQty > 0,
      };
    });
    setSimResult(results);
  }

  function resetSim() {
    setSimQty({});
    setSimResult(null);
  }

  useEffect(() => {
    if (!open) return;
    const hasAny = Object.values(simQty).some((v) => Number(v) > 0);
    if (hasAny) runSimulation();
    else setSimResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simQty, stocks, open]);

  if (!open) return null;

  const positiveStocks = stocks.filter((s) => Number(s.quantite) > 0);

  const touched = positiveStocks.filter((s) => Number(simQty[getLineKey(s)] || 0) > 0);

  const liveSummary = touched.map((s) => {
    const current = Number(s.quantite);
    const sell = Number(simQty[getLineKey(s)] || 0);
    const after = current - sell;
    const seuil = getLineStockMin(s) ?? 0;
    return {
      status: after <= 0 ? "rupture" : after <= seuil ? "critique" : "ok",
    };
  });

  const okCount = liveSummary.filter((r) => r.status === "ok").length;
  const critiqueCount = liveSummary.filter((r) => r.status === "critique").length;
  const ruptureCount = liveSummary.filter((r) => r.status === "rupture").length;

  const hasSimInput = Object.values(simQty).some((v) => v !== "" && Number(v) > 0);

  function updateQty(aid, rawValue, max) {
    const next = rawValue === "" ? "" : Math.min(max, Math.max(0, Number(rawValue) || 0));
    setSimQty((q) => ({ ...q, [aid]: next }));
  }

  function bumpQty(aid, delta, max) {
    setSimQty((q) => {
      const current = Number(q[aid] || 0);
      const next = Math.min(max, Math.max(0, current + delta));
      return { ...q, [aid]: next === 0 ? "" : next };
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
        style={{ animation: "fadeIn 0.2s ease" }}
      />

      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l shadow-2xl"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-default)",
          animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div className="shrink-0 border-b p-5" style={{ borderColor: "var(--border-default)" }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "rgba(127,119,221,0.15)" }}
              >
                <i className="ti ti-flask" style={{ color: "#7F77DD", fontSize: 20 }} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Simulation de vente</h2>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Testez l&apos;impact sur votre stock avant de vendre
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-muted)" }}
              aria-label="Fermer"
            >
              <i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden="true" />
            </button>
          </div>

          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{
              background: "rgba(127,119,221,0.06)",
              borderColor: "rgba(127,119,221,0.2)",
            }}
          >
            <i className="ti ti-info-circle shrink-0 text-xs" style={{ color: "#7F77DD" }} aria-hidden="true" />
            <p className="text-[10px] text-[var(--text-secondary)]">
              Entrez les quantités à vendre par article. Le résultat s&apos;affiche en temps réel.
            </p>
          </div>
        </div>

        {/* Scrollable article list */}
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Quantités à vendre
          </p>

          {positiveStocks.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <i className="ti ti-package mb-2 text-3xl" style={{ color: "var(--text-muted)" }} aria-hidden="true" />
              <p className="text-xs text-[var(--text-secondary)]">Aucun stock disponible à simuler</p>
            </div>
          ) : (
            positiveStocks.map((s, i) => {
              const aid = getLineKey(s);
              const current = Number(s.quantite);
              const sellVal = Number(simQty[aid] || 0);
              const after = current - sellVal;
              const seuil = getLineStockMin(s) ?? 0;
              const status = getRowStatus(current, sellVal, seuil);
              const sc = STATUS_CONFIG[status];

              return (
                <div
                  key={`${aid}-${s.depotId}-${s.emplacementId ?? s.id}`}
                  className="rounded-xl border p-3"
                  style={{
                    animation: `fadeUp 0.25s ease ${i * 30}ms both`,
                    borderColor: sc.color,
                    background: sc.bg,
                    transition: "border-color 0.2s ease, background 0.2s ease",
                  }}
                >
                  <div className="flex items-center gap-3">
                    {s.article?.imageUrl ? (
                      <img
                        src={s.article.imageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: "var(--bg-input)" }}
                      >
                        <i
                          className="ti ti-package"
                          style={{ color: "var(--text-muted)", fontSize: 16 }}
                          aria-hidden="true"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                          {s.article?.libelle || s.article?.code}
                        </p>
                        {status !== "idle" && (
                          <span
                            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                            style={{
                              background: `${sc.color}20`,
                              color: sc.color,
                              animation: status === "rupture" ? "pulse 1s infinite" : "none",
                            }}
                          >
                            {sc.text}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="text-[var(--text-secondary)]">
                          Stock:{" "}
                          <strong className="text-[var(--text-primary)]">
                            {current.toLocaleString("fr-FR")}
                          </strong>
                        </span>
                        {sellVal > 0 && (
                          <>
                            <i
                              className="ti ti-arrow-right"
                              style={{ color: "var(--text-muted)", fontSize: 10 }}
                              aria-hidden="true"
                            />
                            <strong style={{ color: sc.color }}>{after.toLocaleString("fr-FR")} UN</strong>
                          </>
                        )}
                        <span className="text-[var(--text-muted)]">
                          · {s.depot?.code || s.depot?.libelle || "—"}
                          {s.emplacement?.code && ` · ${s.emplacement.code}`}
                        </span>
                      </div>

                      {current > 0 && (
                        <div
                          className="mt-1.5 h-1 overflow-hidden rounded-full"
                          style={{ background: "var(--bg-input)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(0, (after / current) * 100)}%`,
                              background:
                                sc.color === "var(--border-default)" ? "#378ADD" : sc.color,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => bumpQty(aid, -1, current)}
                        className="sim-qty-btn flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold transition-all"
                        style={{
                          background: "var(--bg-input)",
                          color: "var(--text-secondary)",
                        }}
                        aria-label="Diminuer"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={current}
                        value={simQty[aid] ?? ""}
                        onChange={(e) => updateQty(aid, e.target.value, current)}
                        placeholder="0"
                        className="sim-qty-input w-14 rounded-lg border px-2 py-1.5 text-center text-sm font-semibold outline-none transition-all"
                        style={{
                          background: "var(--bg-input)",
                          borderColor:
                            sc.color === "var(--border-default)" ? "var(--border-default)" : sc.color,
                          color:
                            sc.color === "var(--border-default)" ? "var(--text-primary)" : sc.color,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => bumpQty(aid, 1, current)}
                        className="sim-qty-btn sim-qty-btn-plus flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold transition-all"
                        style={{
                          background: "var(--bg-input)",
                          color: "var(--text-secondary)",
                        }}
                        aria-label="Augmenter"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky bottom results — live */}
        <div className="shrink-0 border-t p-4" style={{ borderColor: "var(--border-default)" }}>
          {touched.length === 0 ? (
            <p className="mb-3 text-center text-[11px] text-[var(--text-muted)]">
              Entrez des quantités ci-dessus pour voir l&apos;impact
            </p>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {[
                  {
                    label: "OK",
                    count: okCount,
                    color: "#1D9E75",
                    bg: "rgba(29,158,117,0.1)",
                    icon: "ti-circle-check",
                  },
                  {
                    label: "Critique",
                    count: critiqueCount,
                    color: "#BA7517",
                    bg: "rgba(186,117,23,0.1)",
                    icon: "ti-alert-triangle",
                  },
                  {
                    label: "Rupture",
                    count: ruptureCount,
                    color: "#E24B4A",
                    bg: "rgba(226,75,74,0.1)",
                    icon: "ti-circle-x",
                    pulse: ruptureCount > 0,
                  },
                ].map((r) => (
                  <div
                    key={r.label}
                    className="flex flex-col items-center rounded-xl border py-2.5"
                    style={{
                      borderColor: `${r.color}30`,
                      background: r.bg,
                      animation: "fadeUp 0.2s ease both",
                    }}
                  >
                    <i
                      className={`ti ${r.icon} mb-1`}
                      style={{
                        color: r.color,
                        fontSize: 16,
                        animation: r.pulse ? "pulse 1s infinite" : "none",
                      }}
                      aria-hidden="true"
                    />
                    <span className="text-xl font-bold" style={{ color: r.color }}>
                      {r.count}
                    </span>
                    <span className="text-[10px]" style={{ color: r.color }}>
                      {r.label}
                    </span>
                  </div>
                ))}
              </div>

              {ruptureCount > 0 && (
                <div
                  className="mb-3 flex items-center gap-2 rounded-xl border px-3 py-2"
                  style={{
                    background: "rgba(226,75,74,0.06)",
                    borderColor: "rgba(226,75,74,0.25)",
                    animation: "fadeUp 0.2s ease",
                  }}
                >
                  <i
                    className="ti ti-alert-triangle shrink-0"
                    style={{ color: "#E24B4A", fontSize: 14 }}
                    aria-hidden="true"
                  />
                  <p className="text-[11px]" style={{ color: "#E24B4A" }}>
                    {ruptureCount} article{ruptureCount > 1 ? "s" : ""} en rupture après cette vente — pensez à
                    commander
                  </p>
                </div>
              )}

              {simResult &&
                simResult
                  .filter((r) => r.status !== "OK" && r.changed)
                  .slice(0, 4)
                  .map((r, idx) => (
                    <div
                      key={r.id}
                      className="mb-2 flex items-center justify-between rounded-xl border px-3 py-2"
                      style={{
                        animation: `fadeUp 0.2s ease ${idx * 30}ms both`,
                        borderColor: r.status === "RUPTURE" ? "rgba(226,75,74,0.3)" : "rgba(186,117,23,0.3)",
                        background: r.status === "RUPTURE" ? "rgba(226,75,74,0.06)" : "rgba(186,117,23,0.06)",
                      }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                          {r.article?.libelle}
                        </p>
                        <p
                          className="text-[10px]"
                          style={{ color: r.status === "RUPTURE" ? "#E24B4A" : "#BA7517" }}
                        >
                          {r.depot?.code} · {Number(r.quantite).toLocaleString("fr-FR")} →{" "}
                          {Number(r.after).toLocaleString("fr-FR")} UN
                        </p>
                      </div>
                      <i
                        className={`ti ${r.status === "RUPTURE" ? "ti-circle-x" : "ti-alert-triangle"}`}
                        style={{ color: r.status === "RUPTURE" ? "#E24B4A" : "#BA7517", fontSize: 16 }}
                        aria-hidden="true"
                      />
                    </div>
                  ))}
            </>
          )}

          <button
            type="button"
            onClick={resetSim}
            disabled={!hasSimInput}
            className="w-full rounded-xl border py-2.5 text-sm font-medium transition-all disabled:opacity-40"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            <i className="ti ti-refresh mr-2 text-xs" aria-hidden="true" />
            Réinitialiser
          </button>
        </div>
      </div>

      <style>{`
        .sim-qty-btn:hover { background: rgba(226,75,74,0.12) !important; }
        .sim-qty-btn-plus:hover { background: rgba(29,158,117,0.12) !important; }
      `}</style>
    </>
  );
}
