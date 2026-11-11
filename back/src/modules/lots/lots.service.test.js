"use strict";

jest.mock("../../config/database", () => {
  const { creerMockPrisma } = require("../../__tests__/helpers/prismaMock");
  return creerMockPrisma();
});

const prisma = require("../../config/database");
const { creerMockPrisma, reinitialiserMockPrisma } = require("../../__tests__/helpers/prismaMock");
const {
  sortLotsFefo,
  lotOrderBy,
  consumeLotsInTransaction,
  notifierClientsLot,
} = require("./lots.service");

function nouveauTx(strategie = "FIFO") {
  const tx = creerMockPrisma();
  tx.article.findFirst.mockResolvedValue({
    id: 1,
    libelle: "Huile d'olive",
    strategieSortie: strategie,
  });
  tx.lot.update.mockImplementation(async ({ where, data }) => ({
    id: where.id,
    ...data,
  }));
  return tx;
}

const demande = {
  articleId: 1,
  depotId: 2,
  societeId: 1,
};

describe("tri des lots", () => {
  test("FEFO place l'expiration la plus proche en premier", () => {
    // Arrange
    const lots = [
      { id: 3, dateExpiration: "2026-12-01", dateFabrication: "2026-01-01" },
      { id: 1, dateExpiration: "2026-06-01", dateFabrication: "2026-02-01" },
      { id: 2, dateExpiration: "2026-06-01", dateFabrication: "2026-01-01" },
    ];

    // Act
    const ordre = sortLotsFefo(lots).map((lot) => lot.id);

    // Assert — juin avant décembre, et à expiration égale la fabrication la plus ancienne
    expect(ordre).toEqual([2, 1, 3]);
    expect(lotOrderBy("FEFO")).toEqual([
      { dateExpiration: "asc" },
      { dateFabrication: "asc" },
      { id: "asc" },
    ]);
  });

  test("FEFO place les lots sans date d'expiration en dernier", () => {
    // Arrange
    const lots = [
      { id: 4, dateExpiration: null, dateFabrication: "2020-01-01" },
      { id: 5, dateExpiration: "pas-une-date", dateFabrication: "2024-01-01" },
      { id: 1, dateExpiration: "2026-08-01", dateFabrication: "2026-01-01" },
    ];

    // Act
    const ordre = sortLotsFefo(lots).map((lot) => lot.id);

    // Assert
    expect(ordre).toEqual([1, 4, 5]);
  });

  test("FIFO demande la fabrication la plus ancienne puis l'id", () => {
    // Act
    const ordre = lotOrderBy("FIFO");

    // Assert
    expect(ordre).toEqual([{ dateFabrication: "asc" }, { id: "asc" }]);
    expect(lotOrderBy(undefined)).toEqual(ordre);
  });

  test("STANDARD trie uniquement par id", () => {
    expect(lotOrderBy("STANDARD")).toEqual([{ id: "asc" }]);
  });
});

