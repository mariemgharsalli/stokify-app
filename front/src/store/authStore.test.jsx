import { beforeEach, describe, expect, it } from "vitest";
import { setAuthPersistence, useAuthStore } from "./authStore";

const UTILISATEUR = {
  id: 7,
  email: "admin@stokify.local",
  role: "ADMIN",
  prenom: "Amira",
};

function viderStockage() {
  localStorage.clear();
  sessionStorage.clear();
  setAuthPersistence(true);
  useAuthStore.setState({ token: null, user: null, activeSocieteId: null });
}

describe("store d'authentification", () => {
  beforeEach(() => {
    viderStockage();
  });

  it("enregistre l'utilisateur et le jeton dans localStorage quand on se souvient de moi", () => {
    useAuthStore.getState().setAuth("jeton-local", UTILISATEUR, true);

    const etat = useAuthStore.getState();
    expect(etat.token).toBe("jeton-local");
    expect(etat.user).toMatchObject({ id: 7, role: "ADMIN" });

    const brut = localStorage.getItem("stokify-auth");
    expect(brut).toBeTruthy();
    expect(JSON.parse(brut).state.token).toBe("jeton-local");
    expect(sessionStorage.getItem("stokify-auth")).toBeNull();
  });

  it("utilise sessionStorage sans souvenir, et la déconnexion efface jeton, utilisateur et les deux stockages", () => {
    useAuthStore.getState().setAuth("jeton-session", UTILISATEUR, false);

    expect(useAuthStore.getState().token).toBe("jeton-session");
    expect(sessionStorage.getItem("stokify-auth")).toBeTruthy();
    expect(localStorage.getItem("stokify-auth")).toBeNull();

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem("stokify-auth")).toBeNull();
    const session = sessionStorage.getItem("stokify-auth");
    if (session != null) {
      const etat = JSON.parse(session).state;
      expect(etat.token).toBeNull();
      expect(etat.user).toBeNull();
    }
  });
});
