import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import TerrainGuard from "./TerrainGuard";
import TerrainLayout from "./TerrainLayout";
import TerrainHome from "./pages/TerrainHome";
import TerrainScan from "./pages/TerrainScan";
import TerrainDepot from "./pages/TerrainDepot";
import TerrainEntityScan from "./pages/TerrainEntityScan";
import { fr } from "./strings/fr";

const ReceptionList = lazy(() => import("./pages/ReceptionList"));
const ReceptionDetail = lazy(() => import("./pages/ReceptionDetail"));
const PickingList = lazy(() => import("./pages/PickingList"));
const PickingMission = lazy(() => import("./pages/PickingMission"));
const TransferFlow = lazy(() => import("./pages/TransferFlow"));
const InventoryHome = lazy(() => import("./pages/InventoryHome"));
const InventoryLocation = lazy(() => import("./pages/InventoryLocation"));
const TerrainPlan = lazy(() => import("./pages/TerrainPlan"));
const TerrainDepotsMap = lazy(() => import("./pages/TerrainDepotsMap"));

function ReceptionFallback() {
  return <p role="status" className="px-4 py-6 text-base text-text-sub">{fr.scanResolving}</p>;
}

export default function TerrainApp() {
  return (
    <Routes>
      <Route element={<TerrainGuard />}>
        <Route element={<TerrainLayout />}>
          <Route index element={<TerrainHome />} />
          <Route path="scan" element={<TerrainScan />} />
          <Route path="scan/stock/:id" element={<TerrainEntityScan resource="stock" />} />
          <Route path="scan/lot/:id" element={<TerrainEntityScan resource="lot" />} />
          <Route path="depot" element={<TerrainDepot />} />
          <Route path="plan" element={<Suspense fallback={<ReceptionFallback />}><TerrainPlan /></Suspense>} />
          <Route path="carte" element={<Suspense fallback={<ReceptionFallback />}><TerrainDepotsMap /></Suspense>} />
          <Route path="reception" element={<Suspense fallback={<ReceptionFallback />}><ReceptionList /></Suspense>} />
          <Route path="reception/:achatId" element={<Suspense fallback={<ReceptionFallback />}><ReceptionDetail /></Suspense>} />
          <Route path="preparation" element={<Suspense fallback={<ReceptionFallback />}><PickingList /></Suspense>} />
          <Route path="preparation/:venteId" element={<Suspense fallback={<ReceptionFallback />}><PickingMission /></Suspense>} />
          <Route path="transfert" element={<Suspense fallback={<ReceptionFallback />}><TransferFlow /></Suspense>} />
          <Route path="inventaire" element={<Suspense fallback={<ReceptionFallback />}><InventoryHome /></Suspense>} />
          <Route path="inventaire/emplacement/:emplacementId" element={<Suspense fallback={<ReceptionFallback />}><InventoryLocation /></Suspense>} />
          <Route path="*" element={<Navigate to="/terrain" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