describe("consommation de lots", () => {
  test("répartition d'une sortie sur plusieurs lots", async () => {
    // Arrange — 4 puis 6, demande 7
    const tx = nouveauTx("FEFO");
    tx.lot.findMany.mockResolvedValue([
      { id: 11, numero: "A", quantiteRestante: 4, statut: "ACTIF", dateExpiration: "2026-06-01" },
      { id: 12, numero: "B", quantiteRestante: 6, statut: "ACTIF", dateExpiration: "2026-12-01" },
    ]);

    // Act
    const resultat = await consumeLotsInTransaction(tx, {
      ...demande,
      quantite: 7,
      strategie: "FEFO",
    });

    // Assert — 4 sur A (épuisé) et 3 sur B (reste 3)
    expect(resultat.lotsConsumed).toEqual([
      { lotId: 11, lotNumero: "A", quantite: 4, dateExpiration: "2026-06-01" },
      { lotId: 12, lotNumero: "B", quantite: 3, dateExpiration: "2026-12-01" },
    ]);
    expect(tx.lot.update).toHaveBeenNthCalledWith(1, {
      where: { id: 11 },
      data: { quantiteRestante: 0, statut: "EPUISE" },
    });
    expect(tx.lot.update).toHaveBeenNthCalledWith(2, {
      where: { id: 12 },
      data: { quantiteRestante: 3, statut: "ACTIF" },
    });
    expect(tx.lot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: lotOrderBy("FEFO") })
    );
  });

  test("une sortie décimale est répartie et arrondie au centième", async () => {
    // Arrange — 1,10 + 2,25, demande 2,50 → 1,10 puis 1,40, reste 0,85
    const tx = nouveauTx();
    tx.lot.findMany.mockResolvedValue([
      { id: 1, numero: "A", quantiteRestante: 1.1, statut: "ACTIF" },
      { id: 2, numero: "B", quantiteRestante: 2.25, statut: "ACTIF" },
    ]);

    // Act
    const resultat = await consumeLotsInTransaction(tx, { ...demande, quantite: 2.5 });

    // Assert
    expect(resultat.lotsConsumed.map((l) => l.quantite)).toEqual([1.1, 1.4]);
    expect(tx.lot.update).toHaveBeenLastCalledWith({
      where: { id: 2 },
      data: { quantiteRestante: 0.85, statut: "ACTIF" },
    });
  });

  test("une très grande quantité est répartie sans perdre le centième", async () => {
    // Arrange — 1 000 000,50 + 2 000 000,25, demande 1 500 000,75
    const tx = nouveauTx();
    tx.lot.findMany.mockResolvedValue([
      { id: 1, numero: "A", quantiteRestante: 1000000.5, statut: "ACTIF" },
      { id: 2, numero: "B", quantiteRestante: 2000000.25, statut: "ACTIF" },
    ]);

    // Act
    const resultat = await consumeLotsInTransaction(tx, {
      ...demande,
      quantite: 1500000.75,
    });

    // Assert — reste du second lot : 2 000 000,25 − 500 000,25 = 1 500 000
    expect(resultat.lotsConsumed.map((l) => l.quantite)).toEqual([1000000.5, 500000.25]);
    expect(tx.lot.update).toHaveBeenLastCalledWith({
      where: { id: 2 },
      data: { quantiteRestante: 1500000, statut: "ACTIF" },
    });
  });

  test.each([
    ["quantité 0", 0],
    ["quantité négative", -3],
    ["quantité nulle", null],
  ])("une %s est refusée et aucun lot n'est lu", async (_libelle, quantite) => {
    // Arrange
    const tx = nouveauTx();

    // Act / Assert
    await expect(
      consumeLotsInTransaction(tx, { ...demande, quantite })
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.lot.findMany).not.toHaveBeenCalled();
    expect(tx.lot.update).not.toHaveBeenCalled();
  });

  test("une vente supérieure au stock lève STOCK_INSUFFISANT", async () => {
    // Arrange — 4 + 3 = 7, demande 10, il manque 3
    const tx = nouveauTx();
    tx.lot.findMany.mockResolvedValue([
      { id: 1, numero: "A", quantiteRestante: 4, statut: "ACTIF" },
      { id: 2, numero: "B", quantiteRestante: 3, statut: "ACTIF" },
    ]);

    // Act / Assert
    await expect(
      consumeLotsInTransaction(tx, { ...demande, quantite: 10 })
    ).rejects.toMatchObject({
      status: 409,
      code: "STOCK_INSUFFISANT",
      details: { demande: 10, manquant: 3 },
    });
  });

  it("une vente supérieure au stock ne modifie aucun lot", async () => {
    // Arrange
    const tx = nouveauTx();
    tx.lot.findMany.mockResolvedValue([
      { id: 1, numero: "A", quantiteRestante: 4, statut: "ACTIF" },
      { id: 2, numero: "B", quantiteRestante: 3, statut: "ACTIF" },
    ]);

    // Act
    await expect(
      consumeLotsInTransaction(tx, { ...demande, quantite: 10 })
    ).rejects.toMatchObject({ code: "STOCK_INSUFFISANT" });

    // Assert
    expect(tx.lot.update).not.toHaveBeenCalled();
  });

  it("en FEFO un lot daté sort avant un lot sans date d'expiration", async () => {
    // Arrange — l'ordre SQL place le lot sans date en premier
    const tx = nouveauTx("FEFO");
    tx.lot.findMany.mockResolvedValue([
      { id: 9, numero: "SANS", quantiteRestante: 5, dateExpiration: null, statut: "ACTIF" },
      {
        id: 2,
        numero: "DATE",
        quantiteRestante: 5,
        dateExpiration: "2026-06-01",
        statut: "ACTIF",
      },
    ]);

    // Act
    const resultat = await consumeLotsInTransaction(tx, {
      ...demande,
      quantite: 1,
      strategie: "FEFO",
    });

    // Assert
    expect(resultat.lotsConsumed[0].lotId).toBe(2);
  });

  it("en FEFO deux lots à la même date sont départagés par id croissant", async () => {
    // Arrange
    const tx = nouveauTx("FEFO");
    tx.lot.findMany.mockResolvedValue([
      {
        id: 8,
        numero: "B",
        quantiteRestante: 5,
        dateExpiration: "2026-06-01",
        dateFabrication: "2026-01-01",
        statut: "ACTIF",
      },
      {
        id: 3,
        numero: "A",
        quantiteRestante: 5,
        dateExpiration: "2026-06-01",
        dateFabrication: "2026-01-01",
        statut: "ACTIF",
      },
    ]);

    // Act
    const resultat = await consumeLotsInTransaction(tx, {
      ...demande,
      quantite: 1,
      strategie: "FEFO",
    });

    // Assert
    expect(resultat.lotsConsumed[0].lotId).toBe(3);
  });

  it("en FIFO un lot sans date conserve l'ordre renvoyé par la base", async () => {
    // Arrange
    const tx = nouveauTx("FIFO");
    tx.lot.findMany.mockResolvedValue([
      { id: 9, numero: "SANS", quantiteRestante: 5, dateExpiration: null, statut: "ACTIF" },
      {
        id: 2,
        numero: "DATE",
        quantiteRestante: 5,
        dateExpiration: "2026-06-01",
        statut: "ACTIF",
      },
    ]);

    // Act
    const resultat = await consumeLotsInTransaction(tx, {
      ...demande,
      quantite: 1,
      strategie: "FIFO",
    });

    // Assert
    expect(resultat.lotsConsumed[0].lotId).toBe(9);
  });
});

