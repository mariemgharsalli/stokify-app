import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useTerrainStore } from "../store/terrainStore";
import TerrainHome from "../pages/TerrainHome";
import { fr } from "../strings/fr";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn() },
  getAxiosErrorMessage: (error) => error?.message || "erreur",
}));

describe("accueil — ma journée", () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: "jeton",
      user: { id: 7, prenom: "Inès", role: "MAGASINIER", societeId: 1 },
      activeSocieteId: null,
    });
    useTerrainStore.setState({ depotId: 5, depotLabel: "Principal", sessionKey: "1:7", warehouseMode: false });
    api.get.mockImplementation((url, config) => {
      const statut = config?.params?.statut;
      if (url === "achats" && statut === "BROUILLON") return Promise.resolve({ data: { total: 4, items: [] } });
      if (url === "achats" && statut === "COMMANDE") return Promise.resolve({ data: { total: 2, items: [] } });
      if (url === "achats/en-retard") return Promise.resolve({ data: { total: 1, items: [] } });
      if (url === "stock/ventes-a-livrer") return Promise.resolve({ data: { total: 0, items: [] } });
      if (url === "inventaires") return Promise.resolve({ data: { total: 0, items: [] } });
      if (url === "lots/peremption-risk") {
        return Promise.resolve({
          data: {
            total: 1,
            items: [{ lotId: 9, numero: "L-9", articleLibelle: "Lait", joursRestants: 2, quantiteRestante: 4 }],
          },
        });
      }
      if (url === "stock/alerts") {
        return Promise.resolve({
          data: [{ articleId: 3, depotId: 5, code: "VIS", libelle: "Vis", quantite: 1, seuil: 5, depot: { libelle: "Principal" } }],
        });
      }
      return Promise.reject(new Error(url));
    });
  });

  it("affiche l'anneau, le réseau, la réception en retard et les listes", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <TerrainHome />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole("img", { name: "Missions faites, 2 sur 5" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(fr.online);
    expect(screen.getByRole("heading", { name: "Bonjour Inès" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Principal" })).toBeInTheDocument();
    expect(screen.getByText(fr.urgent)).toBeInTheDocument();
    expect(screen.getByText("Lait")).toBeInTheDocument();
    expect(screen.getByText("Vis")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Achats à réceptionner/ }).className).toContain("is-featured");
    expect(document.querySelector("video")).toHaveAttribute("src", "/videos/acceuil.mp4");
    expect(screen.getByRole("link", { name: fr.plan3d })).toHaveAttribute("href", "/terrain/plan");
    expect(screen.getByRole("link", { name: fr.depotMap })).toHaveAttribute("href", "/terrain/carte");
  });
});
