import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LandingLangProvider } from "../landing/LandingLangContext";
import { useLangStore } from "../../store/langStore";
import { setAuthPersistence, useAuthStore } from "../../store/authStore";
import AuthPage from "./AuthPage";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("../../services/api", () => ({
  default: {
    post,
    get: vi.fn(),
  },
  getAxiosErrorMessage: (_err, fallback) => fallback,
  getApiOrigin: () => "http://127.0.0.1:5000",
}));

function ecranConnexion() {
  return render(
    <LandingLangProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/dashboard" element={<h1>tableau-de-bord</h1>} />
        </Routes>
      </MemoryRouter>
    </LandingLangProvider>
  );
}

describe("page de connexion", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setAuthPersistence(true);
    useAuthStore.getState().logout();
    useLangStore.setState({ lang: "fr" });
    post.mockReset();
  });

  it("signale les champs obligatoires et n'appelle pas l'API", () => {
    ecranConnexion();

    fireEvent.blur(screen.getByPlaceholderText("vous@entreprise.com"));
    fireEvent.blur(screen.getByPlaceholderText("••••••••"));

    expect(screen.getByText("Email invalide")).toBeInTheDocument();
    expect(screen.getByText("Mot de passe requis")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("affiche le message d'identifiants incorrects quand l'API répond 401", async () => {
    post.mockRejectedValueOnce({ response: { status: 401, data: {} } });
    ecranConnexion();

    fireEvent.change(screen.getByPlaceholderText("vous@entreprise.com"), {
      target: { value: "admin@stokify.local" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "mauvais" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByText(/Identifiants incorrects/)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(
      "auth/login",
      { email: "admin@stokify.local", motDePasse: "mauvais" },
      { timeout: 30000 }
    );
  });

  it("redirige vers le tableau de bord après une connexion réussie", async () => {
    post.mockResolvedValueOnce({
      data: {
        token: "jeton-ok",
        user: { id: 1, role: "ADMIN", prenom: "Amira", profileCompleted: false },
      },
    });
    ecranConnexion();

    fireEvent.change(screen.getByPlaceholderText("vous@entreprise.com"), {
      target: { value: "admin@stokify.local" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "MotDePasse1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByRole("heading", { name: "tableau-de-bord" })).toBeInTheDocument();
    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("jeton-ok");
    });
    expect(useAuthStore.getState().user).toMatchObject({ role: "ADMIN" });
  });
});
