import api from "./api";

export function validerMouvement(id) {
  return api.post(`mouvements/${id}/valider`);
}

export function rejeterMouvement(id, commentaire) {
  const motif = commentaire != null ? String(commentaire).trim() : "";
  return api.post(`mouvements/${id}/rejeter`, motif ? { commentaire: motif } : {});
}

export function invaliderApresMouvement(queryClient) {
  if (!queryClient) return;
  queryClient.invalidateQueries({ queryKey: ["mouvements"] });
  queryClient.invalidateQueries({ queryKey: ["stock"] });
  queryClient.invalidateQueries({ queryKey: ["lots"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}
