import { parseScannedCode } from "../../utils/qrPayload";
import { resolveModeTracage, tracksLot, tracksSerie } from "../../utils/formHelpers";

function compact(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s\-_]/g, "");
}

function memeCode(a, b) {
  const left = String(a || "").trim().toLowerCase();
  const right = String(b || "").trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || compact(left) === compact(right);
}

export function lireLotsConsumed(raw) {
  if (Array.isArray(raw)) {
    return { rows: raw.filter((row) => row && typeof row === "object"), invalid: false, empty: raw.length === 0 };
  }
  if (raw == null || raw === "") return { rows: [], invalid: false, empty: true };
  if (typeof raw !== "string") return { rows: [], invalid: true, empty: true };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { rows: [], invalid: true, empty: true };
    return { rows: parsed.filter((row) => row && typeof row === "object"), invalid: false, empty: parsed.length === 0 };
  } catch {
    return { rows: [], invalid: true, empty: true };
  }
}

function quantiteCible(ligne, serie) {
  const q = Number(ligne?.quantite);
  if (!Number.isFinite(q) || q <= 0) return 0;
  if (!serie) return q;
  return Math.floor(q + 1e-9);
}

export function construireLigne(ligne) {
  const article = ligne?.article || {};
  const mode = resolveModeTracage(article);
  const lu = lireLotsConsumed(ligne?.lotsConsumed);
  const suivi = tracksLot(mode) || tracksSerie(mode);
  const allocationAbsente = suivi && (lu.empty || lu.invalid);
  let entries = [];

  if (!allocationAbsente && mode === "SERIE") {
    entries = lu.rows.map((row, index) => ({
      id: `serie:${String(row.numero || index)}`,
      kind: "serie",
      numero: String(row.numero || ""),
      numeroSerieId: row.numeroSerieId ?? null,
      lotId: row.lotId ?? null,
      quantite: 1,
      dateExpiration: null,
      numerosSerie: [],
    }));
  } else if (!allocationAbsente && (mode === "LOT" || mode === "LOT_SERIE")) {
    entries = lu.rows.map((row, index) => ({
      id: `lot:${row.lotId ?? row.lotNumero ?? index}:${index}`,
      kind: "lot",
      lotId: row.lotId ?? null,
      lotNumero: String(row.lotNumero || ""),
      quantite: Number(row.quantite) > 0 ? Number(row.quantite) : 0,
      dateExpiration: row.dateExpiration || null,
      numerosSerie: Array.isArray(row.numerosSerie) ? row.numerosSerie.map((numero) => String(numero)) : [],
    }));
  } else {
    entries = [{
      id: "qte",
      kind: "quantite",
      quantite: quantiteCible(ligne, tracksSerie(mode)),
      dateExpiration: null,
      numerosSerie: [],
      allocationAbsente,
    }];
  }

  return {
    id: ligne?.id,
    article: {
      code: article.code || "",
      codeBarres: article.codeBarres || "",
      libelle: article.libelle || "",
      unite: article.unite || "",
      fragile: Boolean(article.fragile),
      poids: Number(article.poids) || 0,
      volume: Number(article.volume) || 0,
      mode,
    },
    quantite: Number(ligne?.quantite) || 0,
    strategieAppliquee: ligne?.strategieAppliquee || ligne?.strategie || "",
    allocationAbsente,
    entries,
  };
}

export function construireMission(vente) {
  return {
    id: vente?.id,
    reference: vente?.reference || "",
    statut: vente?.statut || "",
    livree: Boolean(vente?.livree) || String(vente?.statut || "").toUpperCase() === "LIVRE",
    typeVente: vente?.typeVente || "",
    dateVente: vente?.dateVente || null,
    depotId: vente?.depotId ?? null,
    depot: vente?.depot?.libelle || vente?.depot?.code || "",
    client: { nom: vente?.client?.nom || "", ville: vente?.client?.ville || "" },
    lignes: (vente?.lignes || []).map(construireLigne),
  };
}

export function joursAvant(date, now = new Date()) {
  if (!date) return null;
  const cible = new Date(date);
  if (Number.isNaN(cible.getTime())) return null;
  const aujourdhui = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const echeance = Date.UTC(cible.getFullYear(), cible.getMonth(), cible.getDate());
  return Math.round((echeance - aujourdhui) / 86400000);
}

export function pastilleExpiration(date, now = new Date()) {
  const jours = joursAvant(date, now);
  if (jours == null) return null;
  if (jours < 0 || jours <= 7) return "danger";
  if (jours <= 30) return "warning";
  return "ok";
}

