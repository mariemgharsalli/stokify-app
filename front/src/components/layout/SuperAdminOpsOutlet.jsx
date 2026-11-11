import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

/**
 * Super-admin sans société active : seule la route `/select-societe` est accessible.
 */
export default function SuperAdminOpsOutlet() {
  const user = useAuthStore((s) => s.user);
  const activeSocieteId = useAuthStore((s) => s.activeSocieteId);
  const { pathname } = useLocation();

  if (user?.role !== "SUPER_ADMIN") return <Outlet />;

  const hasSociete = activeSocieteId != null && String(activeSocieteId).trim() !== "";
  if (hasSociete) return <Outlet />;

  const p = String(pathname || "").split("?")[0];
  if (p === "/select-societe") return <Outlet />;
  /** Gestion des sociétés sans contexte métier (création / onboarding). */
  if (p === "/superadmin" || p.startsWith("/superadmin/")) return <Outlet />;

  return <Navigate to="/select-societe" replace />;
}
