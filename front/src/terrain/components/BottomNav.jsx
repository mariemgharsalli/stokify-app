import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ClipboardList, Home, PackageCheck, PackageOpen } from "lucide-react";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import ChatSheet from "../chat/ChatSheet";
import ScanFab, { openTerrainScan } from "./ScanFab";
import { fr } from "../strings/fr";

export default function BottomNav() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canChat = hasPermission(role, "ai:read");
  const [chat, setChat] = useState(false);

  return (
    <nav
      aria-label={fr.navLabel}
      className="terrain-dock fixed bottom-0 start-0 end-0 z-30 border-t"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <style>{`
        @keyframes terrain-scan-ring {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-primary) 50%, transparent); }
          100% { box-shadow: 0 0 0 12px transparent; }
        }
        .terrain-scan-fab { animation: terrain-scan-ring 1.6s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .terrain-scan-fab { animation: none; }
        }
      `}</style>
      <div className="grid grid-cols-5 items-end px-1 pt-1">
        <NavLink
          to="/terrain"
          end
          className={({ isActive }) => `terrain-tab flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-xs touch-manipulation ${isActive ? "is-active" : ""}`}
          style={({ isActive }) => ({ color: isActive ? "var(--accent-primary)" : "var(--text-secondary)" })}
        >
          <Home size={20} aria-hidden />
          <span>{fr.navHome}</span>
        </NavLink>
        <NavLink
          to="/terrain/reception"
          className={({ isActive }) => `terrain-tab flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-xs touch-manipulation ${isActive ? "is-active" : ""}`}
          style={({ isActive }) => ({ color: isActive ? "var(--accent-primary)" : "var(--text-secondary)" })}
        >
          <PackageOpen size={20} aria-hidden />
          <span>{fr.navReceive}</span>
        </NavLink>
        <div className="terrain-scan-slot flex items-end justify-center">
          {canChat ? (
            <button
              type="button"
              className="terrain-stoki-fab"
              aria-label={fr.stokiOpen}
              onClick={() => setChat(true)}
            >
              {fr.stoki}
            </button>
          ) : null}
          <ScanFab onPress={() => openTerrainScan(navigate)} />
        </div>
        <NavLink
          to="/terrain/preparation"
          className={({ isActive }) => `terrain-tab flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-xs touch-manipulation ${isActive ? "is-active" : ""}`}
          style={({ isActive }) => ({ color: isActive ? "var(--accent-primary)" : "var(--text-secondary)" })}
        >
          <PackageCheck size={20} aria-hidden />
          <span>{fr.navPrepare}</span>
        </NavLink>
        <NavLink
          to="/terrain/inventaire"
          className={({ isActive }) => `terrain-tab flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-xs touch-manipulation ${isActive ? "is-active" : ""}`}
          style={({ isActive }) => ({ color: isActive ? "var(--accent-primary)" : "var(--text-secondary)" })}
        >
          <ClipboardList size={20} aria-hidden />
          <span>{fr.navInventory}</span>
        </NavLink>
      </div>
      {chat ? <ChatSheet onClose={() => setChat(false)} /> : null}
    </nav>
  );
}
