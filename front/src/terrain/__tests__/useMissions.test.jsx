import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useMissions } from "../lib/useMissions";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn() },
  getAxiosErrorMessage: (error) => error?.message || "erreur",
}));

let receptions = 3;
let commandes = 0;
let retard = 1;

function enveloppe(client) {
  return function Enveloppe({ children }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useMissions", () => {
  beforeEach(() => {
    receptions = 3;
    commandes = 0;
    retard = 1;
    useAuthStore.setState({
      token: "jeton",
      user: { id: 7, role: "MAGASINIER", societeId: 1 },
      activeSocieteId: null,
    });
    api.get.mockImplementation((url, config) => {
      const statut = config?.params?.statut;
      if (url === "achats" && statut === "BROUILLON") return Promise.resolve({ data: { items: [], total: receptions, pages: 1 } });
      if (url === "achats" && statut === "COMMANDE") return Promise.resolve({ data: { items: [], total: commandes, pages: 1 } });
      if (url === "achats/en-retard") return Promise.resolve({ data: { items: [], total: retard } });
      if (url === "stock/ventes-a-livrer") return Promise.reject(new Error("préparations indisponibles"));
      if (url === "inventaires") return Promise.resolve({ data: { items: [], total: 2, page: 1, pages: 1 } });
      if (url === "lots/peremption-risk") return Promise.resolve({ data: { items: [], total: 0 } });
      if (url === "stock/alerts") return Promise.resolve({ data: [] });
      return Promise.reject(new Error(url));
    });
  });

  it("laisse les autres cartes vivre quand une requête échoue, et préfixe la clé par la session", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useMissions(5), { wrapper: enveloppe(client) });

    await waitFor(() => expect(result.current.receive.data?.count).toBe(3));
    await waitFor(() => expect(result.current.prepare.isError).toBe(true));
    expect(result.current.receive.isError).toBe(false);

    const keys = client.getQueryCache().getAll().map((query) => query.queryKey);
    expect(keys.some((key) => key[0] === "terrain" && key[1] === "1:7" && key[2] === "missions")).toBe(true);
  });

  it("ne montre pas le compteur de l'ancienne session après un changement d'utilisateur", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useMissions(5), { wrapper: enveloppe(client) });
    await waitFor(() => expect(result.current.receive.data?.count).toBe(3));

    receptions = 9;
    useAuthStore.setState({
      token: "jeton",
      user: { id: 8, role: "MAGASINIER", societeId: 1 },
      activeSocieteId: null,
    });

    await waitFor(() => expect(result.current.receive.data?.count).toBe(9));
    expect(client.getQueryData(["terrain", "1:7", "missions", "receive", 5])?.count).toBe(3);
    expect(result.current.sessionKey).toBe("1:8");
  });

  it("additionne les brouillons et les commandes, et garde les retards à part", async () => {
    receptions = 4;
    commandes = 2;
    retard = 1;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useMissions(5), { wrapper: enveloppe(client) });
    await waitFor(() => expect(result.current.receive.data?.count).toBe(6));
    expect(result.current.receive.data?.late).toBe(1);
    const lots = client.getQueryCache().findAll().find((query) => query.queryKey[3] === "lots");
    expect(lots.options.staleTime).toBe(5 * 60_000);
    expect(lots.options.refetchOnWindowFocus).toBe(false);
  });
});
