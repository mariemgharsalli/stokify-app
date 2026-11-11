"use strict";

jest.mock("../../config/database", () => {
  const { creerMockPrisma } = require("../../__tests__/helpers/prismaMock");
  return creerMockPrisma();
});

const prisma = require("../../config/database");
const { reinitialiserMockPrisma } = require("../../__tests__/helpers/prismaMock");
const { confirmerVente, createVente } = require("./ventes.service");
const { syncVentePaiement } = require("../reglements/reglements.service");

const user = { id: 2, societeId: 1, role: "COMPTABLE" };

function article(id, tauxTva, prixVente) {
  return {
    id,
    statut: "ACTIF",
    actif: true,
    libelle: `Article ${id}`,
    prixVente,
    tauxTva,
  };
}

beforeEach(() => {
  reinitialiserMockPrisma(prisma);
  prisma.client.findFirst.mockResolvedValue({ id: 4, nom: "Client", code: "C1" });
  prisma.depot.findFirst.mockResolvedValue({
    id: 1,
    societeId: 1,
    statut: "ACTIF",
    code: "D1",
    libelle: "Central",
  });
  prisma.vente.findFirst.mockResolvedValue(null);
  prisma.vente.create.mockImplementation(async ({ data }) => data);
  prisma.article.findFirst.mockImplementation(async ({ where }) => {
    if (Number(where.id) === 2) return article(2, 7, 40);
    return article(1, 19, 50);
  });
});

function creer(lignes, extra = {}) {
  return createVente(user, {
    clientId: 4,
    depotId: 1,
    reference: "VTE-MANUELLE",
    lignes,
    ...extra,
  });
}

describe("totaux de vente", () => {
  test("calcule HT, TVA 19 % et TTC", async () => {
    // Arrange — 2 × 50 = 100 HT ; TVA 100 × 0,19 = 19 ; TTC 119
    const vente = await creer([{ articleId: 1, quantite: 2, prixUnit: 50 }]);

    expect(vente.totalHT).toBe(100);
    expect(vente.totalTVA).toBe(19);
    expect(vente.totalTTC).toBe(119);
  });

  test("additionne deux taux de TVA", async () => {
    // Arrange — 100 HT à 19 % = 19 ; 40 HT à 7 % = 2,80 ; totaux 140 / 21,80 / 161,80
    const vente = await creer([
      { articleId: 1, quantite: 2, prixUnit: 50 },
      { articleId: 2, quantite: 1, prixUnit: 40 },
    ]);

    expect(vente.totalHT).toBe(140);
    expect(vente.totalTVA).toBe(21.8);
    expect(vente.totalTTC).toBe(161.8);
  });

  test("arrondit une ligne décimale au centième", async () => {
    // Arrange — 3 × 19,99 = 59,97 HT ; TVA 59,97 × 0,19 = 11,3943 → 11,39 ; TTC 71,36
    const vente = await creer([{ articleId: 1, quantite: 3, prixUnit: 19.99 }]);

    expect(vente.totalHT).toBe(59.97);
    expect(vente.totalTVA).toBe(11.39);
    expect(vente.totalTTC).toBe(71.36);
  });

  test("une très grande quantité reste exacte au centième", async () => {
    // Arrange — 1 000 000 × 19,99 = 19 990 000 ; TVA 3 798 100 ; TTC 23 788 100
    const vente = await creer([{ articleId: 1, quantite: 1000000, prixUnit: 19.99 }]);

    expect(vente.totalHT).toBe(19990000);
    expect(vente.totalTVA).toBe(3798100);
    expect(vente.totalTTC).toBe(23788100);
  });

  test("un prix absent reprend le prix de vente de l'article", async () => {
    // Arrange — prix article 50, qté 2 → 100 HT, TVA 19, TTC 119
    const vente = await creer([{ articleId: 1, quantite: 2, prixUnit: null }]);

    expect(vente.totalTTC).toBe(119);
  });

  test("une remise de ligne est déduite avant la TVA", async () => {
    // Arrange — 2 × 10 − 3 = 17 HT ; TVA 17 × 0,19 = 3,23 ; TTC 20,23
    const vente = await creer([
      { articleId: 1, quantite: 2, prixUnit: 10, remise: 3 },
    ]);

    expect(vente.totalHT).toBe(17);
    expect(vente.totalTVA).toBe(3.23);
    expect(vente.totalTTC).toBe(20.23);
  });

  test.each([
    ["quantité 0", 0],
    ["quantité négative", -1],
    ["quantité nulle", null],
  ])("une %s est refusée", async (_libelle, quantite) => {
    await expect(
      creer([{ articleId: 1, quantite, prixUnit: 10 }])
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.vente.create).not.toHaveBeenCalled();
  });
});

