"use strict";

jest.mock("../../config/database", () => {
  const { creerMockPrisma } = require("../../__tests__/helpers/prismaMock");
  return creerMockPrisma();
});
jest.mock("../lots/lots.service", () => ({
  transferLotsBetweenDepots: jest.fn(),
  ensureStockCoveredByLots: jest.fn(),
}));

const prisma = require("../../config/database");
const { reinitialiserMockPrisma } = require("../../__tests__/helpers/prismaMock");
const lots = require("../lots/lots.service");
const service = require("./mouvements.service");
const {
  createTransfert,
  createTransfertEmplacement,
  createSortie,
  createEntree,
  validerMouvement,
  rejeterMouvement,
} = service;

const user = { id: 7, societeId: 1, role: "MAGASINIER" };

let stockSource;

function preparer() {
  reinitialiserMockPrisma(prisma);
  stockSource = 10;
  prisma.article.findFirst.mockResolvedValue({
    id: 1,
    societeId: 1,
    statut: "ACTIF",
    libelle: "Vis",
    code: "VIS",
    poids: null,
    volume: null,
    seuilAlerte: null,
    stockMin: null,
  });
  prisma.societe.findFirst.mockResolvedValue({
    id: 1,
    seuilValidationMouvement: 1000,
  });
  prisma.depot.findFirst.mockImplementation(async ({ where }) => ({
    id: Number(where.id),
    societeId: 1,
    code: `D${where.id}`,
    libelle: `Dépôt ${where.id}`,
    statut: "ACTIF",
    capacitePoids: null,
    capaciteVolume: null,
  }));
  prisma.stock.findMany.mockImplementation(async ({ where }) => {
    if (Number(where.depotId) !== 1) return [];
    return [
      {
        id: 10,
        articleId: 1,
        depotId: 1,
        emplacementId: null,
        quantite: stockSource,
        dateLastMvt: null,
      },
    ];
  });
  prisma.stock.findFirst.mockResolvedValue(null);
  prisma.stock.create.mockImplementation(async ({ data }) => ({ id: 20, ...data }));
  prisma.stock.update.mockImplementation(async ({ where, data }) => {
    const ligne = { id: where.id, quantite: data.quantite };
    return ligne;
  });
  prisma.stock.aggregate.mockResolvedValue({ _sum: { quantite: stockSource } });
  prisma.mouvement.create.mockImplementation(async ({ data }) => ({
    id: 99,
    ...data,
    statut: data.statut || "VALIDE",
  }));
  lots.transferLotsBetweenDepots.mockReset();
  lots.transferLotsBetweenDepots.mockResolvedValue({
    strategy: "FIFO",
    lotsTransferred: [{ lotId: 1, lotNumero: "LOT-1", quantite: 4, destLotId: 8 }],
  });
  lots.ensureStockCoveredByLots.mockReset();
}

beforeEach(preparer);

function quantitesMisesAJour() {
  return prisma.stock.update.mock.calls.map((appel) => appel[0].data.quantite);
}

