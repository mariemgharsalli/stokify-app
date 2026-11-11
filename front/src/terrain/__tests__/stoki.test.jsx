import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import BottomNav from "../components/BottomNav";
import ChatSheet from "../chat/ChatSheet";
import SafeReply from "../chat/SafeReply";
import { retryAfterSeconds } from "../chat/chatText";
import { fr } from "../strings/fr";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
  getAxiosErrorMessage: (_error, fallback) => fallback || "erreur",
}));

const briefing = {
  greeting: "Bonjour **Inès**.",
  suggestions: ["Quels lots expirent bientôt ?"],
  status: { tone: "ok", label: "Magasin sous contrôle" },
  kpis: { stockCount: 1, ruptureCount: 0, lotsCount: 0 },
};

function ecran(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/terrain"]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("stoki", () => {
  beforeEach(() => {
    localStorage.clear();
    api.get.mockResolvedValue({ data: briefing });
    api.post.mockReset();
    useAuthStore.setState({
      token: "jeton",
      user: { id: 7, prenom: "Inès", role: "MAGASINIER", societeId: 1 },
      activeSocieteId: null,
    });
  });

  it("calcule le délai du 429 sans relancer tout seul", () => {
    expect(retryAfterSeconds({ "retry-after": "12" })).toBe(12);
    expect(retryAfterSeconds({ "ratelimit-reset": "8" })).toBe(8);
    expect(retryAfterSeconds({})).toBe(60);
  });

  it("affiche le briefing et n'injecte pas de HTML", async () => {
    ecran(<ChatSheet onClose={() => {}} />);
    expect((await screen.findByText("Inès")).tagName).toBe("STRONG");
    expect(document.body.querySelector(".terrain-chat-sheet img, .terrain-chat-sheet script")).toBeNull();
    api.post.mockResolvedValue({
      data: { reply: "<img src=x onerror=alert(1)>Bonjour", articlesSuggeres: [], suggestions: [], trace: [] },
    });
    fireEvent.change(screen.getByLabelText(fr.stokiPlaceholder), { target: { value: "stock ?" } });
    fireEvent.click(screen.getByRole("button", { name: fr.stokiSend }));
    expect(await screen.findByText("Bonjour")).toBeInTheDocument();
    expect(document.body.querySelector(".terrain-chat-sheet img")).toBeNull();
    expect(Object.keys(localStorage).some((key) => /chat/i.test(key))).toBe(false);
    expect(api.post).toHaveBeenCalledWith("ai/chat", { message: "stock ?", history: [], lang: "fr" });
  });

  it("bloque l'envoi sur 429 et ne rappelle pas l'API", async () => {
    api.post.mockRejectedValue({
      response: { status: 429, headers: { "retry-after": "12" }, data: { success: false, message: "Trop de requêtes" } },
    });
    ecran(<ChatSheet onClose={() => {}} />);
    await screen.findByText("Inès");
    fireEvent.change(screen.getByLabelText(fr.stokiPlaceholder), { target: { value: "encore" } });
    fireEvent.click(screen.getByRole("button", { name: fr.stokiSend }));
    expect(await screen.findByText("Trop de questions, réessayez dans 12 s")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: fr.stokiSend }));
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("désactive la question hors ligne", () => {
    const spy = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    ecran(<ChatSheet onClose={() => {}} />);
    expect(screen.getByText(fr.stokiOffline)).toBeInTheDocument();
    expect(screen.getByLabelText(fr.stokiPlaceholder)).toBeDisabled();
    expect(api.get).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("masque Stoki sans la permission ai:read", () => {
    useAuthStore.setState({
      token: "jeton",
      user: { id: 3, role: "COMPTABLE", societeId: 1 },
      activeSocieteId: null,
    });
    ecran(<BottomNav />);
    expect(screen.queryByRole("button", { name: fr.stokiOpen })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.navScan })).toBeInTheDocument();
  });

  it("rend un lien terrain et rien d'autre", () => {
    const { container } = render(
      <MemoryRouter>
        <SafeReply content={"Voir /terrain/scan/lot/4\n<script>alert(1)</script>"} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "/terrain/scan/lot/4" })).toHaveAttribute("href", "/terrain/scan/lot/4");
    expect(container.querySelector("script")).toBeNull();
  });
});
