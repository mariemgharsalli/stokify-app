"use strict";

const METHODES_MODELE = [
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
];

function creerModeleMock() {
  const modele = {};
  for (const methode of METHODES_MODELE) {
    modele[methode] = jest.fn();
  }
  return modele;
}

/**
 * Client Prisma en mémoire. Tout modèle non listé est créé au premier accès.
 *
 * jest.mock("../../config/database", () => {
 *   const { creerMockPrisma } = require("../../__tests__/helpers/prismaMock");
 *   return creerMockPrisma();
 * });
 */
function creerMockPrisma(modeles = []) {
  const prisma = {
    $transaction: jest.fn(async (operations) => {
      if (typeof operations === "function") return operations(prisma);
      return Promise.all(operations);
    }),
    $connect: jest.fn(async () => {}),
    $disconnect: jest.fn(async () => {}),
    $queryRaw: jest.fn(async () => []),
    $executeRaw: jest.fn(async () => 0),
    $queryRawUnsafe: jest.fn(async () => []),
    $executeRawUnsafe: jest.fn(async () => 0),
  };

  const proxy = new Proxy(prisma, {
    get(cible, propriete) {
      if (propriete in cible) return cible[propriete];
      if (typeof propriete !== "string") return undefined;
      cible[propriete] = creerModeleMock();
      return cible[propriete];
    },
  });

  for (const nom of modeles) {
    proxy[nom] = creerModeleMock();
  }

  return proxy;
}

function reinitialiserMockPrisma(prisma) {
  for (const valeur of Object.values(prisma)) {
    if (valeur && typeof valeur.mockReset === "function") {
      valeur.mockReset();
      continue;
    }
    if (!valeur || typeof valeur !== "object") continue;
    for (const methode of Object.values(valeur)) {
      if (methode && typeof methode.mockReset === "function") methode.mockReset();
    }
  }

  prisma.$transaction.mockImplementation(async (operations) => {
    if (typeof operations === "function") return operations(prisma);
    return Promise.all(operations);
  });
  prisma.$connect.mockResolvedValue(undefined);
  prisma.$disconnect.mockResolvedValue(undefined);
  prisma.$queryRaw.mockResolvedValue([]);
  prisma.$executeRaw.mockResolvedValue(0);
  prisma.$queryRawUnsafe.mockResolvedValue([]);
  prisma.$executeRawUnsafe.mockResolvedValue(0);
}

module.exports = {
  creerModeleMock,
  creerMockPrisma,
  reinitialiserMockPrisma,
};
