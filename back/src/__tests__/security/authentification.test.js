"use strict";

jest.mock("../../config/database", () => {
  const { creerPrismaSecurite } = require("./harnaisHttp");
  return creerPrismaSecurite();
});

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../../app");
const { creerUtilisateursParRoles, creerUtilisateur, reinitialiserSequenceUtilisateurs } = require("../helpers/userFactory");
const { genererJwtDeTest, genererJwtExpire, enteteAuthorization, JWT_SECRET_TEST } = require("../helpers/jwtTest");
const { etat, SOCIETE_A, ID_B } = require("./harnaisHttp");

function preparerComptes() {
  reinitialiserSequenceUtilisateurs();
  const parRole = creerUtilisateursParRoles({ societeId: SOCIETE_A });
  parRole.SUPER_ADMIN = { ...parRole.SUPER_ADMIN, societeId: null };
  const cible = creerUtilisateur({
    id: ID_B,
    role: "MAGASINIER",
    societeId: 2,
    nom: "SECRET-B",
    email: "cible.b@secret.test",
  });
  etat.utilisateurs = [...Object.values(parRole), cible];
  etat.overrides = [];
  etat.actifParSociete = { 1: true, 2: true };
  etat.erreurSql = null;
  etat.journal = [];
  return parRole;
}

describe("Authentification HTTP", () => {
  let comptes;

  beforeEach(() => {
    comptes = preparerComptes();
  });

  test("une requête sans token est refusée", async () => {
    // Arrange
    const url = "/api/articles";

    // Act
    const reponse = await request(app).get(url);

    // Assert
    expect(reponse.status).toBe(401);
    expect(reponse.body.message).toMatch(/token manquant/i);
  });

  test("un token mal formé est refusé", async () => {
    // Arrange
    const entete = { Authorization: "Bearer pas-un-jwt" };

    // Act
    const reponse = await request(app).get("/api/articles").set(entete);

    // Assert
    expect(reponse.status).toBe(401);
    expect(reponse.body.message).toMatch(/token invalide/i);
  });

  test("un token signé avec un mauvais secret est refusé", async () => {
    // Arrange
    const jeton = genererJwtDeTest(comptes.ADMIN, { secret: "un-autre-secret-qui-ne-correspond-pas" });

    // Act
    const reponse = await request(app).get("/api/articles").set(enteteAuthorization(jeton));

    // Assert
    expect(reponse.status).toBe(401);
  });

  test("un token sans identifiant est refusé", async () => {
    // Arrange
    const jeton = jwt.sign({ role: "ADMIN" }, JWT_SECRET_TEST, { expiresIn: "1h" });

    // Act
    const reponse = await request(app).get("/api/articles").set(enteteAuthorization(jeton));

    // Assert
    expect(reponse.status).toBe(401);
  });

  test("un token expiré est refusé", async () => {
    // Arrange
    const jeton = genererJwtExpire(comptes.ADMIN);

    // Act
    const reponse = await request(app).get("/api/articles").set(enteteAuthorization(jeton));

    // Assert
    expect(reponse.status).toBe(401);
  });

  test("un utilisateur absent de la base est refusé", async () => {
    // Arrange
    const inconnu = { ...comptes.ADMIN, id: 9999 };
    const jeton = genererJwtDeTest(inconnu);

    // Act
    const reponse = await request(app).get("/api/articles").set(enteteAuthorization(jeton));

    // Assert
    expect(reponse.status).toBe(401);
    expect(reponse.body.message).toMatch(/introuvable|inactif/i);
  });

  test("un compte inactif est refusé", async () => {
    // Arrange
    etat.utilisateurs = etat.utilisateurs.map((u) =>
      u.id === comptes.ADMIN.id ? { ...u, actif: false } : u
    );
    const jeton = genererJwtDeTest(comptes.ADMIN);

    // Act
    const reponse = await request(app).get("/api/articles").set(enteteAuthorization(jeton));

    // Assert
    expect(reponse.status).toBe(401);
    expect(reponse.body.message).toMatch(/inactif|introuvable/i);
  });

  test("une société désactivée bloque un utilisateur qui n'est pas super administrateur", async () => {
    // Arrange
    etat.actifParSociete[SOCIETE_A] = false;
    const jeton = genererJwtDeTest(comptes.ADMIN);

    // Act
    const reponse = await request(app).get("/api/articles").set(enteteAuthorization(jeton));

    // Assert
    expect(reponse.status).toBe(403);
  });

  test("une société désactivée ne bloque pas le super administrateur", async () => {
    // Arrange
    etat.actifParSociete[SOCIETE_A] = false;
    const jeton = genererJwtDeTest(comptes.SUPER_ADMIN);

    // Act
    const reponse = await request(app)
      .get("/api/articles")
      .set(enteteAuthorization(jeton))
      .set("x-societe-id", String(SOCIETE_A));

    // Assert
    expect(reponse.status).not.toBe(403);
    expect(reponse.status).toBe(200);
  });
});
