import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EyeOff, RotateCcw } from "lucide-react";
import EcartBadge from "./EcartBadge";
import ProgressBar from "./ProgressBar";
import { computeRecap, formatTnd, ligneEcart, INV_THEME } from "../inventaireUtils";

export function shouldHideTheorique(ligne, modeAveugle, inventaireStatut) {
  if (!modeAveugle) return false;
  if (inventaireStatut === "VALIDE") return false;
  return !ligne.valide;
}

function TheoriqueCell({ ligne, modeAveugle, inventaireStatut }) {
  const hidden = shouldHideTheorique(ligne, modeAveugle, inventaireStatut);
  if (hidden) {
    return (
      <span
        className="inline-flex items-center justify-end gap-1 font-mono text-slate-500"
        title="Quantité théorique masquée (comptage à l'aveugle)"
      >
        <EyeOff className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        —
      </span>
    );
  }
  return <span>{ligne.qteTheorique}</span>;
}

const FILTERS = [
  { id: "tous", label: "Tous" },
  { id: "ecarts", label: "Écarts uniquement" },
  { id: "non_saisis", label: "Non saisis" },
  { id: "conformes", label: "Conformes" },
];

export default function SaisieTable({
  lignes,
  onChange,
  masquerTheorique = false,
  modeAveugle = false,
  inventaireStatut = "EN_COURS",
  readOnly = false,
  onSave,
  showRecomptage = false,
  onToggleRecomptage,
  togglingRecomptageId = null,
}) {
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState("tous");
  const [search, setSearch] = useState("");
  const inputRefs = useRef({});

  const hideTheorique = useCallback(
    (ligne) =>
      shouldHideTheorique(ligne, modeAveugle || masquerTheorique, inventaireStatut),
    [modeAveugle, masquerTheorique, inventaireStatut]
  );

  const rows = useMemo(() => {
    let list = [...lignes];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.article?.code?.toLowerCase().includes(q) ||
          l.article?.libelle?.toLowerCase().includes(q)
      );
    }
    if (filter === "ecarts") {
      list = list.filter((l) => {
        if (l.qteReelle == null) return false;
        return Math.abs(ligneEcart(l.qteTheorique, l.qteReelle)) >= 1e-9;
      });
    } else if (filter === "non_saisis") {
      list = list.filter((l) => l.qteReelle == null);
    } else if (filter === "conformes") {
      list = list.filter((l) => {
        if (l.qteReelle == null) return false;
        return Math.abs(ligneEcart(l.qteTheorique, l.qteReelle)) < 1e-9;
      });
    }
    return list;
  }, [lignes, filter, search]);

  const recap = useMemo(() => computeRecap(lignes), [lignes]);

  const focusRow = useCallback(
    (idx) => {
      const row = rows[idx];
      if (!row) return;
      inputRefs.current[row.id]?.focus();
    },
    [rows]
  );

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave]);

  const handleKey = (e, rowIdx, ligne) => {
    if (e.key === "Enter" || e.key === "Tab") {
      if (e.key === "Tab" && e.shiftKey) return;
      e.preventDefault();
      focusRow(rowIdx + 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusRow(rowIdx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusRow(rowIdx - 1);
    } else if (e.key === "Escape") {
      onChange(ligne.id, null);
    }
  };

  const fieldStyle = {
    borderColor: `${INV_THEME.accent}33`,
    background: "color-mix(in srgb, var(--bg-input, #0f172a) 90%, transparent)",
    color: "var(--text-primary)",
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Progression
        </p>
        <ProgressBar value={recap.progressionPct} />
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          {recap.saisis}/{recap.total} articles ({recap.progressionPct}%)
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Filtrer un article…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
          style={fieldStyle}
        />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <motion.button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold"
                style={
                  active
                    ? {
                        background: `linear-gradient(135deg, ${INV_THEME.accent}, ${INV_THEME.cyan})`,
                        color: "#fff",
                        boxShadow: `0 4px 12px -4px ${INV_THEME.accent}88`,
                      }
                    : {
                        border: `1px solid ${INV_THEME.accent}33`,
                        color: "var(--text-muted)",
                        background: "transparent",
                      }
                }
                whileHover={reduceMotion ? undefined : { y: -1 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              >
                {f.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div
        className="hidden overflow-x-auto rounded-xl border md:block"
        style={{ borderColor: "var(--border-default)" }}
      >
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead
            className="text-xs uppercase"
            style={{
              background: "color-mix(in srgb, var(--bg-input) 85%, transparent)",
              color: "var(--text-muted)",
            }}
          >
            <tr>
              <th className="px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Article</th>
              <th className="px-3 py-2.5">Empl.</th>
              <th className="px-3 py-2.5 text-right">Théorique</th>
              <th className="px-3 py-2.5 text-right">Réel</th>
              <th className="px-3 py-2.5 text-right">Écart</th>
              {showRecomptage ? <th className="px-3 py-2.5 text-center">Recomptage</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((l, idx) => {
              const ec = hideTheorique(l) ? null : ligneEcart(l.qteTheorique, l.qteReelle);
              const recomptagePending = Boolean(l.recomptageDemande);
              return (
                <motion.tr
                  key={l.id}
                  className="border-t transition-colors"
                  style={{
                    borderColor: recomptagePending
                      ? "rgba(249,115,22,0.55)"
                      : "var(--border-subtle, var(--border-default))",
                    boxShadow: recomptagePending ? "inset 0 0 0 1px rgba(249,115,22,0.35)" : undefined,
                  }}
                  initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: reduceMotion ? 0 : Math.min(idx * 0.015, 0.25) }}
                  whileHover={
                    reduceMotion
                      ? undefined
                      : { backgroundColor: "color-mix(in srgb, #378ADD 8%, transparent)" }
                  }
                >
                  <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {l.article?.libelle}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {l.article?.code}
                    </div>
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>
                    {l.emplacement?.code ?? "—"}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-mono"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <TheoriqueCell
                      ligne={l}
                      modeAveugle={modeAveugle || masquerTheorique}
                      inventaireStatut={inventaireStatut}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {readOnly ? (
                      <span className="font-mono">{l.qteReelle ?? "—"}</span>
                    ) : (
                      <input
                        ref={(el) => {
                          inputRefs.current[l.id] = el;
                        }}
                        type="number"
                        min={0}
                        step="any"
                        className="w-24 rounded-lg border px-2 py-1 text-right font-mono text-sm outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                        style={fieldStyle}
                        value={l.qteReelle ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          onChange(l.id, v);
                        }}
                        onKeyDown={(e) => handleKey(e, idx, l)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {hideTheorique(l) ? (
                      <span className="text-slate-500" title="Écart masqué (comptage à l'aveugle)">
                        —
                      </span>
                    ) : (
                      <EcartBadge ecart={ec} />
                    )}
                  </td>
                  {showRecomptage ? (
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        title={
                          recomptagePending
                            ? "Recomptage demandé — re-saisir la quantité réelle"
                            : "Demander un recomptage"
                        }
                        disabled={togglingRecomptageId === l.id}
                        onClick={() => onToggleRecomptage?.(l.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-white/5 disabled:opacity-50"
                        style={{
                          borderColor: recomptagePending
                            ? "rgba(249,115,22,0.55)"
                            : "var(--border-default)",
                          color: recomptagePending ? "#fb923c" : "var(--text-muted)",
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  ) : null}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((l, idx) => {
          const ec = hideTheorique(l) ? null : ligneEcart(l.qteTheorique, l.qteReelle);
          const recomptagePending = Boolean(l.recomptageDemande);
          return (
            <motion.div
              key={l.id}
              className="rounded-xl border p-4"
              style={{
                borderColor: recomptagePending
                  ? "rgba(249,115,22,0.55)"
                  : "var(--border-default)",
                background: "var(--bg-card)",
                boxShadow: recomptagePending ? "inset 0 0 0 1px rgba(249,115,22,0.35)" : undefined,
              }}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : Math.min(idx * 0.03, 0.3) }}
            >
              <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                {l.article?.libelle}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {l.article?.code}
              </div>
              <div
                className="mt-3 flex justify-between text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                <span className="inline-flex items-center gap-1">
                  Théorique :{" "}
                  <TheoriqueCell
                    ligne={l}
                    modeAveugle={modeAveugle || masquerTheorique}
                    inventaireStatut={inventaireStatut}
                  />
                </span>
                {hideTheorique(l) ? (
                  <span className="text-slate-500">—</span>
                ) : (
                  <EcartBadge ecart={ec} />
                )}
              </div>
              {showRecomptage ? (
                <button
                  type="button"
                  title={
                    recomptagePending
                      ? "Recomptage demandé — re-saisir la quantité réelle"
                      : "Demander un recomptage"
                  }
                  disabled={togglingRecomptageId === l.id}
                  onClick={() => onToggleRecomptage?.(l.id)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition hover:bg-white/5 disabled:opacity-50"
                  style={{
                    borderColor: recomptagePending
                      ? "rgba(249,115,22,0.55)"
                      : "var(--border-default)",
                    color: recomptagePending ? "#fb923c" : "var(--text-muted)",
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                  {recomptagePending ? "Recomptage demandé" : "Demander recomptage"}
                </button>
              ) : null}
              {!readOnly && (
                <input
                  type="number"
                  min={0}
                  className="mt-3 w-full rounded-xl border px-4 py-3 text-center text-lg font-mono outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                  style={fieldStyle}
                  value={l.qteReelle ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    onChange(l.id, v);
                  }}
                  onKeyDown={(e) => handleKey(e, idx, l)}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {recap.saisis} / {recap.total} articles saisis · {recap.ecarts} écarts détectés · Valeur :{" "}
        {formatTnd(recap.valeurEcart)}
      </p>
    </div>
  );
}
