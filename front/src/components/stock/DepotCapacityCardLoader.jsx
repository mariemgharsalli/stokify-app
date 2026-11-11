import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import DepotCapacityCard from "./DepotCapacityCard";

export default function DepotCapacityCardLoader({ depotId, depotEditPath, className }) {
  const societeScope = useSocieteQueryScope();
  const { data, isLoading } = useQuery({
    queryKey: ["depot-capacity", societeScope, depotId],
    queryFn: () => api.get(`stock/depot-capacity/${depotId}`).then((r) => r.data),
    enabled: Boolean(depotId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className={`h-28 animate-pulse rounded-xl bg-[var(--bg-hover)] ${className || ""}`} />
    );
  }

  return (
    <DepotCapacityCard
      data={data}
      depotEditPath={depotEditPath || `/depots?edit=${depotId}`}
      className={className}
    />
  );
}
