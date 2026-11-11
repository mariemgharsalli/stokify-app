"use strict";

jest.mock("../../config/database", () => {
  const { creerMockPrisma } = require("../../__tests__/helpers/prismaMock");
  return creerMockPrisma();
});

jest.mock("../../utils/aiClient", () => ({
  aiFetch: jest.fn(),
  AiBusyError: class AiBusyError extends Error {},
  isAiBusy: jest.fn(() => false),
}));

const prisma = require("../../config/database");
const { reinitialiserMockPrisma } = require("../../__tests__/helpers/prismaMock");
const { aiFetch } = require("../../utils/aiClient");
const { rememberAiOnline } = require("./aiLocal.fallback");
const { getForecast } = require("./forecast.service");

const ARTICLE = {
  id: 1,
  code: "HUILE",
  libelle: "Huile d'olive",
  imageUrl: null,
  prixAchat: 2,
  familleId: null,
  prixVente: 3,
  stockMin: 1,
  seuilAlerte: 2,
};

function preparerLectures() {
  prisma.article.findFirst.mockResolvedValue(ARTICLE);
  prisma.article.findMany.mockResolvedValue([]);
  prisma.ligneVente.findMany.mockResolvedValue([]);
  prisma.stock.findMany.mockResolvedValue([{ articleId: 1, quantite: 12 }]);
}

beforeEach(() => {
  reinitialiserMockPrisma(prisma);
  aiFetch.mockReset();
  rememberAiOnline(true);
  preparerLectures();
});

describe("repli de prévision", () => {
  test("un service d'intelligence artificielle injoignable bascule en mode local", async () => {
    aiFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const resultat = await getForecast(1, 1);

    expect(resultat.mode).toBe("local");
    expect(resultat.articleId).toBe(1);
    expect(resultat.predictions.length).toBeGreaterThan(0);
    expect(JSON.stringify(resultat)).not.toMatch(/NaN|Infinity/);
    expect(aiFetch).toHaveBeenCalled();
  });

  test("un service déjà considéré hors ligne n'est pas rappelé", async () => {
    rememberAiOnline(false);

    const resultat = await getForecast(1, 1);

    expect(aiFetch).not.toHaveBeenCalled();
    expect(resultat.mode).toBe("local");
    expect(resultat.stockActuel).toBe(12);
  });

  test("une réponse du service est conservée telle quelle", async () => {
    aiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mode: "ai",
        modele: "jeu-de-test",
        predictions: [{ mois: "2026-11", valeur: 4, lower: 1, upper: 6 }],
        confidence: 0.8,
        confidenceLabel: "fiable",
      }),
    });

    const resultat = await getForecast(1, 1);

    expect(resultat.mode).toBe("ai");
    expect(resultat.modele).toBe("jeu-de-test");
    expect(resultat.predictions[0].valeur).toBe(4);
    expect(resultat.stockActuel).toBe(12);
  });
});
