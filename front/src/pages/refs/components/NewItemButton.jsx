import { FolderPlus, Layers, Tag, X } from "lucide-react";

const VARIANTS = {
  marque: {
    label: "Nouvelle marque",
    labelOpen: "Annuler",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #d946ef 100%)",
    glow: "rgba(168, 85, 247, 0.45)",
    Icon: Tag,
    IconOpen: X,
  },
  famille: {
    label: "Nouvelle famille",
    labelOpen: "Annuler",
    gradient: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
    glow: "rgba(37, 99, 235, 0.4)",
    Icon: FolderPlus,
    IconOpen: X,
  },
  "sous-famille": {
    label: "Nouvelle sous-famille",
    labelOpen: "Annuler",
    gradient: "linear-gradient(135deg, #10b981 0%, #14b8a6 100%)",
    glow: "rgba(16, 185, 129, 0.4)",
    Icon: Layers,
    IconOpen: X,
  },
};

export default function NewItemButton({ variant, open, onToggle, className = "" }) {
  const cfg = VARIANTS[variant] || VARIANTS.marque;
  const Icon = open ? cfg.IconOpen : cfg.Icon;
  const label = open ? cfg.labelOpen : cfg.label;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-250 ease-out hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${className}`}
      style={{
        background: open
          ? "linear-gradient(135deg, #475569 0%, #334155 100%)"
          : cfg.gradient,
        boxShadow: open ? "0 4px 14px rgba(0,0,0,0.25)" : `0 4px 20px ${cfg.glow}`,
      }}
      aria-expanded={open}
    >
      <Icon size={18} className="shrink-0" />
      {label}
    </button>
  );
}
