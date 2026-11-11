import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { invaliderApresMouvement } from "../../services/mouvements";
import { useTerrainSessionKey } from "./useTerrainSessionKey";
import { recevoirLignesEnSequence } from "./reception";

export function invaliderReception(queryClient, sessionKey) {
  if (!queryClient) return;
  if (sessionKey) queryClient.invalidateQueries({ queryKey: ["terrain", sessionKey] });
  queryClient.invalidateQueries({ queryKey: ["achats"] });
  queryClient.invalidateQueries({ queryKey: ["stock"] });
  queryClient.invalidateQueries({ queryKey: ["lots"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  invaliderApresMouvement(queryClient);
}

export function useRecevoirLigne() {
  const sessionKey = useTerrainSessionKey();
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: ({ achatId, ligneId, body }) =>
      api.post(`achats/${achatId}/lignes/${ligneId}/reception`, body).then((response) => response.data),
    onSuccess: () => invaliderReception(queryClient, sessionKey),
  });
}

export function useRecevoirTout() {
  const sessionKey = useTerrainSessionKey();
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (achatId) => recevoirLignesEnSequence(api, achatId),
    onSuccess: () => invaliderReception(queryClient, sessionKey),
  });
}
