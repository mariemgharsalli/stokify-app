import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  Package,
  X,
} from "lucide-react";
import api from "../../services/api";
import SearchableSelect from "../ui/SearchableSelect";
import FormFieldError, { inputErrorStyle } from "../ui/FormFieldError";
import { useFormValidation } from "../../hooks/useFormValidation";
import { transferEmplacementSchema } from "../../validation";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import TransferReviewCard, {
  TransferSuccessPanel,
  parseLotsTransferred,
} from "./TransferReviewCard";

const ACCENT = "#378ADD";
const CYAN = "#0EA5E9";
const AMBER = "#BA7517";

const STEPS = [
  { key: "depart", label: "Départ", hint: "D’où part le stock ?" },
  { key: "arrivee", label: "Arrivée", hint: "Où le déplacer ?" },
  { key: "quantite", label: "Quantité", hint: "Combien déplacer ?" },
];

function WizardSteps({ step, reduceMotion }) {
  return (
    <div className="mt-4 flex items-center gap-1">
      {STEPS.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={s.key} className="flex min-w-0 flex-1 items-center gap-1">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <motion.span
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  background: done || active ? ACCENT : "var(--bg-hover)",
                  color: done || active ? "#fff" : "var(--text-muted)",
                  boxShadow: active ? `0 0 0 3px ${ACCENT}33` : undefined,
                }}
                animate={reduceMotion || !active ? undefined : { scale: [1, 1.06, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </motion.span>
              <span
                className="truncate text-[11px] font-semibold"
                style={{ color: active || done ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <div
                className="mb-5 h-0.5 w-full max-w-[40px] rounded-full"
                style={{
                  background: done ? ACCENT : "var(--border-default)",
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SummaryChip({ icon: Icon, label, value, color }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} aria-hidden />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
        <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{value}</p>
      </div>
    </div>
  );
}

/**
 * Assistant en 3 écrans : Départ → Arrivée → Quantité.
 */
export default function TransferEmplacementModal({ open, onClose, prefill = null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const societeScope = useSocieteQueryScope();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState("wizard"); // wizard | review | success
  const [articleId, setArticleId] = useState("");
  const [depotOrigineId, setDepotOrigineId] = useState("");
  const [emplacementOrigineId, setEmplacementOrigineId] = useState("");
  const [depotDestId, setDepotDestId] = useState("");
  const [emplacementDestId, setEmplacementDestId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [error, setError] = useState("");
  const [lotsTransferred, setLotsTransferred] = useState([]);
  const successTimerRef = useRef(null);

  const formValues = useMemo(
    () => ({
      articleId,
      depotOrigineId,
      emplacementOrigineId,
      depotDestId,
      emplacementDestId,
      quantite,
      commentaire,
    }),
    [articleId, depotOrigineId, emplacementOrigineId, depotDestId, emplacementDestId, quantite, commentaire]
  );
  const { errors, validate, validateField, isValid, clearError, clearErrors, setErrors } = useFormValidation(
    transferEmplacementSchema,
    formValues
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

  const fromStock = Boolean(
    prefill?.articleId && prefill?.depotOrigineId && prefill?.emplacementOrigineId
  );

  const { data: articlesData } = useQuery({
    queryKey: ["articles-select-empl-transfer", societeScope],
    queryFn: () => api.get("articles", { params: { limit: 500, actif: true } }).then((r) => r.data),
    enabled: open,
  });

  const { data: depotsData } = useQuery({
    queryKey: ["depots-empl-transfer", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 200, statut: "ACTIF" } }).then((r) => r.data),
    enabled: open,
  });

  const { data: emplOrigineRaw } = useQuery({
    queryKey: ["emplacements-origine", societeScope, depotOrigineId],
    queryFn: () =>
      api.get("emplacements", { params: { depotId: depotOrigineId, statut: "ACTIF" } }).then((r) => r.data),
    enabled: open && Boolean(depotOrigineId),
  });

  const { data: emplDestRaw } = useQuery({
    queryKey: ["emplacements-dest", societeScope, depotDestId],
    queryFn: () =>
      api.get("emplacements", { params: { depotId: depotDestId, statut: "ACTIF" } }).then((r) => r.data),
    enabled: open && Boolean(depotDestId),
  });

  const { data: stockAtSource, isFetching: stockLoading } = useQuery({
    queryKey: ["stock-empl-source", societeScope, articleId, depotOrigineId, emplacementOrigineId],
    queryFn: () =>
      api
        .get("stock", {
          params: {
            articleId,
            depotId: depotOrigineId,
            emplacementId: emplacementOrigineId,
            limit: 5,
          },
        })
        .then((r) => {
          const lines = r.data?.data ?? r.data?.items ?? [];
          return lines.reduce((s, l) => s + Number(l.quantite || 0), 0);
        }),
    enabled: open && Boolean(articleId && depotOrigineId && emplacementOrigineId),
  });

  const { data: compat, isFetching: compatLoading } = useQuery({
    queryKey: ["emplacement-compatibility", societeScope, articleId, emplacementDestId],
    queryFn: () =>
      api
        .get("stock/emplacement-compatibility", {
          params: { articleId, emplacementId: emplacementDestId },
        })
        .then((r) => r.data),
    enabled: open && Boolean(articleId && emplacementDestId),
  });

  const articles = articlesData?.items ?? articlesData ?? [];
  const depots = Array.isArray(depotsData) ? depotsData : depotsData?.items ?? [];
  const emplOrigine = Array.isArray(emplOrigineRaw) ? emplOrigineRaw : emplOrigineRaw?.items ?? [];
  const emplDest = Array.isArray(emplDestRaw) ? emplDestRaw : emplDestRaw?.items ?? [];

  const articleOptions = useMemo(
    () => articles.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.libelle}` })),
    [articles]
  );
  const depotOptions = useMemo(
    () => depots.map((d) => ({ value: String(d.id), label: `${d.code} — ${d.libelle}` })),
    [depots]
  );
  const emplOrigineOptions = useMemo(
    () =>
      emplOrigine.map((e) => ({
        value: String(e.id),
        label: `${e.code} — ${e.libelle}`,
        disabled: String(e.id) === emplacementDestId,
      })),
    [emplOrigine, emplacementDestId]
  );
  const emplDestOptions = useMemo(
    () =>
      emplDest
        .filter((e) => String(e.id) !== emplacementOrigineId)
        .map((e) => ({
          value: String(e.id),
          label: `${e.code} — ${e.libelle}`,
        })),
    [emplDest, emplacementOrigineId]
  );

  const selectedArticle = articles.find((a) => String(a.id) === articleId);
  const depotOrigine = depots.find((d) => String(d.id) === depotOrigineId);
  const depotDest = depots.find((d) => String(d.id) === depotDestId);
  const emplOrigineSel = emplOrigine.find((e) => String(e.id) === emplacementOrigineId);
  const emplDestSel = emplDest.find((e) => String(e.id) === emplacementDestId);

  const dispo = Number(stockAtSource ?? 0);
  const qtyNum = Number(quantite) || 0;

  useEffect(() => {
    if (!open) return;
    clearSuccessTimer();
    const p = prefill || {};
    setArticleId(p.articleId != null ? String(p.articleId) : "");
    setDepotOrigineId(p.depotOrigineId != null ? String(p.depotOrigineId) : "");
    setEmplacementOrigineId(p.emplacementOrigineId != null ? String(p.emplacementOrigineId) : "");
    setDepotDestId(p.depotDestId != null ? String(p.depotDestId) : "");
    setEmplacementDestId(p.emplacementDestId != null ? String(p.emplacementDestId) : "");
    setQuantite(p.quantite != null ? String(p.quantite) : "");
    setCommentaire(p.commentaire || "");
    setError("");
    setPhase("wizard");
    setLotsTransferred([]);
    clearErrors();
    // Depuis le stock : départ déjà connu → commencer à l’arrivée
    setStep(
      p.articleId && p.depotOrigineId && p.emplacementOrigineId ? 1 : 0
    );
    return () => clearSuccessTimer();
  }, [open, prefill]);

  const transferMut = useMutation({
    mutationFn: (payload) => api.post("mouvements/transfert-emplacement", payload).then((r) => r.data),
    onSuccess: (data) => {
      const lots = parseLotsTransferred(data);
      setLotsTransferred(lots);
      toast.success("Transfert d'emplacement enregistré.");
      qc.invalidateQueries({ queryKey: ["stock"], exact: false });
      qc.invalidateQueries({ queryKey: ["mouvements"], exact: false });
      qc.invalidateQueries({ queryKey: ["mouvements-empl-transfer"] });
      qc.invalidateQueries({ queryKey: ["emplacement-suggestions"] });
      qc.invalidateQueries({ queryKey: ["emplacement-audit"] });
      qc.invalidateQueries({ queryKey: ["lots"], exact: false });
      setPhase("success");
      clearSuccessTimer();
      successTimerRef.current = setTimeout(() => finishAndClose(), 1800);
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  function validateStep(s) {
    if (s === 0) {
      if (!articleId) return "Choisissez un article.";
      if (!depotOrigineId) return "Choisissez le dépôt de départ.";
      if (!emplacementOrigineId) return "Choisissez l’emplacement de départ.";
      return "";
    }
    if (s === 1) {
      if (!depotDestId) return "Choisissez le dépôt d’arrivée.";
      if (!emplacementDestId) return "Choisissez l’emplacement d’arrivée.";
      if (emplacementOrigineId === emplacementDestId) {
        return "L’arrivée doit être différente du départ.";
      }
      if (compat && !compat.ok) return compat.message;
      return "";
    }
    if (s === 2) {
      if (!qtyNum || qtyNum <= 0) return "Indiquez une quantité valide.";
      if (qtyNum > dispo) {
        return `Stock insuffisant (disponible : ${dispo.toLocaleString("fr-FR")}).`;
      }
      if (compat && !compat.ok) return compat.message;
      return "";
    }
    return "";
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      if (step === 0) {
        if (!articleId) setErrors((p) => ({ ...p, articleId: "Sélection requise" }));
        if (!depotOrigineId) setErrors((p) => ({ ...p, depotOrigineId: "Sélection requise" }));
        if (!emplacementOrigineId) setErrors((p) => ({ ...p, emplacementOrigineId: "Sélection requise" }));
      }
      if (step === 1) {
        if (!depotDestId) setErrors((p) => ({ ...p, depotDestId: "Sélection requise" }));
        if (!emplacementDestId) setErrors((p) => ({ ...p, emplacementDestId: "Sélection requise" }));
      }
      return;
    }
    setError("");
    setStep((s) => Math.min(2, s + 1));
  }

  function goBack() {
    setError("");
    setStep((s) => Math.max(fromStock ? 1 : 0, s - 1));
  }

  function goToReview(e) {
    e.preventDefault();
    if (!validate()) {
      setError("Corrigez les champs obligatoires.");
      return;
    }
    const err = validateStep(2);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setPhase("review");
  }

  function confirmTransfer() {
    transferMut.mutate({
      articleId: Number(articleId),
      depotOrigineId: Number(depotOrigineId),
      emplacementOrigineId: Number(emplacementOrigineId),
      depotDestId: Number(depotDestId),
      emplacementDestId: Number(emplacementDestId),
      quantite: qtyNum,
      commentaire: commentaire.trim() || undefined,
    });
  }

  if (!open) return null;

  const slide = {
    initial: reduceMotion ? false : { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: reduceMotion ? undefined : { opacity: 0, x: -24 },
    transition: { duration: 0.22 },
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={phase === "success" ? finishAndClose : onClose}
      role="presentation"
    >
      <motion.div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-modal)] shadow-2xl"
        style={{ maxHeight: "min(90vh, 640px)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="empl-transfer-title"
        initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-[var(--border-default)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#378ADD]">
                Assistant transfert
              </p>
              <h2
                id="empl-transfer-title"
                className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]"
              >
                {phase === "review"
                  ? "Vérifiez le transfert"
                  : phase === "success"
                    ? "Succès"
                    : STEPS[step].label}
              </h2>
              {phase === "wizard" ? (
                <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{STEPS[step].hint}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={phase === "success" ? finishAndClose : onClose}
              className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {phase === "wizard" ? (
            <WizardSteps step={step} reduceMotion={reduceMotion} />
          ) : null}
        </div>

        {/* Body */}
        <AnimatePresence mode="wait">
          {phase === "review" ? (
            <motion.div key="phase-review" {...slide} className="flex-1 overflow-y-auto px-5 py-5">
              <TransferReviewCard
                originLabel={depotOrigine?.libelle || depotOrigine?.code}
                originSub={emplOrigineSel?.code}
                destLabel={depotDest?.libelle || depotDest?.code}
                destSub={emplDestSel?.code}
                articleCode={selectedArticle?.code}
                articleLibelle={selectedArticle?.libelle}
                quantite={qtyNum}
                unite={selectedArticle?.unite}
                accent={ACCENT}
                onEdit={() => setPhase("wizard")}
                onConfirm={confirmTransfer}
                confirming={transferMut.isPending}
                confirmLabel={
                  transferMut.isPending ? (
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

          {phase === "success" ? (
            <motion.div key="phase-success" {...slide} className="flex-1 overflow-y-auto px-5 py-5">
              <TransferSuccessPanel
                title="Transfert enregistré"
                originLabel={depotOrigine?.libelle || depotOrigine?.code}
                originSub={emplOrigineSel?.code}
                destLabel={depotDest?.libelle || depotDest?.code}
                destSub={emplDestSel?.code}
                articleCode={selectedArticle?.code}
                quantite={qtyNum}
                unite={selectedArticle?.unite}
                lots={lotsTransferred}
                onDone={finishAndClose}
                reduceMotion={reduceMotion}
              />
            </motion.div>
          ) : null}

          {phase === "wizard" ? (
            <motion.form
              key="phase-wizard"
              {...slide}
              onSubmit={goToReview}
              className="flex min-h-0 flex-1 flex-col"
            >
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="step-0" {...slide} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                      Article <span className="text-[#E24B4A]">*</span>
                    </label>
                    <SearchableSelect
                      options={articleOptions}
                      value={articleId}
                      onChange={(v) => {
                        setArticleId(v);
                        clearError("articleId");
                        setError("");
                      }}
                      placeholder="Rechercher un article…"
                    />
                    <FormFieldError message={errors.articleId} />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                      Dépôt de départ <span className="text-[#E24B4A]">*</span>
                    </label>
                    <SearchableSelect
                      options={depotOptions}
                      value={depotOrigineId}
                      onChange={(v) => {
                        setDepotOrigineId(v);
                        setEmplacementOrigineId("");
                        clearError("depotOrigineId");
                        setError("");
                      }}
                      placeholder="Choisir le dépôt…"
                    />
                    <FormFieldError message={errors.depotOrigineId} />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                      Emplacement de départ <span className="text-[#E24B4A]">*</span>
                    </label>
                    <SearchableSelect
                      options={emplOrigineOptions}
                      value={emplacementOrigineId}
                      onChange={(v) => {
                        setEmplacementOrigineId(v);
                        clearError("emplacementOrigineId");
                        setError("");
                      }}
                      placeholder={
                        depotOrigineId
                          ? "Choisir l’emplacement…"
                          : "Choisissez d’abord le dépôt"
                      }
                      disabled={!depotOrigineId}
                    />
                    <FormFieldError message={errors.emplacementOrigineId} />
                  </div>

                  {articleId && emplacementOrigineId ? (
                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2.5 text-sm">
                      <p className="text-[var(--text-muted)]">Stock disponible ici</p>
                      <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
                        {stockLoading
                          ? "…"
                          : `${dispo.toLocaleString("fr-FR")} ${selectedArticle?.unite || ""}`}
                      </p>
                    </div>
                  ) : null}
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="step-1" {...slide} className="space-y-4">
                  {/* Contexte départ (lu) */}
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#BA7517]">
                      Depuis
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <SummaryChip
                        icon={Package}
                        label="Article"
                        value={
                          selectedArticle
                            ? `${selectedArticle.code}`
                            : "—"
                        }
                        color={ACCENT}
                      />
                      <SummaryChip
                        icon={MapPin}
                        label="Emplacement"
                        value={emplOrigineSel?.code || "—"}
                        color={AMBER}
                      />
                    </div>
                    <p className="mt-2 truncate text-xs text-[var(--text-muted)]">
                      {depotOrigine
                        ? `${depotOrigine.code} — ${depotOrigine.libelle}`
                        : ""}
                      {emplOrigineSel?.libelle ? ` · ${emplOrigineSel.libelle}` : ""}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                      Dépôt d&apos;arrivée <span className="text-[#E24B4A]">*</span>
                    </label>
                    <SearchableSelect
                      options={depotOptions}
                      value={depotDestId}
                      onChange={(v) => {
                        setDepotDestId(v);
                        setEmplacementDestId("");
                        clearError("depotDestId");
                        setError("");
                      }}
                      placeholder="Choisir le dépôt…"
                    />
                    <FormFieldError message={errors.depotDestId} />
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      Souvent le même dépôt que le départ
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                      Emplacement d&apos;arrivée <span className="text-[#E24B4A]">*</span>
                    </label>
                    <SearchableSelect
                      options={emplDestOptions}
                      value={emplacementDestId}
                      onChange={(v) => {
                        setEmplacementDestId(v);
                        clearError("emplacementDestId");
                        setError("");
                      }}
                      placeholder={
                        depotDestId
                          ? "Choisir l’emplacement…"
                          : "Choisissez d’abord le dépôt"
                      }
                      disabled={!depotDestId}
                    />
                    <FormFieldError message={errors.emplacementDestId} />
                  </div>

                  {emplacementDestId && articleId ? (
                    <div className="text-sm">
                      {compatLoading ? (
                        <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Vérification…
                        </span>
                      ) : compat?.ok ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#1D9E75]">
                          <Check className="h-4 w-4" /> Emplacement compatible
                        </span>
                      ) : compat && !compat.ok ? (
                        <span className="font-medium text-[#E24B4A]">⚠ {compat.message}</span>
                      ) : null}
                    </div>
                  ) : null}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step-2" {...slide} className="space-y-4">
                  {/* Récap trajet */}
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
                      <p className="text-[10px] font-bold uppercase text-[#BA7517]">Départ</p>
                      <p className="mt-1 font-mono text-sm font-bold text-[var(--text-primary)]">
                        {emplOrigineSel?.code || "—"}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        {depotOrigine?.libelle}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-[#378ADD]" aria-hidden />
                    <div
                      className="min-w-0 flex-1 rounded-xl border p-3"
                      style={{
                        borderColor: "rgba(55,138,221,0.4)",
                        background: "color-mix(in srgb, #378ADD 10%, var(--bg-card))",
                      }}
                    >
                      <p className="text-[10px] font-bold uppercase text-[#378ADD]">Arrivée</p>
                      <p className="mt-1 font-mono text-sm font-bold text-[var(--text-primary)]">
                        {emplDestSel?.code || "—"}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        {depotDest?.libelle}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-[#378ADD]" aria-hidden />
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {selectedArticle
                          ? `${selectedArticle.code} — ${selectedArticle.libelle}`
                          : "Article"}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Disponible :{" "}
                      <strong className="tabular-nums text-[var(--text-primary)]">
                        {dispo.toLocaleString("fr-FR")} {selectedArticle?.unite || ""}
                      </strong>
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                      Quantité à déplacer <span className="text-[#E24B4A]">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0.001}
                        step="any"
                        value={quantite}
                        onChange={(e) => {
                          setQuantite(e.target.value);
                          clearError("quantite");
                          setError("");
                        }}
                        onBlur={() => validateField("quantite")}
                        className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-3 text-base tabular-nums text-[var(--text-primary)] focus:border-[#378ADD] focus:outline-none"
                        style={errors.quantite ? inputErrorStyle : undefined}
                        placeholder="Ex. 10"
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={!dispo}
                        onClick={() => setQuantite(String(dispo))}
                        className="shrink-0 rounded-xl border border-[var(--border-default)] px-4 text-sm font-semibold text-[#378ADD] hover:bg-[var(--bg-hover)] disabled:opacity-40"
                      >
                        Max
                      </button>
                    </div>
                    <FormFieldError message={errors.quantite} />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                      Commentaire <span className="font-normal text-[var(--text-muted)]">(optionnel)</span>
                    </label>
                    <input
                      type="text"
                      value={commentaire}
                      onChange={(e) => setCommentaire(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#378ADD] focus:outline-none"
                      placeholder="Motif du déplacement…"
                    />
                  </div>

                  {qtyNum > 0 && emplOrigineSel && emplDestSel ? (
                    <div
                      className="rounded-xl border px-3 py-3 text-center text-sm"
                      style={{
                        borderColor: "rgba(14,165,233,0.35)",
                        background: "color-mix(in srgb, #0EA5E9 10%, var(--bg-card))",
                      }}
                    >
                      Déplacer{" "}
                      <strong className="tabular-nums">
                        {qtyNum.toLocaleString("fr-FR")} {selectedArticle?.unite || ""}
                      </strong>
                      <br />
                      <span className="font-mono font-bold">{emplOrigineSel.code}</span>
                      {" → "}
                      <span className="font-mono font-bold">{emplDestSel.code}</span>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>

            {error ? (
              <p className="mt-4 text-sm text-[#E24B4A]">{error}</p>
            ) : null}
          </div>

          {/* Footer nav */}
          <div className="shrink-0 flex items-center justify-between gap-2 border-t border-[var(--border-default)] px-5 py-4">
            <button
              type="button"
              onClick={step === 0 || (fromStock && step === 1) ? onClose : goBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              {step === 0 || (fromStock && step === 1) ? (
                "Annuler"
              ) : (
                <>
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </>
              )}
            </button>

            {step < 2 ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT}, ${CYAN})`,
                  boxShadow: "0 8px 18px -8px rgba(55,138,221,0.5)",
                }}
              >
                Continuer
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!isValid}
                className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT}, ${CYAN})`,
                  boxShadow: "0 8px 18px -8px rgba(55,138,221,0.5)",
                }}
              >
                Continuer
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
            </motion.form>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
