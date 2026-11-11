import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2, X } from "lucide-react";
import api from "../../services/api";
import SearchableSelect from "../ui/SearchableSelect";
import FormFieldError, { inputErrorStyle } from "../ui/FormFieldError";
import { useFormValidation } from "../../hooks/useFormValidation";
import { transfertSchema } from "../../validation";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import TransferReviewCard, {
  TransferRouteSummary,
  TransferSuccessPanel,
  parseLotsTransferred,
} from "./TransferReviewCard";

const AMBER = "#BA7517";

export default function TransfertModal({ ligne, open, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const societeScope = useSocieteQueryScope();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState("form"); // form | review | success
  const [depotDestId, setDepotDestId] = useState("");
  const [emplacementDestId, setEmplacementDestId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [error, setError] = useState("");
  const [compatError, setCompatError] = useState("");
  const [shakeEmplacement, setShakeEmplacement] = useState(false);
  const [lotsTransferred, setLotsTransferred] = useState([]);
  const successTimerRef = useRef(null);

  const articleId = ligne?.articleId ?? ligne?.article?.id;
  const depotOrigineId = ligne?.depotId;
  const maxQty = Number(ligne?.quantite) || 0;

  const formValues = useMemo(
    () => ({
      depotDestId,
      emplacementDestId,
      quantite,
      commentaire: "Transfert depuis fiche stock",
    }),
    [depotDestId, emplacementDestId, quantite]
  );
  const { errors, validate, validateField, isValid, clearError, clearErrors, setErrors } = useFormValidation(
    transfertSchema,
    formValues
  );

  const { data: depotsData } = useQuery({
    queryKey: ["depots-dd", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 200, statut: "ACTIF" } }).then((r) => r.data),
    enabled: open,
  });

  const { data: emplacementsRaw } = useQuery({
    queryKey: ["emplacements-transfert", societeScope, depotDestId],
    queryFn: () =>
      api.get("emplacements", { params: { depotId: depotDestId, statut: "ACTIF" } }).then((r) => r.data),
    enabled: open && Boolean(depotDestId),
  });

  const depots = Array.isArray(depotsData) ? depotsData : depotsData?.items || [];
  const emplacements = Array.isArray(emplacementsRaw) ? emplacementsRaw : emplacementsRaw?.items || [];

  const depotOptions = useMemo(
    () =>
      depots
        .filter((d) => String(d.id) !== String(depotOrigineId))
        .map((d) => ({ value: String(d.id), label: `${d.code} — ${d.libelle}` })),
    [depots, depotOrigineId]
  );

  const emplacementOptions = useMemo(
    () => emplacements.map((e) => ({ value: String(e.id), label: `${e.code} — ${e.libelle}` })),
    [emplacements]
  );

  const depotDest = useMemo(
    () => depots.find((x) => String(x.id) === String(depotDestId)),
    [depots, depotDestId]
  );
  const depotDestLabel = depotDest ? `${depotDest.code} — ${depotDest.libelle}` : null;
  const emplacementDest = useMemo(
    () => emplacements.find((e) => String(e.id) === String(emplacementDestId)),
    [emplacements, emplacementDestId]
  );

  function clearSuccessTimer() {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }

  function finishAndClose() {
    clearSuccessTimer();
    onClose?.();
  }

  useEffect(() => {
    if (open && ligne) {
      clearSuccessTimer();
      setStep("form");
      setDepotDestId("");
      setEmplacementDestId("");
      setQuantite(String(maxQty > 0 ? maxQty : ""));
      setError("");
      setCompatError("");
      setLotsTransferred([]);
      clearErrors();
    }
    return () => clearSuccessTimer();
  }, [open, ligne, maxQty]);

  useEffect(() => {
    if (!open || !emplacementDestId || !articleId) {
      setCompatError("");
      return;
    }
    let cancelled = false;
    api
      .get("stock/emplacement-compatibility", {
        params: { articleId, emplacementId: emplacementDestId },
      })
      .then((r) => {
        if (cancelled) return;
        if (!r.data.ok) {
          setCompatError(r.data.message);
          setShakeEmplacement(true);
          setTimeout(() => setShakeEmplacement(false), 400);
        } else {
          setCompatError("");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, emplacementDestId, articleId]);

  const transfer = useMutation({
    mutationFn: (payload) => api.post("mouvements/transferts", payload).then((r) => r.data),
    onSuccess: (data) => {
      const lots = parseLotsTransferred(data);
      setLotsTransferred(lots);
      toast.success("Transfert inter-dépôts enregistré.");
      qc.invalidateQueries({ queryKey: ["stock"], exact: false });
      qc.invalidateQueries({ queryKey: ["mouvements"], exact: false });
      qc.invalidateQueries({ queryKey: ["lots"], exact: false });
      setStep("success");
      clearSuccessTimer();
      successTimerRef.current = setTimeout(() => finishAndClose(), 1800);
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  function goToReview(e) {
    e.preventDefault();
    if (!validate()) {
      setError("Corrigez les champs obligatoires.");
      return;
    }
    const q = Number(quantite);
    if (q > maxQty) {
      setErrors((prev) => ({ ...prev, quantite: `Quantité maximale : ${maxQty.toLocaleString("fr-FR")}.` }));
      setError(`Quantité maximale : ${maxQty.toLocaleString("fr-FR")}.`);
      return;
    }
    if (compatError) {
      setError(compatError);
      return;
    }
    setError("");
    setStep("review");
  }

  function confirmTransfer() {
    transfer.mutate({
      articleId: Number(articleId),
      depotOrigineId: Number(depotOrigineId),
      depotDestId: Number(depotDestId),
      emplacementDestId: emplacementDestId ? Number(emplacementDestId) : undefined,
      quantite: Number(quantite),
      commentaire: "Transfert depuis fiche stock",
    });
  }

  if (!open || !ligne) return null;

  const slide = {
    initial: reduceMotion ? false : { opacity: 0, x: 28 },
    animate: { opacity: 1, x: 0 },
    exit: reduceMotion ? undefined : { opacity: 0, x: -28 },
    transition: { duration: 0.22 },
  };

  const originLabel = ligne.depot?.libelle || "—";
  const originSub = ligne.emplacement?.code || null;
  const destLabel = depotDest?.libelle || depotDestLabel || "—";
  const destSub = emplacementDest?.code || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={step === "success" ? finishAndClose : onClose}
      role="presentation"
    >
      <motion.div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-modal)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfert-title"
        initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28 }}
      >
        <div className="border-b border-[var(--border-default)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#BA7517]">
                Transfert inter-dépôts
              </p>
              <h2 id="transfert-title" className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">
                {step === "review"
                  ? "Vérifiez le transfert"
                  : step === "success"
                    ? "Succès"
                    : "Vers un autre dépôt"}
              </h2>
              {step === "form" ? (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  <span className="font-mono text-[#378ADD]">{ligne.article?.code}</span>
                  {" — "}
                  Disponible : {maxQty.toLocaleString("fr-FR")}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={step === "success" ? finishAndClose : onClose}
              className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {step === "form" ? (
            <div className="mt-4">
              <TransferRouteSummary
                originLabel={originLabel}
                originSub={originSub}
                destLabel={depotDestLabel || "À choisir…"}
                destSub={destSub}
                accent="#378ADD"
              />
            </div>
          ) : null}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {step === "form" ? (
              <motion.form key="form" {...slide} onSubmit={goToReview} className="space-y-3.5">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Dépôt destination <span className="text-[#E24B4A]">*</span>
                  </label>
                  <SearchableSelect
                    value={depotDestId}
                    onChange={(v) => {
                      setDepotDestId(v);
                      setEmplacementDestId("");
                      clearError("depotDestId");
                      setError("");
                    }}
                    options={depotOptions}
                    placeholder="Choisir un dépôt…"
                    className="w-full"
                  />
                  <FormFieldError message={errors.depotDestId} />
                </div>

                <div className={shakeEmplacement ? "animate-shake" : ""}>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Emplacement destination{" "}
                    <span className="font-normal text-[var(--text-muted)]">(optionnel)</span>
                  </label>
                  <SearchableSelect
                    value={emplacementDestId}
                    onChange={(v) => {
                      setEmplacementDestId(v);
                      clearError("emplacementDestId");
                    }}
                    options={emplacementOptions}
                    placeholder={
                      depotDestId ? "Choisir un emplacement…" : "Sélectionnez d’abord un dépôt"
                    }
                    disabled={!depotDestId}
                    className="w-full"
                  />
                  {compatError ? (
                    <p className="mt-1 text-xs text-[#E24B4A]">⚠ {compatError}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Quantité à transférer <span className="text-[#E24B4A]">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0.001}
                      max={maxQty}
                      step="any"
                      value={quantite}
                      onChange={(e) => {
                        setQuantite(e.target.value);
                        clearError("quantite");
                        setError("");
                      }}
                      onBlur={() => validateField("quantite")}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm tabular-nums text-[var(--text-primary)] focus:border-[#378ADD] focus:outline-none"
                      style={errors.quantite ? inputErrorStyle : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setQuantite(String(maxQty))}
                      className="shrink-0 rounded-lg border border-[var(--border-default)] px-3 text-xs font-semibold text-[#378ADD] hover:bg-[var(--bg-hover)]"
                    >
                      Max
                    </button>
                  </div>
                  <FormFieldError message={errors.quantite} />
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Max. {maxQty.toLocaleString("fr-FR")} disponible
                  </p>
                </div>

                {error ? <p className="text-xs text-[#E24B4A]">{error}</p> : null}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!isValid}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, ${AMBER}, #D97706)`,
                      boxShadow: "0 8px 18px -8px rgba(186,117,23,0.55)",
                    }}
                  >
                    Continuer
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.form>
            ) : null}

            {step === "review" ? (
              <motion.div key="review" {...slide}>
                <TransferReviewCard
                  originLabel={originLabel}
                  originSub={originSub}
                  destLabel={destLabel}
                  destSub={destSub}
                  articleCode={ligne.article?.code}
                  articleLibelle={ligne.article?.libelle}
                  quantite={quantite}
                  unite={ligne.article?.unite}
                  accent={AMBER}
                  onEdit={() => setStep("form")}
                  onConfirm={confirmTransfer}
                  confirming={transfer.isPending}
                  confirmLabel={
                    transfer.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Transfert…
                      </>
                    ) : (
                      "Confirmer"
                    )
                  }
                />
              </motion.div>
            ) : null}

            {step === "success" ? (
              <motion.div key="success" {...slide}>
                <TransferSuccessPanel
                  title="Transfert enregistré"
                  originLabel={originLabel}
                  originSub={originSub}
                  destLabel={destLabel}
                  destSub={destSub}
                  articleCode={ligne.article?.code}
                  quantite={quantite}
                  unite={ligne.article?.unite}
                  lots={lotsTransferred}
                  onDone={finishAndClose}
                  reduceMotion={reduceMotion}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
