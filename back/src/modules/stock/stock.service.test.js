"use strict";

jest.mock("../../config/database", () => {
  const { creerMockPrisma } = require("../../__tests__/helpers/prismaMock");
  return creerMockPrisma();
});

const prisma = require("../../config/database");
const { reinitialiserMockPrisma } = require("../../__tests__/helpers/prismaMock");
const { checkDepotCapacity, getDepotCapacitySummary } = require("./stock.service");

function stockOccupe({ quantite, poids, volume }) {
  return {
    quantite,
    emplacementId: null,
    article: {
      id: 1,
      code: "A",
      libelle: "Article A",
      poids,
      volume,
      fragile: false,
      dangereuxChimique: false,
    },
  };
}

function preparer({
  capaciteVolume = 10,
  capacitePoids = 100,
  stocks = [stockOccupe({ quantite: 10, poids: 2, volume: 0.2 })],
  article = { id: 3, poids: 1, volume: 0.5 },
} = {}) {
  prisma.depot.findFirst.mockResolvedValue({
    id: 1,
    libelle: "Dépôt central",
    capaciteVolume,
    capacitePoids,
  });
  prisma.stock.findMany.mockResolvedValue(stocks);
  prisma.article.findFirst.mockResolvedValue(article);
}

beforeEach(() => {
  reinitialiserMockPrisma(prisma);
});

describe("capacité poids et volume du dépôt", () => {
  test("refuse un ajout qui dépasse le volume", async () => {
    // Arrange — occupé 10 × 0,2 = 2 m³, ajout 9 × 1 = 9, total 11 / 10
    preparer({ article: { id: 3, poids: 1, volume: 1 } });

    const controle = await checkDepotCapacity(1, 3, 9, 1);

    expect(controle.ok).toBe(false);
    expect(controle.blocked).toBe(true);
    expect(controle.message).toMatch(/volume/i);
  });

  test("refuse un ajout qui dépasse le poids", async () => {
    // Arrange — occupé 10 × 2 = 20 kg, ajout 90 kg, total 110 / 100
    preparer({ article: { id: 3, poids: 90, volume: 0.01 } });

    const controle = await checkDepotCapacity(1, 3, 1, 1);

    expect(controle.ok).toBe(false);
    expect(controle.blocked).toBe(true);
    expect(controle.message).toMatch(/poids/i);
  });

  test("signale un volume au-dessus de 90 % sans bloquer", async () => {
    // Arrange — occupé 40 × 0,2 = 8 m³, ajout 1,5 → 9,5 / 10 = 95 %
    preparer({
      stocks: [stockOccupe({ quantite: 40, poids: 0.1, volume: 0.2 })],
      article: { id: 3, poids: 0.1, volume: 1.5 },
    });

    const controle = await checkDepotCapacity(1, 3, 1, 1);

    expect(controle).toMatchObject({ ok: true, warning: true });
  });

  test("accepte un ajout dans la capacité", async () => {
    preparer({ article: { id: 3, poids: 1, volume: 0.1 } });

    const controle = await checkDepotCapacity(1, 3, 1, 1);

    expect(controle).toEqual({ ok: true });
  });

  test("une capacité non configurée n'est pas bloquante", async () => {
    preparer({ capaciteVolume: null, capacitePoids: null });

    const controle = await checkDepotCapacity(1, 3, 100, 1);

    expect(controle).toEqual({ ok: true });
  });

  test("un ajout de quantité nulle ne bloque pas", async () => {
    preparer();

    const controle = await checkDepotCapacity(1, 3, 0, 1);

    expect(controle.ok).toBe(true);
  });

  test("un article sans poids ni volume n'ajoute aucune charge", async () => {
    preparer({ article: { id: 3, poids: null, volume: null } });

    const controle = await checkDepotCapacity(1, 3, 1000, 1);

    expect(controle).toEqual({ ok: true });
  });

  test("un volume décimal qui dépasse juste la capacité est bloqué", async () => {
    // Arrange — occupé 1 m³, ajout 1,10, capacité 2 → 2,10 / 2 = 105 %
    preparer({
      stocks: [stockOccupe({ quantite: 1, poids: 0, volume: 1 })],
      capaciteVolume: 2,
      article: { id: 3, poids: 0, volume: 1.1 },
    });

    const controle = await checkDepotCapacity(1, 3, 1, 1);

    expect(controle.blocked).toBe(true);
  });

  test("une très grande quantité est comparée à la capacité poids", async () => {
    // Arrange — 1 000 000 × 0,001 = 1 000 kg, capacité 500
    preparer({
      stocks: [],
      capacitePoids: 500,
      capaciteVolume: null,
      article: { id: 3, poids: 0.001, volume: 0 },
    });

    const controle = await checkDepotCapacity(1, 3, 1000000, 1);

    expect(controle.blocked).toBe(true);
    expect(controle.message).toMatch(/poids/i);
  });

  test("le résumé arrondit le taux d'occupation au centième", async () => {
    // Arrange — volume 8,5 / 10 = 85 % → CRITIQUE ; poids 20 / 100 = 20 % → OK
    preparer({
      stocks: [stockOccupe({ quantite: 1, poids: 20, volume: 8.5 })],
    });

    const resume = await getDepotCapacitySummary(1, 1);

    expect(resume.pctVolume).toBe(85);
    expect(resume.statutVolume).toBe("CRITIQUE");
    expect(resume.pctPoids).toBe(20);
    expect(resume.statutPoids).toBe("OK");
    expect(resume.volumeOccupe).toBe(8.5);
    expect(resume.poidsTotal).toBe(20);
  });

  test("un dépôt inconnu est refusé", async () => {
    prisma.depot.findFirst.mockResolvedValue(null);

    await expect(getDepotCapacitySummary(1, 1)).rejects.toMatchObject({ status: 404 });
  });
});
