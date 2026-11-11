import { createPortal } from "react-dom";
import { Eye, Pencil, Power, PowerOff } from "lucide-react";

export default function SocieteActionMenu({ societe, onAction, close, anchorRect }) {
  if (!anchorRect || !societe) return null;

  const isActive = societe.actif !== false;

  const actions = [
    { id: "view", label: "Voir le détail", Icon: Eye },
    { id: "edit", label: "Modifier", Icon: Pencil },
    isActive
      ? { id: "deactivate", label: "Désactiver la société", Icon: PowerOff, danger: true }
      : { id: "reactivate", label: "Réactiver la société", Icon: Power },
  ];

  const menuWidth = 220;
  const left = Math.max(12, Math.min(anchorRect.right - menuWidth, window.innerWidth - menuWidth - 12));
  const openUp = window.innerHeight - anchorRect.bottom < 240;
  const top = openUp ? Math.max(12, anchorRect.top - 8 - 180) : anchorRect.bottom + 6;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[110]" onClick={close} role="presentation" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed z-[120] w-56 rounded-xl border p-1 shadow-2xl animate-[societesMenuIn_.15s_ease]"
        style={{
          top,
          left,
          background: "var(--bg-dropdown)",
          borderColor: "var(--border-default)",
          boxShadow: "var(--shadow-dropdown)",
        }}
      >
        {actions.map((item) => {
          const Icon = item.Icon;
          return (
            <div key={item.id}>
              {item.divider ? (
                <div className="my-1 border-t" style={{ borderColor: "var(--border-subtle)" }} />
              ) : null}
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  color: item.danger ? "var(--danger-text)" : "var(--text-primary)",
                }}
                onClick={() => {
                  onAction(item.id, societe);
                  close();
                }}
              >
                <Icon
                  className="h-4 w-4 shrink-0"
                  style={{ color: item.danger ? "var(--danger-text)" : "var(--text-muted)" }}
                />
                {item.label}
              </button>
            </div>
          );
        })}
      </div>
    </>,
    document.body
  );
}
