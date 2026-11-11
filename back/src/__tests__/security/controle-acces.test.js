"use strict";

jest.mock("../../config/database", () => {
  const { creerPrismaSecurite } = require("./harnaisHttp");
  return creerPrismaSecurite();
});

const request = require("supertest");
const app = require("../../app");
const { levelToPermissions } = require("../../middleware/moduleRegistry");
const { creerUtilisateursParRoles, reinitialiserSequenceUtilisateurs } = require("../helpers/userFactory");
const { genererJwtDeTest, enteteAuthorization } = require("../helpers/jwtTest");
const { etat, SOCIETE_A } = require("./harnaisHttp");

function preparer() {
  reinitialiserSequenceUtilisateurs();
  const parRole = creerUtilisateursParRoles({ societeId: SOCIETE_A });
  parRole.SUPER_ADMIN = { ...parRole.SUPER_ADMIN, societeId: null };
  etat.utilisateurs = Object.values(parRole);
  etat.overrides = [];
  etat.actifParSociete = { 1: true, 2: true };
  etat.erreurSql = null;
  etat.journal = [];
  return parRole;
}

function jeton(utilisateur, societeHeader) {
  const entete = enteteAuthorization(genererJwtDeTest(utilisateur));
  if (societeHeader != null) entete["x-societe-id"] = String(societeHeader);
  return entete;
}

async function appeler(methode, url, utilisateur, societeHeader) {
  const requete = request(app)[methode](url).set(jeton(utilisateur, societeHeader));
  if (methode === "post" || methode === "put" || methode === "patch") requete.send({});
  return requete;
}

describe("Contrôle d'accès par rôle", () => {
  let comptes;

  beforeEach(() => {
    comptes = preparer();
  });

  describe("matrice issue de PERMISSIONS", () => {
    const cas = [
      {
        role: "SUPER_ADMIN",
        societe: SOCIETE_A,
        autorisees: [
          ["get", "/api/articles"],
          ["get", "/api/users"],
        ],
        interdites: [
          ["get", "/api/commandes-client"],
          ["get", "/api/panier"],
        ],
      },
      {
        role: "ADMIN",
        autorisees: [
          ["get", "/api/users"],
          ["get", "/api/articles"],
        ],
        interdites: [
          ["get", "/api/ai/chat-client/briefing"],
          ["get", "/api/commandes-client"],
        ],
      },
      {
        role: "RESPONSABLE",
        autorisees: [
          ["get", "/api/articles"],
          ["get", "/api/mouvements"],
        ],
        interdites: [
          ["get", "/api/companies"],
          ["post", "/api/users"],
        ],
      },
      {
        role: "MAGASINIER",
        autorisees: [
          ["get", "/api/articles"],
          ["get", "/api/achats"],
        ],
        interdites: [
          ["get", "/api/users"],
          ["get", "/api/valuation/stock"],
        ],
      },
      {
        role: "COMPTABLE",
        autorisees: [
          ["get", "/api/articles"],
          ["get", "/api/clients"],
        ],
        interdites: [
          ["post", "/api/mouvements/sorties"],
          ["post", "/api/stock/lines"],
        ],
      },
      {
        role: "CLIENT",
        autorisees: [
          ["get", "/api/articles"],
          ["get", "/api/commandes-client"],
        ],
        interdites: [
          ["get", "/api/users"],
          ["get", "/api/companies"],
        ],
      },
    ];

    test.each(cas)("$role : deux routes autorisées", async ({ role, autorisees, societe }) => {
      for (const [methode, url] of autorisees) {
        // Arrange
        const utilisateur = comptes[role];

        // Act
        const reponse = await appeler(methode, url, utilisateur, societe);

        // Assert
        expect(reponse.status).toBe(200);
      }
    });

    test.each(cas)("$role : deux routes interdites", async ({ role, interdites, societe }) => {
      for (const [methode, url] of interdites) {
        // Arrange
        const utilisateur = comptes[role];

        // Act
        const reponse = await appeler(methode, url, utilisateur, societe);

        // Assert
        expect(reponse.status).toBe(403);
      }
    });

    test("la synthèse plateforme est réservée au super administrateur", async () => {
      // Arrange
      const utilisateur = comptes.ADMIN;

      // Act
      const reponse = await appeler("get", "/api/companies/platform-summary", utilisateur);

      // Assert
      expect(reponse.status).toBe(403);
    });

    test("SUPER_ADMIN sans société sélectionnée ne lit pas le stock", async () => {
      // Arrange
      const utilisateur = comptes.SUPER_ADMIN;

      // Act
      const reponse = await appeler("get", "/api/articles", utilisateur);

      // Assert
      expect(reponse.status).toBe(403);
    });
  });

  test("le rôle CLIENT n'accède pas à l'administration des utilisateurs", async () => {
    // Arrange
    const client = comptes.CLIENT;

    // Act
    const liste = await appeler("get", "/api/users", client);
    const creation = await appeler("post", "/api/users", client);

    // Assert
    expect(liste.status).toBe(403);
    expect(creation.status).toBe(403);
  });

  test("seul un rôle autorisé valide un mouvement", async () => {
    const magasinier = await appeler("post", "/api/mouvements/99/valider", comptes.MAGASINIER);
    const responsable = await appeler("post", "/api/mouvements/99/valider", comptes.RESPONSABLE);

    expect(magasinier.status).toBe(403);
    expect(responsable.status).not.toBe(403);
    expect(responsable.status).toBeLessThan(500);
  });

  test("COMPTABLE lit le stock et n'écrit pas de mouvement", async () => {
    // Arrange
    const comptable = comptes.COMPTABLE;

    // Act
    const lecture = await appeler("get", "/api/articles", comptable);
    const ecriture = await appeler("post", "/api/mouvements/sorties", comptable);

    // Assert
    expect(lecture.status).toBe(200);
    expect(ecriture.status).toBe(403);
  });

  test("un override de niveau validation étend les droits du magasinier", async () => {
    // Arrange
    etat.overrides = [{ utilisateurId: comptes.MAGASINIER.id, module: "users", niveau: "validation" }];

    // Act
    const reponse = await appeler("get", "/api/users", comptes.MAGASINIER);

    // Assert
    expect(reponse.status).toBe(200);
  });

  test("un override de niveau aucun retire la lecture stock du comptable", async () => {
    // Arrange
    etat.overrides = [{ utilisateurId: comptes.COMPTABLE.id, module: "stock", niveau: "aucun" }];

    // Act
    const reponse = await appeler("get", "/api/articles", comptes.COMPTABLE);

    // Assert
    expect(reponse.status).toBe(403);
  });

  test("levelToPermissions traduit les niveaux de moduleRegistry", () => {
    // Arrange
    const stockValidation = levelToPermissions("stock", "validation");
    const stockAucun = levelToPermissions("stock", "aucun");
    const usersEcriture = levelToPermissions("users", "ecriture");
    const reglementsLecture = levelToPermissions("reglements", "lecture");

    // Act / Assert
    expect(stockValidation).toEqual(expect.arrayContaining(["stock:read", "stock:write", "stock:delete"]));
    expect(stockAucun).toEqual([]);
    expect(usersEcriture).toEqual(["users:read"]);
    expect(reglementsLecture).toEqual([]);
    expect(levelToPermissions("companies", "lecture")).toEqual(["companies:read"]);
  });
});
