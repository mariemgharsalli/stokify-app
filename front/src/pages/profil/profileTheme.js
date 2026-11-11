/** Mon Profil — glass navy, bleu/cyan Stokify, animations. */

export const PROFILE_ACCENT = "#378ADD";
export const PROFILE_CYAN = "#0EA5E9";

export const PROFILE_CSS = `
  @keyframes profileFadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes profileSlideIn {
    from { opacity: 0; transform: translateX(10px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes profileGlowPulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, #378ADD 35%, transparent); }
    50% { box-shadow: 0 0 22px 2px color-mix(in srgb, #0EA5E9 28%, transparent); }
  }
  @keyframes profileShimmer {
    0% { background-position: 120% 0; }
    100% { background-position: -40% 0; }
  }
  .profile-fade-up { animation: profileFadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .profile-slide-in { animation: profileSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .profile-btn-glow { animation: profileGlowPulse 2.4s ease-in-out infinite; }
  .profile-hero-mesh {
    background:
      radial-gradient(ellipse 55% 70% at 0% 0%, rgba(55,138,221,0.28), transparent 55%),
      radial-gradient(ellipse 45% 55% at 100% 100%, rgba(14,165,233,0.18), transparent 50%);
  }
  .profile-kpi-pulse {
    animation: profileGlowPulse 2.4s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .profile-fade-up, .profile-slide-in, .profile-btn-glow, .profile-kpi-pulse {
      animation: none !important;
    }
  }
`;

export const profilePage = "relative min-h-full w-full pb-12";

export const profileGlassHero =
  "relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]";

export const profileGlassCard =
  "relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]";

export const profileMiniStat =
  "group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 transition-all duration-300";

export const profileInput =
  "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[rgba(55,138,221,0.2)] disabled:opacity-55 transition-all duration-200";

export const profileLabel =
  "mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]";

export const profileBtnBlue =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-45";

export const profileBtnOutlineBlue =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-600 dark:text-sky-300 hover:bg-sky-500/15 hover:-translate-y-0.5 transition-all duration-300";

export const profileBtnEditGlow =
  "inline-flex items-center gap-2 rounded-xl border border-[#378ADD]/50 bg-[color-mix(in_srgb,#378ADD_12%,transparent)] px-4 py-2 text-sm font-medium text-[#378ADD] dark:text-sky-300 profile-btn-glow hover:bg-[color-mix(in_srgb,#378ADD_18%,transparent)] transition-all duration-200";

export const profileBtnGhost =
  "inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all";

export const profileTabBar =
  "relative flex w-full gap-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-1.5 shadow-[var(--shadow-card)]";

export const ACTION_META = {
  LOGIN: { label: "Connexion", tone: "success" },
  LOGIN_FAIL: { label: "Échec connexion", tone: "danger" },
  UPDATE_ROLE: { label: "Rôle modifié", tone: "accent" },
  UPDATE_STATUS: { label: "Statut modifié", tone: "warning" },
  CREATE: { label: "Création", tone: "info" },
  UPDATE: { label: "Modification", tone: "info" },
  DELETE: { label: "Suppression", tone: "danger" },
};

export const ACTION_TONE = {
  success: { iconBg: "bg-[var(--success-bg)]", icon: "text-[var(--success-text)]", border: "border-[var(--success-border)]" },
  danger: { iconBg: "bg-[var(--danger-bg)]", icon: "text-[var(--danger-text)]", border: "border-[var(--danger-border)]" },
  warning: { iconBg: "bg-[var(--warning-bg)]", icon: "text-[var(--warning-text)]", border: "border-[var(--warning-border)]" },
  info: { iconBg: "bg-[var(--info-bg)]", icon: "text-[var(--info-text)]", border: "border-[var(--info-border)]" },
  accent: { iconBg: "bg-[color-mix(in_srgb,#378ADD_14%,transparent)]", icon: "text-[#378ADD] dark:text-sky-400", border: "border-[rgba(55,138,221,0.28)]" },
};
