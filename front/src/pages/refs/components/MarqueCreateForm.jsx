import { useEffect, useMemo, useState } from "react";
import { Tag } from "lucide-react";
import SuggestedCodeInput, { normalizeCodeClient } from "../../../components/forms/SuggestedCodeInput";
import MarqueImagePicker from "./MarqueImagePicker";
import { generateCodeFromName, refsInputClass } from "./refsUtils";
import FormFieldError, { INPUT_ERROR_CLASS } from "../../../components/ui/FormFieldError";
import { useFormValidation } from "../../../hooks/useFormValidation";
import { marqueSchema } from "../../../validation";

const CODE_INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-[#0f1117] px-3 py-2.5 font-mono text-sm text-slate-200 outline-none focus:border-violet-500";

export default function MarqueCreateForm({
  nom,
  onNomChange,
  existingCodes,
  existingNoms = [],
  codeError,
  onClearCodeError,
  imagePreview,
  onPickImage,
  onClearImage,
  onSubmit,
  isPending,
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
    useFormValidation(marqueSchema, values);

  const nomDuplicate = useMemo(() => {
    const normalized = nom.trim().toLowerCase();
    return Boolean(normalized && existingNoms.includes(normalized));
  }, [nom, existingNoms]);

  const isValid = schemaValid && !nomDuplicate;

  function handleNomBlur() {
    validateField("nom");
    const normalized = nom.trim().toLowerCase();
    if (normalized && existingNoms.includes(normalized)) {
      setErrors((prev) => ({ ...prev, nom: "Ce nom existe déjà" }));
    }
  }

  return (
    <div className="refs-form-expand rounded-xl border border-white/10 bg-[#1a1d27]/80 p-5 backdrop-blur-sm transition-all focus-within:border-violet-500/40">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
          <Tag size={18} />
        </div>
        <h3 className="text-sm font-medium text-white">Nouvelle marque</h3>
      </div>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Nom</label>
          <input
            className={`${refsInputClass} ${errors.nom ? INPUT_ERROR_CLASS : ""}`}
            placeholder="Nom de la marque"
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
            placeholder="Ex: MAR-001"
            inputClassName={CODE_INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-slate-500">
            Suggestion auto — modifiable avant enregistrement
          </p>
        </div>
        <MarqueImagePicker
          nom={nom}
          code={normalizedCode}
          previewSrc={imagePreview}
          onPickFile={onPickImage}
          onClear={onClearImage}
          compact
        />
        <button
          type="button"
          disabled={isPending || !isValid || !normalizedCode}
          onClick={() => {
            if (!validate() || nomDuplicate) return;
            onSubmit({ code: normalizedCode });
          }}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
        >
          {isPending ? "Création…" : "Créer la marque"}
        </button>
      </div>
    </div>
  );
}
