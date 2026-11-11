"use strict";

jest.mock("../../config/database", () => {
  const { creerMockPrisma } = require("../helpers/prismaMock");
  return creerMockPrisma();
});

jest.mock("../../utils/auditHelper", () => ({
  auditFromReq: jest.fn(async () => {}),
  createAudit: jest.fn(async () => {}),
}));

jest.mock("../../utils/smtp", () => ({
  createSmtpTransporter: () => null,
  getSmtpFrom: () => "test@stokify.local",
}));

const bcrypt = require("bcryptjs");
const prisma = require("../../config/database");
const { loginUser } = require("../../modules/auth/auth.service");

const MOT_DE_PASSE = "MotDePasseCorrect1";
const REQUETE = { headers: {}, ip: "127.0.0.1" };

describe("Connexion", () => {
  let hash;
  let compte;

  beforeAll(async () => {
    hash = await bcrypt.hash(MOT_DE_PASSE, 4);
  });

  beforeEach(() => {
    compte = {
      id: 7,
      email: "admin.7@test.stokify.local",
      motDePasse: hash,
      role: "ADMIN",
      actif: true,
      statutCompte: "ACTIF",
      societeId: 1,
      tentativesEchouees: 0,
      verrouilleJusqua: null,
      loginCount: 0,
      societe: { id: 1, actif: true, nom: "Societe A" },
    };

    prisma.utilisateur.findUnique.mockImplementation(async ({ where }) => {
      if (where.email && where.email !== compte.email) return null;
      if (where.id != null && Number(where.id) !== compte.id) return null;
      return {
        ...compte,
        societe: { ...compte.societe },
      };
    });

    prisma.utilisateur.update.mockImplementation(async ({ data }) => {
      if (typeof data.tentativesEchouees === "number") compte.tentativesEchouees = data.tentativesEchouees;
      if (Object.prototype.hasOwnProperty.call(data, "verrouilleJusqua")) {
        compte.verrouilleJusqua = data.verrouilleJusqua;
      }
      if (data.loginCount && data.loginCount.increment) compte.loginCount += data.loginCount.increment;
      return { ...compte, societe: { ...compte.societe } };
    });

    prisma.utilisateur.findMany.mockResolvedValue([]);
    prisma.utilisateur.update.mockClear();
  });

  test("un mauvais mot de passe incrémente le compteur de tentatives", async () => {
    // Arrange
    const identifiants = { email: compte.email, motDePasse: "mauvais" };

    // Act
    const attente = loginUser(identifiants, REQUETE);

    // Assert
    await expect(attente).rejects.toMatchObject({ status: 401 });
    expect(compte.tentativesEchouees).toBe(1);
    expect(compte.verrouilleJusqua).toBeNull();
  });

  test("le compte est verrouillé au seuil de tentatives", async () => {
    // Arrange
    compte.tentativesEchouees = 2;

    // Act
    const attente = loginUser({ email: compte.email, motDePasse: "mauvais" }, REQUETE);

    // Assert
    await expect(attente).rejects.toMatchObject({ status: 423, code: "COMPTE_VERROUILLE" });
    expect(compte.tentativesEchouees).toBe(0);
    expect(new Date(compte.verrouilleJusqua).getTime()).toBeGreaterThan(Date.now());
  });

  test("une connexion est refusée pendant le verrouillage", async () => {
    // Arrange
    compte.verrouilleJusqua = new Date(Date.now() + 10 * 60 * 1000);
    compte.tentativesEchouees = 0;

    // Act
    const attente = loginUser({ email: compte.email, motDePasse: MOT_DE_PASSE }, REQUETE);

    // Assert
    await expect(attente).rejects.toMatchObject({ status: 423, code: "COMPTE_VERROUILLE" });
    expect(prisma.utilisateur.update).not.toHaveBeenCalled();
  });

  test("après l'échéance du verrouillage, le bon mot de passe est accepté", async () => {
    // Arrange — le délai de 15 minutes est passé
    compte.verrouilleJusqua = new Date(Date.now() - 1000);
    compte.tentativesEchouees = 0;

    // Act
    const resultat = await loginUser(
      { email: compte.email, motDePasse: MOT_DE_PASSE },
      REQUETE
    );

    // Assert
    expect(resultat.token).toEqual(expect.any(String));
    expect(resultat.user.email).toBe(compte.email);
    expect(resultat.user.motDePasse).toBeUndefined();
    expect(compte.verrouilleJusqua).toBeNull();
    expect(compte.tentativesEchouees).toBe(0);
    expect(compte.loginCount).toBe(1);
  });

  test("un compte inactif est refusé à la connexion", async () => {
    // Arrange
    compte.actif = false;

    // Act
    const attente = loginUser({ email: compte.email, motDePasse: MOT_DE_PASSE }, REQUETE);

    // Assert
    await expect(attente).rejects.toMatchObject({ status: 401 });
    expect(prisma.utilisateur.update).not.toHaveBeenCalled();
  });

  test.each(["EN_ATTENTE_VALIDATION", "EN_ATTENTE_RATTACHEMENT"])(
    "le statut %s est refusé",
    async (statutCompte) => {
      // Arrange
      compte.statutCompte = statutCompte;

      // Act
      const attente = loginUser({ email: compte.email, motDePasse: MOT_DE_PASSE }, REQUETE);

      // Assert
      await expect(attente).rejects.toMatchObject({ status: 403, code: "EN_ATTENTE_VALIDATION" });
    }
  );

  test("une société désactivée refuse la connexion d'un non super administrateur", async () => {
    // Arrange
    compte.societe = { id: 1, actif: false, nom: "Societe A" };

    // Act
    const attente = loginUser({ email: compte.email, motDePasse: MOT_DE_PASSE }, REQUETE);

    // Assert
    await expect(attente).rejects.toMatchObject({ status: 401 });
  });
});
