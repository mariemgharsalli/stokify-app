import { motion, useReducedMotion } from "framer-motion";
import { MoreVertical, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import UserRoleBadge from "./UserRoleBadge";
import UserStatusDot from "./UserStatusDot";
import UserActionMenu from "./UserActionMenu";
import CopyableEmail from "./CopyableEmail";
import { avatarColorForUser, userInitials } from "../adminTheme";

const rowFade = {
  hidden: { opacity: 0, x: -10 },
  visible: (i = 0) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  }),
};

function formatCreated(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-TN");
  } catch {
    return "—";
  }
}

export default function UserTableRow({
  user,
  index,
  isSelf,
  openMenu,
  setOpenMenu,
  currentUser,
  onAction,
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const colors = avatarColorForUser(user);
  const menuOpen = openMenu?.id === user.id;
  const canManagePermissions =
    currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";

  return (
    <motion.div
      custom={index}
      variants={rowFade}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={reduceMotion ? undefined : { y: -2, x: 2 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/users/${user.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/users/${user.id}`);
        }
      }}
      className="group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-4 transition-colors hover:bg-[var(--bg-hover)] sm:flex-row sm:items-center sm:justify-between"
      style={{
        borderLeft: `3px solid ${user.actif ? "var(--accent-success)" : "var(--accent-danger)"}`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 7%, transparent) 0%, transparent 50%)",
        }}
        aria-hidden
      />

      <div className="relative flex min-w-0 flex-1 items-start gap-3">
        <div className="relative shrink-0">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md"
            style={{ background: colors.bg }}
          >
            {userInitials(user)}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-card)]"
            style={{ background: user.actif ? "var(--accent-success)" : "var(--accent-danger)" }}
          />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-[var(--text-primary)]">
            {user.prenom} {user.nom}
            {isSelf ? (
              <span className="ml-2 rounded-full bg-[color-mix(in_srgb,var(--accent-primary)_18%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-primary)]">
                Vous
              </span>
            ) : null}
          </p>
          <CopyableEmail
            email={user.email}
            className="mt-0.5 text-sm text-[var(--text-secondary)]"
          />
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            ID #{user.id} · Créé {formatCreated(user.createdAt)}
          </p>
        </div>
      </div>

      <div
        className="relative flex flex-wrap items-center gap-2 sm:justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        <UserRoleBadge role={user.role} />
        <UserStatusDot actif={user.actif} />
        {canManagePermissions ? (
          <button
            type="button"
            aria-label="Contrôle d'accès"
            title="Contrôle d'accès par module"
            onClick={() => navigate(`/users/${user.id}`)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-muted)] transition hover:border-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)] hover:text-[var(--accent-primary)]"
          >
            <ShieldCheck className="h-4 w-4" />
          </button>
        ) : null}
        <div className="relative">
          <button
            type="button"
            aria-label="Plus d'options"
            aria-expanded={menuOpen}
            title="Options"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setOpenMenu(menuOpen ? null : { id: user.id, rect });
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
              menuOpen
                ? "border-[color-mix(in_srgb,var(--accent-primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] text-[var(--accent-primary)]"
                : "border-[var(--border-default)] text-[var(--text-muted)] hover:border-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)] hover:text-[var(--text-primary)]"
            }`}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <UserActionMenu
              user={user}
              currentUser={currentUser}
              onAction={onAction}
              close={() => setOpenMenu(null)}
              anchorRect={openMenu.rect}
            />
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
