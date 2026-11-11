"use strict";

jest.mock("../../config/database", () => {
  const { creerMockPrisma } = require("../../__tests__/helpers/prismaMock");
  return creerMockPrisma();
});
jest.mock("../mouvements/mouvements.service", () => ({
  adjustStock: jest.fn(async () => ({})),
  insertMouvement: jest.fn(async (_tx, payload) => payload),
  genRef: jest.fn(() => "MVT-INV-TEST"),
}));
jest.mock("../valuation/valuation.service", () => ({
  getCoutUnitaireCourant: jest.fn(async () => 12.5),
  ensureStockCoveredByCouches: jest.fn(async () => null),
}));
jest.mock("../lots/lots.service", () => ({
  ensureStockCoveredByLots: jest.fn(async () => null),
  consumeLotsInTransaction: jest.fn(async () => ({
    strategy: "FIFO",
    lotsConsumed: [],
  })),
}));
jest.mock("../../utils/pdfHelper", () => ({ generateInventairePdf: jest.fn() }));
jest.mock("../../utils/excelHelper", () => ({
  generateInventaireExcel: jest.fn(),
  generateInventairesListExcel: jest.fn(),
}));

const prisma = require("../../config/database");
const { reinitialiserMockPrisma } = require("../../__tests__/helpers/prismaMock");
const mouvements = require("../mouvements/mouvements.service");
const lots = require("../lots/lots.service");
const { validateInventaire } = require("./inventaires.service");

const user = { id: 4, societeId: 1, role: "RESPONSABLE" };

function ligne(remplacements) {
  return {
    id: 8,
    articleId: 1,
    emplacementId: null,
    lotId: null,
    qteTheorique: 10,
    qteReelle: 10,
    recomptageDemande: false,
    article: { id: 1, code: "HUILE", libelle: "Huile", strategieSortie: "FIFO" },
    ...remplacements,
  };
}

function preparer(lignes) {
  const inventaire = {
    id: 3,
    statut: "EN_COURS",
    reference: "INV-1",
    depotId: 2,
    depot: { id: 2 },
    lignes,
  };
  prisma.inventaire.findFirst.mockResolvedValue(inventaire);
  prisma.inventaire.findUnique.mockResolvedValue({ ...inventaire, statut: "VALIDE" });
  prisma.inventaire.update.mockResolvedValue({});
  prisma.ligneInventaire.update.mockResolvedValue({});
}

beforeEach(() => {
  reinitialiserMockPrisma(prisma);
  mouvements.adjustStock.mockClear();
  mouvements.insertMouvement.mockClear();
  lots.consumeLotsInTransaction.mockClear();
  lots.ensureStockCoveredByLots.mockClear();
});

