/** Classes partagées thème Articles — aligné CSS vars Stokify. */

import { REFS_GRADIENT_PALETTE } from "../../refs/components/refsUtils";

export const pageShellClass = "min-h-full space-y-5";

export const glassCardClass =
  "rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-sm";

export const glassCardInnerClass =
  "rounded-xl border border-[var(--border-default)] bg-[var(--bg-hover)]";

/** Panneau filtres Articles — navy glass + accents bleu (voir .article-filter-panel) */
export const filterBarShellClass = "article-filter-panel sticky top-2 z-20 space-y-4 p-4 sm:p-5";

export const filterBarLabelClass = "art-filter-label mb-1.5 block text-[11px] font-semibold uppercase tracking-wide";

export const filterBarInputClass = "art-filter-field px-3 py-2.5 pl-10 text-[13px] shadow-none";

export const filterBarSelectClass = "art-filter-field min-w-[140px] px-3 py-2.5 text-[13px] shadow-none";

export const filterLabelClass = filterBarLabelClass;

export const filterInputClass = filterBarInputClass;

export const filterSelectClass = filterBarSelectClass;

export const tableShellClass =
  "overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-sm";

export const tableHeadClass =
  "sticky top-0 z-10 border-b border-r border-[var(--border-default)] bg-[var(--bg-input)]/95 px-2.5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] backdrop-blur-md";

export const tableCellClass =
  "border-r border-[var(--border-default)]/50 px-2.5 py-2.5 align-middle text-[12px] text-[var(--text-secondary)]";

export const checkboxClass =
  "h-4 w-4 rounded border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--accent-primary)] shadow-sm transition focus:ring-[color-mix(in_srgb,var(--accent-primary)_35%,transparent)] focus:ring-offset-0";

const ARTICLE_TABLE_GRADIENT_PALETTE = REFS_GRADIENT_PALETTE.map((pair, i) => {
  if (i === 6) return ["#2563eb", "#3b82f6"];
  if (i === 7) return ["#0284c7", "#0ea5e9"];
  return pair;
});

function tableColorFromString(str) {
  let hash = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % ARTICLE_TABLE_GRADIENT_PALETTE.length;
  return ARTICLE_TABLE_GRADIENT_PALETTE[idx];
}

function tableGradientFromString(str) {
  const [a, b] = tableColorFromString(str);
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export function articleTableFamilleGradient(code = "") {
  return tableGradientFromString(`famille-${code}`);
}

export function articleTableSousFamilleGradient(code = "", parentCode = "") {
  const seed = parentCode ? `sf-${parentCode}-${code}` : `sf-${code}`;
  return tableGradientFromString(seed);
}

export function articleTableGradient(str) {
  return tableGradientFromString(str);
}

export function articleTableStockLevelClass(qty, stockMin) {
  const q = Number(qty) || 0;
  const min = stockMin != null && stockMin !== "" ? Number(stockMin) : null;
  if (q === 0) {
    return "bg-[color-mix(in_srgb,var(--accent-danger)_18%,transparent)] text-[var(--accent-danger)]";
  }
  if (min != null && q > 0 && q <= min) {
    return "bg-[color-mix(in_srgb,var(--accent-warning)_18%,transparent)] text-[var(--accent-warning)]";
  }
  return "bg-[color-mix(in_srgb,var(--accent-success)_18%,transparent)] text-[var(--accent-success)]";
}
