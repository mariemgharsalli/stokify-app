import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../store/authStore";
import { validerMouvement } from "../../services/mouvements";
import MouvementDetailSheet from "./MouvementDetailSheet";
import { messageCreationMouvement } from "./validationMouvement";

vi.mock("../../services/mouvements", () => ({
  validerMouvement: vi.fn(),
  rejeterMouvement: vi.fn(),
  invaliderApresMouvement: vi.fn(),
}));

function fiche(statut, utilisateurId = 7) {
  return {
    id: 99,
    type: "SORTIE_PERTE",
    statut,
    quantite: 4,
    reference: "MVT-1",
    utilisateurId,
    utilisateur: { id: utilisateurId, nom: "Ben", prenom: "Ali" },
    article: { libelle: "Vis", code: "VIS" },
    depot: { code: "D1", libelle: "Central" },
    createdAt: "2026-10-13T10:00:00.000Z",
  };
}

function afficher(mouvement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MouvementDetailSheet mouvement={mouvement} onClose={() => {}} onToast={() => {}} />
    </QueryClientProvider>
  );
}

describe("validation des mouvements", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: "jeton", user: { id: 8, role: "RESPONSABLE", societeId: 1 } });
    validerMouvement.mockReset();
  });

  it("n'affiche valider et rejeter que pour un rôle autorisé et un statut en attente", () => {
    const attente = afficher(fiche("EN_ATTENTE_VALIDATION"));
    expect(screen.getByRole("button", { name: "Valider" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejeter" })).toBeInTheDocument();
    attente.unmount();

    useAuthStore.setState({ token: "jeton", user: { id: 3, role: "MAGASINIER", societeId: 1 } });
    const magasinier = afficher(fiche("EN_ATTENTE_VALIDATION"));
    expect(screen.queryByRole("button", { name: "Valider" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rejeter" })).not.toBeInTheDocument();
    magasinier.unmount();

    useAuthStore.setState({ token: "jeton", user: { id: 8, role: "RESPONSABLE", societeId: 1 } });
    afficher(fiche("VALIDE"));
    expect(screen.queryByRole("button", { name: "Valider" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rejeter" })).not.toBeInTheDocument();
  });

  it("cache Valider pour l'auteur qui n'est pas admin", () => {
    useAuthStore.setState({ token: "jeton", user: { id: 7, role: "RESPONSABLE", societeId: 1 } });
    afficher(fiche("EN_ATTENTE_VALIDATION", 7));

    expect(screen.queryByRole("button", { name: "Valider" })).not.toBeInTheDocument();
    expect(screen.getByText("Vous ne pouvez pas valider votre propre mouvement.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejeter" })).toBeInTheDocument();
  });

  it("affiche déjà traité quand la validation répond 409", async () => {
    validerMouvement.mockRejectedValueOnce({ response: { status: 409, data: { message: "Mouvement déjà traité" } } });
    afficher(fiche("EN_ATTENTE_VALIDATION"));

    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect((await screen.findByRole("alert")).textContent).toContain("déjà traité");
  });

  it("utilise un toast de création en attente différent du toast normal", () => {
    const normal = messageCreationMouvement({ statut: "VALIDE" });
    const attente = messageCreationMouvement({ statut: "EN_ATTENTE_VALIDATION" });

    expect(normal).toBe("Mouvement créé avec succès.");
    expect(attente).toContain("Mouvement envoyé pour validation");
    expect(attente).not.toBe(normal);
  });
});