describe("transfert dépôt vers dépôt", () => {
  test("diminue le stock source et augmente la destination", async () => {
    // Arrange — source 10, transfert 4 → source 6, destination 4
    const resultat = await createTransfert(user, {
      articleId: 1,
      depotOrigineId: 1,
      depotDestId: 2,
      quantite: 4,
    });

    // Assert
    expect(quantitesMisesAJour()).toEqual([6, 4]);
    expect(resultat.type).toBe("TRANSFERT");
    expect(resultat.depotId).toBe(1);
    expect(resultat.depotDestId).toBe(2);
    expect(resultat.quantite).toBe(4);
  });

  test("un transfert immédiat de 5 unités appelle adjustStock deux fois, -5 puis +5", async () => {
    const deltas = [];
    const original = service.adjustStock;
    const espion = jest.spyOn(service, "adjustStock").mockImplementation(async (...args) => {
      deltas.push(args[1].delta);
      return original(...args);
    });
    stockSource = 10;

    try {
      await createTransfert(user, {
        articleId: 1,
        depotOrigineId: 1,
        depotDestId: 2,
        quantite: 5,
      });
    } finally {
      espion.mockRestore();
    }

    expect(deltas).toEqual([-5, 5]);
    expect(prisma.stock.update).toHaveBeenCalledTimes(2);
  });

  test("un transfert d'emplacement de 5 unités appelle adjustStock deux fois, -5 puis +5", async () => {
    const ficheEmplacement = (id, depotId) => ({
      id: Number(id),
      depotId: Number(depotId),
      code: `E${id}`,
      statut: "ACTIF",
      zoneDangereuse: false,
      categorieAutorisee: null,
      depot: { id: Number(depotId), societeId: 1, statut: "ACTIF", code: `D${depotId}`, libelle: `Dépôt ${depotId}` },
    });
    prisma.emplacement.findUnique.mockImplementation(async ({ where }) =>
      ficheEmplacement(where.id, Number(where.id) === 11 ? 1 : 2)
    );
    prisma.emplacement.findFirst.mockImplementation(async ({ where }) =>
      ficheEmplacement(where.id, where.depotId)
    );
    const deltas = [];
    const original = service.adjustStock;
    const espion = jest.spyOn(service, "adjustStock").mockImplementation(async (...args) => {
      deltas.push(args[1].delta);
      return original(...args);
    });
    stockSource = 10;

    try {
      await createTransfertEmplacement(user, {
        articleId: 1,
        depotOrigineId: 1,
        emplacementOrigineId: 11,
        depotDestId: 2,
        emplacementDestId: 22,
        quantite: 5,
      });
    } finally {
      espion.mockRestore();
    }

    expect(deltas).toEqual([-5, 5]);
    expect(prisma.stock.update).toHaveBeenCalledTimes(2);
  });

  test("un transfert décimal conserve le centième", async () => {
    // Arrange — 10,50 − 2,25 = 8,25
    stockSource = 10.5;

    await createTransfert(user, {
      articleId: 1,
      depotOrigineId: 1,
      depotDestId: 2,
      quantite: 2.25,
    });

    expect(quantitesMisesAJour()).toEqual([8.25, 2.25]);
  });

  test("une très grande quantité est transférée au centième", async () => {
    // Arrange — 5 000 000,50 − 2 500 000,25 = 2 500 000,25
    stockSource = 5000000.5;

    await createTransfert(user, {
      articleId: 1,
      depotOrigineId: 1,
      depotDestId: 2,
      quantite: 2500000.25,
    });

    expect(quantitesMisesAJour()).toEqual([2500000.25, 2500000.25]);
  });

  test("un stock insuffisant est refusé sans écrire de mouvement", async () => {
    stockSource = 2;

    await expect(
      createTransfert(user, {
        articleId: 1,
        depotOrigineId: 1,
        depotDestId: 2,
        quantite: 5,
      })
    ).rejects.toMatchObject({ message: "Stock insuffisant", status: 400 });

    expect(prisma.stock.update).not.toHaveBeenCalled();
    expect(prisma.mouvement.create).not.toHaveBeenCalled();
  });

  test.each([
    ["quantité 0", 0],
    ["quantité négative", -1],
    ["quantité nulle", null],
  ])("une %s est refusée avant toute écriture", async (_libelle, quantite) => {
    await expect(
      createTransfert(user, {
        articleId: 1,
        depotOrigineId: 1,
        depotDestId: 2,
        quantite,
      })
    ).rejects.toMatchObject({ status: 400 });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  function articleAPrix(prixAchat) {
    prisma.article.findFirst.mockResolvedValue({
      id: 1,
      societeId: 1,
      statut: "ACTIF",
      libelle: "Vis",
      code: "VIS",
      prixAchat,
      poids: null,
      volume: null,
      seuilAlerte: null,
      stockMin: null,
    });
  }

  it("un transfert au-dessus du seuil est créé en attente sans toucher le stock", async () => {
    // Arrange — seuil 1 000 DT, 200 × 10 DT = 2 000 DT
    articleAPrix(10);
    stockSource = 500;

    const resultat = await createTransfert(user, {
      articleId: 1,
      depotOrigineId: 1,
      depotDestId: 2,
      quantite: 200,
      valeur: 2000,
    });

    expect(resultat.statut).toBe("EN_ATTENTE_VALIDATION");
    expect(prisma.stock.update).not.toHaveBeenCalled();
    expect(lots.transferLotsBetweenDepots).not.toHaveBeenCalled();
    expect(prisma.audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CREATE",
          entite: "Mouvement",
          nouvelleValeur: "EN_ATTENTE_VALIDATION",
          societeId: 1,
        }),
      })
    );
  });

  it("un transfert en dessous du seuil met le stock à jour", async () => {
    // Arrange — 50 × 10 = 500 DT, seuil 1 000
    articleAPrix(10);
    stockSource = 80;

    const resultat = await createTransfert(user, {
      articleId: 1,
      depotOrigineId: 1,
      depotDestId: 2,
      quantite: 50,
    });

    expect(resultat.statut).toBe("VALIDE");
    expect(prisma.stock.update).toHaveBeenCalled();
    expect(lots.transferLotsBetweenDepots).toHaveBeenCalled();
  });

  it("un transfert égal au seuil met le stock à jour", async () => {
    // Arrange — 100 × 10 = 1 000 DT, seuil 1 000
    articleAPrix(10);
    stockSource = 100;

    const resultat = await createTransfert(user, {
      articleId: 1,
      depotOrigineId: 1,
      depotDestId: 2,
      quantite: 100,
    });

    expect(resultat.statut).toBe("VALIDE");
    expect(prisma.stock.update).toHaveBeenCalled();
    expect(lots.transferLotsBetweenDepots).toHaveBeenCalled();
  });

  it("une valeur envoyée à 0 ne contourne pas le seuil", async () => {
    // Arrange — coût réel 2 000 DT, corps valeur 0
    articleAPrix(10);
    stockSource = 500;

    const resultat = await createTransfert(user, {
      articleId: 1,
      depotOrigineId: 1,
      depotDestId: 2,
      quantite: 200,
      valeur: 0,
    });

    expect(resultat.statut).toBe("EN_ATTENTE_VALIDATION");
    expect(resultat.valeur).toBe(2000);
    expect(prisma.stock.update).not.toHaveBeenCalled();
  });

  it.each([
    ["null", null],
    ["nul", 0],
  ])("un seuil %s désactive la validation", async (_libelle, seuil) => {
    articleAPrix(10);
    stockSource = 500;
    prisma.societe.findFirst.mockResolvedValue({
      id: 1,
      seuilValidationMouvement: seuil,
    });

    const resultat = await createTransfert(user, {
      articleId: 1,
      depotOrigineId: 1,
      depotDestId: 2,
      quantite: 200,
      valeur: 2000,
    });

    expect(resultat.statut).toBe("VALIDE");
    expect(prisma.stock.update).toHaveBeenCalled();
    expect(lots.transferLotsBetweenDepots).toHaveBeenCalled();
  });

  it("un article sans prix et sans valeur reste un transfert immédiat", async () => {
    articleAPrix(null);
    stockSource = 500;

    const resultat = await createTransfert(user, {
      articleId: 1,
      depotOrigineId: 1,
      depotDestId: 2,
      quantite: 200,
    });

    expect(resultat.statut).toBe("VALIDE");
    expect(prisma.stock.update).toHaveBeenCalled();
  });

  it("une sortie perte au-dessus du seuil n'ajuste pas le stock", async () => {
    articleAPrix(10);
    stockSource = 500;

    const resultat = await createSortie(user, {
      articleId: 1,
      depotId: 1,
      quantite: 200,
      type: "SORTIE_PERTE",
      valeur: 0,
    });

    expect(resultat.statut).toBe("EN_ATTENTE_VALIDATION");
    expect(resultat.type).toBe("SORTIE_PERTE");
    expect(prisma.stock.update).not.toHaveBeenCalled();
  });

  it("un ajustement d'entrée manuel au-dessus du seuil n'ajuste pas le stock", async () => {
    articleAPrix(10);

    const resultat = await createEntree(user, {
      articleId: 1,
      depotId: 1,
      quantite: 200,
      type: "ENTREE_AJUSTEMENT",
      valeur: 0,
    });

    expect(resultat.statut).toBe("EN_ATTENTE_VALIDATION");
    expect(resultat.type).toBe("ENTREE_AJUSTEMENT");
    expect(prisma.stock.update).not.toHaveBeenCalled();
    expect(lots.ensureStockCoveredByLots).not.toHaveBeenCalled();
  });
});

