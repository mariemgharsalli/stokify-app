"use strict";

jest.mock("../../config/database", () => {
  const { creerMockPrisma } = require("../../__tests__/helpers/prismaMock");
  return creerMockPrisma();
});

const prisma = require("../../config/database");
const { reinitialiserMockPrisma } = require("../../__tests__/helpers/prismaMock");
const { getStockTendance, getStockCalendar, getRotationSummary } = require("./stock.service");
const { getTauxRotation } = require("../coutStockage/coutStockage.service");
const { getRotationReport } = require("../rapports/rapports.service");

const user = { id: 1, societeId: 1, role: "ADMIN" };

function lignes() {
  const createdAt = new Date();
  createdAt.setHours(0, 0, 0, 0);
  return [
    { id: 1, type: "ENTREE_AJUSTEMENT", quantite: 10, statut: "VALIDE", articleId: 1, depotId: 1, createdAt },
    { id: 2, type: "SORTIE_PERTE", quantite: 3, statut: "VALIDE", articleId: 1, depotId: 1, createdAt },
    { id: 3, type: "SORTIE_PERTE", quantite: 4, statut: "EN_ATTENTE_VALIDATION", articleId: 1, depotId: 1, createdAt },
    { id: 4, type: "SORTIE_PERTE", quantite: 7, statut: "REJETE", articleId: 1, depotId: 1, createdAt },
  ];
}

function accepte(ligne, where) {
  if (!where) return true;
  if (where.statut === "VALIDE" && ligne.statut !== "VALIDE") return false;
  if (where.statut && where.statut.not && ligne.statut === where.statut.not) return false;
  if (where.type && where.type.startsWith && !String(ligne.type).startsWith(where.type.startsWith)) return false;
  return true;
}

beforeEach(() => {
  reinitialiserMockPrisma(prisma);
  prisma.mouvement.findMany.mockImplementation(async ({ where } = {}) =>
    lignes().filter((ligne) => accepte(ligne, where))
  );
  prisma.mouvement.groupBy.mockImplementation(async ({ where } = {}) => {
    const visibles = lignes().filter((ligne) => accepte(ligne, where));
    const groupes = new Map();
    for (const ligne of visibles) {
      const cle = `${ligne.articleId}-${ligne.depotId}`;
      const courant = groupes.get(cle) || {
        articleId: ligne.articleId,
        depotId: ligne.depotId,
        quantite: 0,
        nombre: 0,
      };
      courant.quantite += Number(ligne.quantite);
      courant.nombre += 1;
      groupes.set(cle, courant);
    }
    return [...groupes.values()].map((groupe) => ({
      articleId: groupe.articleId,
      depotId: groupe.depotId,
      _sum: { quantite: groupe.quantite },
      _count: { id: groupe.nombre },
    }));
  });
  prisma.stock.findMany.mockResolvedValue([
    {
      articleId: 1,
      depotId: 1,
      quantite: 20,
      article: { id: 1, code: "VIS", libelle: "Vis" },
      depot: { id: 1, code: "D1", libelle: "Dépôt 1" },
    },
  ]);
});

describe("statistiques limitées aux mouvements validés", () => {
  test("la tendance ignore un mouvement en attente et un mouvement rejeté", async () => {
    const jours = await getStockTendance(user, 7);
    const total = jours.reduce(
      (somme, jour) => ({
        entrees: somme.entrees + jour.entrees,
        sorties: somme.sorties + jour.sorties,
      }),
      { entrees: 0, sorties: 0 }
    );

    expect(total).toEqual({ entrees: 10, sorties: 3 });
  });

  test("le calendrier ignore un mouvement en attente et un mouvement rejeté", async () => {
    const maintenant = new Date();
    const mois = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;
    const jours = await getStockCalendar(user, mois);
    const total = jours.reduce(
      (somme, jour) => ({
        entrees: somme.entrees + jour.entrees,
        sorties: somme.sorties + jour.sorties,
      }),
      { entrees: 0, sorties: 0 }
    );

    expect(total).toEqual({ entrees: 10, sorties: 3 });
  });

  test("la rotation ignore un mouvement en attente et un mouvement rejeté", async () => {
    const lignesRotation = await getRotationSummary(user);

    expect(lignesRotation).toEqual([expect.objectContaining({ articleId: 1, rotationScore: 2 })]);
  });

  test("le coût de stockage ignore un mouvement en attente et un mouvement rejeté", async () => {
    const maintenant = new Date();
    const periode = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;
    const rapport = await getTauxRotation(1, { periode });

    expect(rapport.items).toEqual([expect.objectContaining({ articleId: 1, qteSorties: 3 })]);
  });

  test("le rapport de rotation ignore un mouvement en attente et un mouvement rejeté", async () => {
    const rapport = await getRotationReport(1, { days: 30 });

    expect(rapport.items).toEqual([expect.objectContaining({ articleId: 1, qteVendue: 3 })]);
  });
});
