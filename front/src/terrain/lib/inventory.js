import { UNITES_ENTIERES } from "../../validation/helpers";

const ENTIERES = new Set([...UNITES_ENTIERES, "UN"]);
const MASQUE_CLE = "stokify-terrain-inventaire-masque";

export function uniteEntiere(unite) {
  return ENTIERES.has(String(unite || "").trim().toUpperCase());
}

export function quantiteComptage(raw, entier = false) {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (!text) return { ok: false, reason: "vide" };
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return { ok: false, reason: "negatif" };
  if (entier && Math.abs(n - Math.round(n)) > 1e-9) return { ok: false, reason: "entier" };
  const quantite = entier ? Math.round(n) : Math.round(n * 1000) / 1000;
  return { ok: true, quantite, zero: quantite === 0 };
}

export function corpsComptage(qteReelle) {
  return { qteReelle: Number(qteReelle) };
}

export function corpsAjout(input) {
  const body = {
    articleId: Number(input?.articleId),
    qteReelle: Number(input?.qteReelle),
  };
  if (input?.emplacementId != null && input.emplacementId !== "" && input.emplacementId !== "sans") {
    body.emplacementId = Number(input.emplacementId);
  }
  if (input?.lotId != null && input.lotId !== "") body.lotId = Number(input.lotId);
  return body;
}

export function lireMasque() {
  try {
    return localStorage.getItem(MASQUE_CLE) !== "0";
  } catch {
    return true;
  }
}

export function ecrireMasque(actif) {
  try {
    localStorage.setItem(MASQUE_CLE, actif ? "1" : "0");
  } catch {
    /* le réglage reste en mémoire */
  }
}

export function vueLigne(ligne, { aveugle = false, masquer = false } = {}) {
  if (!aveugle && !masquer) return ligne;
  if (!ligne) return ligne;
  const copie = { ...ligne };
  delete copie.qteTheorique;
  delete copie.ecart;
  delete copie.valeurEcart;
  return copie;
}

export function grouperParEmplacement(lignes) {
  const map = new Map();
  for (const ligne of lignes || []) {
    const id = ligne?.emplacementId ?? ligne?.emplacement?.id ?? null;
    const key = id == null ? "sans" : String(id);
    if (!map.has(key)) {
      map.set(key, {
        id,
        code: id == null ? "" : ligne?.emplacement?.code || "",
        libelle: id == null ? "" : ligne?.emplacement?.libelle || "",
        lignes: [],
      });
    }
    map.get(key).lignes.push(ligne);
  }
  return [...map.values()];
}

export function progression(lignes) {
  const total = (lignes || []).length;
  const done = (lignes || []).filter((ligne) => ligne?.qteReelle != null).length;
  return { done, total };
}

export function lignesCorrespondantes(lignes, { articleId, lotId } = {}) {
  const memes = (lignes || []).filter((ligne) => Number(ligne?.articleId || ligne?.article?.id) === Number(articleId));
  if (lotId == null || lotId === "") return memes;
  const exactes = memes.filter((ligne) => Number(ligne?.lotId || ligne?.lot?.id) === Number(lotId));
  if (exactes.length) return exactes;
  return memes.filter((ligne) => (ligne?.lotId ?? ligne?.lot?.id) == null);
}

export function memeLigne(ligne, critere) {
  const articleOk = Number(ligne?.articleId || ligne?.article?.id) === Number(critere?.articleId);
  const lotLigne = ligne?.lotId ?? ligne?.lot?.id ?? null;
  const lotCritere = critere?.lotId ?? null;
  const lotOk = (lotLigne == null && (lotCritere == null || lotCritere === "")) || Number(lotLigne) === Number(lotCritere);
  const placeLigne = ligne?.emplacementId ?? ligne?.emplacement?.id ?? null;
  const placeCritere = critere?.emplacementId === "sans" ? null : critere?.emplacementId ?? null;
  const placeOk = (placeLigne == null && placeCritere == null) || Number(placeLigne) === Number(placeCritere);
  return articleOk && lotOk && placeOk;
}

export function ligneNouvelle(idsConnus, lignes, critere) {
  const connus = new Set((idsConnus || []).map((id) => Number(id)));
  return (lignes || []).find((ligne) => !connus.has(Number(ligne.id)) && memeLigne(ligne, critere)) || null;
}

export function inventaireCloture(error) {
  const status = Number(error?.response?.status);
  const message = String(error?.response?.data?.message || "");
  return status === 400 && /clotur/i.test(message);
}

export function messageBackend(error) {
  const message = error?.response?.data?.message;
  return typeof message === "string" ? message.trim() : "";
}

export function classeInventaire(error) {
  const status = Number(error?.response?.status);
  if (status === 400 || status === 403 || status === 404 || status === 409 || status === 422) return "validation";
  return "verifier";
}

export function dureeSession(debut, fin = Date.now()) {
  const start = Number(debut);
  const end = Number(fin);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "0:00";
  const total = Math.max(0, Math.round((end - start) / 1000));
  const minutes = Math.floor(total / 60);
  const secondes = total % 60;
  return `${minutes}:${String(secondes).padStart(2, "0")}`;
}

export function debutSession(cle) {
  try {
    const existant = Number(sessionStorage.getItem(cle));
    if (Number.isFinite(existant) && existant > 0) return existant;
    const maintenant = Date.now();
    sessionStorage.setItem(cle, String(maintenant));
    return maintenant;
  } catch {
    return Date.now();
  }
}
