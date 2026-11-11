import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { invaliderApresMouvement } from "../../services/mouvements";

export function useTransferMutation(sessionKey) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (body) => api.post("mouvements/transfert-emplacement", body).then((response) => response.data),
    onSuccess: (data) => {
      const attente = data?.statut === "EN_ATTENTE_VALIDATION";
      if (attente) {
        queryClient.invalidateQueries({ queryKey: ["mouvements"] });
        return;
      }
      if (sessionKey) queryClient.invalidateQueries({ queryKey: ["terrain", sessionKey] });
      invaliderApresMouvement(queryClient);
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["lots"] });
    },
  });
}
