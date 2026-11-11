import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../services/api";
import { resolveScan } from "../lib/resolveScan";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn() },
}));

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("resolveScan", () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it("résout un QR de ligne de stock", async () => {
    api.get.mockResolvedValue({ data: { id: 12, article: { libelle: "Vis" } } });
    const res = await resolveScan("https://lan.local/stock/scan/12", { depotId: 1, queryClient: client() });
    expect(api.get).toHaveBeenCalledWith("stock/lines/12");
    expect(res.kind).toBe("stock-line");
    expect(res.data.article.libelle).toBe("Vis");
  });

  it("résout un QR de lot", async () => {
    api.get.mockResolvedValue({ data: { id: 4, numero: "LOT-4" } });
    const res = await resolveScan("/stock/lots/scan/4", { depotId: 1, queryClient: client() });
    expect(api.get).toHaveBeenCalledWith("lots/4");
    expect(res.kind).toBe("lot");
    expect(res.data.numero).toBe("LOT-4");
  });

  it("résout un code d'emplacement, insensible à la casse, et met la liste en cache", async () => {
    const queryClient = client();
    api.get.mockImplementation((url) => {
      if (url === "emplacements") {
        return Promise.resolve({ data: [{ id: 3, code: "A-01", libelle: "Rayon A", barcode: "EMP-3" }] });
      }
      return Promise.reject(new Error(url));
    });

    const first = await resolveScan("a-01", { depotId: 9, queryClient, sessionKey: "4:2" });
    const second = await resolveScan("EMP-3", { depotId: 9, queryClient, sessionKey: "4:2" });

    expect(first.kind).toBe("emplacement");
    expect(first.data.id).toBe(3);
    expect(second.kind).toBe("emplacement");
    expect(second.data.barcode).toBe("EMP-3");
    expect(api.get.mock.calls.filter((call) => call[0] === "emplacements")).toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith("emplacements", { params: { depotId: 9 } });
    expect(queryClient.getQueryCache().find({ queryKey: ["terrain", "4:2", "ref", "emplacements", 9] })).toBeTruthy();
  });

  it("résout un article par code ou code-barres exact, pas par simple contient", async () => {
    api.get.mockImplementation((url, config) => {
      if (url === "emplacements") return Promise.resolve({ data: [] });
      if (url === "articles") {
        const page = config?.params?.page || 1;
        if (page === 1) {
          return Promise.resolve({
            data: { items: [{ id: 1, code: "ART-100-EXTRA", libelle: "Autre", codeBarres: null }], pages: 2 },
          });
        }
        return Promise.resolve({
          data: { items: [{ id: 2, code: "ART-100", libelle: "Vis", codeBarres: "300123" }], pages: 2 },
        });
      }
      return Promise.reject(new Error(url));
    });

    const byCode = await resolveScan("ART-100", { depotId: 2, queryClient: client() });
    expect(byCode.kind).toBe("article");
    expect(byCode.data.id).toBe(2);

    api.get.mockImplementation((url) => {
      if (url === "emplacements") return Promise.resolve({ data: [] });
      if (url === "articles") {
        return Promise.resolve({
          data: { items: [{ id: 7, code: "ART-7", libelle: "Boulon", codeBarres: "300123" }], pages: 1 },
        });
      }
      return Promise.reject(new Error(url));
    });
    const byBarcode = await resolveScan("300123", { depotId: 2, queryClient: client() });
    expect(byBarcode.kind).toBe("article");
    expect(byBarcode.data.id).toBe(7);
  });

  it("désambiguïse un QR texte ancien avec l'emplacement du dépôt", async () => {
    const raw = "Code: ART-1\nEmplacement: A-01";
    api.get.mockImplementation((url, config) => {
      if (url === "emplacements") {
        return Promise.resolve({
          data: [
            { id: 3, code: "A-01", libelle: "Rayon A" },
            { id: 4, code: "B-02", libelle: "Rayon B" },
          ],
        });
      }
      if (url === "articles") {
        return Promise.resolve({
          data: { items: [{ id: 9, code: "ART-1", libelle: "Vis" }], pages: 1 },
        });
      }
      if (url === "stock") {
        expect(config?.params).toMatchObject({ depotId: 2, articleId: 9, emplacementId: 3 });
        return Promise.resolve({
          data: {
            items: [
              {
                id: 44,
                articleId: 9,
                emplacementId: 3,
                article: { code: "ART-1", libelle: "Vis" },
                emplacement: { code: "A-01" },
              },
            ],
          },
        });
      }
      return Promise.reject(new Error(url));
    });

    const res = await resolveScan(raw, { depotId: 2, queryClient: client() });
    expect(res.kind).toBe("stock-line");
    expect(res.data.id).toBe(44);
    expect(api.get).toHaveBeenCalledWith("stock", {
      params: { depotId: 2, articleId: 9, emplacementId: 3, limit: 20 },
    });
  });

  it("retourne unknown si rien ne correspond", async () => {
    api.get.mockImplementation((url) => {
      if (url === "emplacements") return Promise.resolve({ data: [] });
      if (url === "articles") return Promise.resolve({ data: { items: [], pages: 1 } });
      return Promise.reject(new Error(url));
    });
    const res = await resolveScan("INCONNU", { depotId: 1, queryClient: client() });
    expect(res.kind).toBe("unknown");
    expect(res.suggestions).toEqual({ articles: [], emplacements: [] });
  });

  it("propose les articles proches quand le code n'est pas exact", async () => {
    api.get.mockImplementation((url) => {
      if (url === "emplacements") return Promise.resolve({ data: [{ id: 8, code: "VIS-A", libelle: "Bac vis" }] });
      if (url === "articles") {
        return Promise.resolve({
          data: { items: [{ id: 5, code: "VIS-12", libelle: "Vis inox", codeBarres: null }], pages: 1 },
        });
      }
      return Promise.reject(new Error(url));
    });
    const res = await resolveScan("VIS", { depotId: 1, queryClient: client() });
    expect(res.kind).toBe("unknown");
    expect(res.suggestions.articles[0].code).toBe("VIS-12");
    expect(res.suggestions.emplacements.map((row) => row.code)).toEqual(["VIS-A"]);
  });

  it("retrouve un code-barres saisi avec des espaces", async () => {
    const searches = [];
    api.get.mockImplementation((url, config) => {
      if (url === "emplacements") return Promise.resolve({ data: [] });
      if (url === "articles") {
        searches.push(config.params.search);
        if (config.params.search === "0123456789012") {
          return Promise.resolve({
            data: { items: [{ id: 3, code: "EAN", libelle: "Colis", codeBarres: "0123456789012" }], pages: 1 },
          });
        }
        return Promise.resolve({ data: { items: [], pages: 1 } });
      }
      return Promise.reject(new Error(url));
    });
    const res = await resolveScan("0123 456789012", { depotId: 1, queryClient: client() });
    expect(res.kind).toBe("article");
    expect(res.data.libelle).toBe("Colis");
    expect(searches).toContain("0123456789012");
  });
});
