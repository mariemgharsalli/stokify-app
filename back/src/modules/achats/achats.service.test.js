"use strict";

jest.mock("../../config/database", () => {
  const { creerMockPrisma } = require("../../__tests__/helpers/prismaMock");
  return creerMockPrisma();
});
jest.mock("../mouvements/mouvements.service", () => ({
  adjustStock: jest.fn(async () => ({})),
  insertMouvement: jest.fn(async () => ({ id: 1 })),
  resolveDepot: jest.fn(async (_tx, _sid, depotId) => Number(depotId) || 1),
  MOUVEMENT_TYPES: { ENTREE_ACHAT: "ENTREE_ACHAT" },
}));
jest.mock("../lots/lots.service", () => ({
  ensureStockCoveredByLots: jest.fn(),
  attachLotsToLignes: (row) => row,
  generateNumeroLot: jest.fn(),
}));
jest.mock("../valuation/valuation.service", () => ({
  onEntreeStock: jest.fn(async () => ({})),
}));
jest.mock("../numeroserie/numeroserie.service", () => ({
  generateNumeroSerie: jest.fn(),
}));
jest.mock("../stock/stock.service", () => ({}));
jest.mock("../../utils/pdfHelper", () => ({}));

const prisma = require("../../config/database");
const { reinitialiserMockPrisma } = require("../../__tests__/helpers/prismaMock");
const { adjustStock } = require("../mouvements/mouvements.service");
const {
  createAchat,
  receptionnerLigne,
  statutPaiementFromMontants,
  enregistrerPaiementAchat,
} = require("./achats.service");

const user = { id: 3, societeId: 1, role: "MAGASINIER" };

function article(id, tauxTva) {
  return {
    id,
    statut: "ACTIF",
    actif: true,
    societeId: 1,
    libelle: `Article ${id}`,
    tauxTva,
    modeTracage: "AUCUN",
    modeGestion: "STANDARD",
  };
}

beforeEach(() => {
  reinitialiserMockPrisma(prisma);
  adjustStock.mockClear();
  prisma.fournisseur.findFirst.mockResolvedValue({ id: 6, societeId: 1, nom: "Fournisseur" });
  prisma.achat.create.mockImplementation(async ({ data }) => data);
  prisma.article.findFirst.mockImplementation(async ({ where }) => {
    if (Number(where.id) === 2) return article(2, 7);
    return article(1, 19);
  });
});

