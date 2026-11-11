import { FolderTree, Layers } from "lucide-react";
import { generateCodeFromName, generateSousFamilleCodeFromName, refsInputClass } from "./refsUtils";
import { useEffect, useMemo, useState } from "react";
import SuggestedCodeInput, { normalizeCodeClient } from "../../../components/forms/SuggestedCodeInput";
import FormFieldError, { INPUT_ERROR_CLASS } from "../../../components/ui/FormFieldError";
import { useFormValidation } from "../../../hooks/useFormValidation";
import { familleNomSchema, sousFamilleSchema } from "../../../validation";
import { parseRefsStatut } from "../refsStatusUi";

const FAMILLE_CODE_INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-[#0f1117] px-3 py-2.5 font-mono text-sm text-slate-200 outline-none focus:border-cyan-500";

const SOUS_FAMILLE_CODE_INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-[#0f1117] px-3 py-2.5 font-mono text-sm text-slate-200 outline-none focus:border-emerald-500";

function useNomDuplicateCheck(nom, existingNoms, validateField, setErrors) {
  const nomDuplicate = useMemo(() => {
    const normalized = nom.trim().toLowerCase();
    return Boolean(normalized && existingNoms.includes(normalized));
  }, [nom, existingNoms]);

  function handleNomBlur() {
    validateField("nom");
    const normalized = nom.trim().toLowerCase();
    if (normalized && existingNoms.includes(normalized)) {
      setErrors((prev) => ({ ...prev, nom: "Ce nom existe déjà" }));
    }
  }

  return { nomDuplicate, handleNomBlur };
}

export function FamilleCreateForm({
  nom,
  description,
  onNomChange,
  onDescriptionChange,
  existingCodes,
  existingNoms = [],
  codeError,
  onClearCodeError,
  onSubmit,
  isPending,
  bare = false,
  onCancel,
}) {
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);

  useEffect(() => {
    if (codeTouched) return;
    setCode(generateCodeFromName(nom, existingCodes));
  }, [nom, existingCodes, codeTouched]);

  const normalizedCode = normalizeCodeClient(code);

  const values = useMemo(() => ({ nom }), [nom]);
  const { errors, validate, validateField, isValid: schemaValid, clearError, setErrors } =
    useFormValidation(familleNomSchema, values);
  const { nomDuplicate, handleNomBlur } = useNomDuplicateCheck(
    nom,
    existingNoms,
    validateField,
    setErrors
  );
  const isValid = schemaValid && !nomDuplicate;

  const fields = (
    <>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Nom</label>
        <input
          className={`${refsInputClass} ${errors.nom ? INPUT_ERROR_CLASS : ""}`}
          placeholder="Nom de la famille"
          value={nom}
          onChange={(e) => {
            onNomChange(e.target.value);
            clearError("nom");
          }}
          onBlur={handleNomBlur}
          autoFocus
        />
        <FormFieldError message={errors.nom} />
      </div>
      <input
        className={refsInputClass}
        placeholder="Description (optionnel)"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
      />
      <div>
        <SuggestedCodeInput
          label="Code"
          value={code}
          codeError={codeError}
          onClearError={onClearCodeError}
          onChange={(v) => {
            setCode(v);
            setCodeTouched(true);
          }}
          onRegenerate={() => {
            setCode(generateCodeFromName(nom, existingCodes));
            setCodeTouched(false);
            onClearCodeError?.();
          }}
          placeholder="Ex: FAM-001"
          inputClassName={FAMILLE_CODE_INPUT_CLASS}
        />
        <p className="mt-1 text-xs text-slate-500">
          Suggestion auto — modifiable avant enregistrement
        </p>
      </div>
    </>
  );

  const submitButton = (
    <button
      type="button"
      disabled={isPending || !isValid || !normalizedCode}
      onClick={() => {
        if (!validate() || nomDuplicate) return;
        onSubmit({ code: normalizedCode });
      }}
      className={
        bare
          ? "flex-1 rounded-xl py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
          : "rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
      }
      style={bare ? { background: "linear-gradient(135deg, #378ADD, #2563a8)" } : undefined}
    >
      {isPending ? "Création…" : "Créer la famille"}
    </button>
  );

  if (bare) {
    return (
      <div className="space-y-4">
        {fields}
        <div className="flex gap-3 pt-1">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border py-2.5 text-sm font-medium"
              style={{
                borderColor: "var(--color-border-tertiary)",
                color: "var(--color-text-secondary)",
              }}
            >
              Annuler
            </button>
          )}
          {submitButton}
        </div>
      </div>
    );
  }

  return (
    <div className="refs-form-expand rounded-xl border border-white/10 bg-[#1a1d27]/80 p-5 backdrop-blur-sm focus-within:border-cyan-500/40">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
          <FolderTree size={18} />
        </div>
        <h3 className="text-sm font-medium text-white">Nouvelle famille</h3>
      </div>
      <div className="space-y-3">
        {fields}
        {submitButton}
      </div>
    </div>
  );
}

