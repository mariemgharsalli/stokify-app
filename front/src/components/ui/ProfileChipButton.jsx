import { UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { roleLabel } from "../../security/roleLabels";
import { resolveAvatarUrl } from "../../utils/avatarUtils";

/** Bouton profil — style bleu électrique, thème clair/sombre */
export default function ProfileChipButton({ user, className = "" }) {
  const navigate = useNavigate();
  const avatarSrc = resolveAvatarUrl(user?.avatar);
  const initials = `${user?.prenom?.[0] || ""}${user?.nom?.[0] || ""}`.toUpperCase();

  return (
    <button
      type="button"
      onClick={() => navigate("/profil")}
      className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/90 px-4 py-2.5 shadow-[var(--shadow-card)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-[0_8px_24px_rgba(59,130,246,0.15)] ${className}`}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.05))" }}
      />
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-2 ring-blue-500/25 transition-all group-hover:ring-blue-500/50 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white ring-2 ring-blue-500/20 transition-transform group-hover:scale-105">
            {initials || "?"}
          </span>
        )}
      </span>
      <span className="relative hidden text-left sm:block">
        <span className="block text-sm font-semibold leading-none text-[var(--text-primary)]">
          {user?.prenom} {user?.nom}
        </span>
        <span className="mt-1 block text-xs text-[var(--text-muted)]">
          {user?.poste || roleLabel(user?.role)}
        </span>
      </span>
      <UserCircle2
        size={18}
        className="relative shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-blue-500"
      />
    </button>
  );
}
