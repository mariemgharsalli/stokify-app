import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { resetDashboardToCinematicView } from "../pages/dashboard/dashboardViewMode";

const ACTIVE_LS_KEY = "active_societe_id";
const REMEMBER_EMAIL_KEY = "stokify-remember-email";
const AUTH_STORAGE_KEY = "stokify-auth";

let persistToSession = false;

export function setAuthPersistence(rememberMe) {
  persistToSession = !rememberMe;
}

const authStorage = {
  getItem: (name) => sessionStorage.getItem(name) ?? localStorage.getItem(name),
  setItem: (name, value) => {
    if (persistToSession) {
      localStorage.removeItem(name);
      sessionStorage.setItem(name, value);
    } else {
      sessionStorage.removeItem(name);
      localStorage.setItem(name, value);
    }
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};

export function getRememberedEmail() {
  if (typeof localStorage === "undefined") return "";
  return String(localStorage.getItem(REMEMBER_EMAIL_KEY) || "").trim();
}

export function saveRememberedEmail(email) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(REMEMBER_EMAIL_KEY, String(email || "").trim().toLowerCase());
}

export function clearRememberedEmail() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(REMEMBER_EMAIL_KEY);
}

/** Au démarrage : session navigateur vs persistance longue durée. */
(function initAuthPersistenceMode() {
  if (typeof window === "undefined") return;
  persistToSession = Boolean(sessionStorage.getItem(AUTH_STORAGE_KEY) && !localStorage.getItem(AUTH_STORAGE_KEY));
})();

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      activeSocieteId: null,
      setAuth: (token, user, rememberMe = true) => {
        setAuthPersistence(rememberMe);
        set((state) => {
          if (typeof localStorage !== "undefined" && user?.role !== "SUPER_ADMIN") {
            localStorage.removeItem(ACTIVE_LS_KEY);
          }
          return {
            token,
            user,
            ...(user?.role !== "SUPER_ADMIN"
              ? { activeSocieteId: null }
              : { activeSocieteId: state.activeSocieteId }),
          };
        });
      },
      setActiveSociete: (id) => {
        const v = id == null || id === "" ? null : Number(id);
        const next = Number.isFinite(v) && v > 0 ? v : null;
        if (typeof localStorage !== "undefined") {
          if (next) localStorage.setItem(ACTIVE_LS_KEY, String(next));
          else localStorage.removeItem(ACTIVE_LS_KEY);
        }
        resetDashboardToCinematicView();
        set({ activeSocieteId: next });
      },
      logout: () => {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(ACTIVE_LS_KEY);
        }
        authStorage.removeItem(AUTH_STORAGE_KEY);
        set({ token: null, user: null, activeSocieteId: null });
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => authStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        activeSocieteId: state.activeSocieteId,
      }),
    }
  )
);