export function etatEntree(progress, ligneId, entryId) {
  return progress?.[ligneId]?.[entryId] || progress?.[String(ligneId)]?.[entryId] || { count: 0, series: [] };
}

export function quantiteFaite(entry, etat) {
  const cible = Number(entry?.quantite) || 0;
  if (cible <= 0) return 0;
  const count = Number(etat?.count) || 0;
  const series = Array.isArray(etat?.series) ? etat.series.length : 0;
  const faite = entry?.kind === "lot" && entry.numerosSerie?.length ? Math.max(count, series) : count;
  return Math.min(cible, faite);
}

export function entreeComplete(entry, etat) {
  const cible = Number(entry?.quantite) || 0;
  if (cible <= 0) return true;
  return quantiteFaite(entry, etat) + 1e-9 >= cible;
}

export function ligneComplete(ligne, progress) {
  return (ligne?.entries || []).every((entry) => entreeComplete(entry, etatEntree(progress, ligne.id, entry.id)));
}

export function missionComplete(mission, progress) {
  const lignes = mission?.lignes || [];
  return lignes.length > 0 && lignes.every((ligne) => ligneComplete(ligne, progress));
}

export function ligneTerminee(ligne, progress, bloquees) {
  if (bloquees?.[ligne?.id] || bloquees?.[String(ligne?.id)]) return true;
  return ligneComplete(ligne, progress);
}

export function missionTerminee(mission, progress, bloquees) {
  const lignes = mission?.lignes || [];
  return lignes.length > 0 && lignes.every((ligne) => ligneTerminee(ligne, progress, bloquees));
}

export function resteAllocation(entry, etat) {
  const cible = Number(entry?.quantite) || 0;
  const reste = cible - quantiteFaite(entry, etat);
  return reste > 1e-9 ? Math.round(reste * 1000) / 1000 : 0;
}

export function appliquerQuantiteLot(entry, etat, quantite) {
  const reste = resteAllocation(entry, etat);
  const q = Number(String(quantite ?? "").replace(",", "."));
  if (!Number.isFinite(q) || q <= 0 || q > reste + 1e-9) return { ok: false, reason: "impossible" };
  return {
    ok: true,
    etat: {
      count: (Number(etat?.count) || 0) + q,
      series: Array.isArray(etat?.series) ? [...etat.series] : [],
    },
  };
}

export function incrementer(entry, etat, serie) {
  const count = Number(etat?.count) || 0;
  const series = Array.isArray(etat?.series) ? [...etat.series] : [];
  if (entry?.kind === "serie") return { count: 1, series: entry.numero ? [entry.numero] : series };
  if (serie) {
    if (!series.includes(serie)) series.push(serie);
    return { count, series };
  }
  return { count: count + 1, series };
}

function expire(entry, now) {
  const jours = joursAvant(entry?.dateExpiration, now);
  return jours != null && jours < 0;
}

function trouverLot(ligne, critere) {
  return (ligne?.entries || []).find((entry) => {
    if (entry.kind !== "lot") return false;
    if (critere.lotId != null && Number(entry.lotId) === Number(critere.lotId)) return true;
    if (critere.numero && memeCode(entry.lotNumero, critere.numero)) return true;
    return false;
  });
}

function trouverSerie(ligne, token) {
  for (const entry of ligne?.entries || []) {
    if (entry.kind === "serie" && memeCode(entry.numero, token)) return { entry, serie: entry.numero };
    const numero = (entry.numerosSerie || []).find((value) => memeCode(value, token));
    if (numero) return { entry, serie: numero };
  }
  return null;
}

function memeArticle(ligne, token) {
  return memeCode(ligne?.article?.code, token) || memeCode(ligne?.article?.codeBarres, token);
}

function verdictEntree(ligne, entry, progress, now, serie) {
  if (expire(entry, now)) return { type: "bloque-expire", ligneId: ligne.id, entry };
  const etat = etatEntree(progress, ligne.id, entry.id);
  if (entreeComplete(entry, etat)) return { type: "complet", ligneId: ligne.id, entry };
  if (serie && (etat.series || []).includes(serie)) return { type: "deja", ligneId: ligne.id, entry };
  return { type: "ok", ligneId: ligne.id, entry, serie: serie || "" };
}