export function SousFamilleCreateForm({
  nom,
  familleId,
  onNomChange,
  onFamilleIdChange,
  existingCodes,
  existingNoms = [],
  codeError,
  onClearCodeError,
  familles,
  onSubmit,
  isPending,
  bare = false,
  onCancel,
  activeFamillesOnly = false,
}) {
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);

  const parentCode = useMemo(
    () => familles.find((f) => String(f.id) === String(familleId))?.code ?? "",
    [familles, familleId]
  );

  useEffect(() => {
    if (codeTouched) return;
    setCode(generateSousFamilleCodeFromName(nom, parentCode, existingCodes));
  }, [nom, parentCode, existingCodes, codeTouched]);

  const normalizedCode = normalizeCodeClient(code);

  const values = useMemo(() => ({ nom, familleId }), [nom, familleId]);
  const { errors, validate, validateField, isValid: schemaValid, clearError, setErrors } =
    useFormValidation(sousFamilleSchema, values);
  const { nomDuplicate, handleNomBlur } = useNomDuplicateCheck(
    nom,
    existingNoms,
    validateField,
    setErrors
  );
  const isValid = schemaValid && !nomDuplicate;
  const familleOptions = activeFamillesOnly
    ? familles.filter((x) => parseRefsStatut(x) === "ACTIF")
    : familles;

  const fields = (
    <>
      <div>
        <select
          className={`${refsInputClass} ${errors.familleId ? INPUT_ERROR_CLASS : ""}`}
          value={familleId}
          onChange={(e) => {
            onFamilleIdChange(e.target.value);
            clearError("familleId");
          }}
          onBlur={() => validateField("familleId")}
        >
          <option value="">Famille parente…</option>
          {familleOptions.map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} — {x.nom}
            </option>
          ))}
        </select>
        <FormFieldError message={errors.familleId} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Nom</label>
        <input
          className={`${refsInputClass} ${errors.nom ? INPUT_ERROR_CLASS : ""}`}
          placeholder="Nom de la sous-famille"
          value={nom}
          onChange={(e) => {
            onNomChange(e.target.value);
            clearError("nom");
          }}
          onBlur={handleNomBlur}
        />
        <FormFieldError message={errors.nom} />
      </div>
      <div>
        <SuggestedCodeInput
          label="Code"
          value={code}
          codeError={codeError}
          onClearError={onClearCodeError}
          onChange={(v) => {
            setCode(v);
            setCodeTouched(true);
          }}
          onRegenerate={() => {
            setCode(generateSousFamilleCodeFromName(nom, parentCode, existingCodes));
            setCodeTouched(false);
            onClearCodeError?.();
          }}
          placeholder="Ex: FAM_SF01"
          inputClassName={SOUS_FAMILLE_CODE_INPUT_CLASS}
        />
        <p className="mt-1 text-xs text-slate-500">
          Suggestion auto — modifiable avant enregistrement
        </p>
      </div>
    </>
  );

  const submitButton = (
    <button
      type="button"
      disabled={isPending || !isValid || !normalizedCode}
      onClick={() => {
        if (!validate() || nomDuplicate) return;
        onSubmit({ code: normalizedCode });
      }}
      className={
        bare
          ? "flex-1 rounded-xl py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
          : "rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      }
      style={bare ? { background: "linear-gradient(135deg, #1D9E75, #0f7a5a)" } : undefined}
    >
      {isPending ? "Création…" : "Créer la sous-famille"}
    </button>
  );

  if (bare) {
    return (
      <div className="space-y-4">
        {fields}
        <div className="flex gap-3 pt-1">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border py-2.5 text-sm font-medium"
              style={{
                borderColor: "var(--color-border-tertiary)",
                color: "var(--color-text-secondary)",
              }}
            >
              Annuler
            </button>
          )}
          {submitButton}
        </div>
      </div>
    );
  }

  return (
    <div className="refs-form-expand rounded-xl border border-white/10 bg-[#1a1d27]/80 p-5 backdrop-blur-sm focus-within:border-emerald-500/40">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
          <Layers size={18} />
        </div>
        <h3 className="text-sm font-medium text-white">Nouvelle sous-famille</h3>
      </div>
      <div className="space-y-3">
        {fields}
        {submitButton}
      </div>
    </div>
  );
}
