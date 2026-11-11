import { useAuthStore } from "../../store/authStore";

/** Même clé que TerrainLayout : `${societeId}:${userId}`. */
export function useTerrainSessionKey() {
  const user = useAuthStore((s) => s.user);
  const activeSocieteId = useAuthStore((s) => s.activeSocieteId);
  if (!user?.id) return "";
  const societeId = user.role === "SUPER_ADMIN" ? activeSocieteId : user.societeId;
  if (societeId == null || societeId === "") return "";
  return `${societeId}:${user.id}`;
}
