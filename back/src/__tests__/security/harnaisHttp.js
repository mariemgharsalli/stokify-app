"use strict";

/**
 * Clé factice : le SDK Groq est instancié au chargement de app.js.
 * Aucun appel réseau n'est fait avec cette valeur.
 */
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "cle-de-test-groq-sans-appel";

/**
 * Client Prisma fictif pour les tests HTTP.
 * Les lectures filtrées par societeId de la société A ne renvoient jamais
 * la ressource de la société B. Une lecture par id seul renvoie la ressource B,
 * pour qu'un oubli de cloisonnement apparaisse en 200.
 */

const SOCIETE_A = 1;
const SOCIETE_B = 2;
const ID_B = 50;

const etat = {
  utilisateurs: [],
  overrides: [],
  actifParSociete: { 1: true, 2: true },
  erreurSql: null,
  journal: [],
};

function fiche(id, societeId) {
  const secret = Number(societeId) === SOCIETE_B;
  const libelle = secret ? "SECRET-B" : "LOCAL-A";
  return {
    id,
    societeId,
    code: libelle,
    libelle,
    nom: libelle,
    prenom: "Test",
    email: secret ? "cible.b@secret.test" : "local.a@test.stokify.local",
    role: "MAGASINIER",
    actif: secret ? false : true,
    statut: secret ? "ARCHIVE" : "ACTIF",
    statutCompte: "ACTIF",
    reference: libelle,
    quantite: 1,
    quantiteRestante: 0,
    totalTTC: 10,
    totalHT: 8,
    montant: 0,
    montantHT: 0,
    montantTTC: 0,
    stocks: [],
    lignes: [],
    depot: { id: secret ? ID_B : 1, societeId, code: libelle, libelle },
    article: {
      id: 1,
      societeId,
      code: libelle,
      libelle,
      poids: 0,
      volume: 0,
      fragile: false,
      dangereuxChimique: false,
    },
    vente: { id: 1, societeId, reference: libelle, client: { nom: libelle } },
    permissions: {},
    _count: {
      stocks: 0,
      emplacements: 0,
      ventes: 0,
      achats: 0,
      mouvements: 0,
      lignesInventaire: 0,
      numerosSerie: 0,
      couchesFifo: 0,
      lignes: 0,
    },
  };
}

function societeDans(where, profondeur = 0) {
  if (!where || typeof where !== "object" || profondeur > 6) return undefined;
  if (Object.prototype.hasOwnProperty.call(where, "societeId")) {
    const valeur = where.societeId;
    if (typeof valeur === "number") return valeur;
    if (typeof valeur === "string" && valeur !== "" && Number.isFinite(Number(valeur))) {
      return Number(valeur);
    }
  }
  for (const valeur of Object.values(where)) {
    if (Array.isArray(valeur)) {
      for (const item of valeur) {
        const trouve = societeDans(item, profondeur + 1);
        if (trouve != null) return trouve;
      }
    } else if (valeur && typeof valeur === "object") {
      const trouve = societeDans(valeur, profondeur + 1);
      if (trouve != null) return trouve;
    }
  }
  return undefined;
}

function cibleSocieteB(where, profondeur = 0) {
  if (!where || typeof where !== "object" || profondeur > 6) return false;
  for (const valeur of Object.values(where)) {
    if (valeur === ID_B) return true;
    if (Array.isArray(valeur)) {
      if (valeur.some((item) => cibleSocieteB(item, profondeur + 1))) return true;
    } else if (valeur && typeof valeur === "object" && cibleSocieteB(valeur, profondeur + 1)) {
      return true;
    }
  }
  return false;
}

function cleEtrangere(where) {
  if (!where || typeof where !== "object") return null;
  const proche = (valeur) => {
    if (valeur === 1 || valeur === SOCIETE_A) return "A";
    if (valeur === ID_B) return "B";
    return null;
  };
  for (const cle of ["depotId", "articleId", "venteId", "achatId", "clientId", "fournisseurId", "emplacementId"]) {
    if (typeof where[cle] === "number") {
      const sens = proche(where[cle]);
      if (sens) return sens;
    }
  }
  return null;
}

function lignesPour(nom, where) {
  if (nom === "utilisateur") {
    if (where && where.OR) return [];
    const sid = societeDans(where);
    if (sid == null) return etat.utilisateurs.filter((u) => u.societeId === SOCIETE_B);
    return etat.utilisateurs.filter((u) => u.societeId === sid);
  }
  if (nom === "societe") {
    if (!where || Object.keys(where).length === 0) {
      return [
        { id: SOCIETE_A, nom: "Societe A", code: "SA", actif: etat.actifParSociete[SOCIETE_A] !== false },
        { id: SOCIETE_B, nom: "SECRET-B", code: "SECRET-B", actif: true },
      ];
    }
    if (Number(where.id) === SOCIETE_A) {
      return [{ id: SOCIETE_A, nom: "Societe A", code: "SA", actif: etat.actifParSociete[SOCIETE_A] !== false }];
    }
    if (Number(where.id) === SOCIETE_B) {
      return [{ id: SOCIETE_B, nom: "SECRET-B", code: "SECRET-B", actif: true }];
    }
    return [];
  }
  if (nom === "permissionOverride") {
    const uid = where && where.utilisateurId;
    return etat.overrides.filter((o) => uid == null || o.utilisateurId === uid);
  }
  if (nom === "audit" || nom === "activityLog") return [];

  const sid = societeDans(where);
  if (sid === SOCIETE_A) return cibleSocieteB(where) ? [] : [fiche(1, SOCIETE_A)];
  if (sid === SOCIETE_B) return [fiche(ID_B, SOCIETE_B)];
  const fk = cleEtrangere(where);
  if (fk === "A") return [fiche(1, SOCIETE_A)];
  if (fk === "B") return [fiche(ID_B, SOCIETE_B)];
  return [fiche(ID_B, SOCIETE_B)];
}

