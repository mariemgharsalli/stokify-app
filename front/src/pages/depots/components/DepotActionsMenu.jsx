import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Eye, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";

/**
 * Menu actions dépôt — rendu en portal pour éviter le clip overflow des cartes.
 */
export default function DepotActionsMenu({
  anchorRect,
  close,
  canWrite,
  canDeletePermanent,
  isActif,
  onView,
  onEdit,
  onAddEmplacement,
  onToggleStatut,
  onDelete,
}) {
  useEffect(() => {
    if (!anchorRect) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchorRect, close]);

  if (!anchorRect) return null;

  const menuWidth = 220;
  const left = Math.max(
    12,
    Math.min(anchorRect.right - menuWidth, window.innerWidth - menuWidth - 12)
  );
  const openUp = window.innerHeight - anchorRect.bottom < 260;
  const top = openUp
    ? Math.max(12, anchorRect.top - 8 - 220)
    : anchorRect.bottom + 6;

  const items = [
    { id: "view", label: "Voir détail", Icon: Eye, color: "#378ADD", onClick: onView },
    canWrite && {
      id: "edit",
      label: "Modifier",
      Icon: Pencil,
      color: "#378ADD",
      onClick: onEdit,
    },
    canWrite && {
      id: "add",
      label: "Ajouter emplacement",
      Icon: Plus,
      color: "#1D9E75",
      onClick: onAddEmplacement,
    },
    canWrite && {
      id: "toggle",
      label: isActif ? "Désactiver" : "Réactiver",
      Icon: isActif ? PowerOff : Power,
      color: isActif ? "var(--text-muted)" : "#1D9E75",
      onClick: onToggleStatut,
    },
    canWrite &&
      canDeletePermanent && {
        id: "delete",
        label: "Supprimer définitivement",
        Icon: Trash2,
        color: "#E24B4A",
        danger: true,
        onClick: onDelete,
      },
  ].filter(Boolean);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[200]" onClick={close} role="presentation" />
      <div
        role="menu"
        className="fixed z-[210] w-56 overflow-hidden rounded-xl border p-1.5 shadow-2xl"
        style={{
          top,
          left,
          background: "var(--bg-dropdown, var(--bg-card, #fff))",
          borderColor: "var(--border-default)",
          boxShadow:
            "0 20px 40px -12px rgba(11, 31, 58, 0.45), 0 0 0 1px rgba(55, 138, 221, 0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Actions
        </p>
        {items.map((item) => {
          const Icon = item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors"
              style={{
                color: item.danger ? "#E24B4A" : "var(--text-primary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = item.danger
                  ? "rgba(226,75,74,0.1)"
                  : "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              onClick={() => {
                item.onClick?.();
                close();
              }}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: item.danger
                    ? "rgba(226,75,74,0.12)"
                    : "rgba(55,138,221,0.1)",
                  color: item.color,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </>,
    document.body
  );
}
