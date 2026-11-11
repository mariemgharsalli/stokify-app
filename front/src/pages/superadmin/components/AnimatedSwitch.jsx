import { Eye, EyeOff } from "lucide-react";
import { statusGradient } from "../../refs/components/refsUtils";

export default function AnimatedSwitch({ checked, onChange, disabled = false, id }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "" : "bg-slate-200 dark:bg-slate-700"
      }`}
      style={checked ? { background: statusGradient("ACTIF") } : undefined}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-out ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function VisibilityToggle({ checked, onChange, disabled, label = "Visible à l'inscription (actif)" }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-3">
      <AnimatedSwitch checked={checked} onChange={onChange} disabled={disabled} />
      <span className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
        {checked ? (
          <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <EyeOff className="h-4 w-4 text-slate-400" />
        )}
        {label}
      </span>
    </label>
  );
}