function chercherLot(mission, actif, critere, progress, now) {
  const ici = trouverLot(actif, critere);
  if (ici) return verdictEntree(actif, ici, progress, now);
  for (const ligne of mission?.lignes || []) {
    if (String(ligne.id) === String(actif?.id)) continue;
    const ailleurs = trouverLot(ligne, critere);
    if (!ailleurs) continue;
    if (expire(ailleurs, now)) return { type: "bloque-expire", ligneId: ligne.id, entry: ailleurs };
    return { type: "autre-ligne", ligneId: ligne.id, libelle: ligne.article?.libelle || "" };
  }
  return null;
}

function chercherSerie(mission, actif, token, progress, now) {
  const ici = trouverSerie(actif, token);
  if (ici) return verdictEntree(actif, ici.entry, progress, now, ici.serie);
  for (const ligne of mission?.lignes || []) {
    if (String(ligne.id) === String(actif?.id)) continue;
    const ailleurs = trouverSerie(ligne, token);
    if (!ailleurs) continue;
    if (expire(ailleurs.entry, now)) return { type: "bloque-expire", ligneId: ligne.id, entry: ailleurs.entry };
    return { type: "autre-ligne", ligneId: ligne.id, libelle: ligne.article?.libelle || "" };
  }
  return null;
}

export function classerScan(mission, ligneActiveId, raw, progress, now = new Date()) {
  const text = String(raw || "").trim();
  if (!text) return { type: "vide" };
  const actif = (mission?.lignes || []).find((ligne) => String(ligne.id) === String(ligneActiveId)) || mission?.lignes?.[0];
  if (!actif) return { type: "hors" };
  const parsed = parseScannedCode(text);

  if (parsed.type === "lot") {
    return chercherLot(mission, actif, { lotId: parsed.id }, progress, now) || { type: "bloque-lot" };
  }

  const token = parsed.type === "stock-text" ? parsed.articleCode : parsed.value || text;
  const lot = chercherLot(mission, actif, { numero: token }, progress, now);
  if (lot) return lot;
  const serie = chercherSerie(mission, actif, token, progress, now);
  if (serie) return serie;

  if (memeArticle(actif, token) && actif.entries.some((entry) => entry.kind === "quantite")) {
    const entry = actif.entries.find((item) => item.kind === "quantite");
    return verdictEntree(actif, entry, progress, now);
  }
  for (const ligne of mission.lignes || []) {
    if (String(ligne.id) === String(actif.id)) continue;
    if (memeArticle(ligne, token)) return { type: "autre-ligne", ligneId: ligne.id, libelle: ligne.article?.libelle || "" };
  }
  if (actif.entries.some((entry) => entry.kind === "lot" || entry.kind === "serie")) return { type: "bloque-lot" };
  return { type: "hors" };
}

function lotsTexte(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function empreinteVente(vente) {
  const lignes = (vente?.lignes || [])
    .map((ligne) => ({
      id: Number(ligne?.id),
      quantite: Number(ligne?.quantite) || 0,
      lots: lotsTexte(ligne?.lotsConsumed),
    }))
    .sort((a, b) => a.id - b.id);
  return JSON.stringify({
    statut: String(vente?.statut || ""),
    livree: Boolean(vente?.livree),
    lignes,
  });
}

export function filtrerVentes(items, { depotId, scope, recherche } = {}) {
  const needle = String(recherche || "").trim().toLowerCase();
  return (items || []).filter((vente) => {
    if (scope === "depot" && depotId != null) {
      const id = vente?.depotId;
      const absent = id == null || id === "";
      if (!absent && Number(id) !== Number(depotId)) return false;
    }
    if (!needle) return true;
    const reference = String(vente?.reference || "").toLowerCase();
    const nom = String(vente?.client?.nom || "").toLowerCase();
    return reference.includes(needle) || nom.includes(needle);
  });
}

export function trierVentes(items) {
  return [...(items || [])].sort((a, b) => {
    const gauche = a?.dateVente ? new Date(a.dateVente).getTime() : Number.POSITIVE_INFINITY;
    const droite = b?.dateVente ? new Date(b.dateVente).getTime() : Number.POSITIVE_INFINITY;
    const da = Number.isNaN(gauche) ? Number.POSITIVE_INFINITY : gauche;
    const db = Number.isNaN(droite) ? Number.POSITIVE_INFINITY : droite;
    if (da !== db) return da - db;
    return Number(a?.id) - Number(b?.id);
  });
}

export function venteFragile(vente) {
  return (vente?.lignes || []).some((ligne) => Boolean(ligne?.article?.fragile));
}
