import { parseScannedCode } from "../../utils/qrPayload";
import { resolveModeTracage, tracksLot, tracksSerie } from "../../utils/formHelpers";

export function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function resteLigne(ligne) {
  const commandee = Number(ligne?.quantite);
  const recue = Number(ligne?.quantiteRecue || 0);
  if (!Number.isFinite(commandee)) return 0;
  const reste = round2(commandee - (Number.isFinite(recue) ? recue : 0));
  return reste > 1e-6 ? reste : 0;
}

export function lignesRestantes(achat) {
  return (achat?.lignes || []).filter((ligne) => resteLigne(ligne) > 0);
}

export function achatComplet(achat) {
  const lignes = achat?.lignes;
  if (!Array.isArray(lignes) || lignes.length === 0) return false;
  return lignes.every((ligne) => resteLigne(ligne) <= 0);
}

export function progression(achat) {
  const lignes = achat?.lignes || [];
  const commandee = round2(lignes.reduce((sum, ligne) => sum + (Number(ligne.quantite) || 0), 0));
  const recue = round2(lignes.reduce((sum, ligne) => sum + (Number(ligne.quantiteRecue) || 0), 0));
  const ratio = commandee > 0 ? Math.min(1, Math.max(0, recue / commandee)) : 0;
  return { commandee, recue, ratio };
}

export function joursDeRetard(date, now = new Date()) {
  if (!date) return 0;
  const prevu = new Date(date);
  if (Number.isNaN(prevu.getTime())) return 0;
  const aujourdhui = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const echeance = Date.UTC(prevu.getFullYear(), prevu.getMonth(), prevu.getDate());
  const jours = Math.round((aujourdhui - echeance) / 86400000);
  return jours > 0 ? jours : 0;
}

export function comparerLivraison(a, b) {
  const temps = (achat) => {
    if (!achat?.dateLivraisonPrevue) return Number.POSITIVE_INFINITY;
    const value = new Date(achat.dateLivraisonPrevue).getTime();
    return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
  };
  return temps(a) - temps(b);
}

export function traceOf(article) {
  const mode = resolveModeTracage(article);
  const auto = Boolean(article?.tracageAuto) && mode !== "AUCUN";
  const lot = tracksLot(mode);
  const serie = tracksSerie(mode);
  return {
    mode,
    auto,
    needsLot: lot && !auto,
    needsSerie: serie && !auto,
    needsManual: (lot || serie) && !auto,
  };
}

export function motifToutRecevoir(achat) {
  const restantes = lignesRestantes(achat);
  if (restantes.length === 0) return "vide";
  if (restantes.some((ligne) => traceOf(ligne.article).needsManual)) return "manuel";
  return "ok";
}

export function peutToutRecevoir(achat) {
  return motifToutRecevoir(achat) === "ok";
}

export function boundQuantite(raw, reste, { entier = false } = {}) {
  const max = Number(reste);
  const plafond = Number.isFinite(max) && max > 0 ? max : 0;
  let n = Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) n = 0;
  const limite = entier ? Math.floor(plafond + 1e-9) : plafond;
  if (n > limite) n = limite;
  if (entier) n = Math.floor(n + 1e-9);
  else n = round2(n);
  return n > 0 ? n : 0;
}

export function quantiteValide(qty, reste, { entier = false } = {}) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: "quantite" };
  if (n > Number(reste) + 1e-6) return { ok: false, reason: "reste" };
  if (entier && Math.abs(n - Math.round(n)) > 1e-6) return { ok: false, reason: "entier" };
  return { ok: true, quantite: n };
}

export function seriesValides(numeros, n) {
  const list = (numeros || []).map((value) => String(value || "").trim());
  if (list.length !== n) return { ok: false, reason: "count" };
  if (list.some((value) => !value)) return { ok: false, reason: "vide" };
  if (new Set(list).size !== n) return { ok: false, reason: "doublon" };
  return { ok: true, numeros: list };
}

