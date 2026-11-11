import { useLangStore } from "../store/langStore";
import { getDashboardDict } from "../i18n/dashboardLocales";

/** Libellés pour l’affichage (sidebar, en-têtes). */
export const ROLE_LABELS = {
  SUPER_ADMIN: "Super Administrateur",
  ADMIN: "Administrateur",
  RESPONSABLE: "Responsable logistique",
  MAGASINIER: "Magasinier",
  COMPTABLE: "Comptable",
  CLIENT: "Client",
};

const ROLE_I18N_KEYS = {
  SUPER_ADMIN: "roleSuperAdmin",
  ADMIN: "roleAdmin",
  RESPONSABLE: "roleResponsable",
  MAGASINIER: "roleMagasinier",
  COMPTABLE: "roleComptable",
  CLIENT: "roleClient",
};

/** Classes Tailwind pour pastilles de rôle (badges). */
export const ROLE_COLORS = {
  SUPER_ADMIN: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  ADMIN: "bg-accent-600/15 text-accent-300 border border-accent-500/25",
  RESPONSABLE: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
  MAGASINIER: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  COMPTABLE: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  CLIENT: "bg-slate-500/15 text-slate-400 border border-slate-500/25",
};

export function roleBadgeClass(role) {
  return ROLE_COLORS[role] || "bg-slate-500/15 text-slate-400 border border-slate-500/25";
}

export function roleLabel(role) {
  const key = ROLE_I18N_KEYS[role];
  if (key) {
    try {
      const lang = useLangStore.getState().lang;
      const dict = getDashboardDict(lang);
      if (dict[key]) return dict[key];
    } catch {
      /* store not ready */
    }
  }
  return ROLE_LABELS[role] || role || "";
}
