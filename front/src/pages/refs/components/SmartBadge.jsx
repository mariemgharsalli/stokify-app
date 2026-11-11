import { TrendingUp } from "lucide-react";

const CONFIG = {
  "high-rotation": {
    label: "Forte rotation",
    icon: TrendingUp,
    className: "border-amber-500/35 bg-amber-500/12 text-amber-300",
  },
  unused: {
    label: "Non utilisé",
    icon: null,
    className: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  },
};

export default function SmartBadge({ type }) {
  const cfg = CONFIG[type];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <span
      className={`refs-smart-badge inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.className}`}
    >
      {Icon && <Icon size={10} className="shrink-0" />}
      {cfg.label}
    </span>
  );
}