export function ajouterSerie(liste, raw, max) {
  const numero = String(raw || "").trim();
  const actuel = Array.isArray(liste) ? liste : [];
  if (!numero) return { ok: false, reason: "vide", liste: actuel };
  if (actuel.some((value) => value.toLowerCase() === numero.toLowerCase())) {
    return { ok: false, reason: "doublon", liste: actuel };
  }
  if (actuel.length >= max) return { ok: false, reason: "plein", liste: actuel };
  return { ok: true, liste: [...actuel, numero] };
}

export function fefoSansDate(article, dateExpiration) {
  return String(article?.strategieSortie || "").toUpperCase() === "FEFO" && !String(dateExpiration || "").trim();
}

export function buildReceptionBody(input) {
  const article = input?.article;
  const trace = traceOf(article);
  const entier = tracksSerie(trace.mode);
  const qty = quantiteValide(input?.quantiteRecue, input?.reste, { entier });
  if (!qty.ok) return { ok: false, reason: qty.reason };
  const body = { quantiteRecue: entier ? Math.round(qty.quantite) : qty.quantite };
  if (trace.needsLot) {
    const numeroLot = String(input?.numeroLot || "").trim();
    if (!numeroLot) return { ok: false, reason: "lot" };
    body.numeroLot = numeroLot;
  }
  if (tracksLot(trace.mode) && String(input?.dateExpiration || "").trim()) {
    body.dateExpiration = String(input.dateExpiration).trim();
  }
  if (trace.needsSerie) {
    const series = seriesValides(input?.numerosSerie, body.quantiteRecue);
    if (!series.ok) return series;
    body.numerosSerie = series.numeros;
  }
  if (input?.emplacementId != null && input.emplacementId !== "") {
    const emplacementId = Number(input.emplacementId);
    if (!Number.isInteger(emplacementId) || emplacementId <= 0) return { ok: false, reason: "emplacement" };
    body.emplacementId = emplacementId;
  }
  return { ok: true, body };
}

function compact(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s\-_]/g, "");
}

function memeCode(a, b) {
  const left = String(a || "").trim().toLowerCase();
  const right = String(b || "").trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || compact(left) === compact(right);
}

function codesLu(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  const parsed = parseScannedCode(text);
  const values = [text];
  if (parsed?.articleCode) values.push(parsed.articleCode);
  if (parsed?.type === "code" && parsed.value) values.push(parsed.value);
  return values;
}

export function interpreterScan(lignes, raw) {
  const needles = codesLu(raw);
  const ligne = (lignes || []).find((item) =>
    needles.some((code) => memeCode(code, item?.article?.code) || memeCode(code, item?.article?.codeBarres))
  );
  if (!ligne) return { type: "hors" };
  if (resteLigne(ligne) <= 0) return { type: "complet", ligne };
  return { type: "ouvrir", ligne };
}

export function resoudreEmplacement(liste, raw, depotId) {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, reason: "inconnu" };
  const parsed = parseScannedCode(text);
  const value = parsed?.type === "stock-text" && parsed.emplacement ? parsed.emplacement : parsed?.value || text;
  const found = (liste || []).find((item) => memeCode(item?.code, value) || memeCode(item?.barcode, value));
  if (!found) return { ok: false, reason: "inconnu" };
  if (depotId != null && found.depotId != null && Number(found.depotId) !== Number(depotId)) {
    return { ok: false, reason: "autre" };
  }
  return { ok: true, emplacement: found };
}

export function filtrerAchats(items, { depotId, scope, recherche } = {}) {
  const needle = String(recherche || "").trim().toLowerCase();
  return (items || []).filter((achat) => {
    if (scope === "depot" && depotId != null) {
      const id = achat?.depotId;
      const absent = id == null || id === "";
      if (!absent && Number(id) !== Number(depotId)) return false;
    }
    if (!needle) return true;
    const reference = String(achat?.reference || "").toLowerCase();
    const nom = String(achat?.fournisseur?.nom || "").toLowerCase();
    const code = String(achat?.fournisseur?.code || "").toLowerCase();
    return reference.includes(needle) || nom.includes(needle) || code.includes(needle);
  });
}

