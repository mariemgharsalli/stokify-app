import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useTerrainSessionKey } from "./useTerrainSessionKey";

const STALE_MS = 60_000;
const LOTS_STALE_MS = 5 * 60_000;

function listFrom(data) {
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

function missionQuery({ sessionKey, name, depotId, enabled, queryFn, staleTime = STALE_MS, refetchOnWindowFocus }) {
  return {
    queryKey: ["terrain", sessionKey, "missions", name, depotId ?? null],
    enabled: Boolean(sessionKey) && enabled,
    staleTime,
    ...(refetchOnWindowFocus === undefined ? {} : { refetchOnWindowFocus }),
    queryFn,
  };
}

export function useMissions(depotId) {
  const sessionKey = useTerrainSessionKey();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canAchats = hasPermission(role, "achats:read");
  const canStock = hasPermission(role, "stock:read");

  const receive = useQuery(
    missionQuery({
      sessionKey,
      name: "receive",
      depotId,
      enabled: canAchats,
      queryFn: async () => {
        const [brouillon, commande, retard] = await Promise.all([
          api.get("achats", { params: { statut: "BROUILLON", limit: 1, page: 1 } }),
          api.get("achats", { params: { statut: "COMMANDE", limit: 1, page: 1 } }),
          api.get("achats/en-retard"),
        ]);
        return {
          count: (Number(brouillon.data?.total) || 0) + (Number(commande.data?.total) || 0),
          late: Number(retard.data?.total) || 0,
          items: listFrom(retard.data),
          scoped: false,
        };
      },
    })
  );

  const prepare = useQuery(
    missionQuery({
      sessionKey,
      name: "prepare",
      depotId,
      enabled: canStock,
      queryFn: async () => {
        const { data } = await api.get("stock/ventes-a-livrer");
        return {
          count: Number(data?.total) || 0,
          items: listFrom(data),
          scoped: false,
        };
      },
    })
  );

  const inventory = useQuery(
    missionQuery({
      sessionKey,
      name: "inventory",
      depotId,
      enabled: canStock && depotId != null,
      queryFn: async () => {
        const { data } = await api.get("inventaires", {
          params: { statut: "EN_COURS", depotId, limit: 1, page: 1 },
        });
        return {
          count: Number(data?.total) || 0,
          items: listFrom(data),
          scoped: true,
        };
      },
    })
  );

  const lots = useQuery(
    missionQuery({
      sessionKey,
      name: "lots",
      depotId,
      enabled: canStock && depotId != null,
      staleTime: LOTS_STALE_MS,
      refetchOnWindowFocus: false,
      queryFn: async () => {
        const { data } = await api.get("lots/peremption-risk", {
          params: { days: 30, depotId },
        });
        const items = listFrom(data).slice().sort((a, b) => {
          const left = a?.joursRestants == null ? Number.POSITIVE_INFINITY : Number(a.joursRestants);
          const right = b?.joursRestants == null ? Number.POSITIVE_INFINITY : Number(b.joursRestants);
          return left - right;
        });
        const total = Number(data?.total) || items.length;
        return {
          count: total,
          items,
          truncated: items.length < total,
          scoped: true,
        };
      },
    })
  );

  const alerts = useQuery(
    missionQuery({
      sessionKey,
      name: "alerts",
      depotId,
      enabled: canStock,
      queryFn: async () => {
        const { data } = await api.get("stock/alerts");
        const items = listFrom(data).slice().sort((a, b) => Number(a?.quantite) - Number(b?.quantite));
        return {
          count: items.length,
          items,
          scoped: false,
        };
      },
    })
  );

  function refresh() {
    if (!sessionKey) return Promise.resolve();
    return queryClient.invalidateQueries({ queryKey: ["terrain", sessionKey, "missions"] });
  }

  return {
    sessionKey,
    refresh,
    receive: { ...receive, allowed: canAchats },
    prepare: { ...prepare, allowed: canStock },
    inventory: { ...inventory, allowed: canStock && depotId != null },
    lots: { ...lots, allowed: canStock && depotId != null },
    alerts: { ...alerts, allowed: canStock },
  };
}
