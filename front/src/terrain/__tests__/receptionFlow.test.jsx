import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useTerrainStore } from "../store/terrainStore";
import ReceptionDetail from "../pages/ReceptionDetail";
import TerrainHome from "../pages/TerrainHome";
import { feedback } from "../lib/feedback";
import { fr } from "../strings/fr";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
  getAxiosErrorMessage: (error, fallback = "erreur") => error?.response?.data?.message || error?.message || fallback,
}));

vi.mock("../lib/feedback", () => ({
  feedback: { success: vi.fn(), warn: vi.fn(), error: vi.fn() },
  unlockAudio: vi.fn(),
}));

vi.mock("../../services/mouvements", () => ({
  invaliderApresMouvement: vi.fn(),
}));

function article(partiel) {
  return {
    id: 3,
    code: "VIS",
    codeBarres: "300",
    libelle: "Vis",
    unite: "UN",
    modeTracage: "AUCUN",
    tracageAuto: false,
    strategieSortie: "FIFO",
    ...partiel,
  };
}

function bon(partiel) {
  return {
    id: 5,
    reference: "ACH-5",
    statut: "BROUILLON",
    depotId: 4,
    dateLivraisonPrevue: "2026-10-01",
    fournisseur: { id: 1, nom: "Nord", code: "N" },
    depot: { id: 4, code: "DEP", libelle: "Depot Principal" },
    lignes: [
      { id: 9, quantite: 3, quantiteRecue: 0, articleId: 3, article: article() },
    ],
    ...partiel,
  };
}

