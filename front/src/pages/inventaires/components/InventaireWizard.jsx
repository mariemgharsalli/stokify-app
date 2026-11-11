import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Printer,
  X,
} from "lucide-react";
import api, { getAxiosErrorMessage } from "../../../services/api";
import SaisieTable from "./SaisieTable";
import { InventaireValidationFlow } from "./InventaireValidationFlow";
import { useAuthStore } from "../../../store/authStore";
import SuggestedCodeInput, {
  getDuplicateCodeMessage,
  isDuplicateCodeError,
} from "../../../components/forms/SuggestedCodeInput";
import FormFieldError, { INPUT_ERROR_CLASS } from "../../../components/ui/FormFieldError";
import { useFormValidation } from "../../../hooks/useFormValidation";
import { inventaireConfigSchema } from "../../../validation";
import {
  buildDuplicatePrefill,
  printFicheInventaire,
} from "../inventaireUtils";

const STEPS_DEFAULT = ["Config", "Articles", "Saisie", "Validation"];

function StepIndicator({ current, steps = STEPS_DEFAULT, internalStep, lignes = [] }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="mb-5">
      <div className="flex items-center">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold"
                  animate={{ scale: active ? 1.1 : 1 }}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 24 }}
                  style={{
                    background: done
                      ? "linear-gradient(135deg,#059669,#1D9E75)"
                      : active
                        ? "linear-gradient(135deg,#378ADD,#0EA5E9)"
                        : "rgba(255,255,255,0.06)",
                    color: done || active ? "#fff" : "rgba(148,163,184,0.7)",
                    boxShadow: active ? "0 0 22px rgba(55,138,221,.45)" : "none",
                    border: active
                      ? "1px solid rgba(125,211,252,0.45)"
                      : "1px solid rgba(148,163,184,0.12)",
                  }}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </motion.div>
                <span
                  className="hidden text-[10px] font-semibold uppercase tracking-wide sm:block"
                  style={{
                    color: active ? "#7dd3fc" : done ? "#6ee7b7" : "rgba(148,163,184,0.55)",
                  }}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full"
                    initial={false}
                    animate={{ width: done ? "100%" : "0%" }}
                    transition={{ duration: reduceMotion ? 0 : 0.45 }}
                    style={{ background: "linear-gradient(90deg,#1D9E75,#6ee7b7)" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {internalStep === 2 && lignes.length > 0 && (() => {
        const saisis = lignes.filter((l) => l.qteReelle != null).length;
        const pct = Math.round((saisis / lignes.length) * 100);
        return (
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full"
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.5 }}
                style={{
                  background: "linear-gradient(90deg,#378ADD,#0EA5E9,#1D9E75)",
                  boxShadow: "0 0 12px rgba(14,165,233,0.4)",
                }}
              />
            </div>
            <p className="mt-1 text-center text-[10px] text-sky-200/50">
              {saisis}/{lignes.length} articles saisis ({pct}%)
            </p>
          </div>
        );
      })()}
    </div>
  );
}

