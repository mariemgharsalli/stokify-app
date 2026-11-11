"use strict";

jest.mock("../../config/database", () => {
  const { creerMockPrisma } = require("../../__tests__/helpers/prismaMock");
  return creerMockPrisma();
});
jest.mock("../coutStockage/coutStockage.service", () => ({
  getLatestCout: jest.fn(),
}));

const prisma = require("../../config/database");
const { reinitialiserMockPrisma } = require("../../__tests__/helpers/prismaMock");
const {
  onEntreeStock,
  onSortieStock,
  getDernierPrixAchat,
  getCoutUnitaireCourant,
  calculateLIFO,
} = require("./valuation.service");

const ids = { societeId: 1, articleId: 1, depotId: 2 };

function couchesFifo() {
  return [
    { id: 1, orderIndex: 1, quantiteRestante: 4, prixUnitaire: 10, lotId: null },
    { id: 2, orderIndex: 2, quantiteRestante: 6, prixUnitaire: 30, lotId: null },
  ];
}

beforeEach(() => {
  reinitialiserMockPrisma(prisma);
  prisma.couchesFifo.update.mockImplementation(async ({ where, data }) => ({
    id: where.id,
    ...data,
  }));
  prisma.historiqueCMP.create.mockResolvedValue({});
  prisma.couchesFifo.create.mockResolvedValue({});
  prisma.valorisation.findFirst.mockResolvedValue(null);
  prisma.valorisation.create.mockResolvedValue({});
  prisma.couchesFifo.aggregate.mockResolvedValue({ _max: { orderIndex: 2 } });
});

describe("CMP", () => {
  test("une entrée recalcule le coût moyen pondéré", async () => {
    // Arrange — stock 10 à 5 DT, entrée 10 à 8 DT
    // (10 × 5 + 10 × 8) / 20 = 130 / 20 = 6,50
    prisma.stock.findFirst.mockResolvedValue({ quantite: 10 });
    prisma.historiqueCMP.findFirst.mockResolvedValue({ nouveauCMP: 5 });

    // Act
    const resultat = await onEntreeStock(prisma, {
      ...ids,
      quantite: 10,
      prixUnitaire: 8,
    });

    // Assert
    expect(resultat).toEqual({ ancienCMP: 5, nouveauCMP: 6.5 });
  });

  test("une entrée décimale est arrondie au centième", async () => {
    // Arrange — stock 3 à 1,10 et entrée 1 à 2,25
    // (3 × 1,10 + 2,25) / 4 = 5,55 / 4 = 1,3875 → 1,39
    prisma.stock.findFirst.mockResolvedValue({ quantite: 3 });
    prisma.historiqueCMP.findFirst.mockResolvedValue({ nouveauCMP: 1.1 });

    // Act
    const resultat = await onEntreeStock(prisma, {
      ...ids,
      quantite: 1,
      prixUnitaire: 2.25,
    });

    // Assert
    expect(resultat.nouveauCMP).toBe(1.39);
  });

  test("une très grande entrée reste exacte", async () => {
    // Arrange — 1 000 000 à 10 DT + 1 000 000 à 20 DT = 15 DT
    prisma.stock.findFirst.mockResolvedValue({ quantite: 1000000 });
    prisma.historiqueCMP.findFirst.mockResolvedValue({ nouveauCMP: 10 });

    // Act
    const resultat = await onEntreeStock(prisma, {
      ...ids,
      quantite: 1000000,
      prixUnitaire: 20,
    });

    // Assert
    expect(resultat.nouveauCMP).toBe(15);
  });

  test("une quantité nulle laisse le CMP inchangé", async () => {
    // Arrange — (10 × 5 + 0 × 8) / 10 = 5
    prisma.stock.findFirst.mockResolvedValue({ quantite: 10 });
    prisma.historiqueCMP.findFirst.mockResolvedValue({ nouveauCMP: 5 });

    // Act
    const resultat = await onEntreeStock(prisma, {
      ...ids,
      quantite: 0,
      prixUnitaire: 8,
    });

    // Assert
    expect(resultat.nouveauCMP).toBe(5);
  });

  test("un prix absent est lu comme zéro", async () => {
    // Arrange — (10 × 5 + 10 × 0) / 20 = 2,50
    prisma.stock.findFirst.mockResolvedValue({ quantite: 10 });
    prisma.historiqueCMP.findFirst.mockResolvedValue({ nouveauCMP: 5 });

    // Act
    const resultat = await onEntreeStock(prisma, {
      ...ids,
      quantite: 10,
      prixUnitaire: null,
    });

    // Assert
    expect(resultat.nouveauCMP).toBe(2.5);
  });

  it("une entrée de quantité négative est refusée", async () => {
    prisma.stock.findFirst.mockResolvedValue({ quantite: 10 });
    prisma.historiqueCMP.findFirst.mockResolvedValue({ nouveauCMP: 5 });

    await expect(
      onEntreeStock(prisma, { ...ids, quantite: -4, prixUnitaire: 8 })
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.historiqueCMP.create).not.toHaveBeenCalled();
  });

  test("une sortie CMP vaut quantité × CMP", async () => {
    // Arrange — 4 × 6,50 = 26,00
    prisma.historiqueCMP.findFirst.mockResolvedValue({ nouveauCMP: 6.5 });

    // Act
    const resultat = await onSortieStock(prisma, {
      ...ids,
      quantite: 4,
      methode: "CMP",
    });

    // Assert
    expect(resultat.coutTotal).toBe(26);
    expect(resultat.coutsDetail).toEqual([
      { methode: "CMP", qteConsommee: 4, prix: 6.5, montant: 26 },
    ]);
  });
});

