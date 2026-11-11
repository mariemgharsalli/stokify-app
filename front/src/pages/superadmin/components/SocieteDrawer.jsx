import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, Mail, MapPin, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import SuggestedCodeInput, { normalizeCodeClient } from "../../../components/forms/SuggestedCodeInput";
import { generateCodeFromName } from "../../refs/components/refsUtils";
import FormFieldError, { INPUT_ERROR_CLASS } from "../../../components/ui/FormFieldError";
import { useFormValidation } from "../../../hooks/useFormValidation";
import { societeSchema } from "../../../validation";
import SocieteLogoUpload from "./SocieteLogoUpload";
import SocieteMapSection from "./SocieteMapSection";
import { inputWithIconClass } from "./superadminTheme";

const SOCIETE_CODE_INPUT_CLASS = `${inputWithIconClass} font-mono uppercase focus:border-rose-500 dark:focus:border-rose-400`;

const EASE = [0.16, 1, 0.3, 1];

/**
 * Modal centrée — Nouvelle / Modifier société (créative, animée, pro).
 */
export default function SocieteDrawer({
  editingSociete,
  form,
  setForm,
  existingCodes = [],
  existingNoms = [],
  codeError,
  onClearCodeError,
  latitude,
  setLatitude,
  longitude,
  setLongitude,
  createLogoFile,
  pickCreateLogoFile,
  createLogoPreviewUrl,
  formError,
  formSuccess,
  isPending,
  onClose,
  onSubmit,
}) {
  const isEdit = Boolean(editingSociete);
  const reduce = useReducedMotion();
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);

  useEffect(() => {
    if (isEdit || codeTouched) return;
    setCode(generateCodeFromName(form.nom, existingCodes));
  }, [form.nom, existingCodes, codeTouched, isEdit]);

  const normalizedCode = normalizeCodeClient(code);
  const displayCode = isEdit ? editingSociete.code : normalizedCode;
  const codeOk = isEdit || (Boolean(normalizedCode) && normalizedCode.length >= 3);

  const values = useMemo(
    () => ({
      nom: form.nom,
      code: displayCode,
      email: form.email,
      adresse: form.adresse,
      ville: form.ville,
    }),
    [form, displayCode]
  );
  const { errors, validate, validateField, isValid: schemaValid, clearError, setErrors } =
    useFormValidation(societeSchema, values);

  const nomDuplicate = useMemo(() => {
    if (isEdit) return false;
    const normalized = form.nom.trim().toLowerCase();
    return Boolean(normalized && existingNoms.includes(normalized));
  }, [form.nom, existingNoms, isEdit]);

  const canSubmit = schemaValid && !nomDuplicate && codeOk && Boolean(form.nom?.trim());

  function handleNomBlur() {
    validateField("nom");
    if (isEdit) return;
    const normalized = form.nom.trim().toLowerCase();
    if (normalized && existingNoms.includes(normalized)) {
      setErrors((prev) => ({ ...prev, nom: "Ce nom existe déjà" }));
    }
  }

  function clearLogo() {
    pickCreateLogoFile(null);
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="societe-modal-root"
        className="societe-modal-root"
        role="presentation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="societe-modal-title"
          className="societe-modal"
          initial={reduce ? false : { opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.38, ease: EASE }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="societe-modal__beam" aria-hidden />
          <div className="societe-modal__glow" aria-hidden />

          <header className="societe-modal__header">
            <div className="societe-modal__brand">
              <div className="societe-modal__avatar">
                <Building2 className="h-5 w-5" strokeWidth={2.2} />
                <span className="societe-modal__avatar-spark" aria-hidden>
                  <Sparkles className="h-3 w-3" />
                </span>
              </div>
              <div>
                <p className="societe-modal__kicker">
                  {isEdit ? "Édition tenant" : "Nouveau tenant"}
                </p>
                <h2 id="societe-modal-title">
                  {isEdit ? "Modifier la société" : "Nouvelle société"}
                </h2>
                <p className="societe-modal__sub">
                  {isEdit
                    ? `Code · ${editingSociete.code}`
                    : "Configuration d’un nouvel espace société"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="societe-modal__close"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="societe-modal__body">
            <FormSection title="Informations générales" step="1">
              <div className="societe-modal__fields">
                <Field label="Nom de la société" required>
                  <InputWithIcon
                    icon={Building2}
                    value={form.nom}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, nom: e.target.value }));
                      clearError("nom");
                    }}
                    onBlur={handleNomBlur}
                    placeholder="Ex. Acme Distribution"
                    autoFocus
                    className={errors.nom ? INPUT_ERROR_CLASS : ""}
                  />
                  <FormFieldError message={errors.nom} />
                </Field>

                <Field label="Email de contact">
                  <InputWithIcon
                    icon={Mail}
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="contact@societe.tn"
                  />
                </Field>

                {!isEdit ? (
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
                ) : (
                  <div className="societe-modal__code">
                    <div className="min-w-0 flex-1">
                      <p>Code tenant</p>
                      <strong>{displayCode || "—"}</strong>
                    </div>
                  </div>
                )}

                {!isEdit && (
                  <SocieteLogoUpload
                    previewUrl={createLogoPreviewUrl}
                    fileName={createLogoFile?.name}
                    onPickFile={pickCreateLogoFile}
                    onClear={clearLogo}
                  />
                )}
              </div>
            </FormSection>

            <FormSection title="Localisation" step="2">
              <SocieteMapSection
                latitude={latitude}
                longitude={longitude}
                setLatitude={setLatitude}
                setLongitude={setLongitude}
                form={form}
                setForm={setForm}
              />
              {latitude && longitude && (
                <div className="societe-modal__coords">
                  <MapPin className="h-3.5 w-3.5" />
                  {Number(latitude).toFixed(4)}, {Number(longitude).toFixed(4)}
                </div>
              )}
            </FormSection>

            <div className="societe-modal__toggle-row">
              <div>
                <p>Société active à la création</p>
                <span>Visible pour la sélection utilisateur</span>
              </div>
              <ToggleSwitch
                checked={form.actifRegistration}
                onChange={() =>
                  setForm((f) => ({ ...f, actifRegistration: !f.actifRegistration }))
                }
              />
            </div>

            {formSuccess && <Alert type="success">{formSuccess}</Alert>}
            {formError && <Alert type="error">{formError}</Alert>}
          </div>

          <footer className="societe-modal__footer">
            <button type="button" onClick={onClose} className="societe-modal__btn-ghost">
              Annuler
            </button>
            <motion.button
              type="button"
              onClick={() => {
                if (!validate() || nomDuplicate || !codeOk) return;
                onSubmit(isEdit ? undefined : { code: normalizedCode });
              }}
              disabled={isPending || !canSubmit}
              className="societe-modal__btn-primary"
              whileHover={reduce || isPending ? undefined : { scale: 1.02 }}
              whileTap={reduce || isPending ? undefined : { scale: 0.98 }}
            >
              {isPending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer la société"}
            </motion.button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

function FormSection({ title, step, children }) {
  return (
    <section className="societe-modal__section">
      <div className="societe-modal__section-head">
        <span>{step}</span>
        <h3>{title}</h3>
        <div />
      </div>
      {children}
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="societe-modal__field">
      <label>
        {label}
        {required ? <em> *</em> : null}
      </label>
      {children}
    </div>
  );
}

function InputWithIcon({ icon: Icon, className = "", ...props }) {
  return (
    <div className="societe-modal__input">
      <Icon className="h-4 w-4" />
      <input className={className} {...props} />
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`societe-modal__switch${checked ? " is-on" : ""}`}
    >
      <span />
    </button>
  );
}

function Alert({ type, children }) {
  return <p className={`societe-modal__alert societe-modal__alert--${type}`}>{children}</p>;
}
