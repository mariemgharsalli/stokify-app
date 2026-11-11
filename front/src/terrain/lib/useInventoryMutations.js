import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { useTerrainStore } from "../store/terrainStore";
import { useTerrainSessionKey } from "./useTerrainSessionKey";
import { corpsAjout, corpsComptage } from "./inventory";

export function useInventaireCourant() {
  const sessionKey = useTerrainSessionKey();
  const depotId = useTerrainStore((state) => state.depotId);
  const list = useQuery({
    queryKey: ["terrain", sessionKey, "inventaire", "cours", depotId ?? null],
    enabled: Boolean(sessionKey) && depotId != null,
    queryFn: async () => {
      const { data } = await api.get("inventaires", { params: { statut: "EN_COURS", depotId, limit: 1, page: 1 } });
      return data;
    },
  });
  const id = list.data?.items?.[0]?.id ?? null;
  const detail = useQuery({
    queryKey: ["terrain", sessionKey, "inventaire", String(id)],
    enabled: Boolean(sessionKey) && id != null,
    queryFn: async () => (await api.get(`inventaires/${id}`)).data,
  });
  return { sessionKey, depotId, list, detail, id };
}

function remplacerLigne(queryClient, sessionKey, inventaireId, ligne) {
  queryClient.setQueryData(["terrain", sessionKey, "inventaire", String(inventaireId)], (prev) => {
    if (!prev) return prev;
    const lignes = prev.lignes || [];
    const existe = lignes.some((item) => item.id === ligne.id);
    return { ...prev, lignes: existe ? lignes.map((item) => (item.id === ligne.id ? ligne : item)) : [...lignes, ligne] };
  });
}

export function useCompterLigne(sessionKey) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: ({ inventaireId, ligneId, qteReelle }) =>
      api.patch(`inventaires/${inventaireId}/lignes/${ligneId}`, corpsComptage(qteReelle)).then((response) => response.data),
    onSuccess: (ligne, variables) => remplacerLigne(queryClient, sessionKey, variables.inventaireId, ligne),
  });
}

export function useAjouterLigne(sessionKey) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: ({ inventaireId, ...input }) =>
      api.post(`inventaires/${inventaireId}/lignes`, corpsAjout(input)).then((response) => response.data),
    onSuccess: (ligne, variables) => remplacerLigne(queryClient, sessionKey, variables.inventaireId, ligne),
  });
}
