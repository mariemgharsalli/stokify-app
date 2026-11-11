import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useSocieteQueryScope } from "./useSocieteQueryScope";
import { resolveClientBranding } from "../utils/clientBranding";

/** Identité visuelle de la société cliente active (logo, nom, coordonnées). */
export function useClientBranding({ enabled = true } = {}) {
  const user = useAuthStore((s) => s.user);
  const activeSocieteId = useAuthStore((s) => s.activeSocieteId);
  const societeScope = useSocieteQueryScope();

  const { data: publicCompanies = [] } = useQuery({
    queryKey: ["companies", "public", "client-branding", societeScope],
    queryFn: () => api.get("companies/public").then((r) => r.data),
    enabled: enabled && Boolean(user),
    staleTime: 5 * 60 * 1000,
  });

  const branding = useMemo(
    () =>
      resolveClientBranding({
        user,
        publicCompanies,
        activeSocieteId,
        societeScope,
      }),
    [user, publicCompanies, activeSocieteId, societeScope]
  );

  return branding;
}
