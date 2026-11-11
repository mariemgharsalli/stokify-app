import { Navigate, useParams } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { terrainScanPath } from "./postAuthRoutes";

/** QR ouvert par l'appareil photo : le magasinier mobile va sur la fiche terrain. */
export default function QrTerrainRedirect({ kind, children }) {
  const { id } = useParams();
  const role = useAuthStore((s) => s.user?.role);
  const target = terrainScanPath(role, kind, id);
  if (target) return <Navigate to={target} replace />;
  return children;
}
