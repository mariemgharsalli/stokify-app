import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { subscribeTerrainAuthReset, useTerrainStore } from "./store/terrainStore";
import { subscribePickAuthReset, usePickStore } from "./store/pickStore";
import { useOnlineStatus } from "./lib/useOnlineStatus";
import { registerTerrainSW } from "./pwa/registerTerrainSW";
import BottomNav from "./components/BottomNav";
import UpdateToast from "./components/UpdateToast";
import { needsPhoneHttps, phoneScanUrl } from "./lib/phoneScan";
import PageTransition from "./motion/PageTransition";
import QueuePanel from "./offline/QueuePanel";
import { fr } from "./strings/fr";
import "./terrain.css";

function isDepotRoute(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "");
  return path === "/terrain/depot" || path === "/terrain/carte";
}

function keepsScanWithoutDepot(pathname) {
  return /^\/terrain\/scan\/(stock|lot)\/[^/]+$/.test(String(pathname || "").replace(/\/+$/, ""));
}

export default function TerrainLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeSocieteId = useAuthStore((s) => s.activeSocieteId);
  const bindSession = useTerrainStore((s) => s.bindSession);
  const terrainSession = useTerrainStore((s) => s.sessionKey);
  const bindPick = usePickStore((s) => s.bind);
  const depotId = useTerrainStore((s) => s.depotId);
  const depotLabel = useTerrainStore((s) => s.depotLabel);
  const warehouseMode = useTerrainStore((s) => s.warehouseMode);
  const setWarehouse = useTerrainStore((s) => s.setWarehouse);
  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const [applyUpdate, setApplyUpdate] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    const societeId = user.role === "SUPER_ADMIN" ? activeSocieteId : user.societeId;
    if (societeId == null || societeId === "") return;
    bindSession(`${societeId}:${user.id}`);
  }, [user, activeSocieteId, bindSession]);

  useEffect(() => {
    if (terrainSession) bindPick(terrainSession);
  }, [terrainSession, bindPick]);

  useEffect(
    () => {
      const unsubTerrain = subscribeTerrainAuthReset(() => {
        queryClient.removeQueries({ queryKey: ["terrain"] });
      });
      const unsubPick = subscribePickAuthReset();
      return () => {
        unsubTerrain();
        unsubPick();
      };
    },
    [queryClient]
  );

  useEffect(() => {
    registerTerrainSW({
      onNeedRefresh(apply) {
        setApplyUpdate(() => apply);
      },
    });
    return () => {
      registerTerrainSW({ onNeedRefresh: () => {} });
    };
  }, []);

  if (!depotId && !isDepotRoute(location.pathname) && !keepsScanWithoutDepot(location.pathname)) {
    return <Navigate to="/terrain/depot" replace />;
  }

  return (
    <div className={`terrain-app min-h-dvh bg-app-bg text-text-main${warehouseMode ? " is-warehouse" : ""}`} style={{ color: "var(--text-primary)" }}>
      <header
        className="terrain-topbar sticky top-0 z-20 flex items-center gap-2 border-b px-3"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <button
          type="button"
          onClick={() => navigate("/terrain/depot")}
          className="terrain-depot min-w-0 flex-1 truncate px-4 text-start text-base font-semibold touch-manipulation"
        >
          {depotLabel || fr.chooseDepot}
        </button>
        <span
          className="terrain-status inline-flex shrink-0 items-center gap-2 px-3 text-sm"
          style={{ color: online ? "var(--accent-success)" : "var(--accent-warning)" }}
          aria-live="polite"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: online ? "var(--accent-success)" : "var(--accent-warning)" }}
            aria-hidden
          />
          {online ? fr.online : fr.offline}
        </span>
        <button
          type="button"
          aria-pressed={warehouseMode}
          aria-label={fr.warehouseToggle}
          onClick={() => setWarehouse(!warehouseMode)}
          className="terrain-warehouse inline-flex shrink-0 items-center justify-center px-3 text-sm font-semibold touch-manipulation"
        >
          {fr.warehouseShort}
        </button>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
          className="terrain-logout inline-flex shrink-0 items-center justify-center px-3 text-sm font-semibold touch-manipulation"
        >
          {fr.logout}
        </button>
      </header>

      <main className="terrain-screen pb-[calc(5.75rem+env(safe-area-inset-bottom))]">
        {needsPhoneHttps() ? (
          <a href={phoneScanUrl()} className="terrain-secure-banner">
            <span>{fr.scanHttpsBanner}</span>
            <strong>{fr.scanOpenSecure}</strong>
          </a>
        ) : null}
        <QueuePanel sessionKey={terrainSession} />
        {/\/terrain\/carte\/?$/.test(location.pathname) ? (
          <Outlet />
        ) : (
          <PageTransition pageKey={location.pathname}>
            <Outlet />
          </PageTransition>
        )}
      </main>
      <BottomNav />
      {applyUpdate ? (
        <UpdateToast onUpdate={() => applyUpdate(true)} onDismiss={() => setApplyUpdate(null)} />
      ) : null}
    </div>
  );
}
