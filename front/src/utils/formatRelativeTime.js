import { interpolate } from "../i18n/languages";
import { useLangStore } from "../store/langStore";
import { getDashboardDict } from "../i18n/dashboardLocales";

/**
 * Affiche une date relative (« il y a 3 min », « 3 min ago », …).
 * @param {string | number | Date} value
 * @returns {string}
 */
export function formatRelativeTime(value) {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const lang = useLangStore.getState().lang;
  const t = getDashboardDict(lang);
  const localeTag = t.localeTag || "fr-FR";

  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return t.relJustNow;
  if (diffSec < 60) return interpolate(t.relSeconds, { n: diffSec });

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return interpolate(t.relMinutes, { n: diffMin });

  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return interpolate(t.relHours, { n: diffH });

  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return interpolate(t.relDays, { n: diffD });

  return date.toLocaleDateString(localeTag, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
