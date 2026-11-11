"use strict";

jest.mock("../../config/database", () => {
  const { creerPrismaSecurite } = require("../../__tests__/security/harnaisHttp");
  return creerPrismaSecurite();
});

const request = require("supertest");
const app = require("../../app");
const prisma = require("../../config/database");
const { creerUtilisateursParRoles, reinitialiserSequenceUtilisateurs } = require("../../__tests__/helpers/userFactory");
const { genererJwtDeTest, enteteAuthorization } = require("../../__tests__/helpers/jwtTest");
const { etat, SOCIETE_A, SOCIETE_B } = require("../../__tests__/security/harnaisHttp");

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

function jeton(utilisateur) {
  return enteteAuthorization(genererJwtDeTest(utilisateur));
}

describe("seuil de validation des mouvements", () => {
  let comptes;

  beforeEach(() => {
    comptes = preparer();
    prisma.societe.update.mockClear();
    prisma.audit.create.mockClear();
  });

  test("un admin fixe le seuil de sa société", async () => {
    const reponse = await request(app)
      .patch(`/api/companies/${SOCIETE_A}/seuil-validation`)
      .set(jeton(comptes.ADMIN))
      .send({ seuilValidationMouvement: 250 });

    expect(reponse.status).toBe(200);
    expect(reponse.body.seuilValidationMouvement).toBe(250);
    expect(prisma.societe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SOCIETE_A },
        data: { seuilValidationMouvement: 250 },
      })
    );
    expect(prisma.audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entite: "Societe",
          nouvelleValeur: "250",
        }),
      })
    );
  });

  test("un magasinier ne peut pas modifier le seuil", async () => {
    const reponse = await request(app)
      .patch(`/api/companies/${SOCIETE_A}/seuil-validation`)
      .set(jeton(comptes.MAGASINIER))
      .send({ seuilValidationMouvement: 250 });

    expect(reponse.status).toBe(403);
    expect(prisma.societe.update).not.toHaveBeenCalled();
  });

  test("une valeur négative est refusée", async () => {
    const reponse = await request(app)
      .patch(`/api/companies/${SOCIETE_A}/seuil-validation`)
      .set(jeton(comptes.ADMIN))
      .send({ seuilValidationMouvement: -1 });

    expect(reponse.status).toBe(422);
    expect(prisma.societe.update).not.toHaveBeenCalled();
  });

  test("une autre société est refusée", async () => {
    const reponse = await request(app)
      .patch(`/api/companies/${SOCIETE_B}/seuil-validation`)
      .set(jeton(comptes.ADMIN))
      .send({ seuilValidationMouvement: 250 });

    expect(reponse.status).toBe(403);
    expect(prisma.societe.update).not.toHaveBeenCalled();
  });

  test("un seuil vide désactive la validation", async () => {
    const reponse = await request(app)
      .patch(`/api/companies/${SOCIETE_A}/seuil-validation`)
      .set(jeton(comptes.ADMIN))
      .send({ seuilValidationMouvement: "" });

    expect(reponse.status).toBe(200);
    expect(reponse.body.seuilValidationMouvement).toBe(0);
  });
});
