"use strict";

jest.mock("../../config/database", () => {
  const { creerPrismaSecurite } = require("./harnaisHttp");
  return creerPrismaSecurite();
});

const request = require("supertest");
const app = require("../../app");
const errorHandler = require("../../middleware/errorHandler");
const { creerUtilisateursParRoles, reinitialiserSequenceUtilisateurs } = require("../helpers/userFactory");
const { genererJwtDeTest, enteteAuthorization } = require("../helpers/jwtTest");
const { etat, SOCIETE_A } = require("./harnaisHttp");

function preparer() {
  reinitialiserSequenceUtilisateurs();
  const parRole = creerUtilisateursParRoles({ societeId: SOCIETE_A });
  etat.utilisateurs = Object.values(parRole);
  etat.overrides = [];
  etat.actifParSociete = { 1: true, 2: true };
  etat.erreurSql = null;
  etat.journal = [];
  return parRole;
}

describe("Validation et erreurs", () => {
  let admin;

  beforeEach(() => {
    admin = preparer().ADMIN;
  });

  test("un doublon de code unique répond 409 sans être journalisé comme une erreur interne", () => {
    const reponse = {
      codeStatut: 0,
      corps: null,
      status(code) {
        this.codeStatut = code;
        return this;
      },
      json(corps) {
        this.corps = corps;
        return this;
      },
    };
    const journal = jest.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(
      { code: "P2002", meta: { target: ["code"] }, message: "Unique constraint failed" },
      {},
      reponse,
      () => {}
    );

    expect(reponse.codeStatut).toBe(409);
    expect(reponse.corps.error).toBe("DUPLICATE_CODE");
    expect(reponse.corps.field).toBe("code");
    expect(journal).not.toHaveBeenCalled();
    journal.mockRestore();
  });

  test("un corps de connexion invalide est rejeté dans un format homogène", async () => {
    // Arrange
    const corps = { email: "pas-un-email", motDePasse: "" };

    // Act
    const reponse = await request(app).post("/api/auth/login").send(corps);

    // Assert — validate.js répond 422, format unique du projet.
    expect(reponse.status).toBe(422);
    expect(reponse.body.success).toBe(false);
    expect(Array.isArray(reponse.body.errors)).toBe(true);
    expect(reponse.body.errors[0]).toEqual(
      expect.objectContaining({ field: expect.any(String), message: expect.any(String) })
    );
    expect(reponse.body.message).toEqual(expect.any(String));
  });

  test("un message de chat vide est rejeté dans le même format", async () => {
    // Arrange
    const entete = enteteAuthorization(genererJwtDeTest(admin));

    // Act
    const reponse = await request(app).post("/api/ai/chat").set(entete).send({});

    // Assert
    expect(reponse.status).toBe(422);
    expect(reponse.body.success).toBe(false);
    expect(reponse.body.errors[0].field).toBe("message");
    expect(reponse.body.message).toBeTruthy();
  });

  test("POST /api/ia/recommandations/apply n'utilise pas express-validator", async () => {
    // Arrange
    const entete = enteteAuthorization(genererJwtDeTest(admin));

    // Act
    const reponse = await request(app).post("/api/ia/recommandations/apply").set(entete).send({});

    // Assert — contrôle manuel 400, pas le format { success, errors }.
    expect(reponse.status).toBe(400);
    expect(reponse.body.errors).toBeUndefined();
    expect(reponse.body.success).toBeUndefined();
    expect(reponse.body.message).toMatch(/type de recommandation/i);
  });

  test("en production une erreur interne ne fuit ni stack ni SQL", async () => {
    // Arrange
    const precedent = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const journal = jest.spyOn(console, "error").mockImplementation(() => {});
    etat.erreurSql = Object.assign(new Error("SELECT password FROM Utilisateur WHERE id = 1"), {
      stack: "Error: SELECT password FROM Utilisateur WHERE id = 1\n    at secret (/app/db.js:1:1)",
    });
    const entete = enteteAuthorization(genererJwtDeTest(admin));

    try {
      // Act
      const reponse = await request(app).get("/api/articles").set(entete);

      // Assert
      expect(reponse.status).toBe(500);
      expect(reponse.body.message).toBe("Erreur interne du serveur");
      expect(reponse.body.stack).toBeUndefined();
      expect(JSON.stringify(reponse.body)).not.toMatch(/SELECT|password|db\.js/i);
      expect(journal).toHaveBeenCalled();
    } finally {
      journal.mockRestore();
      process.env.NODE_ENV = precedent;
    }
  });

  test("sans NODE_ENV une erreur interne reste générique et est journalisée", async () => {
    // Arrange
    const precedent = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    const journal = jest.spyOn(console, "error").mockImplementation(() => {});
    etat.erreurSql = Object.assign(new Error("SELECT password FROM Utilisateur WHERE id = 1"), {
      stack: "Error: SELECT password FROM Utilisateur WHERE id = 1\n    at secret (/app/db.js:1:1)",
    });
    const entete = enteteAuthorization(genererJwtDeTest(admin));

    try {
      // Act
      const reponse = await request(app).get("/api/articles").set(entete);

      // Assert
      expect(reponse.status).toBe(500);
      expect(reponse.body.message).toBe("Erreur interne du serveur");
      expect(reponse.body.stack).toBeUndefined();
      expect(JSON.stringify(reponse.body)).not.toMatch(/SELECT|password/i);
      expect(journal).toHaveBeenCalled();
    } finally {
      journal.mockRestore();
      if (precedent === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = precedent;
    }
  });

  test("en development le message technique et la stack sont renvoyés", async () => {
    // Arrange
    const precedent = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const journal = jest.spyOn(console, "error").mockImplementation(() => {});
    etat.erreurSql = Object.assign(new Error("SELECT password FROM Utilisateur WHERE id = 1"), {
      stack: "Error: SELECT password FROM Utilisateur WHERE id = 1\n    at secret (/app/db.js:1:1)",
    });
    const entete = enteteAuthorization(genererJwtDeTest(admin));

    try {
      // Act
      const reponse = await request(app).get("/api/articles").set(entete);

      // Assert
      expect(reponse.status).toBe(500);
      expect(reponse.body.message).toMatch(/SELECT password/);
      expect(reponse.body.stack).toMatch(/db\.js/);
      expect(journal).toHaveBeenCalled();
    } finally {
      journal.mockRestore();
      process.env.NODE_ENV = precedent;
    }
  });

  test("en development une colonne Prisma manquante expose la meta", async () => {
    // Arrange
    const precedent = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const journal = jest.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("The column `Utilisateur.password` does not exist");
    err.code = "P2022";
    err.meta = { modelName: "Utilisateur", column: "password" };
    etat.erreurSql = err;
    const entete = enteteAuthorization(genererJwtDeTest(admin));

    try {
      // Act
      const reponse = await request(app).get("/api/articles").set(entete);

      // Assert
      expect(reponse.status).toBe(500);
      expect(reponse.body.prismaMeta).toEqual({ modelName: "Utilisateur", column: "password" });
      expect(reponse.body.code).toBe("P2022");
      expect(journal).toHaveBeenCalled();
    } finally {
      journal.mockRestore();
      process.env.NODE_ENV = precedent;
    }
  });

  test("en production une colonne Prisma manquante reste un message générique", async () => {
    // Arrange
    const precedent = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const journal = jest.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("The column `Utilisateur.password` does not exist");
    err.code = "P2022";
    err.meta = { modelName: "Utilisateur", column: "password" };
    etat.erreurSql = err;
    const entete = enteteAuthorization(genererJwtDeTest(admin));

    try {
      // Act
      const reponse = await request(app).get("/api/articles").set(entete);

      // Assert
      expect(reponse.status).toBe(500);
      expect(reponse.body.message).toBe("Erreur interne du serveur");
      expect(reponse.body.prismaMeta).toBeUndefined();
      expect(reponse.body.code).toBeUndefined();
      expect(JSON.stringify(reponse.body)).not.toMatch(/password|Utilisateur|P2022/);
      expect(journal).toHaveBeenCalled();
    } finally {
      journal.mockRestore();
      process.env.NODE_ENV = precedent;
    }
  });
});
