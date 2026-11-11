import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import TransferFlow from "../pages/TransferFlow";
import { useTerrainStore } from "../store/terrainStore";
import { fr } from "../strings/fr";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
  getAxiosErrorMessage: (error, fallback = "erreur") => error?.response?.data?.message || error?.message || fallback,
}));

vi.mock("../lib/feedback", () => ({
  feedback: { success: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const prefill = {
  articleId: 4,
  articleCode: "VIS",
  articleLibelle: "Vis",
  modeTracage: "AUCUN",
  emplacementId: 10,
  emplacementCode: "A-01",
  depotId: 3,
};

let sourceQty = 8;
let destQty = 1;

function stock(params) {
  const ligne = {
    id: 1,
    quantite: sourceQty,
    articleId: 4,
    emplacementId: 10,
    article: { id: 4, code: "VIS", libelle: "Vis", modeTracage: "AUCUN" },
    emplacement: { id: 10, code: "A-01" },
  };
  const sansLieu = { id: 2, quantite: 6, articleId: 4, emplacementId: null, article: ligne.article, emplacement: null };
  if (params?.emplacementId === 22) return { items: [{ quantite: destQty, emplacementId: 22, articleId: 4 }] };
  if (params?.emplacementId === 10) return { items: [{ ...ligne, quantite: sourceQty }] };
  return { items: [ligne, sansLieu] };
}

function ecran(role = "MAGASINIER", state = prefill) {
  useAuthStore.setState({ token: "jeton", user: { id: 7, role, societeId: 1 }, activeSocieteId: null });
  useTerrainStore.setState({ depotId: 3, depotLabel: "Principal", sessionKey: "1:7" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const spy = vi.spyOn(client, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: "/terrain/transfert", state }]}>
        <TransferFlow />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...view, spy };
}

async function jusquaConfirmation() {
  fireEvent.change(await screen.findByLabelText(fr.transferQty), { target: { value: "2" } });
  await waitFor(() => expect(screen.getByRole("button", { name: fr.transferDest })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: fr.transferDest }));
  await screen.findByLabelText(fr.placeLabel);
  await waitFor(() => {
    fireEvent.change(screen.getByLabelText(fr.placeLabel), { target: { value: "B-02" } });
    fireEvent.click(screen.getByRole("button", { name: fr.scanSubmit }));
    expect(screen.getByRole("button", { name: fr.transferConfirm })).toBeEnabled();
  });
  fireEvent.click(screen.getByRole("button", { name: fr.transferConfirm }));
}

beforeEach(() => {
  sourceQty = 8;
  destQty = 1;
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockImplementation((url, config) => {
    if (url === "emplacements") return Promise.resolve({ data: [{ id: 22, code: "B-02", depotId: 3, statut: "ACTIF" }] });
    if (url === "stock/emplacement-compatibility") return Promise.resolve({ data: { ok: true } });
    if (url === "stock") return Promise.resolve({ data: stock(config?.params) });
    if (url === "depots") return Promise.resolve({ data: { items: [{ id: 8, code: "NORD", libelle: "Nord", statut: "ACTIF" }] } });
    return Promise.resolve({ data: {} });
  });
});

describe("transfert — flux", () => {
  it("affiche un déplacement validé et invalide le stock", async () => {
    api.post.mockResolvedValue({
      data: { id: 9, reference: "MVT-EMPL-1", statut: "VALIDE", lotsTransferred: [{ lotId: 1, lotNumero: "L1", quantite: 2 }] },
    });
    const { spy } = ecran();
    await jusquaConfirmation();
    fireEvent.click(screen.getAllByRole("button", { name: fr.transferConfirm }).at(-1));
    expect(await screen.findByText("VALIDE")).toBeInTheDocument();
    expect(screen.getByText(/MVT-EMPL-1/)).toBeInTheDocument();
    expect(screen.getByText(/L1/)).toBeInTheDocument();
    expect(screen.queryByText(fr.transferPending)).not.toBeInTheDocument();
    const chemin = `${"mouvements"}/${"transfert-emplacement"}`;
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(chemin, {
      articleId: 4,
      depotOrigineId: 3,
      emplacementOrigineId: 10,
      depotDestId: 3,
      emplacementDestId: 22,
      quantite: 2,
    });
    await waitFor(() => expect(spy.mock.calls.some((call) => call[0]?.queryKey?.[0] === "stock")).toBe(true));
  });

  it("affiche une demande en attente sans invalider le stock", async () => {
    api.post.mockResolvedValue({ data: { id: 9, reference: "MVT-EMPL-2", statut: "EN_ATTENTE_VALIDATION" } });
    const { spy } = ecran();
    await jusquaConfirmation();
    fireEvent.click(screen.getAllByRole("button", { name: fr.transferConfirm }).at(-1));
    expect(await screen.findByText(fr.transferPending)).toBeInTheDocument();
    expect(screen.getByText("EN_ATTENTE_VALIDATION")).toBeInTheDocument();
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const cles = spy.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(cles).toContain("mouvements");
    expect(cles).not.toContain("stock");
    expect(cles).not.toContain("lots");
  });

  it("affiche tels quels les 409 de stock et d'incompatibilité", async () => {
    const insuffisant = "Stock insuffisant à l'emplacement A-01 (disponible: 0)";
    api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: insuffisant } } });
    ecran();
    await jusquaConfirmation();
    fireEvent.click(screen.getAllByRole("button", { name: fr.transferConfirm }).at(-1));
    expect((await screen.findAllByText(insuffisant)).length).toBeGreaterThan(0);

    const incompatible = "Article dangereux refusé dans cette zone";
    api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: incompatible } } });
    fireEvent.click(screen.getAllByRole("button", { name: fr.transferConfirm }).at(-1));
    expect((await screen.findAllByText(incompatible)).length).toBeGreaterThan(0);
  });

  it("n'envoie qu'une requête quand on confirme deux fois", async () => {
    let resoudre;
    api.post.mockImplementation(() => new Promise((resolve) => { resoudre = resolve; }));
    ecran();
    await jusquaConfirmation();
    const bouton = screen.getAllByRole("button", { name: fr.transferConfirm }).at(-1);
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    resoudre({ data: { reference: "MVT-EMPL-3", statut: "VALIDE", lotsTransferred: [] } });
    expect(await screen.findByText("VALIDE")).toBeInTheDocument();
  });

  it("conclut qu'un transfert perdu a été appliqué quand les deux quantités ont bougé", async () => {
    api.post.mockImplementation(async () => {
      sourceQty = 6;
      destQty = 3;
      throw new Error("network");
    });
    ecran();
    await jusquaConfirmation();
    fireEvent.click(screen.getAllByRole("button", { name: fr.transferConfirm }).at(-1));
    expect(await screen.findByText(fr.transferAppliedGuess)).toBeInTheDocument();
  });

  it("affiche un résultat indéterminé si seule la source a baissé", async () => {
    api.post.mockImplementation(async () => {
      sourceQty = 6;
      throw new Error("network");
    });
    ecran();
    await jusquaConfirmation();
    fireEvent.click(screen.getAllByRole("button", { name: fr.transferConfirm }).at(-1));
    expect(await screen.findByText(fr.transferUncertain)).toBeInTheDocument();
    expect(screen.getByText(fr.transferCheckMoves)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.transferConfirm })).not.toBeInTheDocument();
  });

  it("conclut que rien n'a bougé quand les quantités sont inchangées", async () => {
    api.post.mockRejectedValue(new Error("network"));
    ecran();
    await jusquaConfirmation();
    fireEvent.click(screen.getAllByRole("button", { name: fr.transferConfirm }).at(-1));
    expect(await screen.findByText(fr.transferUnchanged)).toBeInTheDocument();
  });

  it("masque le transfert sans stock:write", () => {
    ecran("COMPTABLE");
    expect(screen.getByText(fr.transferForbidden)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.transferConfirm })).not.toBeInTheDocument();
  });

  it("signale le stock sans emplacement comme non déplaçable", async () => {
    ecran("MAGASINIER", { articleId: 4, depotId: 3 });
    expect(await screen.findByText(/non déplaçable depuis Terrain/)).toBeInTheDocument();
  });
});
