import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { LandingLangProvider } from "../landing/LandingLangContext";
import LotScanPage from "./LotScanPage";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn() },
}));

describe("LotScanPage", () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: "jeton",
      user: { id: 1, role: "ADMIN", societeId: 1 },
      activeSocieteId: null,
    });
    api.get.mockResolvedValue({
      data: {
        id: 4,
        numero: "LOT-9",
        quantiteRestante: 2,
        quantiteInitiale: 10,
        dateFabrication: "2026-01-02",
        dateExpiration: "2026-12-01",
        statut: "ACTIF",
        article: { libelle: "Vis", code: "VIS" },
        depot: { code: "DEP", libelle: "Principal" },
      },
    });
  });

  it("affiche le numéro, le statut et la date comme avant", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <LandingLangProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/stock/lots/scan/4"]}>
            <Routes>
              <Route path="/stock/lots/scan/:id" element={<LotScanPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </LandingLangProvider>
    );

    expect(await screen.findByText("LOT-9")).toBeInTheDocument();
    expect(screen.getByText("Numéro de lot")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();
    expect(screen.getByText("Vis")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("lots/4");
  });
});
