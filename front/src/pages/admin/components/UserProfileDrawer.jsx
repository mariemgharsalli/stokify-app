import { X, Key, Mail, Pencil } from "lucide-react";
import UserRoleBadge from "./UserRoleBadge";
import UserStatusDot from "./UserStatusDot";
import CopyableEmail from "./CopyableEmail";
import { avatarColorForUser, roleLabel, THEME, userInitials } from "../adminTheme";
import { hasPermission } from "../../../security/permissions";

const PERMISSIONS_LIST = [
  { key: "articles", label: "Gestion articles" },
  { key: "achats", label: "Gestion achats" },
  { key: "ventes", label: "Gestion ventes" },
  { key: "users", label: "Gestion utilisateurs" },
  { key: "rapports", label: "Rapports" },
  { key: "config", label: "Configuration" },
];

function permissionsForRole(role) {
  const map = {
    SUPER_ADMIN: PERMISSIONS_LIST.map((p) => p.key),
    ADMIN: ["articles", "achats", "ventes", "users", "rapports"],
    RESPONSABLE: ["articles", "achats", "ventes", "rapports"],
    MAGASINIER: ["articles"],
    COMPTABLE: ["achats", "ventes", "rapports"],
    CLIENT: [],
  };
  return new Set(map[role] || []);
}

export default function UserProfileDrawer({ user, currentUser, onClose, onEdit, onReset, onInvite }) {
  if (!user) return null;
  const colors = avatarColorForUser(user);
  const perms = permissionsForRole(user.role);
  const canManage = hasPermission(currentUser?.role, "users:manage");

  return (
    <>
      <div
        className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />
      <aside
        className="fixed right-0 top-0 z-[210] flex h-full w-full max-w-[420px] flex-col border-l shadow-2xl animate-[drawerIn_.28s_ease-out]"
        style={{ background: THEME.card, borderColor: THEME.border }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: THEME.border }}>
          <span className="text-sm font-medium text-slate-300">Profil utilisateur</span>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <div className="flex gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white"
              style={{ background: colors.bg }}
            >
              {userInitials(user)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {user.prenom} {user.nom}
              </h2>
              <UserRoleBadge role={user.role} className="mt-2" />
              <div className="mt-2">
                <CopyableEmail email={user.email} className="text-sm text-slate-400" />
              </div>
              <p className="text-xs text-slate-500">ID #{user.id}</p>
            </div>
          </div>

          <UserStatusDot actif={user.actif} neverConnected />
          <p className="text-xs text-slate-500 -mt-4">Dernière connexion : jamais</p>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Informations</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Téléphone</dt>
                <dd className="text-slate-300">—</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Société</dt>
                <dd className="text-slate-300">{user.societe?.nom || user.societe?.code || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Dépôts</dt>
                <dd className="text-slate-300">Tous les dépôts</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">2FA</dt>
                <dd className="text-emerald-400">Non configuré</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Permissions</h3>
            <ul className="space-y-1.5 text-sm">
              {PERMISSIONS_LIST.map((p) => (
                <li key={p.key} className={perms.has(p.key) ? "text-emerald-400" : "text-slate-600"}>
                  {perms.has(p.key) ? "✅" : "○"} {p.label}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Activité récente</h3>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>🕐 Récemment — Session active ({roleLabel(user.role)})</li>
              <li>📦 — Aucune activité enregistrée</li>
            </ul>
          </section>
        </div>

        {canManage && (
          <div className="flex gap-2 border-t p-4" style={{ borderColor: THEME.border }}>
            <button
              type="button"
              onClick={() => onInvite?.(user)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm text-sky-300"
              style={{ borderColor: THEME.border }}
            >
              <Mail className="h-4 w-4" />
              Invitation
            </button>
            <button
              type="button"
              onClick={() => onReset?.(user)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm text-amber-300"
              style={{ borderColor: THEME.border }}
            >
              <Key className="h-4 w-4" />
              Réinitialiser MDP
            </button>
            <button
              type="button"
              onClick={() => onEdit?.(user)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-sm text-white"
            >
              <Pencil className="h-4 w-4" />
              Modifier
            </button>
          </div>
        )}
      </aside>
      <style>{`@keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}