describe("valider et rejeter un mouvement en attente", () => {
  const responsable = { id: 8, societeId: 1, role: "RESPONSABLE" };
  let etat;
  let societeArticle;
  let introuvable;

  function ligne() {
    return {
      id: 99,
      reference: "MVT-1",
      type: "TRANSFERT",
      articleId: 1,
      depotId: 1,
      depotDestId: 2,
      emplacementId: null,
      quantite: 4,
      utilisateurId: 7,
      commentaire: "attente",
      statut: "EN_ATTENTE_VALIDATION",
    };
  }

  beforeEach(() => {
    etat = "EN_ATTENTE_VALIDATION";
    societeArticle = 1;
    introuvable = false;
    stockSource = 10;
    prisma.stock.aggregate.mockResolvedValue({ _sum: { quantite: 10 } });
    prisma.mouvement.findFirst.mockImplementation(async ({ where }) => {
      if (introuvable) return null;
      if (where.statut === "EN_ATTENTE_VALIDATION") {
        if (etat !== "EN_ATTENTE_VALIDATION") return null;
        if (Number(where.article?.societeId) !== societeArticle) return null;
        return ligne();
      }
      return { ...ligne(), statut: etat, article: { societeId: societeArticle } };
    });
    prisma.mouvement.updateMany.mockImplementation(async ({ data }) => {
      if (etat !== "EN_ATTENTE_VALIDATION") return { count: 0 };
      etat = data.statut;
      return { count: 1 };
    });
    prisma.mouvement.update.mockResolvedValue({ id: 99 });
  });

  test("un responsable valide le mouvement d'un autre utilisateur", async () => {
    const resultat = await validerMouvement(responsable, 99);

    expect(resultat.statut).toBe("VALIDE");
    expect(lots.transferLotsBetweenDepots).toHaveBeenCalledTimes(1);
    expect(prisma.mouvement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lotId: 1 }),
      })
    );
  });

  test("un magasinier ne peut pas valider", async () => {
    await expect(
      validerMouvement({ id: 3, societeId: 1, role: "MAGASINIER" }, 99)
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.mouvement.updateMany).not.toHaveBeenCalled();
    expect(prisma.stock.update).not.toHaveBeenCalled();
  });

  test("un mouvement d'une autre société répond 404", async () => {
    societeArticle = 2;

    await expect(validerMouvement(responsable, 99)).rejects.toMatchObject({ status: 404 });
    expect(prisma.stock.update).not.toHaveBeenCalled();
  });

  test("un mouvement inexistant répond 404", async () => {
    introuvable = true;

    await expect(validerMouvement(responsable, 99)).rejects.toMatchObject({ status: 404 });
  });

  test("une seconde validation répond 409", async () => {
    await validerMouvement(responsable, 99);

    await expect(validerMouvement(responsable, 99)).rejects.toMatchObject({ status: 409 });
    expect(lots.transferLotsBetweenDepots).toHaveBeenCalledTimes(1);
  });

  test("un stock insuffisant répond 400 et laisse le statut en attente", async () => {
    prisma.stock.aggregate.mockResolvedValue({ _sum: { quantite: 1 } });

    await expect(validerMouvement(responsable, 99)).rejects.toMatchObject({
      status: 400,
      message: "Stock insuffisant",
    });
    expect(etat).toBe("EN_ATTENTE_VALIDATION");
    expect(prisma.mouvement.updateMany).not.toHaveBeenCalled();
    expect(prisma.stock.update).not.toHaveBeenCalled();
  });

  test("l'auteur responsable ne valide pas son propre mouvement", async () => {
    await expect(
      validerMouvement({ id: 7, societeId: 1, role: "RESPONSABLE" }, 99)
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.mouvement.updateMany).not.toHaveBeenCalled();
  });

  test("un admin valide son propre mouvement et l'audit le trace", async () => {
    const resultat = await validerMouvement({ id: 7, societeId: 1, role: "ADMIN" }, 99);

    expect(resultat.statut).toBe("VALIDE");
    expect(prisma.audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: expect.stringContaining("propre mouvement"),
          nouvelleValeur: "VALIDE",
        }),
      })
    );
  });

  test("le rejet conserve le commentaire et ne touche pas le stock", async () => {
    const resultat = await rejeterMouvement(responsable, 99, { commentaire: "Montant trop élevé" });

    expect(resultat.statut).toBe("REJETE");
    expect(resultat.commentaire).toBe("attente | Rejet : Montant trop élevé");
    expect(prisma.stock.update).not.toHaveBeenCalled();
    expect(lots.transferLotsBetweenDepots).not.toHaveBeenCalled();
    expect(prisma.mouvement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { statut: "REJETE", commentaire: "attente | Rejet : Montant trop élevé" },
      })
    );
  });

  test("deux validations simultanées n'appliquent le stock qu'une fois", async () => {
    let reclamations = 0;
    prisma.mouvement.findFirst.mockImplementation(async ({ where }) => {
      if (where.statut === "EN_ATTENTE_VALIDATION") return ligne();
      return { ...ligne(), article: { societeId: 1 } };
    });
    prisma.mouvement.updateMany.mockImplementation(async () => {
      reclamations += 1;
      return { count: reclamations === 1 ? 1 : 0 };
    });

    const resultats = await Promise.allSettled([
      validerMouvement(responsable, 99),
      validerMouvement(responsable, 99),
    ]);

    expect(resultats.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultats.find((r) => r.status === "rejected").reason).toMatchObject({ status: 409 });
    expect(lots.transferLotsBetweenDepots).toHaveBeenCalledTimes(1);
  });
});
