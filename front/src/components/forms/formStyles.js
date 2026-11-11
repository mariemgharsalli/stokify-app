import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";



export const labelClass = "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]";



export const inputClass =

  "w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#378ADD]/50 focus:outline-none focus:ring-2 focus:ring-[#378ADD]/20 disabled:opacity-50";



export const selectClass = `${inputClass} cursor-pointer`;



export const btnSecondary =

  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]";



export const btnPrimary = PRIMARY_BTN_CLASSES;

export { primaryButtonStyle };



export const inputErrorClass = "border-red-500/70 ring-1 ring-red-500/30";