describe("FIFO et LIFO", () => {
  test("FIFO consomme la couche la plus ancienne", async () => {
    // Arrange — 4 × 10 + 1 × 30 = 40 + 30 = 70
    prisma.couchesFifo.findMany.mockResolvedValue(couchesFifo());

    // Act
    const resultat = await onSortieStock(prisma, {
      ...ids,
      quantite: 5,
      methode: "FIFO",
    });

    // Assert
    expect(resultat.coutTotal).toBe(70);
    expect(resultat.coutsDetail.map((l) => l.qteConsommee)).toEqual([4, 1]);
  });

  test("FIFO arrondit chaque couche avant d'additionner", async () => {
    // Arrange — 4,50 × 1,10 = 4,95 ; 0,50 × 2,25 = 1,125 → 1,13 ; total 6,08
    prisma.couchesFifo.findMany.mockResolvedValue([
      { id: 1, orderIndex: 1, quantiteRestante: 4.5, prixUnitaire: 1.1 },
      { id: 2, orderIndex: 2, quantiteRestante: 2, prixUnitaire: 2.25 },
    ]);

    // Act
    const resultat = await onSortieStock(prisma, {
      ...ids,
      quantite: 5,
      methode: "FIFO",
    });

    // Assert
    expect(resultat.coutTotal).toBe(6.08);
  });

  test("LIFO consomme la couche la plus récente", async () => {
    // Arrange — demande 8 : 6 × 30 + 2 × 10 = 180 + 20 = 200 ; unitaire 200 / 8 = 25
    prisma.article.findFirst.mockResolvedValue({ id: 1, prixAchat: 99 });
    prisma.couchesFifo.findMany.mockResolvedValue([...couchesFifo()].reverse());

    // Act
    const lifo = await calculateLIFO(1, 1, 2, 8);
    const sortie = await onSortieStock(prisma, {
      ...ids,
      quantite: 5,
      methode: "LIFO",
    });

    // Assert — sortie 5 : uniquement la couche récente 5 × 30 = 150
    expect(lifo.totalValue).toBe(200);
    expect(lifo.unit_cost).toBe(25);
    expect(sortie.coutTotal).toBe(150);
  });

  test("le coût FIFO unitaire est le prix de la couche la plus ancienne", async () => {
    prisma.article.findFirst.mockResolvedValue({
      id: 1,
      prixAchat: 99,
      strategieSortie: "FIFO",
    });
    prisma.couchesFifo.findFirst.mockResolvedValue({ prixUnitaire: 10 });

    const cout = await getCoutUnitaireCourant(prisma, { ...ids, methode: "FIFO" });

    expect(cout).toBe(10);
  });

  it("une sortie FIFO de quantité négative est refusée", async () => {
    prisma.couchesFifo.findMany.mockResolvedValue(couchesFifo());

    await expect(
      onSortieStock(prisma, { ...ids, quantite: -5, methode: "FIFO" })
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.couchesFifo.update).not.toHaveBeenCalled();
  });

  test("une sortie nulle en FIFO ne coûte rien", async () => {
    prisma.couchesFifo.findMany.mockResolvedValue(couchesFifo());

    const resultat = await onSortieStock(prisma, {
      ...ids,
      quantite: 0,
      methode: "FIFO",
    });

    expect(resultat.coutTotal).toBe(0);
    expect(prisma.couchesFifo.update).not.toHaveBeenCalled();
  });
});

describe("dernier prix d'achat", () => {
  test("retient le prix de la ligne la plus récente, arrondi au centième", async () => {
    // Arrange — 12,345 → 12,35
    prisma.ligneAchat.findFirst.mockResolvedValue({
      prixUnit: 12.345,
      achat: { reference: "ACH-9", dateReception: "2026-03-01", dateCommande: "2026-02-01" },
    });

    // Act
    const prix = await getDernierPrixAchat(1, 1, 2);

    // Assert
    expect(prix.valeurUnit).toBe(12.35);
    expect(prix.achatReference).toBe("ACH-9");
  });

  test("sans achat, retombe sur le prix d'achat article", async () => {
    prisma.ligneAchat.findFirst.mockResolvedValue(null);
    prisma.article.findFirst.mockResolvedValue({ prixAchat: 7.5 });

    const prix = await getDernierPrixAchat(1, 1, 2);

    expect(prix).toMatchObject({ valeurUnit: 7.5, dateAchat: null, achatReference: null });
  });

  test("sans achat et sans prix article, la valeur est zéro", async () => {
    prisma.ligneAchat.findFirst.mockResolvedValue(null);
    prisma.article.findFirst.mockResolvedValue({ prixAchat: null });

    const prix = await getDernierPrixAchat(1, 1, 2);

    expect(prix.valeurUnit).toBe(0);
  });

  test("le coût unitaire dernier prix reprend cette valeur", async () => {
    prisma.article.findFirst.mockResolvedValue({ id: 1, prixAchat: 1, strategieSortie: "FIFO" });
    prisma.ligneAchat.findFirst.mockResolvedValue({
      prixUnit: 18.2,
      achat: { reference: "ACH-1", dateReception: null, dateCommande: "2026-01-01" },
    });

    const cout = await getCoutUnitaireCourant(prisma, {
      ...ids,
      methode: "DERNIER_PRIX_ACHAT",
    });

    expect(cout).toBe(18.2);
  });
});
