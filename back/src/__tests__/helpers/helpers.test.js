"use strict";

const jwt = require("jsonwebtoken");
const { creerMockPrisma, reinitialiserMockPrisma } = require("./prismaMock");
const {
  ROLES,
  creerUtilisateur,
  creerUtilisateursParRoles,
  reinitialiserSequenceUtilisateurs,
} = require("./userFactory");
const {
  JWT_SECRET_TEST,
  genererJwtDeTest,
  genererJwtExpire,
  enteteAuthorization,
} = require("./jwtTest");

describe("helpers de test", () => {
  beforeEach(() => {
    reinitialiserSequenceUtilisateurs();
  });

  test("crée un utilisateur actif pour chaque rôle", () => {
    // Arrange
    const societeId = 42;

    // Act
    const utilisateurs = creerUtilisateursParRoles({ societeId });

    // Assert
    expect(Object.keys(utilisateurs).sort()).toEqual([...ROLES].sort());
    for (const role of ROLES) {
      expect(utilisateurs[role].role).toBe(role);
      expect(utilisateurs[role].societeId).toBe(societeId);
      expect(utilisateurs[role].actif).toBe(true);
      expect(utilisateurs[role].statutCompte).toBe("ACTIF");
      expect(utilisateurs[role].email).toMatch(/@test\.stokify\.local$/);
    }
    expect(utilisateurs.CLIENT.clientId).toBe(100);
    expect(utilisateurs.ADMIN.clientId).toBeNull();
  });

  test("deux utilisateurs créés n'ont ni le même id ni le même e-mail", () => {
    // Arrange / Act
    const premier = creerUtilisateur({ role: "ADMIN" });
    const second = creerUtilisateur({ role: "ADMIN" });

    // Assert
    expect(premier.id).not.toBe(second.id);
    expect(premier.email).not.toBe(second.email);
  });

  test("le JWT de test porte id, rôle et société", () => {
    // Arrange
    const utilisateur = creerUtilisateur({
      id: 7,
      role: "RESPONSABLE",
      societeId: 3,
    });

    // Act
    const token = genererJwtDeTest(utilisateur);
    const payload = jwt.verify(token, JWT_SECRET_TEST);

    // Assert
    expect(payload.id).toBe(7);
    expect(payload.role).toBe("RESPONSABLE");
    expect(payload.societeId).toBe(3);
    expect(enteteAuthorization(token)).toEqual({
      Authorization: `Bearer ${token}`,
    });
  });

  test("un JWT expiré est refusé à la vérification", () => {
    // Arrange
    const utilisateur = creerUtilisateur({ role: "MAGASINIER" });
    const token = genererJwtExpire(utilisateur);

    // Act / Assert
    expect(() => jwt.verify(token, JWT_SECRET_TEST)).toThrow(/expired/i);
  });

  test("le mock Prisma sert un modèle à la demande dans une transaction", async () => {
    // Arrange
    const prisma = creerMockPrisma(["article"]);
    prisma.article.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.depot.create.mockResolvedValue({ id: 9 });

    // Act
    const articles = await prisma.article.findMany();
    const depot = await prisma.$transaction((tx) =>
      tx.depot.create({ data: { libelle: "Dépôt test" } })
    );

    // Assert
    expect(articles).toEqual([{ id: 1 }]);
    expect(depot).toEqual({ id: 9 });
    expect(prisma.depot.create).toHaveBeenCalledTimes(1);
  });

  test("réinitialiser le mock Prisma efface les appels précédents", async () => {
    // Arrange
    const prisma = creerMockPrisma();
    prisma.lot.count.mockResolvedValue(4);
    await prisma.lot.count();

    // Act
    reinitialiserMockPrisma(prisma);

    // Assert
    expect(prisma.lot.count).not.toHaveBeenCalled();
    expect(prisma.lot.count()).toBeUndefined();
  });
});
