import { ROLE_CONFIG, roleLabel } from "../adminTheme";

export default function RoleSelector({ roles, value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {roles.map((r) => {
        const cfg = ROLE_CONFIG[r] || ROLE_CONFIG.CLIENT;
        const Icon = cfg.Icon;
        const selected = value === r;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className="rounded-xl border p-4 text-left transition-all duration-150"
            style={{
              borderColor: selected ? cfg.border : "#2d3148",
              background: selected ? `${cfg.bg}88` : "#0f1117",
              boxShadow: selected ? `0 0 0 1px ${cfg.border}` : undefined,
            }}
          >
            <Icon className="mb-2 h-6 w-6" style={{ color: cfg.color }} />
            <p className="text-sm font-medium text-slate-100">{roleLabel(r)}</p>
          </button>
        );
      })}
    </div>
  );
}
