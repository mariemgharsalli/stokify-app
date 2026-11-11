"use strict";

jest.mock("../../config/database", () => {
  const { creerPrismaSecurite } = require("./harnaisHttp");
  return creerPrismaSecurite();
});

const request = require("supertest");
const app = require("../../app");
const {
  creerUtilisateursParRoles,
  creerUtilisateur,
  reinitialiserSequenceUtilisateurs,
} = require("../helpers/userFactory");
const { genererJwtDeTest, enteteAuthorization } = require("../helpers/jwtTest");
const { etat, societeDans, SOCIETE_A, SOCIETE_B, ID_B } = require("./harnaisHttp");

const CORPS_VENTE = {
  clientId: 1,
  depotId: 1,
  lignes: [{ articleId: 1, quantite: 1, prixUnit: 10 }],
};
const CORPS_ACHAT = {
  fournisseurId: 1,
  depotId: 1,
  lignes: [{ articleId: 1, quantite: 1, prixUnit: 10 }],
};
const CORPS_ARTICLE = {
  familleId: 1,
  sousFamilleId: 1,
  fournisseurId: 1,
  depotId: 1,
  emplacementId: 1,
};

function preparer() {
  reinitialiserSequenceUtilisateurs();
  const parRole = creerUtilisateursParRoles({ societeId: SOCIETE_A });
  parRole.SUPER_ADMIN = { ...parRole.SUPER_ADMIN, societeId: null };
  const cible = creerUtilisateur({
    id: ID_B,
    role: "MAGASINIER",
    societeId: SOCIETE_B,
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

function auth(utilisateur, societeHeader) {
  const entete = enteteAuthorization(genererJwtDeTest(utilisateur));
  if (societeHeader != null) entete["x-societe-id"] = String(societeHeader);
  return entete;
}

describe("Isolation entre sociétés", () => {
  let admin;
  let comptes;

  beforeEach(() => {
    comptes = preparer();
    admin = comptes.ADMIN;
  });

  const lectures = [
    ["articles", "get", `/api/articles/${ID_B}`],
    ["dépôts", "get", `/api/depots/${ID_B}`],
    ["emplacements", "get", `/api/emplacements?depotId=${ID_B}`],
    ["clients", "get", `/api/clients/${ID_B}`],
    ["fournisseurs", "get", `/api/fournisseurs/${ID_B}`],
    ["ventes", "get", `/api/ventes/${ID_B}`],
    ["achats", "get", `/api/achats/${ID_B}`],
    ["lots", "get", `/api/lots/${ID_B}`],
    ["factures", "get", `/api/factures/${ID_B}/apercu`],
    ["règlements", "get", `/api/reglements/ventes/${ID_B}`],
    ["inventaires", "get", `/api/inventaires/${ID_B}`],
  ];

  const modifications = [
    ["articles", "patch", `/api/articles/${ID_B}`, CORPS_ARTICLE],
    ["dépôts", "patch", `/api/depots/${ID_B}`, { libelle: "Pirate" }],
    ["emplacements", "patch", `/api/emplacements/${ID_B}`, { libelle: "Pirate" }],
    ["clients", "patch", `/api/clients/${ID_B}`, { nom: "Pirate" }],
    ["fournisseurs", "patch", `/api/fournisseurs/${ID_B}`, { nom: "Pirate" }],
    ["ventes", "put", `/api/ventes/${ID_B}`, CORPS_VENTE],
    ["achats", "put", `/api/achats/${ID_B}`, CORPS_ACHAT],
    ["lots", "patch", `/api/lots/${ID_B}`, { statut: "BLOQUE" }],
    ["inventaires", "patch", `/api/inventaires/${ID_B}/cancel`, {}],
  ];

  const suppressions = [
    ["articles", "delete", `/api/articles/${ID_B}`],
    ["dépôts", "delete", `/api/depots/${ID_B}`],
    ["emplacements", "delete", `/api/emplacements/${ID_B}`],
    ["ventes", "delete", `/api/ventes/${ID_B}`],
    ["achats", "delete", `/api/achats/${ID_B}`],
    ["lots", "delete", `/api/lots/${ID_B}`],
    ["règlements", "delete", `/api/reglements/vente-reglements/${ID_B}`],
    ["inventaires", "delete", `/api/inventaires/${ID_B}`],
    ["utilisateurs", "delete", `/api/users/${ID_B}`],
  ];

  const listes = [
    ["articles", "/api/articles"],
    ["dépôts", "/api/depots"],
    ["emplacements", `/api/emplacements?depotId=1`],
    ["clients", "/api/clients"],
    ["fournisseurs", "/api/fournisseurs"],
    ["ventes", "/api/ventes"],
    ["achats", "/api/achats"],
    ["lots", "/api/lots"],
    ["règlements", "/api/reglements/list/ventes"],
    ["inventaires", "/api/inventaires"],
    ["utilisateurs", "/api/users"],
    ["sociétés visibles par l'admin", "/api/companies"],
  ];

  test.each(lectures)("lecture %s de la société B refusée", async (_nom, methode, url) => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app)[methode](url).set(entete);

    // Assert
    expect([403, 404]).toContain(reponse.status);
    expect(JSON.stringify(reponse.body)).not.toContain("SECRET-B");
  });

  test.each(modifications)("modification %s de la société B refusée", async (_nom, methode, url, corps) => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app)[methode](url).set(entete).send(corps);

    // Assert
    expect([403, 404]).toContain(reponse.status);
  });

  test.each(suppressions)("suppression %s de la société B refusée", async (_nom, methode, url) => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app)[methode](url).set(entete);

    // Assert
    expect([403, 404]).toContain(reponse.status);
  });

  test("la désactivation d'un client de la société B est refusée", async () => {
    // Arrange — DELETE /clients/:id n'est pas exposé ; la désactivation passe par PATCH.
    const entete = auth(admin);

    // Act
    const reponse = await request(app).patch(`/api/clients/${ID_B}`).set(entete).send({ actif: false });

    // Assert
    expect([403, 404]).toContain(reponse.status);
  });

  test("la désactivation d'un fournisseur de la société B est refusée", async () => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app).patch(`/api/fournisseurs/${ID_B}`).set(entete).send({ actif: false });

    // Assert
    expect([403, 404]).toContain(reponse.status);
  });

  test("la lecture d'une facture de vente de la société B est refusée", async () => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app).get(`/api/factures/vente/${ID_B}`).set(entete);

    // Assert
    expect([403, 404]).toContain(reponse.status);
  });

  test.each(listes)("la liste %s ne contient pas la société B", async (_nom, url) => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app).get(url).set(entete);

    // Assert
    expect(reponse.status).toBe(200);
    expect(JSON.stringify(reponse.body)).not.toContain("SECRET-B");
    expect(JSON.stringify(reponse.body)).not.toContain("cible.b@secret.test");
  });

  test.each(["ADMIN", "RESPONSABLE", "MAGASINIER", "COMPTABLE", "CLIENT"])(
    "le header x-societe-id est ignoré pour %s",
    async (role) => {
      // Arrange
      etat.journal = [];
      const entete = auth(comptes[role], SOCIETE_B);

      // Act
      const reponse = await request(app).get("/api/articles").set(entete);

      // Assert
      expect(reponse.status).toBe(200);
      const appel = etat.journal.find((j) => j.modele === "article" && j.methode === "findMany");
      expect(societeDans(appel.where)).toBe(SOCIETE_A);
      expect(JSON.stringify(reponse.body)).not.toContain("SECRET-B");
    }
  );

  test("le header x-societe-id change le contexte du super administrateur", async () => {
    // Arrange
    etat.journal = [];
    const entete = auth(comptes.SUPER_ADMIN, SOCIETE_B);

    // Act
    const reponse = await request(app).get("/api/articles").set(entete);

    // Assert
    expect(reponse.status).toBe(200);
    const appel = etat.journal.find((j) => j.modele === "article" && j.methode === "findMany");
    expect(societeDans(appel.where)).toBe(SOCIETE_B);
    expect(JSON.stringify(reponse.body)).toContain("SECRET-B");
  });

  it("refuse les permissions d'un utilisateur d'une autre société (GET)", async () => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app).get(`/api/users/${ID_B}/permissions`).set(entete);

    // Assert
    expect(reponse.status).toBe(404);
  });

  it("refuse les permissions d'un utilisateur d'une autre société (PUT)", async () => {
    // Arrange
    const entete = auth(admin);
    const corps = { overrides: [{ module: "stock", niveau: "lecture" }] };

    // Act
    const reponse = await request(app).put(`/api/users/${ID_B}/permissions`).set(entete).send(corps);

    // Assert
    expect(reponse.status).toBe(404);
  });

  it("refuse les permissions d'un utilisateur d'une autre société (PATCH)", async () => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app)
      .patch(`/api/users/${ID_B}/permissions`)
      .set(entete)
      .send({ permissions: { stock: "lecture" } });

    // Assert
    expect(reponse.status).toBe(404);
  });

  it("refuse les permissions d'un utilisateur d'une autre société (DELETE)", async () => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app).delete(`/api/users/${ID_B}/permissions`).set(entete);

    // Assert
    expect(reponse.status).toBe(404);
  });

  it("refuse la lecture d'un utilisateur d'une autre société", async () => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app).get(`/api/users/${ID_B}`).set(entete);

    // Assert
    expect(reponse.status).toBe(404);
  });

  it("refuse la modification d'un utilisateur d'une autre société", async () => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app).patch(`/api/users/${ID_B}`).set(entete).send({ prenom: "Pirate" });

    // Assert
    expect(reponse.status).toBe(404);
  });

  it("laisse un administrateur lire un utilisateur de sa société", async () => {
    // Arrange
    const cible = comptes.MAGASINIER;

    // Act
    const reponse = await request(app).get(`/api/users/${cible.id}`).set(auth(admin));

    // Assert
    expect(reponse.status).toBe(200);
    expect(reponse.body.email).toBe(cible.email);
    expect(reponse.body.role).toBe("MAGASINIER");
  });

  it("laisse le super administrateur lire un utilisateur d'une autre société", async () => {
    // Arrange
    const entete = auth(comptes.SUPER_ADMIN);

    // Act
    const reponse = await request(app).get(`/api/users/${ID_B}`).set(entete);

    // Assert
    expect(reponse.status).toBe(200);
    expect(reponse.body.id).toBe(ID_B);
  });

  it("refuse d'élever un rôle au-dessus de celui de l'appelant", async () => {
    // Arrange
    const cible = comptes.MAGASINIER;

    // Act
    const reponse = await request(app)
      .patch(`/api/users/${cible.id}`)
      .set(auth(admin))
      .send({ role: "SUPER_ADMIN" });

    // Assert
    expect(reponse.status).toBe(400);
    expect(reponse.body.message).toBe("Role invalide");
  });

  it("renvoie 404 avant 403 pour la suppression d'un utilisateur d'une autre société", async () => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app).delete(`/api/users/${ID_B}`).set(entete);

    // Assert
    expect(reponse.status).toBe(404);
  });

  it("refuse encore en 403 la suppression d'un utilisateur de la même société", async () => {
    // Arrange
    const entete = auth(admin);

    // Act
    const reponse = await request(app).delete(`/api/users/${comptes.MAGASINIER.id}`).set(entete);

    // Assert
    expect(reponse.status).toBe(403);
    expect(reponse.body.message).toMatch(/super administrateur/i);
  });
});
