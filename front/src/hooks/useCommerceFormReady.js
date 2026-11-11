import { useAuthPersistHydrated } from "./useAuthPersistHydrated";
import { useSocieteQueryScope } from "./useSocieteQueryScope";
import { useAuthStore } from "../store/authStore";

/** Formulaire commerce prêt : auth hydratée + société active connue. */
export function useCommerceFormReady() {
  const hydrated = useAuthPersistHydrated();
  const societeScope = useSocieteQueryScope();
  return hydrated && societeScope != null;
}

/** Message bloquant si les listes ne peuvent pas être chargées. */
export function useCommerceFormGate() {
  const hydrated = useAuthPersistHydrated();
  const societeScope = useSocieteQueryScope();
  const user = useAuthStore((s) => s.user);

  if (!hydrated) {
    return { blocked: true, reason: "hydrating", message: "Chargement de la session…" };
  }
  if (societeScope == null) {
    if (user?.role === "SUPER_ADMIN") {
      return {
        blocked: true,
        reason: "no-societe",
        message: "Sélectionnez une société dans la barre latérale avant de créer un document.",
      };
    }
    return {
      blocked: true,
      reason: "no-societe",
      message: "Société introuvable pour votre compte. Reconnectez-vous ou contactez un administrateur.",
    };
  }
  return { blocked: false, reason: null, message: null };
}
