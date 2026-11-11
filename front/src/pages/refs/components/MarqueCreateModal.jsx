import { Sparkles, Tag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import SuggestedCodeInput, { normalizeCodeClient } from "../../../components/forms/SuggestedCodeInput";
import MarqueImagePicker from "./MarqueImagePicker";
import { generateCodeFromName } from "./refsUtils";
import FormFieldError, { inputErrorStyle } from "../../../components/ui/FormFieldError";
import { useFormValidation } from "../../../hooks/useFormValidation";
import { marqueSchema } from "../../../validation";

function brandHue(nom) {
  return ((nom?.charCodeAt(0) ?? 65) * 137) % 360;
}

function ModalField({ label, required, children }) {
  return (
    <div>
      <label
        className="mb-1.5 block text-xs font-medium"
        style={{ color: "var(--text-secondary, var(--color-text-secondary))" }}
      >
        {label} {required && <span style={{ color: "#E24B4A" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  background: "var(--bg-input, var(--color-background-secondary))",
  border: "1px solid var(--border-default, var(--color-border-tertiary))",
  color: "var(--text-primary, var(--color-text-primary))",
};

const CODE_INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-[#0f1117] px-3 py-2.5 font-mono text-sm text-slate-200 outline-none focus:border-violet-500";

export default function MarqueCreateModal({
  open,
  onClose,
  error,
  createNom,
  onCreateNomChange,
  existingCodes = [],
  existingNoms = [],
  codeError,
  onClearCodeError,
  createImagePreview,
  onPickImage,
  onClearImage,
  onSubmit,
  isPending,
}) {
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);

  useEffect(() => {
    if (codeTouched) return;
    setCode(generateCodeFromName(createNom, existingCodes));
  }, [createNom, existingCodes, codeTouched]);

  const normalizedCode = normalizeCodeClient(code);

  const values = useMemo(() => ({ nom: createNom }), [createNom]);
  const { errors, validate, validateField, isValid: schemaValid, clearError, setErrors } =
    useFormValidation(marqueSchema, values);

  const nomDuplicate = useMemo(() => {
    const normalized = createNom.trim().toLowerCase();
    return Boolean(normalized && existingNoms.includes(normalized));
  }, [createNom, existingNoms]);

  const isValid = schemaValid && !nomDuplicate;
  const canSubmit = isValid && Boolean(normalizedCode);

  function handleNomBlur() {
    validateField("nom");
    const normalized = createNom.trim().toLowerCase();
    if (normalized && existingNoms.includes(normalized)) {
      setErrors((prev) => ({ ...prev, nom: "Ce nom existe déjà" }));
    }
  }

  if (!open) return null;

  const hue = brandHue(createNom);

  return (
    <div
      className="modal-overlay-backdrop fixed inset-0 z-40 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-overlay-dialog relative w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: "var(--bg-card, var(--color-background-primary))",
          borderColor: "var(--border-default, var(--color-border-tertiary))",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="marque-modal-title"
      >
        <div
          className="h-1 w-full"
          style={{
            background: "linear-gradient(90deg, #378ADD 0%, #1D9E75 50%, #378ADD 100%)",
          }}
          aria-hidden
        />

        <div
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #378ADD 0%, transparent 70%)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #1D9E75 0%, transparent 70%)" }}
          aria-hidden
        />

        <div
          className="relative flex items-center justify-between border-b px-6 py-5"
          style={{ borderColor: "var(--border-default, var(--color-border-tertiary))" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg"
              style={{
                background: "linear-gradient(145deg, rgba(55,138,221,0.25), rgba(55,138,221,0.08))",
                border: "1px solid rgba(55,138,221,0.35)",
              }}
            >
              <Tag className="h-5 w-5" style={{ color: "#378ADD" }} />
            </div>
            <div>
              <h2
                id="marque-modal-title"
                className="text-lg font-semibold tracking-tight"
                style={{ color: "var(--text-primary, var(--color-text-primary))" }}
              >
                Nouvelle marque
              </h2>
              <p className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <Sparkles size={11} style={{ color: "#378ADD" }} />
                Enrichissez votre référentiel produit
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
            <X size={18} />
          </button>
        </div>

        <div className="relative grid gap-6 p-6 sm:grid-cols-2">
          <div className="space-y-4">
            {error && (
              <div
                className="rounded-xl border px-4 py-3 text-sm"
                style={{
                  background: "rgba(226,75,74,0.08)",
                  borderColor: "rgba(226,75,74,0.25)",
                  color: "#E24B4A",
                }}
              >
                {error}
              </div>
            )}

            <ModalField label="Nom" required>
              <input
                value={createNom}
                onChange={(e) => {
                  onCreateNomChange(e.target.value);
                  clearError("nom");
                }}
                onBlur={handleNomBlur}
                placeholder="Ex. Nestlé, Danone…"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-shadow"
                style={{ ...inputStyle, ...(errors.nom ? inputErrorStyle : {}) }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#378ADD";
                  e.target.style.boxShadow = "0 0 0 3px rgba(55,138,221,0.15)";
                }}
                autoFocus
              />
              <FormFieldError message={errors.nom} />
            </ModalField>

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
                  setCode(generateCodeFromName(createNom, existingCodes));
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
              nom={createNom}
              code={normalizedCode}
              previewSrc={createImagePreview}
              onPickFile={onPickImage}
              onClear={onClearImage}
              compact
            />
          </div>

          <div
            className="flex flex-col rounded-2xl border p-5"
            style={{
              borderColor: "var(--border-default)",
              background:
                "linear-gradient(160deg, color-mix(in srgb, var(--bg-input) 90%, #378ADD 10%), var(--bg-card))",
            }}
          >
            <p
              className="mb-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              <Sparkles size={12} style={{ color: "#378ADD" }} />
              Aperçu en direct
            </p>

            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
              {createImagePreview ? (
                <img
                  src={createImagePreview}
                  alt=""
                  className="h-20 w-20 rounded-2xl object-cover shadow-lg ring-2 ring-white/10"
                />
              ) : (
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
                  style={{
                    background: `linear-gradient(145deg, hsl(${hue}, 60%, 42%), hsl(${(hue + 30) % 360}, 55%, 32%))`,
                  }}
                >
                  {(createNom || "?").charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <p
                  className="truncate text-base font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {createNom.trim() || "Nom de la marque"}
                </p>
                <span
                  className="mt-2 inline-block rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold"
                  style={{
                    background: `hsl(${hue}, 55%, 14%)`,
                    color: `hsl(${hue}, 70%, 68%)`,
                    border: `1px solid hsl(${hue}, 55%, 24%)`,
                  }}
                >
                  {normalizedCode || "CODE_AUTO"}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                La marque apparaîtra ainsi dans le catalogue et les fiches articles.
              </p>
            </div>
          </div>
        </div>

        <div
          className="relative flex gap-3 border-t px-6 py-4"
          style={{
            borderColor: "var(--border-default, var(--color-border-tertiary))",
            background: "color-mix(in srgb, var(--bg-input) 40%, transparent)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isPending || !canSubmit}
            onClick={() => {
              if (!validate() || nomDuplicate) return;
              onSubmit({ code: normalizedCode });
            }}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #378ADD, #2563a8)",
              boxShadow: canSubmit ? "0 6px 20px -4px rgba(55,138,221,0.55)" : "none",
            }}
          >
            {isPending ? "Création…" : "Créer la marque"}
          </button>
        </div>
      </div>
    </div>
  );
}
