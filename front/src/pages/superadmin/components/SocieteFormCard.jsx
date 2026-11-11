import { Building2, Mail, Map, MapPin, PlusCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import SuggestedCodeInput, { normalizeCodeClient } from "../../../components/forms/SuggestedCodeInput";
import { generateCodeFromName } from "../../refs/components/refsUtils";
import FormFieldError, { INPUT_ERROR_CLASS } from "../../../components/ui/FormFieldError";
import { useFormValidation } from "../../../hooks/useFormValidation";
import { societeSchema } from "../../../validation";
import { VisibilityToggle } from "./AnimatedSwitch";
import SocieteLogoUpload from "./SocieteLogoUpload";
import SocieteMapSection from "./SocieteMapSection";
import ValidationRulesList from "./ValidationRulesList";
import {
  ROSE_GRADIENT,
  ROSE_GRADIENT_GLOW,
  glassCardClass,
  inputLabelClass,
  inputWithIconClass,
  primaryBtnClass,
} from "./superadminTheme";

const SOCIETE_CODE_INPUT_CLASS = `${inputWithIconClass} font-mono uppercase focus:border-rose-500 dark:focus:border-rose-400`;

function StyledField({ label, icon: Icon, children, className = "" }) {
  return (
    <div className={className}>
      <label className={inputLabelClass}>{label}</label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        )}
        {children}
      </div>
    </div>
  );
}

function FormSection({ title, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-white/[0.06] dark:bg-white/[0.02] ${className}`}>
      {title && (
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

export default function SocieteFormCard({
  form,
  setForm,
  existingCodes = [],
  existingNoms = [],
  codeError,
  onClearCodeError,
  formSuccess,
  formError,
  setFormError,
  createMutation,
  createLogoFile,
  pickCreateLogoFile,
  createLogoPreviewUrl,
  latitude,
  setLatitude,
  longitude,
  setLongitude,
}) {
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);

  useEffect(() => {
    if (codeTouched) return;
    setCode(generateCodeFromName(form.nom, existingCodes));
  }, [form.nom, existingCodes, codeTouched]);

  const normalizedCode = normalizeCodeClient(code);

  const values = useMemo(
    () => ({
      nom: form.nom,
      code: normalizedCode,
      email: form.email,
      adresse: form.adresse,
      ville: form.ville,
      telephone: form.telephone,
    }),
    [form, normalizedCode]
  );
  const { errors, validate, validateField, isValid: schemaValid, clearError, setErrors } =
    useFormValidation(societeSchema, values);

  const nomDuplicate = useMemo(() => {
    const normalized = form.nom.trim().toLowerCase();
    return Boolean(normalized && existingNoms.includes(normalized));
  }, [form.nom, existingNoms]);

  const isValid =
    schemaValid && !nomDuplicate && Boolean(normalizedCode) && normalizedCode.length >= 3;
  const isPending = createMutation.isPending;

  function handleNomBlur() {
    validateField("nom");
    const normalized = form.nom.trim().toLowerCase();
    if (normalized && existingNoms.includes(normalized)) {
      setErrors((prev) => ({ ...prev, nom: "Ce nom existe déjà" }));
    }
  }

  function clearLogo() {
    pickCreateLogoFile(null);
  }

  return (
    <section className={`superadmin-form-expand ${glassCardClass} p-6`}>
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-gradient-to-br from-rose-50 to-fuchsia-50 dark:border-rose-500/25 dark:from-rose-500/15 dark:to-fuchsia-500/10">
          <Building2 className="h-5 w-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Ajouter une société</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Créez un nouveau tenant — articles, clients et dépôts dédiés
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <FormSection title="Informations générales">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <StyledField label="Nom" icon={Building2}>
              <input
                className={`${inputWithIconClass} ${errors.nom ? INPUT_ERROR_CLASS : ""}`}
                placeholder="Nom de la société"
                value={form.nom}
                onChange={(e) => {
                  setForm((f) => ({ ...f, nom: e.target.value }));
                  clearError("nom");
                }}
                onBlur={handleNomBlur}
                autoFocus
              />
              <FormFieldError message={errors.nom} />
            </StyledField>

            <StyledField label="Email (optionnel)" icon={Mail}>
              <input
                type="email"
                className={`${inputWithIconClass} ${errors.email ? INPUT_ERROR_CLASS : ""}`}
                placeholder="contact@societe.tn"
                value={form.email}
                onChange={(e) => {
                  setForm((f) => ({ ...f, email: e.target.value }));
                  clearError("email");
                }}
                onBlur={() => validateField("email")}
              />
              <FormFieldError message={errors.email} />
            </StyledField>

            <div className="md:col-span-2">
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
                  setCode(generateCodeFromName(form.nom, existingCodes));
                  setCodeTouched(false);
                  onClearCodeError?.();
                }}
                placeholder="Ex: ACME"
                inputClassName={SOCIETE_CODE_INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Suggestion auto — modifiable avant enregistrement
              </p>
            </div>
          </div>
        </FormSection>

        <FormSection title="Emplacement">
          <SocieteMapSection
            latitude={latitude}
            longitude={longitude}
            setLatitude={setLatitude}
            setLongitude={setLongitude}
            form={form}
            setForm={setForm}
          />
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <StyledField label="Adresse (optionnel)" icon={MapPin} className="md:col-span-2">
              <input
                className={inputWithIconClass}
                placeholder="Rue, numéro…"
                value={form.adresse ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
              />
            </StyledField>
            <StyledField label="Ville (optionnel)" icon={Map}>
              <input
                className={inputWithIconClass}
                placeholder="Ville"
                value={form.ville ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))}
              />
            </StyledField>
          </div>
        </FormSection>

        <FormSection title="Logo & visibilité">
          <div className="space-y-4">
            <SocieteLogoUpload
              previewUrl={createLogoPreviewUrl}
              fileName={createLogoFile?.name}
              onPickFile={pickCreateLogoFile}
              onClear={clearLogo}
            />
            <VisibilityToggle
              checked={form.actifRegistration}
              onChange={(v) => setForm((f) => ({ ...f, actifRegistration: v }))}
            />
          </div>
        </FormSection>

        {formSuccess && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {formSuccess}
          </p>
        )}
        {formError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {formError}
          </p>
        )}

        <ValidationRulesList form={form} generatedCode={normalizedCode} />

        <button
          type="button"
          disabled={isPending || !isValid}
          onClick={() => {
            setFormError("");
            if (!validate() || nomDuplicate || !normalizedCode) {
              setFormError("Corrigez les champs obligatoires");
              return;
            }
            createMutation.mutate({ code: normalizedCode });
          }}
          className={primaryBtnClass}
          style={
            isValid && !isPending
              ? { background: ROSE_GRADIENT, boxShadow: ROSE_GRADIENT_GLOW }
              : { background: "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)" }
          }
        >
          <PlusCircle className="h-[18px] w-[18px]" />
          {isPending ? "Ajout en cours…" : "Ajouter la société"}
        </button>
      </div>
    </section>
  );
}