describe("rappel de lot", () => {
  const user = { id: 4, societeId: 1, role: "RESPONSABLE" };

  beforeEach(() => {
    reinitialiserMockPrisma(prisma);
  });

  test("deux clients sont notifiés, sans doublon si l'un a deux ventes", async () => {
    prisma.lot.findFirst.mockResolvedValue({
      id: 3,
      articleId: 1,
      numero: "LOT-003",
      article: { id: 1, libelle: "Huile", societeId: 1 },
    });
    prisma.mouvement.findMany.mockResolvedValue([]);
    prisma.ligneVente.findMany.mockResolvedValue([
      {
        id: 1,
        quantite: 2,
        lotsConsumed: JSON.stringify([{ lotId: 3, quantite: 2 }]),
        vente: {
          id: 10,
          reference: "VTE-1",
          dateVente: "2026-06-01",
          client: { id: 1, nom: "Client A", email: "a@test.local", telephone: "111" },
        },
      },
      {
        id: 2,
        quantite: 1,
        lotsConsumed: JSON.stringify([{ lotId: 3, quantite: 1 }]),
        vente: {
          id: 11,
          reference: "VTE-2",
          dateVente: "2026-06-02",
          client: { id: 1, nom: "Client A", email: "a@test.local", telephone: "111" },
        },
      },
      {
        id: 3,
        quantite: 4,
        lotsConsumed: JSON.stringify([{ lotId: 3, quantite: 4 }]),
        vente: {
          id: 12,
          reference: "VTE-3",
          dateVente: "2026-06-03",
          client: { id: 2, nom: "Client B", email: "b@test.local", telephone: "222" },
        },
      },
      {
        id: 4,
        quantite: 9,
        lotsConsumed: JSON.stringify([{ lotId: 99, quantite: 9 }]),
        vente: {
          id: 13,
          reference: "VTE-4",
          dateVente: "2026-06-04",
          client: { id: 3, nom: "Client C", email: "c@test.local", telephone: "333" },
        },
      },
    ]);
    prisma.lot.update.mockResolvedValue({});

    const resultat = await notifierClientsLot(3, user, null);

    expect(resultat.clients).toHaveLength(2);
    const clientA = resultat.clients.find((ligne) => ligne.client.email === "a@test.local");
    expect(clientA.ventes).toHaveLength(2);
    expect(clientA.quantiteTotale).toBe(3);
    expect(prisma.lot.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { statutRappel: "NOTIFIE" },
    });
  });
});