function ecran(achat, role = "MAGASINIER") {
  useAuthStore.setState({
    token: "jeton",
    user: { id: 2, role, societeId: 1 },
    activeSocieteId: null,
  });
  useTerrainStore.setState({ depotId: 4, depotLabel: "Principal", sessionKey: "1:2" });
  api.get.mockImplementation((url) => {
    if (url === "emplacements") {
      return Promise.resolve({ data: [{ id: 8, code: "A-01", barcode: "B1", depotId: 9 }] });
    }
    if (String(url).startsWith("achats/")) return Promise.resolve({ data: achat });
    return Promise.resolve({ data: {} });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/terrain/reception/5"]}>
        <Routes>
          <Route path="/terrain/reception/:achatId" element={<ReceptionDetail />} />
          <Route path="/terrain" element={<p>accueil</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function ouvrirSaisie() {
  fireEvent.click(await screen.findByRole("button", { name: fr.openLine }));
  return screen.findByRole("dialog");
}

describe("réception — flux", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    feedback.success.mockReset();
    feedback.warn.mockReset();
    feedback.error.mockReset();
  });

  it("ouvre la ligne d'un article de la commande, refuse un hors commande et une ligne complète", async () => {
    ecran(bon());
    fireEvent.change(await screen.findByLabelText(fr.codeOfOrder), { target: { value: "VIS" } });
    fireEvent.click(screen.getByRole("button", { name: fr.scanSubmit }));
    expect(await screen.findByRole("heading", { name: "Vis" })).toBeInTheDocument();
    expect(feedback.success).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: fr.close }));

    fireEvent.change(screen.getByLabelText(fr.codeOfOrder), { target: { value: "ZZZ" } });
    fireEvent.click(screen.getByRole("button", { name: fr.scanSubmit }));
    expect(await screen.findByText(fr.notOnOrder)).toBeInTheDocument();
    expect(feedback.warn).toHaveBeenCalled();
  });

  it("avertit quand la ligne est déjà complète", async () => {
    ecran(bon({ lignes: [{ id: 9, quantite: 3, quantiteRecue: 3, articleId: 3, article: article() }] }));
    fireEvent.change(await screen.findByLabelText(fr.codeOfOrder), { target: { value: "VIS" } });
    fireEvent.click(screen.getByRole("button", { name: fr.scanSubmit }));
    expect(await screen.findByText(fr.lineDone)).toBeInTheDocument();
    expect(feedback.warn).toHaveBeenCalled();
  });

  it("n'envoie qu'une requête quand on confirme deux fois", async () => {
    let resoudre;
    api.post.mockImplementation(() => new Promise((resolve) => { resoudre = resolve; }));
    ecran(bon());
    await ouvrirSaisie();
    fireEvent.click(screen.getByRole("button", { name: fr.validateLine }));
    const confirmer = await screen.findByRole("button", { name: fr.confirmReceipt });
    fireEvent.click(confirmer);
    fireEvent.click(confirmer);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][0]).toBe("achats/5/lignes/9/reception");
    expect(api.post.mock.calls[0][1]).toEqual({ quantiteRecue: 1 });
    resoudre({ data: { statut: "COMMANDE", id: 5, lignes: [] } });
  });

  it("recharge l'achat après une erreur réseau et ne propose pas de réessayer", async () => {
    api.post.mockRejectedValue(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }));
    ecran(bon({ lignes: [{ id: 9, quantite: 3, quantiteRecue: 1, articleId: 3, article: article() }] }));
    const avant = api.get.mock.calls.length;
    await ouvrirSaisie();
    fireEvent.click(screen.getByRole("button", { name: fr.validateLine }));
    fireEvent.click(await screen.findByRole("button", { name: fr.confirmReceipt }));
    await waitFor(() => expect(screen.getByText(fr.verifyBeforeRetry)).toBeInTheDocument());
    expect(screen.getByText("1 lignes reçues, 1 restantes")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.get.mock.calls.length).toBeGreaterThan(avant);
    expect(screen.queryByRole("button", { name: fr.retry })).not.toBeInTheDocument();
  });

  it("affiche tel quel le message 422 du backend", async () => {
    api.post.mockRejectedValue({ response: { status: 422, data: { message: "Quantite recue depasse le restant (2)" } } });
    ecran(bon());
    await ouvrirSaisie();
    fireEvent.click(screen.getByRole("button", { name: fr.validateLine }));
    fireEvent.click(await screen.findByRole("button", { name: fr.confirmReceipt }));
    expect(await screen.findByText("Quantite recue depasse le restant (2)")).toBeInTheDocument();
    expect(screen.queryByText(fr.verifyBeforeRetry)).not.toBeInTheDocument();
  });

  it("avertit quand le dépôt de l'achat n'est pas celui de la session", async () => {
    ecran(bon({ depotId: 9, depot: { id: 9, code: "Q", libelle: "Quai Sud" } }));
    expect(await screen.findByText("Cet achat est destiné au dépôt Quai Sud")).toBeInTheDocument();
  });

  it("refuse un emplacement d'un autre dépôt", async () => {
    ecran(bon());
    const dialog = await ouvrirSaisie();
    fireEvent.change(within(dialog).getByLabelText(fr.placeLabel), { target: { value: "A-01" } });
    fireEvent.click(within(dialog).getByRole("button", { name: fr.scanSubmit }));
    expect(await screen.findByText(fr.placeOtherDepot)).toBeInTheDocument();
  });

  it("masque la validation sans achats:write et masque tout réceptionner si une saisie est exigée", async () => {
    ecran(bon(), "COMPTABLE");
    expect(await screen.findByRole("heading", { name: "ACH-5" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.openLine })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.confirmAll })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(fr.codeOfOrder)).not.toBeInTheDocument();
  });

  it("masque tout réceptionner quand une ligne exige un lot ou des séries", async () => {
    ecran(bon({
      lignes: [{ id: 9, quantite: 3, quantiteRecue: 0, articleId: 3, article: article({ modeTracage: "LOT", tracageAuto: false }) }],
    }));
    expect(await screen.findByText(fr.confirmAllHidden)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.confirmAll })).not.toBeInTheDocument();
  });
});

describe("accueil — achats à réceptionner", () => {
  it("affiche la somme des brouillons et des commandes, avec les retards", async () => {
    useAuthStore.setState({ token: "jeton", user: { id: 7, role: "MAGASINIER", societeId: 1 }, activeSocieteId: null });
    useTerrainStore.setState({ depotId: 5, depotLabel: "Principal", sessionKey: "1:7" });
    api.get.mockImplementation((url, config) => {
      const statut = config?.params?.statut;
      if (url === "achats" && statut === "BROUILLON") return Promise.resolve({ data: { total: 4, items: [], pages: 1 } });
      if (url === "achats" && statut === "COMMANDE") return Promise.resolve({ data: { total: 2, items: [], pages: 1 } });
      if (url === "achats/en-retard") return Promise.resolve({ data: { total: 1, items: [] } });
      if (url === "stock/ventes-a-livrer") return Promise.resolve({ data: { total: 0, items: [] } });
      if (url === "inventaires") return Promise.resolve({ data: { total: 0, items: [] } });
      if (url === "lots/peremption-risk") return Promise.resolve({ data: { total: 0, items: [] } });
      if (url === "stock/alerts") return Promise.resolve({ data: [] });
      return Promise.reject(new Error(url));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <TerrainHome />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByText("dont 1 en retard")).toBeInTheDocument();
    expect(screen.getByLabelText("Achats à réceptionner 6")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Achats à réceptionner/ })).toHaveAttribute("href", "/terrain/reception");
  });
});
