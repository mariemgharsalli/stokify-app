import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import TerrainScanResult from "../components/TerrainScanResult";
import { fr } from "../strings/fr";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn() },
  getAxiosErrorMessage: (error, fallback = "erreur") => error?.message || fallback,
}));

function ouvrir(kind, data, role) {
  useAuthStore.setState({
    token: "jeton",
    user: { id: 1, role, societeId: 2 },
    activeSocieteId: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TerrainScanResult open kind={kind} data={data} depotId={4} onClose={() => {}} raw="CODE" />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("TerrainScanResult", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockResolvedValue({
      data: { items: [{ id: 1, quantite: 6, emplacement: { code: "A-01" }, article: { libelle: "Vis" } }], total: 1 },
    });
  });

  it("affiche un article avec son stock, sa stratégie et sa traçabilité", async () => {
    ouvrir(
      "article",
      { id: 9, code: "VIS", libelle: "Vis inox", strategieSortie: "FEFO", modeTracage: "LOT", unite: "UN" },
      "MAGASINIER"
    );
    expect(await screen.findByRole("heading", { name: "Vis inox" })).toBeInTheDocument();
    expect((await screen.findAllByText("6")).length).toBeGreaterThan(0);
    expect(screen.getByText("FEFO")).toBeInTheDocument();
    expect(screen.getByText("Lot")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("stock", { params: { depotId: 4, articleId: 9, limit: 50 } });
  });

  it("masque la stratégie quand elle est inconnue", async () => {
    ouvrir("article", { id: 9, code: "VIS", libelle: "Vis", modeTracage: "LOT", unite: "UN" }, "MAGASINIER");
    expect(await screen.findByText("Lot")).toBeInTheDocument();
    expect(screen.queryByText(fr.strategy)).not.toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("affiche une ligne de stock", () => {
    ouvrir(
      "stock-line",
      { quantite: 3, statut: "ACTIF", article: { libelle: "Boulon", code: "B" }, emplacement: { code: "C-2" } },
      "MAGASINIER"
    );
    expect(screen.getByRole("heading", { name: "Boulon" })).toBeInTheDocument();
    expect(screen.getByText("C-2 · ACTIF")).toBeInTheDocument();
  });

  it("affiche un lot épuisé", () => {
    ouvrir(
      "lot",
      { numero: "LOT-1", quantiteRestante: 0, dateExpiration: "2020-01-01", article: { libelle: "Yaourt" } },
      "MAGASINIER"
    );
    expect(screen.getByRole("heading", { name: "LOT-1" })).toBeInTheDocument();
    expect(screen.getAllByText(/Épuisé/).length).toBeGreaterThan(0);
    expect(document.querySelector(".terrain-lot-status")).toHaveClass("is-danger");
  });

  it("affiche le contenu d'un emplacement", async () => {
    ouvrir("emplacement", { id: 3, code: "A-01", libelle: "Rayon", capaciteSlots: 12 }, "MAGASINIER");
    expect(screen.getByRole("heading", { name: "A-01" })).toBeInTheDocument();
    expect(await screen.findByText("Vis")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("stock", { params: { depotId: 4, emplacementId: 3, limit: 40 } });
  });

  it("affiche un code inconnu et le bouton pour rescanner", () => {
    ouvrir("unknown", null, "MAGASINIER");
    expect(screen.getByRole("heading", { name: fr.scanUnknown })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.rescan })).toBeInTheDocument();
  });

  it("masque Déplacer et Compter sans les permissions", () => {
    ouvrir("stock-line", { quantite: 1, article: { libelle: "Vis" }, emplacement: { code: "A" } }, "COMPTABLE");
    expect(screen.queryByRole("button", { name: new RegExp(fr.move) })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(fr.count) })).not.toBeInTheDocument();
  });

  it("active Déplacer et Compter pour un magasinier", () => {
    ouvrir("stock-line", { quantite: 1, article: { libelle: "Vis" }, emplacement: { code: "A" } }, "MAGASINIER");
    expect(screen.getByRole("button", { name: fr.move })).toBeEnabled();
    expect(screen.getByRole("button", { name: fr.count })).toBeEnabled();
  });
});
