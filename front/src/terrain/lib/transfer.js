import { resolveModeTracage, tracksSerie } from "../../utils/formHelpers";

export function quantiteTransfert(raw, disponible, serie) {
  const n = Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: "quantite" };
  if (serie && Math.abs(n - Math.round(n)) > 1e-9) return { ok: false, reason: "entier" };
  const quantite = serie ? Math.round(n) : Math.round(n * 1000) / 1000;
  if (quantite > Number(disponible) + 1e-9) return { ok: false, reason: "plafond" };
  return { ok: true, quantite };
}

export function memeEmplacement(origine, destination) {
  if (origine == null || destination == null || origine === "" || destination === "") return false;
  return Number(origine) === Number(destination);
}

export function classerLignesStock(lignes) {
  const deplacables = [];
  const immobiles = [];
  for (const ligne of lignes || []) {
    const id = ligne?.emplacementId ?? ligne?.emplacement?.id;
    if (id == null || id === "") immobiles.push(ligne);
    else deplacables.push(ligne);
  }
  return { deplacables, immobiles };
}

export function articleSerie(article) {
  return tracksSerie(resolveModeTracage(article));
}

export function interDepotInterdit(article, depotOrigineId, depotDestId) {
  if (depotOrigineId == null || depotDestId == null) return false;
  if (Number(depotOrigineId) === Number(depotDestId)) return false;
  const mode = resolveModeTracage(article);
  return mode === "SERIE" || mode === "LOT_SERIE";
}

export function corpsTransfert(input) {
  const body = {
    articleId: Number(input.articleId),
    depotOrigineId: Number(input.depotOrigineId),
    emplacementOrigineId: Number(input.emplacementOrigineId),
    depotDestId: Number(input.depotDestId),
    emplacementDestId: Number(input.emplacementDestId),
    quantite: Number(input.quantite),
  };
  const commentaire = String(input.commentaire || "").trim();
  if (commentaire) body.commentaire = commentaire;
  return body;
}

export function sommeQuantite(lignes) {
  return (lignes || []).reduce((sum, ligne) => sum + (Number(ligne?.quantite) || 0), 0);
}

export function comparerSnapshot(avantSource, apresSource, avantDest, apresDest, quantite) {
  const source = Number(avantSource);
  const suivant = Number(apresSource);
  const dest = Number(avantDest);
  const destSuivant = Number(apresDest);
  const q = Number(quantite);
  if (![source, suivant, dest, destSuivant, q].every(Number.isFinite)) return "incertain";
  const sourceBaisse = Math.abs(source - suivant - q) <= 0.001;
  const destMonte = Math.abs(destSuivant - dest - q) <= 0.001;
  if (sourceBaisse && destMonte) return "applique";
  if (Math.abs(source - suivant) <= 0.001 && Math.abs(dest - destSuivant) <= 0.001) return "inchange";
  return "incertain";
}

export function messageBackend(error) {
  const message = error?.response?.data?.message;
  return typeof message === "string" ? message.trim() : "";
}

export function classeTransfert(error) {
  const status = Number(error?.response?.status);
  if (status === 400 || status === 403 || status === 409 || status === 422) return "validation";
  return "verifier";
}
