import { RefreshCw, Sparkles } from "lucide-react";
import FormFieldError, { INPUT_ERROR_CLASS } from "../../../components/ui/FormFieldError";
import { accentColorFromString, refsInputClass, statusGradient } from "./refsUtils";

function sanitizeManualCodeInput(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "");
}

function isExistingCode(code, existingCodes = []) {
  const normalized = String(code || "").toUpperCase();
  if (!normalized) return false;
  return (existingCodes || []).some((c) => String(c || "").toUpperCase() === normalized);
}

export function CodeModeToggle({
  mode,
  onModeChange,
  autoCode,
  manualCode,
  onManualCodeChange,
  existingCodes = [],
  colorSeed = "",
  inputClassName = refsInputClass,
}) {
  const manualConflict = mode === "manuel" && isExistingCode(manualCode, existingCodes);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Code</span>
        <div
          className="inline-flex rounded-lg border border-white/10 bg-navy-900/50 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.03]"
          role="group"
          aria-label="Mode de saisie du code"
        >
          {[
            { id: "auto", label: "Automatique" },
            { id: "manuel", label: "Manuel" },
          ].map(({ id, label }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onModeChange(id)}
                aria-pressed={active}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  active ? "text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                }`}
                style={active ? { background: statusGradient("ACTIF") } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "auto" ? (
        <AutoCodePreview code={autoCode} colorSeed={colorSeed || `code-${autoCode}`} />
      ) : (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Code manuel</label>
          <input
            className={`${inputClassName} font-mono uppercase ${manualConflict ? INPUT_ERROR_CLASS : ""}`}
            value={manualCode}
            onChange={(e) => onManualCodeChange(sanitizeManualCodeInput(e.target.value))}
            placeholder="EX_CODE_01"
            spellCheck={false}
          />
          <FormFieldError message={manualConflict ? "Ce code existe déjà" : ""} />
        </div>
      )}
    </div>
  );
}

export function resolveFinalCode(mode, autoCode, manualCode) {
  return mode === "manuel" ? manualCode : autoCode;
}

export function isFinalCodeValid(mode, autoCode, manualCode, existingCodes = []) {
  const finalCode = resolveFinalCode(mode, autoCode, manualCode);
  if (!finalCode) return false;
  if (mode === "manuel" && isExistingCode(finalCode, existingCodes)) return false;
  return true;
}

export function AutoCodePreview({ code, colorSeed = "" }) {
  const color = accentColorFromString(colorSeed || code || "preview");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">Code généré automatiquement</span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs transition-all duration-200"
        style={{
          borderColor: `${color}55`,
          background: `${color}18`,
          color,
        }}
      >
        <Sparkles size={12} className="shrink-0 opacity-80" />
        {code || "—"}
      </span>
    </div>
  );
}

export function EditCodeReadonly({
  code,
  colorSeed = "",
  originalNom,
  currentNom,
  onRegenerate,
}) {
  const color = accentColorFromString(colorSeed || code || "edit");
  const nomChanged =
    String(currentNom || "").trim().toLowerCase() !== String(originalNom || "").trim().toLowerCase();

  return (
    <div className="space-y-2">
      <label className="block text-xs text-slate-500">Code (lecture seule)</label>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs"
          style={{
            borderColor: `${color}44`,
            background: `${color}12`,
            color,
          }}
        >
          {code || "—"}
        </span>
        {nomChanged && onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300 transition hover:bg-amber-500/20"
            title="Régénérer le code à partir du nouveau nom"
          >
            <RefreshCw size={11} />
            Régénérer le code
          </button>
        )}
      </div>
      {nomChanged && (
        <p className="text-[10px] text-amber-400/80">
          Le nom a changé — régénérez le code uniquement si vous acceptez de modifier les références liées.
        </p>
      )}
    </div>
  );
}
