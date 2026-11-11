import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import InventoryHome from "../pages/InventoryHome";
import InventoryLocation from "../pages/InventoryLocation";
import { useTerrainStore } from "../store/terrainStore";
import { fr } from "../strings/fr";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  getAxiosErrorMessage: (error, fallback = "erreur") => error?.response?.data?.message || error?.message || fallback,
}));

vi.mock("../lib/feedback", () => ({
  feedback: { success: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function inventaire(partiel = {}) {
  return {
    id: 3,
    reference: "INV-003",
    date: "2026-10-25T08:00:00.000Z",
    statut: "EN_COURS",
    typeInventaire: "complet",
    modeAveugle: false,
    depotId: 4,
    lignes: [{
      id: 11,
      articleId: 4,
      emplacementId: 8,
      qteReelle: 4,
      recomptageDemande: false,
      qteTheorique: 99,
      ecart: -95,
      valeurEcart: 10,
      article: { id: 4, code: "VIS", libelle: "Vis", unite: "UN", modeTracage: "AUCUN" },
      lot: null,
      emplacement: { id: 8, code: "A-01", libelle: "Rayon" },
    }],
    ...partiel,
  };
}

function ecran(ui, path = "/terrain/inventaire") {
  useAuthStore.setState({ token: "jeton", user: { id: 7, role: "MAGASINIER", societeId: 1 }, activeSocieteId: null });
  useTerrainStore.setState({ depotId: 4, depotLabel: "Principal", sessionKey: "1:7" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  api.get.mockReset();
  api.post.mockReset();
  api.patch.mockReset();
});

describe("inventaire — flux", () => {
  it("affiche l'écran vide sans inventaire en cours", async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } });
    ecran(<InventoryHome />);
    expect(await screen.findByText(fr.inventoryEmpty)).toBeInTheDocument();
  });

  it("demande confirmation avant d'écraser un comptage", async () => {
    api.get.mockImplementation((url) => {
      if (url === "inventaires") return Promise.resolve({ data: { items: [{ id: 3 }], total: 1 } });
      if (url === "inventaires/3") return Promise.resolve({ data: inventaire() });
      return Promise.resolve({ data: [] });
    });
    api.patch.mockResolvedValue({ data: { ...inventaire().lignes[0], qteReelle: 6, recomptageDemande: false } });
    ecran(
      <Routes>
        <Route path="/terrain/inventaire/emplacement/:emplacementId" element={<InventoryLocation />} />
      </Routes>,
      "/terrain/inventaire/emplacement/8"
    );
    fireEvent.click(await screen.findByRole("button", { name: /Compté : 4/ }));
    const dialogue = await screen.findByRole("dialog");
    expect(dialogue).toHaveTextContent(fr.inventoryReplace.replace("{n}", "4"));
    fireEvent.click(screen.getByRole("button", { name: fr.inventoryReplaceYes }));
    fireEvent.change(screen.getByLabelText(fr.transferQty), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: fr.inventorySave }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(Object.keys(api.patch.mock.calls[0][1])).toEqual(["qteReelle"]);
    expect(api.patch.mock.calls[0][1].qteReelle).toBe(6);
  });

  it("explique qu'une quantité identique laisse le recomptage", async () => {
    const ligne = { ...inventaire().lignes[0], recomptageDemande: true };
    api.get.mockImplementation((url) => {
      if (url === "inventaires") return Promise.resolve({ data: { items: [{ id: 3 }], total: 1 } });
      if (url === "inventaires/3") return Promise.resolve({ data: inventaire({ lignes: [ligne] }) });
      return Promise.resolve({ data: [] });
    });
    api.patch.mockResolvedValue({ data: { ...ligne, qteReelle: 4, recomptageDemande: true } });
    ecran(<Routes><Route path="/terrain/inventaire/emplacement/:emplacementId" element={<InventoryLocation />} /></Routes>, "/terrain/inventaire/emplacement/8");
    fireEvent.click(await screen.findByRole("button", { name: /Vis/ }));
    expect(screen.queryByText(/Remplacer/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(fr.transferQty), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: fr.inventorySave }));
    expect(await screen.findByText(fr.inventorySameQty)).toBeInTheDocument();
  });

  it("recharge l'inventaire après une erreur réseau", async () => {
    let lectures = 0;
    api.get.mockImplementation((url) => {
      if (url === "inventaires") return Promise.resolve({ data: { items: [{ id: 3 }], total: 1 } });
      if (url === "inventaires/3") {
        lectures += 1;
        const qteReelle = lectures > 1 ? 7 : 4;
        return Promise.resolve({ data: inventaire({ lignes: [{ ...inventaire().lignes[0], qteReelle }] }) });
      }
      return Promise.resolve({ data: [] });
    });
    api.patch.mockRejectedValue(new Error("network"));
    ecran(<Routes><Route path="/terrain/inventaire/emplacement/:emplacementId" element={<InventoryLocation />} /></Routes>, "/terrain/inventaire/emplacement/8");
    fireEvent.click(await screen.findByRole("button", { name: /Vis/ }));
    fireEvent.click(screen.getByRole("button", { name: fr.inventoryReplaceYes }));
    fireEvent.change(screen.getByLabelText(fr.transferQty), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: fr.inventorySave }));
    expect(await screen.findByRole("status")).toHaveTextContent(`${fr.inventoryAmbiguous} 7`);
  });

  it("revient à l'accueil quand l'inventaire est clôturé", async () => {
    api.get.mockImplementation((url) => {
      if (url === "inventaires") return Promise.resolve({ data: { items: [{ id: 3 }], total: 1 } });
      if (url === "inventaires/3") return Promise.resolve({ data: inventaire() });
      return Promise.resolve({ data: [] });
    });
    api.patch.mockRejectedValue({ response: { status: 400, data: { message: "Inventaire introuvable ou deja cloture" } } });
    ecran(<Routes><Route path="/terrain/inventaire/emplacement/:emplacementId" element={<InventoryLocation />} /></Routes>, "/terrain/inventaire/emplacement/8");
    fireEvent.click(await screen.findByRole("button", { name: /Vis/ }));
    fireEvent.click(screen.getByRole("button", { name: fr.inventoryReplaceYes }));
    fireEvent.change(screen.getByLabelText(fr.transferQty), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: fr.inventorySave }));
    expect(await screen.findByText(fr.inventoryClosed)).toBeInTheDocument();
    expect(screen.getByText("Inventaire introuvable ou deja cloture")).toBeInTheDocument();
  });

  it("n'affiche jamais la théorique en mode aveugle", async () => {
    localStorage.setItem("stokify-terrain-inventaire-masque", "0");
    api.get.mockImplementation((url) => {
      if (url === "inventaires") return Promise.resolve({ data: { items: [{ id: 3 }], total: 1 } });
      if (url === "inventaires/3") return Promise.resolve({ data: inventaire({ modeAveugle: true }) });
      return Promise.resolve({ data: [] });
    });
    ecran(<Routes><Route path="/terrain/inventaire/emplacement/:emplacementId" element={<InventoryLocation />} /></Routes>, "/terrain/inventaire/emplacement/8");
    expect(await screen.findByRole("button", { name: /Vis/ })).toBeInTheDocument();
    expect(screen.queryByText("99")).not.toBeInTheDocument();
    expect(screen.queryByText("-95")).not.toBeInTheDocument();
  });

  it("n'envoie qu'une création hors liste malgré un double tap", async () => {
    let resoudre;
    api.get.mockImplementation((url) => {
      if (url === "inventaires") return Promise.resolve({ data: { items: [{ id: 3 }], total: 1 } });
      if (url === "inventaires/3") return Promise.resolve({ data: inventaire() });
      if (url === "emplacements") return Promise.resolve({ data: [] });
      if (url === "articles") return Promise.resolve({ data: { items: [{ id: 9, code: "BOUL", libelle: "Boulon", unite: "UN", modeTracage: "AUCUN" }], pages: 1 } });
      return Promise.resolve({ data: [] });
    });
    api.post.mockImplementation(() => new Promise((resolve) => { resoudre = resolve; }));
    ecran(<Routes><Route path="/terrain/inventaire/emplacement/:emplacementId" element={<InventoryLocation />} /></Routes>, "/terrain/inventaire/emplacement/8");
    fireEvent.click(await screen.findByRole("button", { name: fr.inventoryUnexpected }));
    const code = await screen.findByLabelText(fr.scanManual);
    fireEvent.change(code, { target: { value: "BOUL" } });
    fireEvent.click(screen.getByRole("button", { name: fr.scanSubmit }));
    expect(await screen.findByText("Boulon")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(fr.transferQty), { target: { value: "1" } });
    const bouton = screen.getByRole("button", { name: fr.inventorySave });
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(Object.keys(api.post.mock.calls[0][1]).sort()).toEqual(["articleId", "emplacementId", "qteReelle"]);
    expect(api.post.mock.calls[0][0]).toBe("inventaires/3/lignes");
    resoudre({ data: { id: 20, articleId: 9, qteReelle: 1, emplacementId: 8, article: { code: "BOUL", libelle: "Boulon" } } });
  });
});
