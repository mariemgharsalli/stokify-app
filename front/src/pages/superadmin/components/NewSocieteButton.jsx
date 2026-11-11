import { Building2, X } from "lucide-react";
import { BLUE_BTN_GRADIENT, BLUE_BTN_GLOW } from "./superadminTheme";

export default function NewSocieteButton({ open, onToggle, className = "" }) {
  const Icon = open ? X : Building2;
  const label = open ? "Annuler" : "Nouvelle société";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-250 ease-out hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 ${className}`}
      style={{
        background: open
          ? "linear-gradient(135deg, #64748b 0%, #475569 100%)"
          : BLUE_BTN_GRADIENT,
        boxShadow: open ? "0 2px 10px rgba(0,0,0,0.12)" : BLUE_BTN_GLOW,
      }}
    >
      <Icon size={18} className="shrink-0" />
      {label}
    </button>
  );
}
