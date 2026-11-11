import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { empreinteVente } from "../lib/picking";
import PickingList from "../pages/PickingList";
import PickingMission from "../pages/PickingMission";
import TerrainHome from "../pages/TerrainHome";
import { purgerPick, usePickStore } from "../store/pickStore";
import { useTerrainStore } from "../store/terrainStore";
import { fr } from "../strings/fr";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
  getAxiosErrorMessage: (error, fallback = "erreur") => error?.response?.data?.message || error?.message || fallback,
}));

vi.mock("../lib/feedback", () => ({
  feedback: { success: vi.fn(), warn: vi.fn(), error: vi.fn() },
  unlockAudio: vi.fn(),
}));

function ecran(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function venteListe(partiel) {
  return {
    id: 1,
    reference: "VTE-1",
    statut: "CONFIRME",
    livree: false,
    depotId: 4,
    dateVente: "2026-10-01",
    client: { nom: "Amin", ville: "Tunis" },
    lignes: [{ id: 9, quantite: 1, lotsConsumed: null, article: { code: "VIS", libelle: "Vis", unite: "UN", fragile: false } }],
    ...partiel,
  };
}

beforeEach(() => {
  purgerPick();
  useAuthStore.setState({ token: "jeton", user: { id: 7, role: "MAGASINIER", societeId: 1 }, activeSocieteId: null });
  useTerrainStore.setState({ depotId: 4, depotLabel: "Principal", sessionKey: "1:7" });
  api.get.mockReset();
  api.post.mockReset();
});

describe("préparation — liste", () => {
  it("affiche les deux totaux et garde le dépôt par défaut dans Mon dépôt", async () => {
    api.get.mockResolvedValue({
      data: {
        items: [
          venteListe({ id: 1, reference: "VTE-DEPOT", depotId: 4, lignes: [{ id: 1, quantite: 1, lotsConsumed: null, article: { fragile: true, libelle: "Verre" } }] }),
          venteListe({ id: 2, reference: "VTE-AUTRE", depotId: 9, dateVente: "2026-09-01" }),
          venteListe({ id: 3, reference: "VTE-SANS", depotId: null, dateVente: "2026-10-20" }),
        ],
        total: 3,
      },
    });
    ecran(
      <MemoryRouter>
        <PickingList />
      </MemoryRouter>
    );
    expect(await screen.findByRole("button", { name: "Mon dépôt (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tous (3)" })).toBeInTheDocument();
    expect(screen.getByText("VTE-DEPOT")).toBeInTheDocument();
    expect(screen.getByText("VTE-SANS")).toBeInTheDocument();
    expect(screen.queryByText("VTE-AUTRE")).not.toBeInTheDocument();
    expect(screen.getByText(fr.defaultDepot)).toBeInTheDocument();
    expect(screen.getByText(fr.pickFragile)).toBeInTheDocument();
  });

  it("retrouve une préparation locale après rechargement", async () => {
    const vente = venteListe();
    usePickStore.getState().bind("1:7");
    usePickStore.getState().enregistrer(vente.id, { fingerprint: empreinteVente(vente), complete: true, scan: true });
    usePickStore.setState({ sessionKey: null, ventes: {} });
    usePickStore.getState().bind("1:7");
    api.get.mockResolvedValue({ data: { items: [vente], total: 1 } });
    ecran(
      <MemoryRouter>
        <PickingList />
      </MemoryRouter>
    );
    expect(await screen.findByText(fr.pickPrepared)).toBeInTheDocument();
  });
});

describe("préparation — mission", () => {
  it("reste lisible quand aucune allocation n'est enregistrée", async () => {
    api.get.mockResolvedValue({
      data: {
        id: 5,
        reference: "VTE-5",
        statut: "CONFIRME",
        livree: false,
        typeVente: "VENTE",
        depotId: 4,
        client: { nom: "Amin", ville: "Tunis" },
        lignes: [{
          id: 9,
          quantite: 2,
          lotsConsumed: null,
          strategieAppliquee: "FIFO",
          article: { code: "VIS", codeBarres: "300", libelle: "Vis", unite: "UN", modeTracage: "LOT", poids: 0, volume: 0, fragile: false },
        }],
      },
    });
    ecran(
      <MemoryRouter initialEntries={["/terrain/preparation/5"]}>
        <Routes>
          <Route path="/terrain/preparation/:venteId" element={<PickingMission />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(fr.pickNoAllocation)).toBeInTheDocument());
    expect(screen.getByText(fr.pickNoPlace)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("termine la mission sans aucune requête d'écriture", async () => {
    api.get.mockImplementation((url) => {
      if (url === "ventes/5") {
        return Promise.resolve({
          data: {
            id: 5,
            reference: "VTE-5",
            statut: "CONFIRME",
            livree: false,
            typeVente: "COMMANDE_WEB",
            depotId: 4,
            client: { nom: "Amin", ville: "Tunis" },
            lignes: [{
              id: 9,
              quantite: 1,
              lotsConsumed: "[]",
              strategieAppliquee: "FIFO",
              article: { code: "VIS", codeBarres: "300", libelle: "Vis", unite: "UN", modeTracage: "AUCUN", fragile: false },
            }],
          },
        });
      }
      return Promise.reject(new Error(url));
    });
    ecran(
      <MemoryRouter initialEntries={["/terrain/preparation/5"]}>
        <Routes>
          <Route path="/terrain/preparation/:venteId" element={<PickingMission />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(fr.pickWeb)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: fr.pickVerify }));
    fireEvent.change(screen.getByLabelText(fr.pickManual), { target: { value: "VIS" } });
    fireEvent.click(screen.getByRole("button", { name: fr.scanSubmit }));
    await waitFor(() => expect(screen.getByText(fr.pickVerified)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: fr.pickNext })).toHaveAttribute("href", "/terrain/preparation");
    expect(screen.getByRole("link", { name: fr.backHome })).toHaveAttribute("href", "/terrain");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("ouvre une feuille de quantité pour un lot et n'ajoute rien avant confirmation", async () => {
    api.get.mockResolvedValue({
      data: {
        id: 5,
        reference: "VTE-5",
        statut: "CONFIRME",
        livree: false,
        typeVente: "VENTE",
        depotId: 4,
        client: { nom: "Amin", ville: "Tunis" },
        lignes: [{
          id: 9,
          quantite: 4,
          lotsConsumed: JSON.stringify([{ lotId: 4, lotNumero: "L-4", quantite: 4, dateExpiration: "2027-01-01" }]),
          article: { code: "VIS", libelle: "Vis", unite: "UN", modeTracage: "LOT" },
        }],
      },
    });
    ecran(
      <MemoryRouter initialEntries={["/terrain/preparation/5"]}>
        <Routes>
          <Route path="/terrain/preparation/:venteId" element={<PickingMission />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("L-4")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: fr.pickVerify }));
    fireEvent.change(screen.getByLabelText(fr.pickManual), { target: { value: "L-4" } });
    fireEvent.click(screen.getByRole("button", { name: fr.scanSubmit }));
    const champ = await screen.findByLabelText(fr.pickLotQty);
    expect(champ).toHaveValue("4");
    expect(screen.getByText("0 / 4")).toBeInTheDocument();
    fireEvent.change(champ, { target: { value: "1" } });
    fireEvent.click(screen.getAllByRole("button", { name: fr.pickVerify }).at(-1));
    await waitFor(() => expect(screen.getByText("1 / 4")).toBeInTheDocument());
    expect(api.post).not.toHaveBeenCalled();
  });

  it("signale une anomalie locale et la liste à la fin", async () => {
    api.get.mockResolvedValue({
      data: {
        id: 5,
        reference: "VTE-5",
        statut: "CONFIRME",
        livree: false,
        typeVente: "VENTE",
        depotId: 4,
        client: { nom: "Amin", ville: "Tunis" },
        lignes: [{
          id: 9,
          quantite: 1,
          lotsConsumed: JSON.stringify([{ lotId: 4, lotNumero: "L-4", quantite: 1, dateExpiration: "2027-01-01" }]),
          article: { code: "VIS", libelle: "Vis", unite: "UN", modeTracage: "LOT" },
        }],
      },
    });
    ecran(
      <MemoryRouter initialEntries={["/terrain/preparation/5"]}>
        <Routes>
          <Route path="/terrain/preparation/:venteId" element={<PickingMission />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole("button", { name: fr.pickVerify })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: fr.pickVerify }));
    fireEvent.change(screen.getByLabelText(fr.pickManual), { target: { value: "HORS" } });
    fireEvent.click(screen.getByRole("button", { name: fr.scanSubmit }));
    expect(await screen.findByText(fr.pickWrongLot)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: fr.pickReport }));
    fireEvent.click(screen.getByRole("radio", { name: fr.pickAnomalyMotif["mauvais-lot"] }));
    fireEvent.change(screen.getByLabelText(fr.pickAnomalyNote), { target: { value: "bac 3" } });
    fireEvent.click(screen.getByRole("button", { name: fr.pickReportSend }));
    expect(await screen.findByText(fr.pickVerifiedAnomalies)).toBeInTheDocument();
    expect(screen.getByText(/Bloquée/)).toBeInTheDocument();
    expect(screen.getByText(/bac 3/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe("accueil — préparations", () => {
  it("ouvre la liste des ventes à livrer", async () => {
    api.get.mockImplementation((url) => {
      if (url === "stock/ventes-a-livrer") return Promise.resolve({ data: { total: 3, items: [] } });
      if (String(url).startsWith("achats")) return Promise.resolve({ data: { total: 0, items: [] } });
      if (url === "inventaires") return Promise.resolve({ data: { total: 0, items: [] } });
      if (url === "lots/peremption-risk") return Promise.resolve({ data: { total: 0, items: [] } });
      if (url === "stock/alerts") return Promise.resolve({ data: [] });
      return Promise.reject(new Error(url));
    });
    ecran(
      <MemoryRouter>
        <TerrainHome />
      </MemoryRouter>
    );
    expect(await screen.findByText(fr.prepareScope)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Préparations/ })).toHaveAttribute("href", "/terrain/preparation");
  });
});
