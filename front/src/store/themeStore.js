import { create } from "zustand";
import { persist } from "zustand/middleware";

const THEMES = { DARK: "dark", LIGHT: "light", AUTO: "auto" };

const getSystemTheme = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const getEffectiveTheme = (preference) => {
  if (preference === THEMES.AUTO) return getSystemTheme();
  return preference;
};

const applyTheme = (effective) => {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(effective);
  root.setAttribute("data-theme", effective);
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    effective === "dark" ? "#0f1117" : "#ffffff"
  );
};

let mediaListener = null;

export const useThemeStore = create(
  persist(
    (set, get) => ({
      preference: THEMES.DARK,
      effective: THEMES.DARK,

      setTheme: (preference) => {
        const effective = getEffectiveTheme(preference);
        applyTheme(effective);
        if (mediaListener) {
          window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", mediaListener);
          mediaListener = null;
        }
        if (preference === THEMES.AUTO) {
          mediaListener = (e) => {
            const newEffective = e.matches ? "dark" : "light";
            applyTheme(newEffective);
            set({ effective: newEffective });
          };
          window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", mediaListener);
        }
        set({ preference, effective });
      },

      initTheme: () => {
        const { preference } = get();
        const effective = getEffectiveTheme(preference);
        applyTheme(effective);
        set({ effective });

        if (mediaListener) {
          window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", mediaListener);
          mediaListener = null;
        }
        if (preference === THEMES.AUTO) {
          mediaListener = (e) => {
            const newEffective = e.matches ? "dark" : "light";
            applyTheme(newEffective);
            set({ effective: newEffective });
          };
          window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", mediaListener);
        }
      },
    }),
    { name: "stokify-theme", partialize: (s) => ({ preference: s.preference }) }
  )
);

export { THEMES };
