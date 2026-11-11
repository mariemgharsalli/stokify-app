import { hasPermission } from "../../security/permissions";

export function effetStockApplique(statut) {
  return !statut || statut === "VALIDE";
}

export function messageCreationMouvement(row) {
  if (row?.statut === "EN_ATTENTE_VALIDATION") {
    return "Mouvement envoyé pour validation. Le stock ne change pas tant qu'il n'est pas validé.";
  }
  return "Mouvement créé avec succès.";
}

export function messageErreurDecision(error) {
  const status = error?.response?.status;
  if (status === 400) return "Stock insuffisant. Le mouvement reste en attente.";
  if (status === 403) return "Action non autorisée.";
  if (status === 404) return "Mouvement introuvable.";
  if (status === 409) return "Ce mouvement est déjà traité.";
  return "Impossible de traiter ce mouvement.";
}

export function peutDeciderMouvement(user) {
  return hasPermission(user?.role, "mouvements:validate");
}

export function estAuteurMouvement(user, mouvement) {
  const auteurId = mouvement?.utilisateur?.id ?? mouvement?.utilisateurId;
  return Number(auteurId) === Number(user?.id);
}

export function peutValiderMouvement(user, mouvement) {
  if (mouvement?.statut !== "EN_ATTENTE_VALIDATION") return false;
  if (!peutDeciderMouvement(user)) return false;
  if (!estAuteurMouvement(user, mouvement)) return true;
  return user.role === "ADMIN" || user.role === "SUPER_ADMIN";
}

export function peutRejeterMouvement(user, mouvement) {
  return mouvement?.statut === "EN_ATTENTE_VALIDATION" && peutDeciderMouvement(user);
}
