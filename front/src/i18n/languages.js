/** Shared language catalog — landing, client space, and back-office dashboards. */

export const LANGUAGES = [
  {
    code: "fr",
    label: "Français",
    short: "FR",
    flagSrc: "/home-assets/icon-lang-fr.png",
    region: "France · Maghreb",
    localeTag: "fr-FR",
  },
  {
    code: "en",
    label: "English",
    short: "EN",
    flagSrc: "/home-assets/icon-lang-en.svg",
    region: "International",
    localeTag: "en-US",
  },
  {
    code: "ar",
    label: "العربية",
    short: "AR",
    flagSrc: "/home-assets/icon-lang-ar.png",
    region: "تونس · الشرق الأوسط",
    localeTag: "ar",
  },
  {
    code: "es",
    label: "Español",
    short: "ES",
    flagSrc: "/home-assets/icon-lang-es.png",
    region: "España · LatAm",
    localeTag: "es-ES",
  },
  {
    code: "de",
    label: "Deutsch",
    short: "DE",
    flagSrc: "/home-assets/icon-lang-de.png",
    region: "Deutschland",
    localeTag: "de-DE",
  },
  {
    code: "it",
    label: "Italiano",
    short: "IT",
    flagSrc: "/home-assets/icon-lang-it.png",
    region: "Italia",
    localeTag: "it-IT",
  },
];

const STORAGE_KEY = "stokify-landing-lang";

export const LOCALE_TAGS = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.localeTag]));

export function isRtlLang(code) {
  return code === "ar";
}

export function getStoredLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    /* ignore */
  }
  return "fr";
}

export function storeLang(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function applyDocumentLang(code) {
  if (typeof document === "undefined") return;
  const lang = LANGUAGES.some((l) => l.code === code) ? code : "fr";
  const root = document.documentElement;
  root.lang = lang;
  root.dir = isRtlLang(lang) ? "rtl" : "ltr";
  root.setAttribute("data-lang", lang);
}

export function interpolate(template, vars = {}) {
  return String(template ?? "").replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] == null ? "" : String(vars[key])
  );
}
