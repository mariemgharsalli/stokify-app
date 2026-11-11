"use strict";

const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "RESPONSABLE",
  "MAGASINIER",
  "COMPTABLE",
  "CLIENT",
];

let sequence = 0;

function reinitialiserSequenceUtilisateurs() {
  sequence = 0;
}

/**
 * Utilisateur fictif, aligné sur le modèle Utilisateur (rôle, société, compte actif).
 * Le mot de passe est un hash factice : aucun appel bcrypt ni base.
 */
function creerUtilisateur(remplacements = {}) {
  const role = remplacements.role || "MAGASINIER";
  if (!ROLES.includes(role)) {
    throw new Error(`Rôle inconnu pour les tests : ${role}`);
  }

  const id = remplacements.id ?? ++sequence;
  const societeId = remplacements.societeId ?? 1;

  return {
    id,
    nom: remplacements.nom ?? "Ben Ali",
    prenom: remplacements.prenom ?? "Test",
    email:
      remplacements.email ??
      `${role.toLowerCase()}.${id}@test.stokify.local`,
    motDePasse: remplacements.motDePasse ?? "$2a$10$hashed-password-test",
    role,
    actif: remplacements.actif ?? true,
    societeId,
    clientId: remplacements.clientId ?? (role === "CLIENT" ? 100 : null),
    statutCompte: remplacements.statutCompte ?? "ACTIF",
    telephone: remplacements.telephone ?? null,
    permissions: remplacements.permissions ?? {},
    tentativesEchouees: remplacements.tentativesEchouees ?? 0,
    verrouilleJusqua: remplacements.verrouilleJusqua ?? null,
    profileCompleted: remplacements.profileCompleted ?? true,
    mustChangePassword: remplacements.mustChangePassword ?? false,
  };
}

/** Un utilisateur par rôle, tous rattachés à la même société sauf surcharge. */
function creerUtilisateursParRoles({ societeId = 1, parRole = {} } = {}) {
  return Object.fromEntries(
    ROLES.map((role) => [
      role,
      creerUtilisateur({ role, societeId, ...parRole[role] }),
    ])
  );
}

module.exports = {
  ROLES,
  creerUtilisateur,
  creerUtilisateursParRoles,
  reinitialiserSequenceUtilisateurs,
};
