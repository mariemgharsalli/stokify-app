import { createContext, useContext, useEffect, useLayoutEffect, useMemo } from "react";
import { DICTS, LANGUAGES } from "./landingLocales";
import { DASHBOARD_DICTS } from "../../i18n/dashboardLocales";
import { APP_UI } from "../../i18n/appUiLocales";
import { useLangStore } from "../../store/langStore";
import { applyDocumentLang } from "../../i18n/languages";
import { startDomI18n, translatePhrase } from "../../i18n/tx";

const LandingLangContext = createContext(null);

function mergeDict(lang) {
  return {
    ...(DICTS.fr || {}),
    ...(DASHBOARD_DICTS.fr || {}),
    ...(APP_UI.fr || {}),
    ...(DICTS[lang] || {}),
    ...(DASHBOARD_DICTS[lang] || {}),
    ...(APP_UI[lang] || {}),
  };
}

export function LandingLangProvider({ children }) {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);

  useEffect(() => {
    applyDocumentLang(lang);
  }, [lang]);

  useLayoutEffect(() => startDomI18n(), []);

  const t = useMemo(() => mergeDict(lang), [lang]);
  const tx = useMemo(() => (text) => translatePhrase(text, lang), [lang]);

  const value = useMemo(
    () => ({ lang, setLang, t, tx, languages: LANGUAGES }),
    [lang, setLang, t, tx]
  );

  return (
    <LandingLangContext.Provider value={value}>{children}</LandingLangContext.Provider>
  );
}

export function useLandingLang() {
  const ctx = useContext(LandingLangContext);
  if (!ctx) {
    throw new Error("useLandingLang must be used within LandingLangProvider");
  }
  return ctx;
}

/** Alias for back-office screens. */
export const useAppLang = useLandingLang;
