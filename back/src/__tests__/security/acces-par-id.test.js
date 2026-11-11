"use strict";

jest.mock("../../config/database", () => {
  const { creerMockPrisma } = require("../helpers/prismaMock");
  return creerMockPrisma();
});

const prisma = require("../../config/database");
const { syncVentePaiement } = require("../../modules/reglements/reglements.service");
const { checkDepotCapacity } = require("../../modules/stock/stock.service");

describe("Accès par identifiant sans société", () => {
  it("filtre la vente et la facture par societeId lors de la synchro paiement", async () => {
    // Arrange
    const tx = {
      reglement: {
        aggregate: jest.fn(async () => ({ _sum: { montant: 5 } })),
      },
      vente: {
        findFirst: jest.fn(async () => ({ id: 9, totalTTC: 10, societeId: 1 })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      facture: {
        findFirst: jest.fn(async () => null),
        update: jest.fn(async () => ({})),
      },
    };

    // Act
    await syncVentePaiement(tx, 9, 1);

    // Assert
    expect(tx.vente.findFirst.mock.calls[0][0].where).toEqual({ id: 9, societeId: 1 });
    expect(tx.facture.findFirst.mock.calls[0][0].where).toEqual({ venteId: 9, societeId: 1 });
    expect(tx.vente.updateMany.mock.calls[0][0].where).toEqual({ id: 9, societeId: 1 });
  });

  it("filtre l'article par societeId lors du contrôle de capacité", async () => {
    // Arrange
    prisma.depot.findFirst.mockResolvedValue({
      id: 1,
      societeId: 1,
      libelle: "Depot A",
      capaciteVolume: null,
      capacitePoids: null,
    });
    prisma.stock.findMany.mockResolvedValue([]);
    let filtreArticle;
    prisma.article.findFirst.mockImplementation(async (args) => {
      filtreArticle = args.where;
      return { id: 3, poids: 2, volume: 1, societeId: 1 };
    });

    // Act
    await checkDepotCapacity(1, 3, 3, 1);

    // Assert
    expect(filtreArticle).toEqual({ id: 3, societeId: 1 });
  });
});
