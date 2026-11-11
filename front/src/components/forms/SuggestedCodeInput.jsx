import { AlertCircle, RefreshCw } from "lucide-react";

/** Même règle que back/src/utils/codeUtils.js — normalizeCode */
export function normalizeCodeClient(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

export function isDuplicateCodeError(err) {
  return err?.response?.status === 409 && err?.response?.data?.error === "DUPLICATE_CODE";
}

export function getDuplicateCodeMessage(err) {
  return err?.response?.data?.message || "Ce code existe déjà. Merci d'en choisir un autre.";
}

/**
 * Champ code avec suggestion auto, édition manuelle, normalisation onBlur,
 * et affichage d'erreur 409 DUPLICATE_CODE + bouton régénérer.
 */
export default function SuggestedCodeInput({
  value = "",
  onChange,
  onRegenerate,
  codeError,
  onClearError,
  locked = false,
  disabled = false,
  placeholder = "",
  label,
  className = "",
  inputClassName = "",
  id,
  name = "code",
  maxLength,
  onFieldBlur,
}) {
  const isLocked = locked || disabled;

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="mb-1 block text-xs text-[var(--text-secondary,var(--color-text-secondary,#64748b))]">
          {label}
        </label>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          id={id}
          name={name}
          value={value}
          disabled={isLocked}
          readOnly={locked}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => {
            onClearError?.();
            onChange?.(e.target.value);
          }}
          onBlur={() => {
            if (isLocked) return;
            onChange?.(normalizeCodeClient(value));
            onFieldBlur?.();
          }}
          className={
            inputClassName ||
            "w-full rounded-xl border border-[var(--border-color,#e2e8f0)] bg-[var(--bg-secondary,#f8fafc)] px-3 py-2.5 font-mono text-sm text-[var(--text-primary,#0f172a)] outline-none focus:border-[var(--accent-500,#7c3aed)] dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          }
        />
        {onRegenerate && !locked ? (
          <button
            type="button"
            onClick={() => {
              onClearError?.();
              onRegenerate();
            }}
            title="Régénérer une suggestion"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--border-color,#e2e8f0)] p-2 text-[var(--text-secondary,#94a3b8)] transition hover:text-[var(--accent-500,#7c3aed)] dark:border-white/10 dark:hover:text-[var(--accent-500)]"
          >
            <RefreshCw size={14} />
          </button>
        ) : null}
      </div>
      {codeError ? (
        <div className="mt-1 space-y-1">
          <p className="flex items-center gap-1 text-[11px] text-red-500">
            <AlertCircle size={11} className="shrink-0" />
            <span>{codeError}</span>
          </p>
          {onRegenerate && !locked ? (
            <button
              type="button"
              onClick={() => {
                onClearError?.();
                onRegenerate();
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 underline underline-offset-2 hover:text-red-400"
            >
              <RefreshCw size={11} />
              Régénérer une suggestion
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
