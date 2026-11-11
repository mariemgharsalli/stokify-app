import { createPortal } from "react-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  Key,
  Mail,
  Pencil,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";

export default function UserActionMenu({ user, currentUser, onAction, close, anchorRect }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    function onClickOutside() {
      close();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClickOutside);
    };
  }, [close]);

  if (!anchorRect) return null;

  const isSelf = Number(user.id) === Number(currentUser?.id);
  const role = currentUser?.role;
  const canEdit = (role === "SUPER_ADMIN" || role === "ADMIN") && !isSelf;
  const canReset = (role === "SUPER_ADMIN" || role === "ADMIN") && Boolean(user.actif);
  const canToggle = (role === "SUPER_ADMIN" || role === "ADMIN") && !isSelf;
  const canDelete = role === "SUPER_ADMIN" && !isSelf && !user.actif;
  const canAccess = role === "SUPER_ADMIN" || role === "ADMIN";

  const actions = [
    { id: "view", label: "Voir le profil", Icon: Eye, tone: "var(--text-primary)" },
    canAccess && {
      id: "access",
      label: "Contrôle d'accès",
      Icon: ShieldCheck,
      tone: "var(--accent-primary)",
    },
    canEdit && { id: "edit", label: "Modifier", Icon: Pencil, tone: "var(--text-primary)" },
    canReset && { id: "reset", label: "Réinitialiser MDP", Icon: Key, tone: "var(--accent-warning)" },
    canReset && {
      id: "invite",
      label: "Envoyer invitation",
      Icon: Mail,
      tone: "var(--accent-info, #378ADD)",
    },
    canToggle &&
      !user.actif && {
        id: "toggle",
        label: "Activer",
        Icon: UserCheck,
        tone: "var(--accent-success)",
      },
    canToggle &&
      user.actif && {
        id: "toggle",
        label: "Désactiver",
        Icon: UserX,
        tone: "var(--accent-warning)",
      },
    canDelete && {
      id: "delete",
      label: "Supprimer",
      Icon: Trash2,
      tone: "var(--accent-danger)",
      divider: true,
    },
  ].filter(Boolean);

  const menuWidth = 232;
  const left = Math.max(12, Math.min(anchorRect.right - menuWidth, window.innerWidth - menuWidth - 12));
  const openUp = window.innerHeight - anchorRect.bottom < 300;
  const top = openUp ? Math.max(12, anchorRect.top - 8 - actions.length * 40) : anchorRect.bottom + 8;

  return createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: openUp ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-[120] w-[232px] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-1.5 shadow-2xl backdrop-blur-md"
      style={{ top, left }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-primary) 50%, transparent), transparent)",
        }}
        aria-hidden
      />
      {actions.map((item) => {
        const Icon = item.Icon;
        return (
          <div key={`${item.id}-${item.label}`}>
            {item.divider ? <div className="my-1 border-t border-[var(--border-default)]" /> : null}
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
              onClick={() => {
                onAction(item.id, user);
                close();
              }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{
                  background: `color-mix(in srgb, ${item.tone} 14%, transparent)`,
                  color: item.tone,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium" style={{ color: item.tone }}>
                {item.label}
              </span>
            </button>
          </div>
        );
      })}
    </motion.div>,
    document.body
  );
}
