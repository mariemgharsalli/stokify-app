import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api, { getAxiosErrorMessage } from "../../services/api";
import { useTerrainStore } from "../store/terrainStore";
import { useTerrainSessionKey } from "../lib/useTerrainSessionKey";
import TerrainScanResult from "../components/TerrainScanResult";
import { fr } from "../strings/fr";

export default function TerrainEntityScan({ resource }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const sessionKey = useTerrainSessionKey();
  const depotId = useTerrainStore((s) => s.depotId);
  const kind = resource === "lot" ? "lot" : "stock-line";

  const query = useQuery({
    queryKey: ["terrain", sessionKey, "scan", resource, id],
    enabled: Boolean(sessionKey && id),
    retry: false,
    queryFn: async () => {
      const path = resource === "lot" ? `lots/${id}` : `stock/lines/${id}`;
      const { data } = await api.get(path);
      return data;
    },
  });

  function close() {
    navigate("/terrain");
  }

  if (query.isLoading) {
    return (
      <p className="px-4 py-8 text-base text-text-sub" role="status">
        {fr.scanResolving}
      </p>
    );
  }

  if (query.isError || !query.data) {
    const status = query.error?.response?.status;
    const message =
      status === 403 ? fr.scanForbidden : status === 404 ? fr.scanMissing : getAxiosErrorMessage(query.error, fr.scanMissing);
    return (
      <div className="mx-4 mt-6 flex flex-col gap-3 rounded-3xl border border-border bg-card-bg p-4" role="alert">
        <p className="text-base">{message}</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent-500 px-4 text-base font-semibold text-white touch-manipulation"
        >
          {fr.retry}
        </button>
        <button
          type="button"
          onClick={close}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border px-4 text-base font-semibold touch-manipulation"
        >
          {fr.navHome}
        </button>
      </div>
    );
  }

  return <TerrainScanResult open kind={kind} data={query.data} depotId={depotId} onClose={close} />;
}
