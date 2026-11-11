import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export const TERRAIN_ROLES = ["MAGASINIER", "RESPONSABLE", "ADMIN", "SUPER_ADMIN"];

/**
 * ProtectedOrClientLayout gère déjà token/user nuls et le rôle CLIENT.
 * Ici : rôle autorisé, société active (SUPER_ADMIN), mot de passe à changer.
 */
export default function TerrainGuard() {
  const user = useAuthStore((s) => s.user);
  const activeSocieteId = useAuthStore((s) => s.activeSocieteId);

  if (!user) return <Navigate to="/login" replace />;
  if (!TERRAIN_ROLES.includes(user.role)) return <Navigate to="/dashboard" replace />;
  if (user.role === "SUPER_ADMIN" && !activeSocieteId) return <Navigate to="/select-societe" replace />;
  // Le modal de changement de mot de passe vit dans le layout desktop : on y renvoie une seule fois.
  if (user.mustChangePassword) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
