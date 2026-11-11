import { create } from "zustand";
import {
  applyDocumentLang,
  getStoredLang,
  LANGUAGES,
  LOCALE_TAGS,
  storeLang,
} from "../i18n/languages";

export const useLangStore = create((set, get) => ({
  lang: typeof window !== "undefined" ? getStoredLang() : "fr",

  setLang: (code) => {
    if (!LANGUAGES.some((l) => l.code === code)) return;
    storeLang(code);
    applyDocumentLang(code);
    set({ lang: code });
  },

  localeTag: () => LOCALE_TAGS[get().lang] || "fr-FR",
}));

if (typeof window !== "undefined") {
  applyDocumentLang(useLangStore.getState().lang);
}

export { LANGUAGES, LOCALE_TAGS };