describe("statut de paiement d'une vente", () => {
  function preparerRegle(montant, totalTTC) {
    prisma.reglement.aggregate.mockResolvedValue({ _sum: { montant } });
    prisma.vente.findFirst.mockResolvedValue({ id: 9, totalTTC });
    prisma.vente.updateMany.mockResolvedValue({ count: 1 });
    prisma.facture.findFirst.mockResolvedValue(null);
  }

  test("aucun règlement donne NON_REGLE", async () => {
    preparerRegle(0, 119);

    const sync = await syncVentePaiement(prisma, 9, user.societeId);

    expect(sync.statutPaiement).toBe("NON_REGLE");
  });

  test("un règlement partiel donne PARTIEL", async () => {
    // Arrange — 40 payés sur 119
    preparerRegle(40, 119);

    const sync = await syncVentePaiement(prisma, 9, user.societeId);

    expect(sync.statutPaiement).toBe("PARTIEL");
    expect(prisma.vente.updateMany).toHaveBeenCalledWith({
      where: { id: 9, societeId: user.societeId },
      data: { montantRegle: 40, statutPaiement: "PARTIEL" },
    });
  });

  test("un règlement égal au TTC donne REGLE", async () => {
    preparerRegle(71.36, 71.36);

    const sync = await syncVentePaiement(prisma, 9, user.societeId);

    expect(sync.statutPaiement).toBe("REGLE");
  });

  test("un centime manquant reste PARTIEL", async () => {
    // Arrange — 10,09 sur 10,10
    preparerRegle(10.09, 10.1);

    const sync = await syncVentePaiement(prisma, 9, user.societeId);

    expect(sync.statutPaiement).toBe("PARTIEL");
  });

  test("un montant réglé nul est NON_REGLE", async () => {
    preparerRegle(null, 100);

    const sync = await syncVentePaiement(prisma, 9, user.societeId);

    expect(sync.statutPaiement).toBe("NON_REGLE");
  });
});

describe("confirmation de vente", () => {
  test("une vente déjà confirmée ne peut pas l'être une seconde fois", async () => {
    prisma.vente.findFirst.mockResolvedValue({
      id: 9,
      statut: "CONFIRME",
      societeId: 1,
      depotId: 1,
      typeVente: "COMPTOIR",
      lignes: [],
    });

    await expect(confirmerVente(user, 9)).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
    expect(prisma.stock.update).not.toHaveBeenCalled();
    expect(prisma.mouvement.create).not.toHaveBeenCalled();
  });

  test("une commande web sans dépôt couvrant est refusée en 409", async () => {
    prisma.vente.findFirst.mockResolvedValue({
      id: 9,
      statut: "BROUILLON",
      typeVente: "COMMANDE_WEB",
      societeId: 1,
      depotId: 1,
      lignes: [
        {
          articleId: 1,
          quantite: 5,
          article: { id: 1, libelle: "Huile", statut: "ACTIF", modeTracage: "AUCUN" },
        },
      ],
    });
    prisma.depot.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.stock.findMany.mockResolvedValue([]);

    await expect(confirmerVente(user, 9)).rejects.toMatchObject({
      status: 409,
      code: "STOCK_INSUFFISANT",
    });
    expect(prisma.vente.update).not.toHaveBeenCalled();
  });
});
