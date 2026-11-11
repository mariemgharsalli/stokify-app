import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Hash, Info, PackageCheck, Sparkles, StickyNote } from "lucide-react";
import api from "../../services/api";
import Modal, { ModalInfo, btnPrimary, btnSecondary, inputStyle, primaryButtonStyle } from "../ui/Modal";
import FormFieldError, { inputErrorStyle } from "../ui/FormFieldError";
import { useToast } from "../../hooks/useToast";
import { receptionLigneSchema } from "../../validation";
import { resolveModeTracage, tracksLot, tracksSerie } from "../../utils/formHelpers";

function AutoBadge({ label }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
      className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{label}</span>
    </motion.div>
  );
}

function parseSerieList(raw) {
  return String(raw || "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ModalReception({ achatId, onClose, onSuccess, societeScope, listQueryKey }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [receptions, setReceptions] = useState({});
  const [lots, setLots] = useState({});
  const [series, setSeries] = useState({});
  const [seriePaste, setSeriePaste] = useState({});
  const [showPaste, setShowPaste] = useState({});
  const [lineErrors, setLineErrors] = useState({});

  const { data: achat, isLoading } = useQuery({
    queryKey: ["achat", achatId],
    queryFn: () => api.get(`achats/${achatId}`).then((r) => r.data),
    enabled: Boolean(achatId),
  });

  const lignes = achat?.lignes || [];

  function lineMode(l) {
    return resolveModeTracage(l.article);
  }

  function lineAuto(l) {
    return Boolean(l.article?.tracageAuto) && lineMode(l) !== "AUCUN";
  }

  function validateLines() {
    const next = {};
    let ok = true;
    let hasAny = false;
    for (const l of lignes) {
      const q = Number(receptions[l.id]);
      if (!q || q <= 0) continue;
      hasAny = true;
      const mode = lineMode(l);
      const auto = lineAuto(l);
      const payload = {
        quantiteRecue: receptions[l.id],
        numeroLot: lots[l.id]?.numero || "",
        dateExpiration: lots[l.id]?.dateExp || "",
      };
      const result = receptionLigneSchema.safeParse(payload);
      if (!result.success) {
        ok = false;
        const issue = result.error.issues[0];
        next[l.id] = issue?.message || "Ligne invalide";
        continue;
      }
      if (tracksLot(mode) && !auto && !String(lots[l.id]?.numero || "").trim()) {
        ok = false;
        next[l.id] = `N° de lot requis pour ${l.article?.libelle}`;
      }
      if (tracksSerie(mode) && !auto) {
        const n = Math.round(q);
        if (Math.abs(q - n) > 1e-6) {
          ok = false;
          next[l.id] = "La quantité reçue doit être un entier pour un n° de série";
        } else {
          const nums = (series[l.id] || []).map((s) => String(s || "").trim()).filter(Boolean);
          if (nums.length !== n) {
            ok = false;
            next[l.id] = `Veuillez saisir exactement ${n} numéro(s) de série`;
          }
        }
      }
    }
    if (!hasAny) {
      toast.error("Saisissez au moins une quantité reçue");
      return false;
    }
    setLineErrors(next);
    return ok;
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      let lastUpdatedAchat = null;
      for (const l of lignes) {
        const q = Number(receptions[l.id]);
        if (!q || q <= 0) continue;
        const restant = Number(l.quantite) - Number(l.quantiteRecue || 0);
        if (q > restant + 1e-6) {
          throw new Error(`Quantité reçue trop élevée pour ${l.article?.libelle}`);
        }
        const mode = lineMode(l);
        const auto = lineAuto(l);
        const body = { quantiteRecue: q };
        if (tracksLot(mode)) {
          if (!auto) {
            body.numeroLot = lots[l.id]?.numero || "";
            if (!body.numeroLot) throw new Error(`N° de lot requis pour ${l.article?.libelle}`);
          }
          if (lots[l.id]?.dateExp) body.dateExpiration = lots[l.id].dateExp;
        }
        if (tracksSerie(mode) && !auto) {
          const nums = (series[l.id] || []).map((s) => String(s || "").trim()).filter(Boolean);
          if (nums.length !== Math.round(q)) {
            throw new Error(`Veuillez saisir exactement ${Math.round(q)} numéro(s) de série pour ${l.article?.libelle}`);
          }
          body.numerosSerie = nums;
        }
        const res = await api.post(`achats/${achatId}/lignes/${l.id}/reception`, body);
        lastUpdatedAchat = res.data;
      }
      return lastUpdatedAchat;
    },
    onSuccess: async (updatedAchat) => {
      if (updatedAchat && listQueryKey) {
        qc.setQueryData(listQueryKey, (old) => {
          if (!old?.items) return old;
          return {
            ...old,
            items: old.items.map((a) =>
              Number(a.id) === Number(updatedAchat.id)
                ? { ...a, ...updatedAchat, lignes: updatedAchat.lignes ?? a.lignes }
                : a
            ),
          };
        });
      }
      await qc.invalidateQueries({ queryKey: ["achats"] });
      await qc.refetchQueries({ queryKey: ["achats"], type: "active" });
      await qc.invalidateQueries({ queryKey: ["achats-stats"] });
      if (achatId) {
        qc.setQueryData(["achat", achatId], updatedAchat);
      }
      toast.success("Réception enregistrée — stock mis à jour");
      onSuccess?.(updatedAchat);
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const hasQty = useMemo(
    () => Object.values(receptions).some((v) => Number(v) > 0),
    [receptions]
  );

  function setQty(lineId, value) {
    setReceptions((p) => ({ ...p, [lineId]: value }));
    const n = Math.max(0, Math.round(Number(value) || 0));
    setSeries((p) => {
      const prev = p[lineId] || [];
      const next = Array.from({ length: n }, (_, i) => prev[i] || "");
      return { ...p, [lineId]: next };
    });
    setLineErrors((p) => {
      if (!p[lineId]) return p;
      const copy = { ...p };
      delete copy[lineId];
      return copy;
    });
  }

  return (
    <Modal
      title="Réceptionner les marchandises"
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annuler
          </button>
          <button
            type="button"
            disabled={submitMutation.isPending || isLoading || !hasQty}
            onClick={() => {
              if (!validateLines()) return;
              submitMutation.mutate();
            }}
            className={btnPrimary}
            style={primaryButtonStyle}
          >
            <PackageCheck className="h-4 w-4" />
            {submitMutation.isPending ? "Enregistrement…" : "Confirmer la réception"}
          </button>
        </div>
      }
    >
      <ModalInfo>
        <span className="inline-flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          Enregistrez les quantités réellement reçues. Le stock sera mis à jour automatiquement.
        </span>
      </ModalInfo>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-[var(--bg-hover)]" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {lignes.map((l) => {
            const restant = Math.max(0, Number(l.quantite) - Number(l.quantiteRecue || 0));
            const mode = lineMode(l);
            const auto = lineAuto(l);
            const q = Number(receptions[l.id]) || 0;
            const qInt = Math.max(0, Math.round(q));
            return (
              <div key={l.id} className="rounded-lg border border-[var(--border-default)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{l.article?.libelle}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      Commandé : {l.quantite} · Déjà reçu : {l.quantiteRecue || 0} · Restant : {restant}
                    </p>
                  </div>
                  {mode !== "AUCUN" ? (
                    <span className="shrink-0 rounded-md border border-[var(--border-default)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                      {mode === "LOT_SERIE" ? "Lot + série" : mode === "SERIE" ? "Série" : "Lot"}
                      {auto ? " · auto" : " · manuel"}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-[var(--text-secondary)]">Qté reçue *</label>
                    <input
                      type="number"
                      min={0}
                      max={restant}
                      step={tracksSerie(mode) ? 1 : "any"}
                      value={receptions[l.id] ?? ""}
                      onChange={(e) => setQty(l.id, e.target.value)}
                      className={inputStyle}
                      style={lineErrors[l.id] ? inputErrorStyle : undefined}
                      placeholder={`Max ${restant}`}
                    />
                  </div>
                  {mode === "LOT_SERIE" && auto ? (
                    <AutoBadge
                      label={`Lot et ${qInt || "n"} n° de série créés automatiquement`}
                    />
                  ) : null}
                  {mode === "LOT" && auto ? (
                    <AutoBadge label="Génération automatique du n° de lot" />
                  ) : null}
                  {mode === "SERIE" && auto ? (
                    <AutoBadge
                      label={`Génération automatique (×${qInt || "n"} numéros)`}
                    />
                  ) : null}
                  {tracksLot(mode) && !auto ? (
                    <>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--text-secondary)]">N° lot *</label>
                        <input
                          value={lots[l.id]?.numero || ""}
                          onChange={(e) =>
                            setLots((p) => ({ ...p, [l.id]: { ...p[l.id], numero: e.target.value } }))
                          }
                          className={inputStyle}
                          style={lineErrors[l.id] ? inputErrorStyle : undefined}
                          placeholder="LOT-001"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--text-secondary)]">
                          Date expiration
                        </label>
                        <input
                          type="date"
                          value={lots[l.id]?.dateExp || ""}
                          onChange={(e) =>
                            setLots((p) => ({ ...p, [l.id]: { ...p[l.id], dateExp: e.target.value } }))
                          }
                          className={inputStyle}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
                <AnimatePresence initial={false}>
                  {tracksSerie(mode) && !auto && qInt > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-hover)]/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                            <Hash className="h-3.5 w-3.5" />
                            {qInt} numéro{qInt > 1 ? "s" : ""} de série
                          </p>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-500,#7c3aed)]"
                            onClick={() => setShowPaste((p) => ({ ...p, [l.id]: !p[l.id] }))}
                          >
                            <StickyNote className="h-3.5 w-3.5" />
                            {showPaste[l.id] ? "Saisie champ par champ" : "Coller une liste"}
                          </button>
                        </div>
                        {showPaste[l.id] ? (
                          <textarea
                            rows={Math.min(6, Math.max(3, qInt))}
                            value={seriePaste[l.id] || ""}
                            placeholder="Un numéro par ligne"
                            className={`${inputStyle} min-h-[84px] font-mono text-xs`}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setSeriePaste((p) => ({ ...p, [l.id]: raw }));
                              const parsed = parseSerieList(raw).slice(0, qInt);
                              setSeries((p) => ({
                                ...p,
                                [l.id]: Array.from({ length: qInt }, (_, i) => parsed[i] || ""),
                              }));
                            }}
                          />
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {Array.from({ length: qInt }, (_, i) => (
                              <input
                                key={`${l.id}-sn-${i}`}
                                value={series[l.id]?.[i] || ""}
                                onChange={(e) =>
                                  setSeries((p) => {
                                    const next = [...(p[l.id] || Array.from({ length: qInt }, () => ""))];
                                    next[i] = e.target.value;
                                    return { ...p, [l.id]: next };
                                  })
                                }
                                className={`${inputStyle} font-mono text-xs`}
                                placeholder={`SN-${String(i + 1).padStart(3, "0")}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <FormFieldError message={lineErrors[l.id]} />
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