export function preparerListe(items) {
  const uniques = new Map();
  for (const achat of items || []) {
    if (achat?.id == null || achatComplet(achat)) continue;
    uniques.set(achat.id, achat);
  }
  return [...uniques.values()].sort(comparerLivraison);
}

export function bilanLignes(achat) {
  const lignes = achat?.lignes || [];
  return {
    recues: lignes.filter((ligne) => Number(ligne?.quantiteRecue) > 0).length,
    restantes: lignes.filter((ligne) => resteLigne(ligne) > 0).length,
  };
}

export function compteSeriesAuto(faites) {
  return (faites || []).reduce((sum, ligne) => {
    const trace = traceOf(ligne?.article);
    if (tracksSerie(trace.mode) && trace.auto) return sum + Math.round(Number(ligne.quantiteRecue) || 0);
    return sum;
  }, 0);
}

export function lotsDesLignes(achat, ligneIds) {
  const ids = new Set((ligneIds || []).map((id) => Number(id)));
  const vus = new Set();
  const lots = [];
  for (const ligne of achat?.lignes || []) {
    if (!ids.has(Number(ligne.id)) || !ligne?.lot?.numero || vus.has(ligne.lot.numero)) continue;
    vus.add(ligne.lot.numero);
    lots.push({ ligneId: ligne.id, numero: ligne.lot.numero, libelle: ligne.article?.libelle || "" });
  }
  return lots;
}

export function classeErreur(error) {
  const status = Number(error?.response?.status);
  if (status === 400 || status === 404 || status === 409 || status === 422) return "validation";
  return "verifier";
}

export function messageBackend(error) {
  const message = error?.response?.data?.message;
  return typeof message === "string" ? message.trim() : "";
}

export async function chargerAchatsParStatut(client, statut) {
  const items = [];
  let page = 1;
  let pages = 1;
  do {
    const { data } = await client.get("achats", { params: { statut, limit: 100, page } });
    items.push(...(data?.items || []));
    pages = Math.max(1, Number(data?.pages) || 1);
    page += 1;
  } while (page <= pages && page <= 50);
  return items;
}

export async function chargerAchatsAReceptionner(client) {
  const [brouillon, commande] = await Promise.all([
    chargerAchatsParStatut(client, "BROUILLON"),
    chargerAchatsParStatut(client, "COMMANDE"),
  ]);
  return preparerListe([...brouillon, ...commande]);
}

/** Une ligne à la fois. Le reste vient d'un GET frais, jamais d'un cache. */
export async function recevoirLignesEnSequence(client, achatId) {
  const premier = await client.get(`achats/${achatId}`);
  const achat = premier?.data;
  if (motifToutRecevoir(achat) !== "ok") {
    const error = new Error("saisie manuelle");
    error.code = "MANUEL";
    error.etat = achat;
    throw error;
  }
  const faites = [];
  let dernier = achat;
  for (const ligne of lignesRestantes(achat)) {
    const quantiteRecue = resteLigne(ligne);
    if (quantiteRecue <= 0) continue;
    try {
      const res = await client.post(`achats/${achatId}/lignes/${ligne.id}/reception`, { quantiteRecue });
      dernier = res?.data || dernier;
      faites.push({ id: ligne.id, quantiteRecue, article: ligne.article });
    } catch (cause) {
      let etat = null;
      try {
        etat = (await client.get(`achats/${achatId}`))?.data || null;
      } catch {
        etat = null;
      }
      const error = new Error("arret");
      error.cause = cause;
      error.etat = etat;
      error.faites = faites;
      error.classe = classeErreur(cause);
      throw error;
    }
  }
  let frais = dernier;
  try {
    frais = (await client.get(`achats/${achatId}`))?.data || dernier;
  } catch {
    frais = dernier;
  }
  return { achat: frais, faites, statut: dernier?.statut || frais?.statut };
}
