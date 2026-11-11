import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LayoutGrid, Loader2, Warehouse } from "lucide-react";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import WarehouseMap2D from "./components/WarehouseMap2D";
import DepotCapacityCardLoader from "../../components/stock/DepotCapacityCardLoader";
import ClientBrandBar from "../../components/brand/ClientBrandBar";
import { useClientBranding } from "../../hooks/useClientBranding";
import { DepotStatutBadge } from "./depotStatusUi";
import GlassPageHeader from "../../components/ui/GlassPageHeader";

export default function WarehouseMapPage() {
  const { id } = useParams();
  const societeScope = useSocieteQueryScope();
  const clientBranding = useClientBranding();
  const [fullscreen, setFullscreen] = useState(false);

  const { data: layoutData, isLoading: loadingLayout } = useQuery({
    queryKey: ["depot-layout", id, societeScope],
    queryFn: () => api.get(`depots/${id}/layout`).then((r) => r.data),
    enabled: !!id,
  });

  const depot = layoutData?.depot;
  const emplacements = layoutData?.emplacements || [];
  const stocks = emplacements.flatMap((e) =>
    (e.stocks || []).map((s) => ({ ...s, emplacementId: e.id }))
  );
  const loading = loadingLayout;

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-text-tertiary,var(--text-muted))]" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <GlassPageHeader
        className="mb-6"
        title={`Plan 2D — ${depot?.libelle || depot?.code || "Dépôt"}`}
        subtitle={`${clientBranding?.nom || "Dépôt"} — visualisation des emplacements`}
        icon={Warehouse}
        badge="Logistique"
        chips={
          <>
            <span className="page-hero__chip page-hero__chip--sky">
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              <strong>{emplacements.length}</strong>
              <span>{emplacements.length !== 1 ? "emplacements" : "emplacement"}</span>
            </span>
            {depot?.code ? (
              <span className="page-hero__chip page-hero__chip--emerald">{depot.code}</span>
            ) : null}
            {depot ? <DepotStatutBadge row={depot} /> : null}
          </>
        }
        actions={
          <Link
            to="/depots"
            className="page-hero__import inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-sky-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour dépôts
          </Link>
        }
      />

      <ClientBrandBar branding={clientBranding} className="mb-4" />
      <DepotCapacityCardLoader depotId={id} depotEditPath={`/depots?edit=${id}`} className="mb-4" />
      <WarehouseMap2D
        emplacements={Array.isArray(emplacements) ? emplacements : []}
        stocks={stocks}
        depot={depot}
        depotCapacite={depot?.capacite}
        layout={layoutData?.layout}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((f) => !f)}
        clientBranding={clientBranding}
      />
    </div>
  );
}
