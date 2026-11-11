import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ClipboardList, PackageCheck, PackageOpen, Warehouse } from "lucide-react";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useTerrainStore } from "../store/terrainStore";
import { openTerrainScan } from "../components/ScanFab";
import { useMissions } from "../lib/useMissions";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { dayProgress, fillTemplate, splitToken } from "../lib/dayProgress";
import TerrainScanResult from "../components/TerrainScanResult";
import MissionCard from "../components/MissionCard";
import DayLists from "../components/DayLists";
import CountUp from "../motion/CountUp";
import ProgressRing from "../motion/ProgressRing";
import PulseDot from "../motion/PulseDot";
import Skeleton from "../motion/Skeleton";
import { fr } from "../strings/fr";

const CARDS = [
  { key: "receive", label: fr.missionReceive, icon: PackageOpen, tone: "var(--accent-primary)", to: "/terrain/reception" },
  { key: "prepare", label: fr.missionPrepare, icon: PackageCheck, tone: "var(--accent-info)", to: "/terrain/preparation" },
  { key: "inventory", label: fr.missionInventory, icon: ClipboardList, tone: "var(--accent-warning)", to: "/terrain/inventaire" },
  { key: "lots", label: fr.missionLots, icon: AlertTriangle, tone: "var(--accent-danger)", anchor: "terrain-lots" },
  { key: "alerts", label: fr.missionAlerts, icon: AlertTriangle, tone: "var(--accent-danger)", anchor: "terrain-alerts" },
];

export default function TerrainHome() {
  const navigate = useNavigate();
  const prenom = useAuthStore((s) => s.user?.prenom);
  const role = useAuthStore((s) => s.user?.role);
  const canMove = hasPermission(role, "stock:write");
  const depotId = useTerrainStore((s) => s.depotId);
  const depotLabel = useTerrainStore((s) => s.depotLabel);
  const missions = useMissions(depotId);
  const online = useOnlineStatus();
  const reduceMotion = useReducedMotion();
  const progress = dayProgress(missions);
  const [alertArticle, setAlertArticle] = useState(null);
  const receiveLate = Number(missions.receive.data?.late) > 0;
  const ringLabel = fillTemplate(fr.dayRing, progress);
  const caption = splitToken(fillTemplate(fr.dayDone, { ...progress, done: "{done}" }), "done");

  return (
    <div className="flex flex-col gap-5 px-4 pb-4 pt-4 text-text-main">
      <header className="terrain-hero">
        <video
          className="terrain-hero-video"
          src="/videos/acceuil.mp4"
          poster="/videos/acceuil-hero.png"
          muted
          loop
          playsInline
          autoPlay={!reduceMotion}
          aria-hidden="true"
        />
        <div className="terrain-hero-scrim" aria-hidden="true" />
        <div className="terrain-hero-body">
        <div className="flex items-start justify-between gap-3">
          <p className="terrain-kicker">{fr.brand}</p>
          <button
            type="button"
            onClick={() => missions.refresh()}
            className="terrain-chip inline-flex items-center px-4 text-sm font-semibold touch-manipulation"
          >
            {fr.refresh}
          </button>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{prenom ? `${fr.hello} ${prenom}` : fr.hello}</h1>
            <div className="mt-1">
              <PulseDot tone={online ? "live" : "alert"} label={online ? fr.online : fr.offline} />
            </div>
            <button
              type="button"
              onClick={() => navigate("/terrain/depot")}
              className="terrain-depot mt-3 inline-flex max-w-full items-center gap-2 self-start px-4 text-start text-base touch-manipulation"
            >
              <Warehouse size={18} aria-hidden />
              <span className="truncate">{depotLabel || fr.chooseDepot}</span>
            </button>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            {progress.loading ? (
              <Skeleton className="terrain-ring-skeleton" />
            ) : (
              <ProgressRing progress={progress.ratio} label={ringLabel} />
            )}
            {progress.loading || progress.total === 0 ? null : (
              <p className="max-w-[8.5rem] text-center text-xs text-text-sub" aria-hidden="true">
                {caption.before}
                <CountUp value={progress.done} />
                {caption.after}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link to="/terrain/plan" className="terrain-chip inline-flex min-h-12 items-center justify-center px-3 text-sm font-semibold touch-manipulation">
            {fr.plan3d}
          </Link>
          <Link to="/terrain/carte" className="terrain-chip inline-flex min-h-12 items-center justify-center px-3 text-sm font-semibold touch-manipulation">
            {fr.depotMap}
          </Link>
        </div>
        </div>
      </header>

      <section aria-label={fr.missions} className="flex flex-col gap-3">
        <h2 className="terrain-kicker">{fr.missions}</h2>
        <div className="terrain-board">
          {CARDS.map((spec) => (
            <MissionCard
              key={spec.key}
              spec={spec}
              query={missions[spec.key]}
              featured={spec.key === "receive" && receiveLate}
            />
          ))}
        </div>
      </section>

      <DayLists lots={missions.lots} alerts={missions.alerts} onAlert={setAlertArticle} />

      {canMove ? (
        <Link
          to="/terrain/transfert"
          className="terrain-row inline-flex min-h-14 w-full items-center justify-center text-base font-semibold touch-manipulation"
        >
          {fr.transferTitle}
        </Link>
      ) : null}
      <button
        type="button"
        onClick={() => openTerrainScan(navigate)}
        className="terrain-primary inline-flex min-h-14 w-full items-center justify-center rounded-2xl text-base font-semibold touch-manipulation"
      >
        {fr.scanNow}
      </button>

      <TerrainScanResult
        open={Boolean(alertArticle)}
        kind="article"
        data={alertArticle}
        depotId={depotId}
        onClose={() => setAlertArticle(null)}
      />
    </div>
  );
}