export default function InventaireWizard({
  open,
  onClose,
  depots = [],
  initialInventaire = null,
  duplicateFrom = null,
  initialStep = 0,
  onSuccess,
  onCreated,
}) {
  const user = useAuthStore((s) => s.user);
  const reduceMotion = useReducedMotion();
  const responsableLabel =
    user?.prenom || user?.nom
      ? `${user.prenom || ""} ${user.nom || ""}`.trim()
      : "Responsable logistique";
  const [step, setStep] = useState(initialStep);
  const [slideDir, setSlideDir] = useState(1);
  const [error, setError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeFading, setCodeFading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [conflictInv, setConflictInv] = useState(null);

  const [code, setCode] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [depotId, setDepotId] = useState("");
  const [typeInv, setTypeInv] = useState("complet");
  const [modeAveugle, setModeAveugle] = useState(false);
  const [methode, setMethode] = useState("simple");
  const [note, setNote] = useState("");

  const [stockLines, setStockLines] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [zonesSelectionnees, setZonesSelectionnees] = useState([]);
  const [emplacements, setEmplacements] = useState([]);
  const [selectionMode, setSelectionMode] = useState("article");
  const [artSearch, setArtSearch] = useState("");

  const [inventaire, setInventaire] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [validationAction, setValidationAction] = useState("ajuster");
  const [commentaire, setCommentaire] = useState("");
  /** review | success — sous-étapes de validation (pattern TransfertModal) */
  const [validationPhase, setValidationPhase] = useState("review");
  const [validationResult, setValidationResult] = useState(null);
  const [togglingRecomptageId, setTogglingRecomptageId] = useState(null);

  const isNewWizard = open && !initialInventaire && !duplicateFrom;
  const isCodeLocked = Boolean(initialInventaire);

  const configValues = useMemo(
    () => ({
      reference: code,
      date,
      depotId: depotId ? Number(depotId) : "",
      typeInventaire: typeInv,
      modeAveugle,
      note,
    }),
    [code, date, depotId, typeInv, modeAveugle, note]
  );

  const {
    errors: fieldErrors,
    validate: validateConfig,
    validateField,
    isValid: isConfigValid,
    clearError,
    clearErrors,
  } = useFormValidation(inventaireConfigSchema, configValues);

  const fetchNextCode = useCallback(async () => {
    setCodeFading(true);
    try {
      const { data } = await api.get("inventaires/next-code");
      if (data?.code) {
        setTimeout(() => {
          setCode(data.code);
          setCodeFading(false);
        }, 75);
      } else {
        setCodeFading(false);
      }
    } catch {
      setCodeFading(false);
    }
  }, []);

  const regenerateCode = useCallback(async () => {
    await fetchNextCode();
  }, [fetchNextCode]);
  const recomptagePending = useMemo(
    () => (lignes || []).filter((l) => l.recomptageDemande),
    [lignes]
  );

  const { data: depotConflictQuery } = useQuery({
    queryKey: ["inventaire-depot-en-cours", depotId],
    queryFn: () =>
      api
        .get("inventaires", { params: { depotId, statut: "EN_COURS", limit: 1 } })
        .then((r) => {
          const items = r.data?.items ?? [];
          return items[0] ?? null;
        }),
    enabled: isNewWizard && !!depotId,
  });

  const depotConflict = conflictInv ?? depotConflictQuery ?? null;

  useEffect(() => {
    if (!open) setConflictInv(null);
  }, [open, depotId]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setCodeError("");
    clearErrors();
    setValidationAction("ajuster");
    setCommentaire("");
    setValidationPhase("review");
    setValidationResult(null);

    if (duplicateFrom) {
      const pre = buildDuplicatePrefill(duplicateFrom);
      setStep(0);
      setInventaire(null);
      setLignes([]);
      setCode(pre.code);
      setDepotId(pre.depotId || (depots[0]?.id ? String(depots[0].id) : ""));
      setDate(new Date().toISOString().slice(0, 10));
      setNote(pre.note);
      setTypeInv(pre.typeInv);
      setModeAveugle(Boolean(pre.modeAveugle));
      setMethode("simple");
      setSelectedIds(new Set(pre.articleIds));
      setZonesSelectionnees([]);
      setArtSearch("");
      return;
    }

    setStep(initialStep);
    if (initialInventaire) {
      setInventaire(initialInventaire);
      setLignes(initialInventaire.lignes || []);
      setCode(initialInventaire.reference);
      setDepotId(String(initialInventaire.depotId));
      setDate(initialInventaire.date?.slice?.(0, 10) || new Date().toISOString().slice(0, 10));
      setNote("");
      setTypeInv(initialInventaire.typeInventaire || "complet");
      setModeAveugle(Boolean(initialInventaire.modeAveugle));
      setSelectedIds(new Set());
      setZonesSelectionnees([]);
    } else {
      setInventaire(null);
      setLignes([]);
      setCode("");
      setDepotId(depots[0]?.id ? String(depots[0].id) : "");
      setNote("");
      setTypeInv("complet");
      setModeAveugle(false);
      setSelectedIds(new Set());
      setZonesSelectionnees([]);
    }
  }, [open, initialInventaire, duplicateFrom, initialStep, depots, clearErrors]);

  useEffect(() => {
    if (!open || initialInventaire || duplicateFrom) return;
    fetchNextCode();
  }, [open, initialInventaire, duplicateFrom, fetchNextCode]);

  useEffect(() => {
    if (!open) return;
    setZonesSelectionnees([]);
    setSelectionMode("article");
  }, [open, typeInv]);

  useEffect(() => {
    if (!open || !depotId || !Number(depotId)) return;
    api
      .get("stock", { params: { depotId: Number(depotId), limit: 2000 } })
      .then((r) => {
        const items = r.data?.items ?? r.data ?? [];
        setStockLines(Array.isArray(items) ? items : []);
      })
      .catch(() => setStockLines([]));
  }, [open, depotId]);

  useEffect(() => {
    if (!open || !depotId) {
      setEmplacements([]);
      setZonesSelectionnees([]);
      return;
    }
    api
      .get("emplacements", { params: { depotId: Number(depotId) } })
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : r.data?.items ?? [];
        setEmplacements(items);
      })
      .catch(() => setEmplacements([]));
    setZonesSelectionnees([]);
  }, [open, depotId]);

  const zones = useMemo(() => {
    const map = {};
    for (const e of emplacements) {
      const parts = e.code?.split(/[-/]/) ?? [];
      const prefix =
        parts.length >= 2
          ? `${parts[0]}-${parts[1]}`.toUpperCase()
          : (parts[0] ?? "?").toUpperCase();
      if (!map[prefix]) map[prefix] = { zone: prefix, label: prefix, emplacements: [] };
      map[prefix].emplacements.push(e);
    }
    const result = Object.values(map).sort((a, b) => a.zone.localeCompare(b.zone));
    if (result.length === 1 && result[0].emplacements.length > 1) {
      return emplacements.map((e) => ({
        zone: e.code,
        label: e.libelle || e.code,
        emplacements: [e],
      }));
    }
    return result;
  }, [emplacements]);

  const dedupedStock = useMemo(() => {
    const map = new Map();
    for (const s of stockLines.filter((x) => Number(x.quantite) > 0)) {
      const aid = s.articleId ?? s.article?.id;
      if (!aid) continue;
      if (!map.has(aid)) {
        map.set(aid, { ...s, _emplacementCount: 1 });
      } else {
        const existing = map.get(aid);
        existing._emplacementCount += 1;
        existing.quantite = Number(existing.quantite) + Number(s.quantite);
      }
    }
    return [...map.values()];
  }, [stockLines]);

  const filteredStock = useMemo(() => {
    const q = artSearch.trim().toLowerCase();
    if (!q) return dedupedStock;
    return dedupedStock.filter(
      (s) =>
        s.article?.code?.toLowerCase().includes(q) ||
        s.article?.libelle?.toLowerCase().includes(q)
    );
  }, [dedupedStock, artSearch]);

  const duplicateArticles = useMemo(() => {
    if (!duplicateFrom?.lignes?.length) return [];
    return duplicateFrom.lignes.map((l) => ({
      id: l.articleId ?? l.article?.id,
      code: l.article?.code,
      libelle: l.article?.libelle,
    }));
  }, [duplicateFrom]);

  const go = (next) => {
    setSlideDir(next > step ? 1 : -1);
    setStep(next);
  };

  const resumeExisting = async (invId) => {
    if (!invId) return;
    setLoading(true);
    setError("");
    try {
      const { data: full } = await api.get(`inventaires/${invId}`);
      setInventaire(full);
      setLignes(
        (full.lignes || []).map((l) => ({
          ...l,
          qteReelle: l.qteReelle ?? null,
          ecart: l.ecart ?? null,
        }))
      );
      setCode(full.reference);
      setDepotId(String(full.depotId));
      setTypeInv(full.typeInventaire || "complet");
      setModeAveugle(Boolean(full.modeAveugle));
      setConflictInv(null);
      onSuccess?.();
      go(2);
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const createInventaire = async () => {
    if (!validateConfig()) {
      setError("Corrigez les champs en rouge avant de continuer.");
      return;
    }

    const articleIds =
      typeInv === "partiel" ? [...selectedIds].map(Number).filter((id) => id > 0) : undefined;

    if (typeInv === "partiel" && (!articleIds || !articleIds.length)) {
      setError("Sélectionnez au moins un article à inventorier.");
      return;
    }
    if (typeInv === "tournant" && zonesSelectionnees.length === 0) {
      setError("Sélectionnez au moins une zone à inventorier.");
      return;
    }

    let emplacementIds;
    if (typeInv === "tournant" && zonesSelectionnees.length > 0) {
      emplacementIds = zones
        .filter((z) => zonesSelectionnees.includes(z.zone))
        .flatMap((z) => z.emplacements.map((e) => e.id));
    }

    setLoading(true);
    setError("");
    try {
      const payload = {
        reference: code.trim(),
        date,
        depotId: Number(depotId),
        populateFromStock: typeInv === "complet",
        typeInventaire: typeInv,
        modeAveugle,
        ...(typeInv === "partiel" ? { articleIds } : {}),
        ...(typeInv === "tournant" ? { emplacementIds, zonesSelectionnees } : {}),
      };
      const { data } = await api.post("inventaires", payload);
      onSuccess?.();

      if (duplicateFrom) {
        onCreated?.(data.id);
        onClose();
        return;
      }

      const nextLignes = (data.lignes || []).map((l) => ({
        ...l,
        qteReelle: l.qteReelle ?? null,
        ecart: l.ecart ?? null,
      }));
      setInventaire(data);
      setLignes(nextLignes);
      setModeAveugle(Boolean(data.modeAveugle));
      go(2);
    } catch (e) {
      const details = e.response?.data?.details;
      if (isDuplicateCodeError(e)) {
        setCodeError(getDuplicateCodeMessage(e));
        go(0);
      }
      if (
        e.response?.status === 409 &&
        e.response?.data?.code === "DEPOT_INVENTAIRE_EN_COURS"
      ) {
        setConflictInv({
          id: details?.existingId,
          reference: details?.existingReference,
        });
      }
      setError(getAxiosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const saveLignes = useCallback(async () => {
    if (!inventaire?.id) return;
    const payload = lignes.map((l) => ({ id: l.id, qteReelle: l.qteReelle }));
    const res = await api.put(`inventaires/${inventaire.id}/lignes`, { lignes: payload });
    if (Array.isArray(res.data?.lignes)) {
      setLignes(res.data.lignes);
    }
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  }, [inventaire?.id, lignes]);

  useEffect(() => {
    if (!open || step !== 2 || !inventaire?.id) return;
    const t = setInterval(() => {
      saveLignes().catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [open, step, inventaire?.id, saveLignes]);

  const handleLigneChange = (id, qteReelle) => {
    setLignes((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const ecart = qteReelle != null ? qteReelle - Number(l.qteTheorique) : null;
        return {
          ...l,
          qteReelle,
          ecart,
          valeurEcart: null,
          ...(qteReelle !== l.qteReelle ? { recomptageDemande: false } : {}),
        };
      })
    );
  };

  const handleToggleRecomptage = async (ligneId) => {
    if (!inventaire?.id) return;
    setTogglingRecomptageId(ligneId);
    setError("");
    try {
      const { data } = await api.patch(
        `inventaires/${inventaire.id}/lignes/${ligneId}/recomptage`
      );
      setLignes((prev) => prev.map((l) => (l.id === ligneId ? { ...l, ...data } : l)));
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    } finally {
      setTogglingRecomptageId(null);
    }
  };

  const finishValidation = useCallback(() => {
    onSuccess?.();
    onClose();
  }, [onSuccess, onClose]);

  const validate = async () => {
    setLoading(true);
    setError("");
    try {
      await saveLignes();
      const { data } = await api.post(`inventaires/${inventaire.id}/valider`, {
        action: validationAction,
        commentaire,
      });
      if (validationAction === "rejeter") {
        setInventaire(data);
        setLignes(data.lignes || []);
        setValidationPhase("review");
        go(2);
        return;
      }
      setValidationResult(data);
      setValidationPhase("success");
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const STEPS =
    typeInv === "complet"
      ? ["Config", "Saisie", "Validation"]
      : ["Config", "Articles", "Saisie", "Validation"];

  const stepperIndex =
    typeInv === "complet" ? ({ 0: 0, 2: 1, 3: 2 }[step] ?? step) : step;

  const inputCls =
    "w-full rounded-xl border bg-[rgba(15,23,42,0.65)] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20";
  const border = { borderColor: "rgba(56,189,248,0.18)" };

  return (
    <AnimatePresence>
      {open ? (
    <motion.div
      key="inv-wizard-backdrop"
      className="fixed inset-0 z-[240] flex items-center justify-center p-3 sm:p-4"
      style={{
        background: "rgba(6,10,20,.72)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <motion.div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background:
            "linear-gradient(165deg, rgba(17,34,66,0.98) 0%, rgba(12,22,40,0.98) 55%, rgba(10,18,32,0.99) 100%)",
          borderColor: "rgba(56,189,248,0.22)",
          boxShadow:
            "0 24px 64px -16px rgba(0,0,0,0.65), inset 0 1px 0 rgba(125,211,252,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
        initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(125,211,252,0.5), transparent)",
          }}
          aria-hidden
        />

        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "rgba(56,189,248,0.14)" }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300/60">
              Mission de contrôle
            </p>
            <h2 className="font-display text-lg font-bold text-white">
              {duplicateFrom ? "Dupliquer l'inventaire" : "Nouvel inventaire"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/20 text-sky-200/70 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <StepIndicator
            current={stepperIndex}
            steps={STEPS}
            internalStep={step}
            lignes={lignes}
          />

          {isNewWizard && depotConflict?.id && step < 2 && (
            <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 sm:flex-row sm:items-center">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  Un inventaire est déjà en cours pour ce dépôt :{" "}
                  <strong className="font-mono text-amber-100">{depotConflict.reference}</strong>.
                  Terminez-le, annulez-le depuis la liste, ou reprenez-le directement.
                </span>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => resumeExisting(depotConflict.id)}
                className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#378ADD,#0EA5E9)" }}
              >
                Reprendre l&apos;inventaire
              </button>
            </div>
          )}

          <AnimatePresence mode="wait" custom={slideDir}>
          <motion.div
            key={step}
            className="wizard-slide"
            custom={slideDir}
            initial={
              reduceMotion
                ? false
                : { opacity: 0, x: slideDir > 0 ? 28 : -28 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion
                ? undefined
                : { opacity: 0, x: slideDir > 0 ? -24 : 24 }
            }
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-sky-300">Configuration de l&apos;inventaire</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <SuggestedCodeInput
                      id="inventaire-reference"
                      name="reference"
                      label="Code inventaire *"
                      value={code}
                      locked={isCodeLocked}
                      disabled={isCodeLocked}
                      codeError={codeError}
                      onClearError={() => setCodeError("")}
                      onRegenerate={!isCodeLocked && !duplicateFrom ? regenerateCode : undefined}
                      onChange={(v) => {
                        setCodeError("");
                        setCode(v);
                        clearError("reference");
                      }}
                      onFieldBlur={() => validateField("reference")}
                      placeholder="INV-001"
                      maxLength={50}
                      className="text-xs"
                      inputClassName={`${inputCls} font-mono transition-opacity duration-150 ${
                        codeFading ? "opacity-30" : "opacity-100"
                      } ${fieldErrors.reference || codeError ? INPUT_ERROR_CLASS : ""}`}
                    />
                    <FormFieldError message={fieldErrors.reference} />
                    {!isCodeLocked && !duplicateFrom ? (
                      <p className="mt-1 text-[10px] text-slate-500">
                        Suggestion auto — modifiable avant enregistrement
                      </p>
                    ) : null}
                  </div>
                  <label className="block text-xs text-slate-500">
                    Date *
                    <input
                      type="date"
                      className={`${inputCls} ${fieldErrors.date ? INPUT_ERROR_CLASS : ""}`}
                      style={border}
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        clearError("date");
                      }}
                      onBlur={() => validateField("date")}
                    />
                    <FormFieldError message={fieldErrors.date} />
                  </label>
                  <label className="block text-xs text-slate-500 sm:col-span-2">
                    Dépôt *
                    <select
                      className={`${inputCls} ${fieldErrors.depotId ? INPUT_ERROR_CLASS : ""}`}
                      style={border}
                      value={depotId}
                      onChange={(e) => {
                        setDepotId(e.target.value);
                        clearError("depotId");
                      }}
                      onBlur={() => validateField("depotId")}
                      disabled={!!duplicateFrom}
                    >
                      <option value="">Choisir…</option>
                      {depots.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.code} — {d.libelle}
                        </option>
                      ))}
                    </select>
                    <FormFieldError message={fieldErrors.depotId} />
                  </label>
                  <label className="block text-xs text-slate-500 sm:col-span-2">
                    Responsable
                    <input
                      className={`${inputCls} opacity-80`}
                      style={border}
                      value={responsableLabel}
                      readOnly
                      tabIndex={-1}
                    />
                  </label>
                </div>
                <fieldset>
                  <legend className="mb-2 text-xs text-slate-500">Type d&apos;inventaire</legend>
                  {[
                    ["complet", "Inventaire complet (tous les articles en stock)"],
                    ["partiel", "Inventaire partiel (sélection manuelle)"],
                    ["tournant", "Inventaire tournant (par zone / emplacement)"],
                  ].map(([v, lbl]) => (
                    <label key={v} className="mb-1 flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="radio"
                        name="type"
                        checked={typeInv === v}
                        disabled={!!duplicateFrom}
                        onChange={() => setTypeInv(v)}
                      />
                      {lbl}
                    </label>
                  ))}
                </fieldset>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 sm:col-span-2" style={border}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sky-500"
                    checked={modeAveugle}
                    disabled={!!duplicateFrom}
                    onChange={(e) => setModeAveugle(e.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-200">Comptage à l&apos;aveugle</span>
                    <span className="block text-[11px] text-slate-500">
                      Masque la quantité théorique pendant la saisie (recommandé pour un comptage indépendant).
                    </span>
                  </span>
                </label>
                <label className="block text-xs text-slate-500">
                  {duplicateFrom ? "Commentaire" : "Notes"}
                  <textarea className={`${inputCls} min-h-[72px]`} style={border} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-sky-300">Périmètre de l&apos;inventaire</h3>

                {duplicateFrom && (
                  <p className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                    {selectedIds.size} article(s) repris de l&apos;inventaire source. Les quantités réelles
                    seront à saisir (réinitialisées à vide).
                  </p>
                )}

                {typeInv === "complet" ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                    ✅ Tous les articles du dépôt ({dedupedStock.length} articles, {stockLines.length} lignes
                    de stock) seront inclus.
                  </div>
                ) : typeInv === "tournant" ? (
                  <>
                    <p className="text-xs text-slate-500">
                      Chaque zone correspond à un groupe d&apos;emplacements physiques dans le dépôt.
                    </p>
                    {zones.length === 0 ? (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                        ⚠ Aucun emplacement configuré pour ce dépôt.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {zones.map((z) => {
                            const selected = zonesSelectionnees.includes(z.zone);
                            const empIds = new Set(z.emplacements.map((e) => e.id));
                            const artCount = stockLines.filter((s) => empIds.has(s.emplacementId)).length;
                            return (
                              <button
                                key={z.zone}
                                type="button"
                                onClick={() =>
                                  setZonesSelectionnees((prev) =>
                                    prev.includes(z.zone)
                                      ? prev.filter((x) => x !== z.zone)
                                      : [...prev, z.zone]
                                  )
                                }
                                className="flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-200 hover:scale-105 active:scale-95"
                                style={{
                                  background: selected ? "rgba(124,58,237,.15)" : "#0f1117",
                                  borderColor: selected ? "#378ADD" : "#2d3148",
                                  boxShadow: selected ? "0 0 16px rgba(124,58,237,.2)" : "none",
                                }}
                              >
                                <div
                                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black"
                                  style={{
                                    background: selected ? "rgba(124,58,237,.3)" : "#374151",
                                    color: selected ? "#c4b5fd" : "#9ca3af",
                                  }}
                                >
                                  {z.zone.charAt(0)}
                                </div>
                                <p
                                  className="text-center text-[11px] font-semibold leading-tight"
                                  style={{ color: selected ? "#c4b5fd" : "#e2e8f0" }}
                                >
                                  {z.label}
                                </p>
                                <p className="text-[10px]" style={{ color: "#9ca3af" }}>
                                  {z.emplacements.length} empl. · {artCount} art.
                                </p>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-slate-500">
                          {zonesSelectionnees.length} zone(s) sélectionnée(s)
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex rounded-xl border border-white/10 p-1" style={{ background: "#0f1117" }}>
                      {[
                        ["article", "📦 Par article"],
                        ["zone", "🗺️ Par zone / emplacement"],
                      ].map(([v, lbl]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setSelectionMode(v)}
                          className="flex-1 rounded-lg py-2 text-xs font-semibold transition-all duration-200"
                          style={{
                            background: selectionMode === v ? "#378ADD" : "transparent",
                            color: selectionMode === v ? "#fff" : "#9ca3af",
                          }}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    {selectionMode === "article" && (
                      <div className="space-y-2">
                        {duplicateFrom && duplicateArticles.length > 0 && (
                          <ul
                            className="max-h-32 space-y-1 overflow-y-auto rounded-lg border p-2 text-xs"
                            style={{ ...border, background: "#0f1117" }}
                          >
                            {duplicateArticles.map((a) => (
                              <li key={a.id} className="flex gap-2 text-slate-300">
                                <span className="font-mono text-sky-300">{a.code}</span>
                                <span className="truncate">{a.libelle}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="search"
                            placeholder="Rechercher un article…"
                            className="w-full rounded-lg border bg-[#0f1117] px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-400/60"
                            style={{ borderColor: "#2d3148" }}
                            value={artSearch}
                            onChange={(e) => setArtSearch(e.target.value)}
                          />
                          {selectedIds.size > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedIds(new Set())}
                              className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition-colors hover:text-white"
                            >
                              Tout effacer
                            </button>
                          )}
                        </div>

                        <div
                          className="max-h-60 overflow-y-auto rounded-xl border"
                          style={{ borderColor: "#2d3148" }}
                        >
                          {filteredStock.length === 0 ? (
                            <p className="p-4 text-center text-xs text-slate-500">
                              Aucun article avec du stock dans ce dépôt
                            </p>
                          ) : (
                            filteredStock.map((s) => {
                              const aid = s.articleId ?? s.article?.id;
                              const checked = selectedIds.has(aid);
                              return (
                                <label
                                  key={aid}
                                  className="flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 text-sm last:border-0 transition-colors hover:bg-white/5"
                                  style={{
                                    borderColor: "#2d3148",
                                    background: checked ? "rgba(124,58,237,.07)" : "transparent",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    className="accent-sky-500"
                                    onChange={() =>
                                      setSelectedIds((p) => {
                                        const n = new Set(p);
                                        if (n.has(aid)) n.delete(aid);
                                        else n.add(aid);
                                        return n;
                                      })
                                    }
                                  />
                                  <span className="font-mono text-xs text-sky-400">{s.article?.code}</span>
                                  <span className="flex-1 text-slate-300">{s.article?.libelle}</span>
                                  <span className="flex items-center gap-1.5">
                                    {s._emplacementCount > 1 && (
                                      <span
                                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                        style={{
                                          background: "rgba(124,58,237,.15)",
                                          color: "#c4b5fd",
                                        }}
                                        title={`Réparti sur ${s._emplacementCount} emplacements — ${s._emplacementCount} lignes créées`}
                                      >
                                        {s._emplacementCount} empl.
                                      </span>
                                    )}
                                    <span className="text-xs text-slate-500">
                                      {Number(s.quantite).toLocaleString("fr-FR")} u.
                                    </span>
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {selectedIds.size} / {dedupedStock.length} articles sélectionnés
                          {selectedIds.size > 0 &&
                            ` — ${stockLines.filter((s) => selectedIds.has(s.articleId ?? s.article?.id)).length} lignes d'inventaire créées`}
                        </p>
                      </div>
                    )}

                    {selectionMode === "zone" && (
                      <div className="space-y-3">
                        {zones.length === 0 ? (
                          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                            ⚠ Aucun emplacement configuré pour ce dépôt. Utilisez la sélection par article.
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-slate-500">
                              Cliquez sur une zone — tous ses articles sont sélectionnés automatiquement.
                            </p>
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                              {zones.map((z) => {
                                const selected = zonesSelectionnees.includes(z.zone);
                                const empIds = new Set(z.emplacements.map((e) => e.id));
                                const artCount = stockLines.filter((s) => empIds.has(s.emplacementId)).length;
                                return (
                                  <button
                                    key={z.zone}
                                    type="button"
                                    onClick={() => {
                                      const isNowSelected = !selected;
                                      setZonesSelectionnees((p) =>
                                        isNowSelected
                                          ? [...p, z.zone]
                                          : p.filter((x) => x !== z.zone)
                                      );
                                      const artInZone = stockLines
                                        .filter((s) => empIds.has(s.emplacementId))
                                        .map((s) => s.articleId ?? s.article?.id)
                                        .filter(Boolean);
                                      setSelectedIds((p) => {
                                        const n = new Set(p);
                                        artInZone.forEach((id) =>
                                          isNowSelected ? n.add(id) : n.delete(id)
                                        );
                                        return n;
                                      });
                                    }}
                                    className="flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-200 hover:scale-105 active:scale-95"
                                    style={{
                                      background: selected ? "rgba(124,58,237,.15)" : "#0f1117",
                                      borderColor: selected ? "#378ADD" : "#2d3148",
                                      boxShadow: selected ? "0 0 16px rgba(124,58,237,.2)" : "none",
                                    }}
                                  >
                                    <div
                                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black"
                                      style={{
                                        background: selected ? "rgba(124,58,237,.3)" : "#374151",
                                        color: selected ? "#c4b5fd" : "#9ca3af",
                                      }}
                                    >
                                      {z.zone.charAt(0)}
                                    </div>
                                    <p
                                      className="text-center text-[11px] font-semibold leading-tight"
                                      style={{ color: selected ? "#c4b5fd" : "#e2e8f0" }}
                                    >
                                      {z.label}
                                    </p>
                                    <p className="text-[10px]" style={{ color: "#9ca3af" }}>
                                      {z.emplacements.length} empl. · {artCount} art.
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-xs text-slate-500">
                              {zonesSelectionnees.length} zone(s) · {selectedIds.size} articles sélectionnés
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-sky-300">Saisie des quantités réelles</h3>
                  <button
                    type="button"
                    onClick={() =>
                      printFicheInventaire(
                        { ...inventaire, lignes, depot: depots.find((d) => String(d.id) === depotId) },
                        { masquerTheorique: Boolean(inventaire?.modeAveugle ?? modeAveugle), titre: "Fiche de comptage terrain" }
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300 transition-colors hover:text-sky-100"
                  >
                    <Printer size={13} />
                    Imprimer fiche terrain
                  </button>
                </div>
                {recomptagePending.length > 0 && (
                  <div className="mb-3 rounded-xl border border-orange-500/35 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
                    Recomptage en attente pour :{" "}
                    <strong>
                      {recomptagePending.map((l) => l.article?.code || `#${l.id}`).join(", ")}
                    </strong>
                    . Re-saisissez la quantité réelle sur chaque ligne concernée.
                  </div>
                )}
                <SaisieTable
                  lignes={lignes}
                  modeAveugle={Boolean(inventaire?.modeAveugle ?? modeAveugle)}
                  inventaireStatut={inventaire?.statut || "EN_COURS"}
                  showRecomptage={inventaire?.statut === "EN_COURS"}
                  onToggleRecomptage={handleToggleRecomptage}
                  togglingRecomptageId={togglingRecomptageId}
                  onChange={handleLigneChange}
                  onSave={saveLignes}
                />
              </div>
            )}

            {step === 3 && (
              <InventaireValidationFlow
                phase={validationPhase}
                lignes={lignes}
                recomptagePending={recomptagePending}
                validationAction={validationAction}
                commentaire={commentaire}
                confirming={loading}
                validationResult={validationResult}
                onBackToSaisie={() => {
                  setValidationPhase("review");
                  go(2);
                }}
                onConfirm={validate}
                onActionChange={setValidationAction}
                onCommentaireChange={setCommentaire}
                onToggleRecomptage={handleToggleRecomptage}
                togglingRecomptageId={togglingRecomptageId}
                onDone={finishValidation}
              />
            )}
          </motion.div>
          </AnimatePresence>

          {error && (
            <motion.div
              className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p>{error}</p>
              {depotConflict?.id && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => resumeExisting(depotConflict.id)}
                  className="mt-2 rounded-xl border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-200 transition-colors hover:bg-sky-500/20 disabled:opacity-50"
                >
                  Reprendre {depotConflict.reference}
                </button>
              )}
            </motion.div>
          )}
        </div>

        {!(step === 3) ? (
        <div
          className="flex justify-between gap-2 border-t px-5 py-4"
          style={{ borderColor: "rgba(56,189,248,0.14)", background: "rgba(8,15,28,0.55)" }}
        >
          <button
            type="button"
            disabled={step === 0 || loading}
            onClick={() => {
              const prevStep = step === 2 && typeInv === "complet" ? 0 : step - 1;
              go(prevStep);
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-sky-400/20 px-4 py-2 text-sm text-sky-100/80 transition hover:bg-white/5 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Retour
          </button>
          {(step === 0 || step === 1) && (
            <button
              type="button"
              disabled={
                loading ||
                (isNewWizard && !!depotConflict?.id) ||
                (step === 0 && !isConfigValid) ||
                (step === 1 && typeInv !== "complet" && selectedIds.size === 0 && typeInv !== "tournant") ||
                (step === 1 && typeInv === "tournant" && zonesSelectionnees.length === 0)
              }
              onClick={() => {
                if (step === 0) {
                  if (!validateConfig()) {
                    setError("Corrigez les champs en rouge avant de continuer.");
                    return;
                  }
                  typeInv === "complet" ? createInventaire() : go(1);
                } else {
                  createInventaire();
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg,#378ADD,#0EA5E9)",
                boxShadow: "0 8px 22px -8px rgba(55,138,221,0.55)",
              }}
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Création…
                </>
              ) : step === 0 && typeInv === "complet" ? (
                <>
                  Créer et continuer <ChevronRight className="h-4 w-4" />
                </>
              ) : step === 1 ? (
                <>
                  {duplicateFrom ? "Enregistrer" : "Créer et continuer"}{" "}
                  <ChevronRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Suivant <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              onClick={async () => {
                await saveLignes();
                setValidationPhase("review");
                go(3);
              }}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg,#378ADD,#0EA5E9)",
                boxShadow: "0 8px 22px -8px rgba(55,138,221,0.55)",
              }}
            >
              Valider la saisie
            </button>
          )}
        </div>
        ) : null}
      </motion.div>

      <AnimatePresence>
        {saveToast ? (
          <motion.div
            key="autosave"
            className="fixed bottom-6 right-6 z-[250] flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm text-emerald-300 shadow-xl"
            style={{
              background: "#161927",
              borderColor: "#10b981",
              boxShadow: "0 0 20px rgba(16,185,129,.15)",
            }}
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          >
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Sauvegardé automatiquement
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