describe("validation d'inventaire", () => {
  test("un écart positif crée une ENTREE_AJUSTEMENT", async () => {
    // Arrange — réel 12, théorique 10, écart +2 ; valeur 2 × 12,50 = 25,00
    preparer([ligne({ qteReelle: 12 })]);

    // Act
    await validateInventaire(3, user);

    // Assert
    expect(mouvements.adjustStock).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ delta: 2, articleId: 1, depotId: 2 })
    );
    expect(mouvements.insertMouvement).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        type: "ENTREE_AJUSTEMENT",
        quantite: 2,
        valeur: 25,
      })
    );
  });

  test("un écart négatif crée une SORTIE_AUTRE", async () => {
    // Arrange — réel 7, théorique 10, écart −3
    preparer([ligne({ qteReelle: 7 })]);

    // Act
    await validateInventaire(3, user);

    // Assert
    expect(mouvements.adjustStock).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ delta: -3 })
    );
    expect(mouvements.insertMouvement).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ type: "SORTIE_AUTRE", quantite: 3 })
    );
    expect(lots.consumeLotsInTransaction).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ quantite: 3 })
    );
  });

  test("un écart nul ne crée aucun mouvement", async () => {
    preparer([ligne({ qteTheorique: 4, qteReelle: 4 })]);

    await validateInventaire(3, user);

    expect(mouvements.adjustStock).not.toHaveBeenCalled();
    expect(mouvements.insertMouvement).not.toHaveBeenCalled();
    expect(prisma.ligneInventaire.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ecart: 0, valeurEcart: 0, valide: true }),
      })
    );
  });

  test("valider sans ajustement clôture l'inventaire sans toucher le stock", async () => {
    // Arrange — écart réel +5, mais l'action ne doit pas l'appliquer
    preparer([ligne({ qteReelle: 15 })]);

    // Act
    await validateInventaire(3, user, { action: "valider_sans_ajustement" });

    // Assert
    expect(mouvements.adjustStock).not.toHaveBeenCalled();
    expect(mouvements.insertMouvement).not.toHaveBeenCalled();
    expect(lots.consumeLotsInTransaction).not.toHaveBeenCalled();
    expect(prisma.inventaire.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { statut: "VALIDE" },
    });
  });

  test("un écart décimal est arrondi au centième", async () => {
    // Arrange — 10,40 − 10,25 = 0,15 ; valeur 0,15 × 12,50 = 1,875 → 1,88
    preparer([ligne({ qteTheorique: 10.25, qteReelle: 10.4 })]);

    await validateInventaire(3, user);

    expect(mouvements.insertMouvement).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        type: "ENTREE_AJUSTEMENT",
        quantite: 0.15,
        valeur: 1.88,
      })
    );
  });

  test("une très grande quantité constatée entre en ajustement", async () => {
    preparer([ligne({ qteTheorique: 0, qteReelle: 1000000.5 })]);

    await validateInventaire(3, user);

    expect(mouvements.insertMouvement).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        type: "ENTREE_AJUSTEMENT",
        quantite: 1000000.5,
      })
    );
  });

  test("une quantité réelle absente est refusée", async () => {
    preparer([ligne({ qteReelle: null })]);

    await expect(validateInventaire(3, user)).rejects.toMatchObject({ status: 400 });
    expect(mouvements.insertMouvement).not.toHaveBeenCalled();
  });

  it("une quantité réelle négative est refusée et n'ajuste pas le stock", async () => {
    preparer([ligne({ qteTheorique: 5, qteReelle: -2 })]);

    await expect(validateInventaire(3, user)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Huile"),
    });
    expect(mouvements.adjustStock).not.toHaveBeenCalled();
  });

  it("un surplus et un manque créent deux ajustements de sens opposés", async () => {
    preparer([
      ligne({ id: 8, articleId: 1, qteTheorique: 10, qteReelle: 12 }),
      ligne({
        id: 9,
        articleId: 2,
        qteTheorique: 10,
        qteReelle: 7,
        article: { id: 2, code: "FARINE", libelle: "Farine", strategieSortie: "FIFO" },
      }),
    ]);

    await validateInventaire(3, user);

    const types = mouvements.insertMouvement.mock.calls.map((appel) => appel[1].type);
    expect(types).toEqual(["ENTREE_AJUSTEMENT", "SORTIE_AUTRE"]);
    expect(mouvements.adjustStock.mock.calls.map((appel) => appel[1].delta)).toEqual([2, -3]);
  });

  it("un recomptage en attente refuse la validation et n'ajuste pas le stock", async () => {
    preparer([ligne({ recomptageDemande: true, qteReelle: 8, article: { id: 1, code: "HUILE", libelle: "Huile", strategieSortie: "FIFO" } })]);

    await expect(validateInventaire(3, user)).rejects.toMatchObject({
      status: 400,
      code: "RECOMPTAGE_REQUIS",
      message: expect.stringContaining("HUILE"),
    });
    expect(mouvements.adjustStock).not.toHaveBeenCalled();
    expect(mouvements.insertMouvement).not.toHaveBeenCalled();
    expect(prisma.inventaire.update).not.toHaveBeenCalled();
  });
});
