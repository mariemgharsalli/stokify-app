import { ROLE_CONFIG, roleLabel } from "../adminTheme";

export default function UserRoleBadge({ role, className = "" }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.CLIENT;
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
      style={{
        background: cfg.bg,
        color: cfg.color,
        borderColor: cfg.border,
        animation: "roleBadgeIn .15s ease both",
      }}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {roleLabel(role)}
      <style>{`@keyframes roleBadgeIn { from { transform: scale(.85); opacity:0; } to { transform: scale(1); opacity:1; } }`}</style>
    </span>
  );
}
