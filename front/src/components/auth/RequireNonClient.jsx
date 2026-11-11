import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

/** Bloque l’accès aux écrans internes (stock, dépôts) pour le rôle Client. */
export default function RequireNonClient() {
  const user = useAuthStore((s) => s.user);
  if (user?.role === "CLIENT") return <Navigate to="/articles" replace />;
  return <Outlet />;
}