function unPour(nom, where) {
  if (nom === "utilisateur") {
    if (where && where.id != null) {
      const trouve = etat.utilisateurs.find((u) => u.id === Number(where.id)) || null;
      if (!trouve) return null;
      if (where.societeId != null && Number(trouve.societeId) !== Number(where.societeId)) return null;
      return trouve;
    }
    if (where && where.email) {
      const email = String(where.email).toLowerCase();
      return etat.utilisateurs.find((u) => String(u.email).toLowerCase() === email) || null;
    }
    return null;
  }
  if (nom === "societe") {
    const id = Number(where && where.id);
    if (!id) return null;
    return {
      id,
      nom: id === SOCIETE_B ? "SECRET-B" : "Societe A",
      code: id === SOCIETE_B ? "SECRET-B" : "SA",
      actif: etat.actifParSociete[id] !== false,
    };
  }
  if (nom === "permissionOverride" || nom === "audit" || nom === "activityLog") return null;

  const sid = societeDans(where);
  const id = where && typeof where.id === "number" ? where.id : undefined;
  if (sid === SOCIETE_A) {
    if (id === ID_B || cibleSocieteB(where)) return null;
    return fiche(id || 1, SOCIETE_A);
  }
  if (sid === SOCIETE_B) return fiche(id || ID_B, SOCIETE_B);
  if (id === ID_B) return fiche(ID_B, SOCIETE_B);
  if (id != null) return null;
  return null;
}

function repondre(nom, methode, args) {
  const where = args.where;
  if (methode === "findMany") return Promise.resolve(lignesPour(nom, where));
  if (methode === "findFirst" || methode === "findUnique" || methode === "findFirstOrThrow" || methode === "findUniqueOrThrow") {
    const ligne = unPour(nom, where);
    if ((methode === "findFirstOrThrow" || methode === "findUniqueOrThrow") && !ligne) {
      const err = new Error("Enregistrement introuvable");
      err.code = "P2025";
      return Promise.reject(err);
    }
    return Promise.resolve(ligne);
  }
  if (methode === "count") return Promise.resolve(lignesPour(nom, where).length);
  if (methode === "aggregate") {
    return Promise.resolve({ _sum: { montant: 0, quantite: 0 }, _count: { _all: 0 }, _avg: {} });
  }
  if (methode === "groupBy") return Promise.resolve([]);
  if (methode === "create") return Promise.resolve({ id: 1, ...(args.data || {}) });
  if (methode === "update") return Promise.resolve({ id: where && where.id, ...(args.data || {}) });
  if (methode === "upsert") return Promise.resolve({ id: 1, ...(args.create || args.update || {}) });
  if (methode === "delete") return Promise.resolve({ id: where && where.id });
  if (methode === "deleteMany" || methode === "updateMany" || methode === "createMany") {
    return Promise.resolve({ count: 0 });
  }
  return Promise.resolve(null);
}

const METHODES = [
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

function creerModele(nom) {
  const modele = {};
  for (const methode of METHODES) {
    modele[methode] = jest.fn(async (args = {}) => {
      etat.journal.push({ modele: nom, methode, where: args.where });
      if (etat.erreurSql && nom === "article" && (methode === "findMany" || methode === "count")) {
        throw etat.erreurSql;
      }
      return repondre(nom, methode, args);
    });
  }
  return modele;
}

function creerPrismaSecurite() {
  const prisma = {
    $transaction: jest.fn(async (operations) => {
      if (typeof operations === "function") return operations(acces);
      return Promise.all(operations);
    }),
    $connect: jest.fn(async () => {}),
    $disconnect: jest.fn(async () => {}),
    $queryRaw: jest.fn(async () => []),
    $executeRaw: jest.fn(async () => 0),
    $queryRawUnsafe: jest.fn(async () => []),
    $executeRawUnsafe: jest.fn(async () => 0),
  };

  const acces = new Proxy(prisma, {
    get(cible, propriete) {
      if (propriete in cible) return cible[propriete];
      if (typeof propriete !== "string") return undefined;
      cible[propriete] = creerModele(propriete);
      return cible[propriete];
    },
  });
  return acces;
}

module.exports = {
  SOCIETE_A,
  SOCIETE_B,
  ID_B,
  etat,
  fiche,
  societeDans,
  creerPrismaSecurite,
};