describe("totaux d'achat", () => {
  function creer(lignes) {
    return createAchat(user, {
      fournisseurId: 6,
      depotId: 1,
      reference: "ACH-MANUEL",
      lignes,
    });
  }

  test("calcule HT, TVA et TTC", async () => {
    // Arrange — 4 × 25 = 100 HT ; TVA 19 ; TTC 119
    const achat = await creer([{ articleId: 1, quantite: 4, prixUnit: 25 }]);

    expect(achat.totalHT).toBe(100);
    expect(achat.totalTVA).toBe(19);
    expect(achat.totalTTC).toBe(119);
  });

  test("arrondit une ligne décimale au centième", async () => {
    // Arrange — 3 × 10,33 − 0,10 = 30,89 HT ; TVA 30,89 × 0,19 = 5,8691 → 5,87 ; TTC 36,76
    const achat = await creer([{ articleId: 1, quantite: 3, prixUnit: 10.33, remise: 0.1 }]);

    expect(achat.totalHT).toBe(30.89);
    expect(achat.totalTVA).toBe(5.87);
    expect(achat.totalTTC).toBe(36.76);
  });

  test("une très grande quantité reste exacte", async () => {
    // Arrange — 1 000 000 × 19,99 = 19 990 000 ; TVA 3 798 100 ; TTC 23 788 100
    const achat = await creer([{ articleId: 1, quantite: 1000000, prixUnit: 19.99 }]);

    expect(achat.totalHT).toBe(19990000);
    expect(achat.totalTVA).toBe(3798100);
    expect(achat.totalTTC).toBe(23788100);
  });

  test.each([
    ["quantité 0", 0],
    ["quantité négative", -2],
    ["quantité nulle", null],
  ])("une %s est refusée", async (_libelle, quantite) => {
    await expect(
      creer([{ articleId: 1, quantite, prixUnit: 10 }])
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.achat.create).not.toHaveBeenCalled();
  });

  test("un prix négatif est refusé", async () => {
    await expect(
      creer([{ articleId: 1, quantite: 1, prixUnit: -5 }])
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("statut de paiement d'un achat", () => {
  test.each([
    [0, "NON_REGLE"],
    [null, "NON_REGLE"],
    [40, "PARTIEL"],
    [10.09, "PARTIEL"],
    [119, "REGLE"],
    [1000000.5, "REGLE"],
  ])("montant réglé %s sur le TTC donne %s", (regle, attendu) => {
    const ttc = regle === 10.09 ? 10.1 : regle === 1000000.5 ? 1000000.5 : 119;
    expect(statutPaiementFromMontants(ttc, regle)).toBe(attendu);
  });

  test("un paiement partiel met à jour le statut", async () => {
    prisma.achat.findFirst.mockResolvedValue({
      id: 5,
      totalTTC: 119,
      montantRegle: 0,
    });
    prisma.achat.update.mockImplementation(async ({ data }) => data);

    const achat = await enregistrerPaiementAchat(user, 5, { montant: 40 });

    expect(achat).toMatchObject({ montantRegle: 40, statutPaiement: "PARTIEL" });
  });

  test.each([
    ["montant 0", 0],
    ["montant négatif", -10],
    ["montant nul", null],
  ])("un %s est refusé", async (_libelle, montant) => {
    await expect(enregistrerPaiementAchat(user, 5, { montant })).rejects.toMatchObject({
      status: 400,
    });
    expect(prisma.achat.update).not.toHaveBeenCalled();
  });
});

describe("réception partielle d'un achat", () => {
  function preparerAchat({ quantite = 10, deja = 4, statut = "COMMANDE" } = {}) {
    prisma.achat.findFirst.mockResolvedValue({
      id: 5,
      reference: "ACH-1",
      statut,
      depotId: 2,
      societeId: 1,
      lignes: [
        {
          id: 9,
          articleId: 1,
          quantite,
          quantiteRecue: deja,
          prixUnit: 10,
          totalHT: quantite * 10,
          article: article(1, 19),
        },
      ],
    });
    prisma.ligneAchat.update.mockResolvedValue({});
    prisma.achat.update.mockImplementation(async ({ data }) => ({ id: 5, ...data }));
  }

  test("reçoit une partie et laisse le bon ouvert", async () => {
    // Arrange — commandé 10, déjà 4, on reçoit 3 → reçu 7, pas encore RECU
    preparerAchat();
    prisma.ligneAchat.findMany.mockResolvedValue([{ quantite: 10, quantiteRecue: 7 }]);

    const achat = await receptionnerLigne(user, 5, 9, { quantiteRecue: 3 });

    expect(adjustStock).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ delta: 3, depotId: 2 })
    );
    expect(prisma.ligneAchat.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { quantiteRecue: 7 },
    });
    expect(achat.statut).toBeUndefined();
  });

  test("la dernière quantité passe le bon à RECU", async () => {
    preparerAchat({ deja: 4 });
    prisma.ligneAchat.findMany.mockResolvedValue([{ quantite: 10, quantiteRecue: 10 }]);

    const achat = await receptionnerLigne(user, 5, 9, { quantiteRecue: 6 });

    expect(achat.statut).toBe("RECU");
    expect(prisma.ligneAchat.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { quantiteRecue: 10 },
    });
  });

  test("une réception décimale est arrondie au centième", async () => {
    // Arrange — déjà 1,10 + 2,25 = 3,35
    preparerAchat({ deja: 1.1, quantite: 10 });
    prisma.ligneAchat.findMany.mockResolvedValue([{ quantite: 10, quantiteRecue: 3.35 }]);

    await receptionnerLigne(user, 5, 9, { quantiteRecue: 2.25 });

    expect(prisma.ligneAchat.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { quantiteRecue: 3.35 },
    });
  });

  test("une très grande réception partielle est enregistrée", async () => {
    preparerAchat({ quantite: 2000000, deja: 0 });
    prisma.ligneAchat.findMany.mockResolvedValue([
      { quantite: 2000000, quantiteRecue: 1000000.5 },
    ]);

    await receptionnerLigne(user, 5, 9, { quantiteRecue: 1000000.5 });

    expect(adjustStock).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ delta: 1000000.5 })
    );
  });

  test("une quantité supérieure au restant est refusée", async () => {
    preparerAchat({ quantite: 10, deja: 4 });

    await expect(receptionnerLigne(user, 5, 9, { quantiteRecue: 7 })).rejects.toMatchObject({
      status: 422,
    });
    expect(prisma.ligneAchat.update).not.toHaveBeenCalled();
    expect(adjustStock).not.toHaveBeenCalled();
  });

  test.each([
    ["quantité 0", 0],
    ["quantité négative", -1],
    ["quantité nulle", null],
  ])("une %s est refusée", async (_libelle, quantiteRecue) => {
    await expect(receptionnerLigne(user, 5, 9, { quantiteRecue })).rejects.toMatchObject({
      status: 422,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
