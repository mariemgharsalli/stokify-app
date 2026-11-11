import { useAuthStore } from "../store/authStore";

/**
 * Identifiant de société pour les `queryKey` React Query (cache isolé par tenant).
 * — SUPER_ADMIN : `activeSocieteId` choisi dans la sidebar / select-société.
 * — Autres rôles : `user.societeId` (fixe pour la session).
 */
export function useSocieteQueryScope() {
  const user = useAuthStore((s) => s.user);
  const activeSocieteId = useAuthStore((s) => s.activeSocieteId);
  if (user?.role === "SUPER_ADMIN") {
    if (activeSocieteId == null || String(activeSocieteId).trim() === "") return null;
    const n = Number(activeSocieteId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const sid = user?.societeId;
  if (sid == null || String(sid).trim() === "") return null;
  const n = Number(sid);
  return Number.isFinite(n) && n > 0 ? n : null;
}
