import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../store/authStore";
import api from "../../services/api";
import ChampSeuilValidation from "./ChampSeuilValidation";

vi.mock("../../services/api", () => ({
  default: { patch: vi.fn() },
  getAxiosErrorMessage: (error) => error?.message || "Erreur",
}));

describe("seuil de validation", () => {
  beforeEach(() => {
    api.patch.mockReset();
    useAuthStore.setState({ token: "jeton", user: { id: 1, role: "ADMIN", societeId: 4 } });
  });

  it("refuse un nombre négatif", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <ChampSeuilValidation societeId={4} valeur={0} />
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText("Seuil de validation des mouvements (DT)"), {
      target: { value: "-3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(screen.getByRole("alert").textContent).toContain("négatif");
    expect(api.patch).not.toHaveBeenCalled();
  });
});
