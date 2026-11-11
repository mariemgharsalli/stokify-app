import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../../store/authStore";
import TerrainLayout from "../TerrainLayout";
import { useTerrainStore } from "../store/terrainStore";
import { fr } from "../strings/fr";

function ouvrir() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/terrain"]}>
        <Routes>
          <Route element={<TerrainLayout />}>
            <Route path="/terrain" element={<h1>accueil</h1>} />
          </Route>
          <Route path="/login" element={<h1>login</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("TerrainLayout déconnexion", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      token: "jeton",
      user: { id: 7, role: "MAGASINIER", prenom: "Nora", societeId: 1 },
      activeSocieteId: null,
    });
    useTerrainStore.setState({ sessionKey: "1:7", depotId: 4, depotLabel: "Principal", recentScans: [], warehouseMode: false });
  });

  it("affiche Déconnexion sur l'accueil et renvoie vers la connexion", async () => {
    ouvrir();
    expect(await screen.findByRole("heading", { name: "accueil" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: fr.logout }));
    expect(await screen.findByRole("heading", { name: "login" })).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useTerrainStore.getState().sessionKey).toBeNull();
    expect(useTerrainStore.getState().depotId).toBeNull();
  });
});
