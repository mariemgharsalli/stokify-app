/** Classes partagées thème clair/sombre — Console Super Administrateur (priorité mode clair) */

export const glassCardClass =
  "rounded-2xl border border-blue-500/45 bg-white shadow-sm backdrop-blur-md transition-all duration-300 focus-within:border-blue-500 dark:border-blue-500/35 dark:bg-[#1a1d27]/60 dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] dark:focus-within:border-blue-500/65";

export const inputLabelClass =
  "mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400";

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm text-slate-800 transition-all duration-200 placeholder:text-slate-400 focus:border-rose-400/70 focus:outline-none focus:ring-2 focus:ring-rose-400/20 dark:border-white/10 dark:bg-[#141a24]/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-rose-500/50 dark:focus:ring-rose-500/20";

export const inputWithIconClass = `${inputClass} pl-10`;

export const tableShellClass =
  "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#1a1d27]/50";

export const tableHeadClass =
  "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200 dark:text-slate-400 dark:bg-[#141a24]/90 dark:border-white/10";

export const tableCellClass =
  "px-4 py-3 text-sm text-slate-700 border-t border-slate-100 dark:text-slate-200 dark:border-white/[0.06]";

export const primaryBtnClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-250 ease-out hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100";

/** Dégradés rose — bouton submit formulaire, recherche carte */
export const ROSE_GRADIENT = "linear-gradient(135deg, #ec4899 0%, #d946ef 50%, #db2777 100%)";
export const ROSE_GRADIENT_GLOW = "0 4px 20px rgba(236, 72, 153, 0.3)";
export const SEARCH_BTN_GRADIENT = "linear-gradient(135deg, #ec4899 0%, #d946ef 100%)";

/** Dégradé bleu — bouton « Nouvelle société » */
export const BLUE_BTN_GRADIENT = "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)";
export const BLUE_BTN_GLOW = "0 4px 20px rgba(37, 99, 235, 0.3)";
