/**
 * Expiry Waste Risk — lecture des lots DLC, score via FastAPI (GBM + réseau).
 * Le journal ExpiryPrediction est le seul écrit : un échec ne bloque pas la réponse.
 * La formule q − v × j reste le repli, étiqueté heuristique.
 */
"use strict";

const prisma = require("../../config/database");
const { requireActiveSocieteId } = require("../../utils/societeScope");
const {
  isAiLikelyOffline,
  localExpiryWaste,
} = require("./aiLocal.fallback");
const { aiFetch, AiBusyError, isAiBusy } = require("../../utils/aiClient");

const EPS = 1e-6;
const TIMEOUT_MS = 20000;
const VENTE_WINDOW_DAYS = 30;
const SEQ_LEN = 28;
const TIMELINE_DAYS = 21;
const VERSION = "2.0.0";
const KIND = "ml_expiry_waste";

const URGENCY_RANK = { now: 0, soon: 1, watch: 2 };

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function utcDayMs(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

function todayUtcMs() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function daysUntilUtc(dateExpiration) {
  const dlc = utcDayMs(dateExpiration);
  if (dlc == null) return null;
  return Math.ceil((dlc - todayUtcMs()) / 86400000);
}

function isLegacyNumero(numero) {
  return String(numero || "").startsWith("STOCK-LEGACY-");
}

function isFefo(strategie) {
  return String(strategie || "").toUpperCase() === "FEFO";
}

function classifyHorizon(joursRestants) {
  if (joursRestants == null) return "inconnu";
  if (joursRestants < 0) return "perime";
  if (joursRestants <= 3) return "j3";
  if (joursRestants <= 7) return "j7";
  if (joursRestants <= 14) return "j14";
  if (joursRestants <= 30) return "j30";
  return "plus";
}

function reinforcedWatch({ qtePred, qteP50, qteP90 }) {
  const p50 = Number(qteP50);
  const p90 = Number(qteP90);
  if (!Number.isFinite(p50) || !Number.isFinite(p90) || !(p90 > p50 + EPS)) return false;
  const lowP50 = p50 <= Math.max(Number(qtePred) || 0, 0) * 0.5 + EPS;
  const highTail = p90 >= Math.max(p50 * 1.8, 0.5);
  return lowP50 && highTail;
}

function riskBand({ joursRestants, proba, qtePred, qteP50, qteP90 }) {
  if (joursRestants == null) return "inconnu";
  if (joursRestants < 0 && qtePred > EPS) return "perdu";
  if (qtePred <= EPS && !(Number(qteP90) > EPS)) return "couvert";
  if (reinforcedWatch({ qtePred, qteP50, qteP90 })) return "veille";
  if (joursRestants <= 7) return "critique";
  if (joursRestants <= 14 && proba >= 0.8) return "critique";
  if (joursRestants <= 14 || proba >= 0.5) return "eleve";
  if (proba >= 0.8) return "eleve";
  return "veille";
}

function velocityQuality({ ventes30j, modeTracage }) {
  if (!(Number(ventes30j) > 0)) return "nulle";
  if (Number(ventes30j) < 5 || String(modeTracage || "").toUpperCase() === "AUCUN") {
    return "faible";
  }
  return "solide";
}

function playbookFor(lot, band) {
  const fefo = isFefo(lot.strategieSortie);
  if (band === "perdu") {
    return {
      code: "isoler",
      label: "Isoler le lot",
      detail:
        "DLC dépassée, quantité encore en stock. Inventaire ou retour fournisseur — pas de destruction automatique.",
      owner: "magasin",
      urgency: "now",
    };
  }
  if (!fefo && (band === "critique" || band === "eleve")) {
    return {
      code: "fefo",
      label: "Prioriser FEFO au picking",
      detail: "L’IA ne déplace pas le stock. Ce lot doit sortir avant les plus jeunes.",
      owner: "picking",
      urgency: lot.joursRestants <= 7 ? "now" : "soon",
    };
  }
  if (band === "critique") {
    return {
      code: "accelerer",
      label: "Sortie prioritaire",
      detail: "Fenêtre J≤7 ou proba ≥ 80 %. Accélérer picking / promo interne.",
      owner: "picking",
      urgency: "now",
    };
  }
  if (band === "eleve") {
    return {
      code: "promo",
      label: "Promo ou picking ciblé",
      detail: "La vitesse actuelle ne couvre pas la DLC. Complète FEFO, ne le remplace pas.",
      owner: "commercial",
      urgency: "soon",
    };
  }
  if (band === "couvert") {
    return {
      code: "verifier",
      label: "Vérifier le picking FEFO",
      detail: "La vitesse article absorberait le restant. S’assurer que ce lot est bien touché.",
      owner: "magasin",
      urgency: "watch",
    };
  }
  return {
    code: "veiller",
    label: "Surveiller la couverture",
    detail: "Ratio couverture / vitesse à revoir à chaque ouverture. Pas d’écriture stock.",
    owner: "veille",
    urgency: "watch",
  };
}

function suggestAction(playbook) {
  return `${playbook.label} — ${playbook.detail}`;
}

function priorityScore({ proba, jours, valeur, band, fefo, velocity, reinforced }) {
  let p = (Number(proba) || 0) * 38;
  if (reinforced) p += 8;
  p += Math.min(22, Math.log10(Math.max(Number(valeur) || 0, 1) + 1) * 8);
  if (jours == null) p += 4;
  else if (jours < 0) p += 28;
  else if (jours <= 3) p += 24;
  else if (jours <= 7) p += 16;
  else if (jours <= 14) p += 8;
  if (!fefo && band !== "couvert") p += 8;
  if (velocity === "nulle" && band !== "couvert" && band !== "perdu") p += 6;
  if (band === "couvert") p = Math.min(p, 28);
  return Math.round(Math.max(0, Math.min(100, p)));
}

function emptyKpis() {
  return {
    lotsSuivis: 0,
    lotsARisque: 0,
    lotsCritique: 0,
    lotsEleve: 0,
    lotsVeille: 0,
    lotsPerdus: 0,
    lotsCouverts: 0,
    lotsSansFefo: 0,
    lotsSansVitesse: 0,
    qtePredite: 0,
    valeurPredite: 0,
    valeurRecuperable: 0,
    valeurPerdue: 0,
    valeurStock: 0,
    prioriteMoyenne: 0,
    concentrationDepotPct: 0,
    depotLeader: null,
  };
}

function emptyPayload(extra = {}) {
  return {
    kind: KIND,
    version: VERSION,
    mode: extra.mode || "empty",
    model: extra.model || {
      mode: "heuristic",
      trainedAt: null,
      data: { synthetic: 0, real: 0, realDataSufficient: false },
      metrics: {},
    },
    asOf: new Date().toISOString(),
    kpis: emptyKpis(),
    briefing: {
      tone: "clear",
      headline: "Aucun lot DLC à scorer",
      summary: "Lots legacy sans DLC exclus. Seuls les lots avec expiration et stock restant sont suivis.",
    },
    horizon: [],
    timeline: [],
    spark: [],
    byDepot: [],
    byBand: [],
    playbook: [],
    items: [],
    ...extra,
  };
}

function buildBriefing(kpis, top) {
  const topName = top?.articleLibelle || top?.numero || null;
  if (kpis.lotsPerdus > 0) {
    return {
      tone: "critical",
      headline: `${kpis.lotsPerdus} lot(s) hors DLC encore en stock`,
      summary: topName
        ? `${Math.round(kpis.valeurPerdue)} TND déjà exposés. Priorité : ${topName}.`
        : `${Math.round(kpis.valeurPerdue)} TND déjà exposés — isoler, inventaire ou retour.`,
    };
  }
  if (kpis.lotsCritique > 0) {
    return {
      tone: "critical",
      headline: `${kpis.lotsCritique} lot(s) dans la fenêtre J≤7`,
      summary: topName
        ? `${Math.round(kpis.valeurRecuperable)} TND encore récupérables. ${topName} concentre le risque.`
        : `${Math.round(kpis.valeurRecuperable)} TND encore récupérables si FEFO / promo.`,
    };
  }
  if (kpis.lotsARisque > 0) {
    return {
      tone: "watch",
      headline: `${kpis.lotsARisque} lot(s) sur le runway DLC`,
      summary: `${Math.round(kpis.valeurPredite)} TND prévus invendus le jour de la DLC. Complète FEFO.`,
    };
  }
  return {
    tone: "clear",
    headline: "Runway DLC sous contrôle",
    summary: "Aucun gaspillage anticipé sur les lots avec date d’expiration et stock restant.",
  };
}

async function loadCandidateLots(sid) {
  return prisma.lot.findMany({
    where: {
      article: { societeId: sid },
      dateExpiration: { not: null },
      quantiteRestante: { gt: 0 },
      statut: { not: "DESACTIVE" },
    },
    select: {
      id: true,
      numero: true,
      articleId: true,
      depotId: true,
      dateFabrication: true,
      dateExpiration: true,
      quantiteInitiale: true,
      quantiteRestante: true,
      statut: true,
      article: {
        select: {
          id: true,
          code: true,
          libelle: true,
          imageUrl: true,
          prixAchat: true,
          prixVente: true,
          strategieSortie: true,
          modeTracage: true,
          familleId: true,
          famille: { select: { id: true, code: true, nom: true } },
        },
      },
      depot: { select: { id: true, code: true, libelle: true } },
      couchesFifo: {
        where: { quantiteRestante: { gt: 0 } },
        orderBy: { dateEntree: "desc" },
        take: 1,
        select: { prixUnitaire: true },
      },
    },
    orderBy: [{ dateExpiration: "asc" }, { id: "asc" }],
    take: 400,
  });
}

async function ventes30ByArticle(sid, articleIds) {
  const map = new Map(articleIds.map((id) => [id, 0]));
  if (!articleIds.length) return map;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - VENTE_WINDOW_DAYS);
  since.setUTCHours(0, 0, 0, 0);
  const lignes = await prisma.ligneVente.findMany({
    where: {
      articleId: { in: articleIds },
      vente: {
        societeId: sid,
        statut: "CONFIRME",
        dateVente: { gte: since },
      },
    },
    select: { articleId: true, quantite: true },
  });
  for (const l of lignes) {
    const id = Number(l.articleId);
    map.set(id, (map.get(id) || 0) + Number(l.quantite || 0));
  }
  return map;
}

async function ventesQuotidiennes28(sid, articleIds) {
  const map = new Map(articleIds.map((id) => [id, new Array(SEQ_LEN).fill(0)]));
  if (!articleIds.length) return map;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (SEQ_LEN - 1));
  since.setUTCHours(0, 0, 0, 0);
  const startMs = since.getTime();
  const lignes = await prisma.ligneVente.findMany({
    where: {
      articleId: { in: articleIds },
      vente: { societeId: sid, statut: "CONFIRME", dateVente: { gte: since } },
    },
    select: { articleId: true, quantite: true, vente: { select: { dateVente: true } } },
  });
  for (const l of lignes) {
    const day = utcDayMs(l.vente?.dateVente);
    if (day == null) continue;
    const idx = Math.round((day - startMs) / 86400000);
    if (idx < 0 || idx >= SEQ_LEN) continue;
    const arr = map.get(Number(l.articleId));
    if (arr) arr[idx] += Number(l.quantite || 0);
  }
  return map;
}

function sortAhead(group, strat) {
  return group.slice().sort((a, b) => {
    if (strat === "FEFO") {
      const da = a.dateExpiration ? new Date(a.dateExpiration).getTime() : Infinity;
      const db = b.dateExpiration ? new Date(b.dateExpiration).getTime() : Infinity;
      return da - db || a.id - b.id;
    }
    const da = a.dateFabrication ? new Date(a.dateFabrication).getTime() : Infinity;
    const db = b.dateFabrication ? new Date(b.dateFabrication).getTime() : Infinity;
    return da - db || a.id - b.id;
  });
}

async function qteDevantByLot(sid, enriched) {
  const articleIds = [...new Set(enriched.map((l) => l.articleId))];
  const out = new Map();
  if (!articleIds.length) return out;
  const lots = await prisma.lot.findMany({
    where: {
      articleId: { in: articleIds },
      article: { societeId: sid },
      quantiteRestante: { gt: 0 },
      statut: { not: "DESACTIVE" },
    },
    select: {
      id: true,
      articleId: true,
      depotId: true,
      quantiteRestante: true,
      dateExpiration: true,
      dateFabrication: true,
    },
  });
  const stratByArticle = new Map(
    enriched.map((l) => [l.articleId, String(l.strategieSortie || "FIFO").toUpperCase()])
  );
  const groups = new Map();
  for (const lot of lots) {
    const key = `${lot.articleId}:${lot.depotId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(lot);
  }
  for (const group of groups.values()) {
    const strat = stratByArticle.get(group[0].articleId) || "FIFO";
    if (strat === "STANDARD") {
      for (const lot of group) out.set(lot.id, 0);
      continue;
    }
    let acc = 0;
    for (const lot of sortAhead(group, strat)) {
      out.set(lot.id, acc);
      acc += Number(lot.quantiteRestante) || 0;
    }
  }
  return out;
}

function enrichLot(lot, ventes30, series28, qDevant) {
  const q = Number(lot.quantiteRestante) || 0;
  const qi = Number(lot.quantiteInitiale) || 0;
  const jours = daysUntilUtc(lot.dateExpiration);
  const v30 = Number(ventes30.get(lot.articleId) || 0);
  const vitesse = v30 / VENTE_WINDOW_DAYS;
  const couche = lot.couchesFifo && lot.couchesFifo[0];
  const prix = Number(couche?.prixUnitaire ?? lot.article?.prixAchat ?? 0) || 0;
  const fab = lot.dateFabrication ? utcDayMs(lot.dateFabrication) : null;
  const dlc = utcDayMs(lot.dateExpiration);
  const today = todayUtcMs();
  const age = fab != null ? Math.max(0, Math.round((today - fab) / 86400000)) : 0;
  const dureeVie =
    fab != null && dlc != null
      ? Math.max(1, Math.round((dlc - fab) / 86400000))
      : Math.max(1, (jours == null ? 0 : Math.max(jours, 0)) + age);
  const series = Array.isArray(series28) && series28.length === SEQ_LEN
    ? series28.map((n) => Number(n) || 0)
    : new Array(SEQ_LEN).fill(0);
  const dow = new Date().getUTCDay();
  return {
    lotId: lot.id,
    numero: lot.numero,
    articleId: lot.articleId,
    articleCode: lot.article?.code || "",
    articleLibelle: lot.article?.libelle || "",
    imageUrl: lot.article?.imageUrl || null,
    depotId: lot.depotId,
    depotCode: lot.depot?.code || "",
    depotLibelle: lot.depot?.libelle || "",
    familleId: lot.article?.famille?.id || lot.article?.familleId || null,
    familleNom: lot.article?.famille?.nom || "",
    dateExpiration: lot.dateExpiration ? new Date(lot.dateExpiration).toISOString().slice(0, 10) : null,
    dateFabrication: lot.dateFabrication ? new Date(lot.dateFabrication).toISOString().slice(0, 10) : null,
    quantiteInitiale: round2(qi),
    quantiteRestante: round2(q),
    joursRestants: jours,
    ageJours: age,
    ventes30j: round2(v30),
    vitesseJour: round2(vitesse),
    prixUnitaire: round2(prix),
    prixVente: round2(Number(lot.article?.prixVente) || 0),
    valeurStock: round2(q * prix),
    strategieSortie: lot.article?.strategieSortie || "FIFO",
    modeTracage: lot.article?.modeTracage || "AUCUN",
    statutLot: lot.statut,
    features: {
      lot_id: lot.id,
      quantite_restante: q,
      quantite_initiale: Math.max(qi, q),
      jours_restants: jours == null ? 0 : jours,
      duree_vie: dureeVie,
      age,
      prix_unitaire: prix,
      strategie_sortie: lot.article?.strategieSortie || "FIFO",
      q_devant: Number(qDevant) || 0,
      ventes_28j: series,
      ventes_30j: v30,
      dow,
      quantite_restante_asof: q,
      vitesse_moyenne_journaliere: vitesse,
      jours_restants_avant_expiration: jours == null ? 0 : jours,
    },
  };
}

function attachScores(enriched, scoredById) {
  return enriched.map((lot) => {
    const s = scoredById.get(lot.lotId) || {
      qte_predite_dlc: Math.max(
        0,
        lot.quantiteRestante - lot.vitesseJour * Math.max(lot.joursRestants || 0, 0)
      ),
      proba_waste: 0,
      valeur_predite: 0,
      y_hat_waste: 0,
    };
    const qPred = round2(Number(s.qte_predite_dlc) || 0);
    const qP50 = round2(Number(s.qte_p50 ?? qPred) || 0);
    const qP10 = round2(Number(s.qte_p10 ?? qP50) || 0);
    const qP90 = round2(Number(s.qte_p90 ?? qP50) || 0);
    const proba = Math.max(0, Math.min(1, Number(s.proba_waste) || 0));
    const valeur = round2(Number(s.valeur_predite) || qP50 * lot.prixUnitaire);
    const valeurP90 = round2(Number(s.valeur_p90) || qP90 * lot.prixUnitaire);
    const reinforced = reinforcedWatch({ qtePred: qP50, qteP50: qP50, qteP90: qP90 });
    const band = riskBand({
      joursRestants: lot.joursRestants,
      proba,
      qtePred: qP50,
      qteP50: qP50,
      qteP90: qP90,
    });
    const vq = velocityQuality(lot);
    const cover =
      lot.vitesseJour > EPS ? round2(lot.quantiteRestante / lot.vitesseJour) : null;
    const deficit =
      cover == null || lot.joursRestants == null
        ? null
        : round2(cover - Math.max(lot.joursRestants, 0));
    const fefo = isFefo(lot.strategieSortie);
    const book = playbookFor(lot, band);
    const recuperable = band === "perdu" ? 0 : valeur;
    const perdue = band === "perdu" ? valeur : 0;
    const margeUnitaire = Math.max(0, lot.prixVente - lot.prixUnitaire);
    return {
      ...lot,
      features: undefined,
      qtePrediteDlc: qPred,
      qteP10: qP10,
      qteP50: qP50,
      qteP90: qP90,
      valeurP90,
      drivers: Array.isArray(s.drivers) ? s.drivers : [],
      modeLot: s.mode_lot || null,
      veilleRenforcee: reinforced && band === "veille",
      probaWaste: round2(proba * 100) / 100,
      valeurPredite: valeur,
      valeurRecuperable: round2(recuperable),
      valeurPerdue: round2(perdue),
      margeARisque: round2(qPred * margeUnitaire),
      yHatWaste: Number(s.y_hat_waste) ? 1 : 0,
      band,
      horizon: classifyHorizon(lot.joursRestants),
      fefoActif: fefo,
      velocityQuality: vq,
      joursCouverture: cover,
      deficitJours: deficit,
      tauxEcoulement: round2(
        lot.quantiteRestante > EPS ? 1 - qPred / lot.quantiteRestante : 1
      ),
      playbook: book,
      priorite: priorityScore({
        proba,
        jours: lot.joursRestants,
        valeur,
        band,
        fefo,
        velocity: vq,
        reinforced: reinforced && band === "veille",
      }),
      action: suggestAction(book),
    };
  });
}

function buildHorizon(items) {
  const order = ["perime", "j3", "j7", "j14", "j30", "plus"];
  const labels = {
    perime: "Hors DLC",
    j3: "J≤3",
    j7: "J≤7",
    j14: "J≤14",
    j30: "J≤30",
    plus: "J>30",
  };
  const map = new Map(order.map((id) => [id, { id, label: labels[id], lots: 0, qte: 0, valeur: 0 }]));
  for (const x of items) {
    const row = map.get(x.horizon);
    if (!row) continue;
    row.lots += 1;
    row.qte = round2(row.qte + (Number(x.qtePrediteDlc) || 0));
    row.valeur = round2(row.valeur + (Number(x.valeurPredite) || 0));
  }
  return order.map((id) => map.get(id)).filter((r) => r.lots > 0 || r.id === "j7" || r.id === "j14");
}

function buildTimeline(items) {
  const start = todayUtcMs();
  const buckets = new Map();
  buckets.set("overdue", {
    key: "overdue",
    offset: -1,
    date: null,
    label: "Hors DLC",
    lots: 0,
    qte: 0,
    valeur: 0,
  });
  for (let i = 0; i < TIMELINE_DAYS; i += 1) {
    const ms = start + i * 86400000;
    const date = isoDay(ms);
    buckets.set(date, {
      key: date,
      offset: i,
      date,
      label: i === 0 ? "Aujourd’hui" : `J-${i}`,
      lots: 0,
      qte: 0,
      valeur: 0,
    });
  }
  for (const x of items) {
    if (!x.dateExpiration) continue;
    const dlc = utcDayMs(x.dateExpiration);
    if (dlc == null) continue;
    const offset = Math.ceil((dlc - start) / 86400000);
    const key = offset < 0 ? "overdue" : isoDay(dlc);
    const row = buckets.get(key);
    if (!row) continue;
    row.lots += 1;
    row.qte = round2(row.qte + (Number(x.qtePrediteDlc) || 0));
    row.valeur = round2(row.valeur + (Number(x.valeurPredite) || 0));
  }
  return [...buckets.values()];
}

function buildByDepot(items) {
  const map = new Map();
  for (const x of items) {
    const id = x.depotId || 0;
    if (!map.has(id)) {
      map.set(id, {
        depotId: x.depotId,
        depotCode: x.depotCode,
        depotLibelle: x.depotLibelle || x.depotCode || "Dépôt",
        lots: 0,
        lotsCritique: 0,
        lotsPerdus: 0,
        qtePredite: 0,
        valeurPredite: 0,
      });
    }
    const row = map.get(id);
    row.lots += 1;
    if (x.band === "critique") row.lotsCritique += 1;
    if (x.band === "perdu") row.lotsPerdus += 1;
    row.qtePredite = round2(row.qtePredite + (Number(x.qtePrediteDlc) || 0));
    row.valeurPredite = round2(row.valeurPredite + (Number(x.valeurPredite) || 0));
  }
  return [...map.values()].sort((a, b) => b.valeurPredite - a.valeurPredite);
}

function buildByBand(items) {
  const order = ["perdu", "critique", "eleve", "veille", "couvert"];
  const map = new Map(order.map((id) => [id, { id, lots: 0, qte: 0, valeur: 0 }]));
  for (const x of items) {
    const row = map.get(x.band);
    if (!row) continue;
    row.lots += 1;
    row.qte = round2(row.qte + (Number(x.qtePrediteDlc) || 0));
    row.valeur = round2(row.valeur + (Number(x.valeurPredite) || 0));
  }
  return order.map((id) => map.get(id)).filter((r) => r.lots > 0);
}

function buildPlaybookQueue(items) {
  const map = new Map();
  for (const x of items) {
    const book = x.playbook;
    if (!book || x.band === "couvert") continue;
    if (!map.has(book.code)) {
      map.set(book.code, {
        code: book.code,
        label: book.label,
        detail: book.detail,
        owner: book.owner,
        urgency: book.urgency,
        lots: 0,
        valeur: 0,
        sample: x.articleLibelle || x.numero,
      });
    }
    const row = map.get(book.code);
    row.lots += 1;
    row.valeur = round2(row.valeur + (Number(x.valeurPredite) || 0));
  }
  return [...map.values()].sort((a, b) => {
    const u = (URGENCY_RANK[a.urgency] ?? 9) - (URGENCY_RANK[b.urgency] ?? 9);
    return u || b.valeur - a.valeur;
  });
}

function summarize(items, meta) {
  const aRisque = items.filter(
    (x) => x.band === "critique" || x.band === "eleve" || x.band === "veille" || x.band === "perdu"
  );
  const critique = items.filter((x) => x.band === "critique");
  const eleve = items.filter((x) => x.band === "eleve");
  const veille = items.filter((x) => x.band === "veille");
  const perdus = items.filter((x) => x.band === "perdu");
  const couverts = items.filter((x) => x.band === "couvert");
  const valeur = items.reduce((s, x) => s + (Number(x.valeurPredite) || 0), 0);
  const qte = items.reduce((s, x) => s + (Number(x.qtePrediteDlc) || 0), 0);
  const valeurRecuperable = items.reduce((s, x) => s + (Number(x.valeurRecuperable) || 0), 0);
  const valeurPerdue = items.reduce((s, x) => s + (Number(x.valeurPerdue) || 0), 0);
  const valeurStock = items.reduce((s, x) => s + (Number(x.valeurStock) || 0), 0);
  const prioriteMoyenne = items.length
    ? Math.round(items.reduce((s, x) => s + (Number(x.priorite) || 0), 0) / items.length)
    : 0;

  const ranked = items
    .slice()
    .sort(
      (a, b) =>
        (Number(b.priorite) || 0) - (Number(a.priorite) || 0) ||
        (Number(b.valeurPredite) || 0) - (Number(a.valeurPredite) || 0)
    );

  const byDepot = buildByDepot(items);
  const topDepot = byDepot[0];
  const concentrationDepotPct = valeur > EPS && topDepot
    ? Math.round((topDepot.valeurPredite / valeur) * 100)
    : 0;

  const timeline = buildTimeline(items);
  const spark = timeline.filter((d) => d.offset >= 0).map((d) => d.valeur);
  const kpis = {
    lotsSuivis: items.length,
    lotsARisque: aRisque.length,
    lotsCritique: critique.length,
    lotsEleve: eleve.length,
    lotsVeille: veille.length,
    lotsPerdus: perdus.length,
    lotsCouverts: couverts.length,
    lotsSansFefo: items.filter((x) => !x.fefoActif && x.band !== "couvert").length,
    lotsSansVitesse: items.filter((x) => x.velocityQuality === "nulle").length,
    qtePredite: round2(qte),
    valeurPredite: round2(valeur),
    valeurRecuperable: round2(valeurRecuperable),
    valeurPerdue: round2(valeurPerdue),
    valeurStock: round2(valeurStock),
    prioriteMoyenne,
    concentrationDepotPct,
    depotLeader: topDepot
      ? { depotId: topDepot.depotId, libelle: topDepot.depotLibelle, valeur: topDepot.valeurPredite }
      : null,
  };

  return {
    kind: meta.kind || KIND,
    version: meta.version || VERSION,
    scorerVersion: meta.version || VERSION,
    mode: meta.mode || "local",
    model: meta.model || {
      mode: meta.mode === "ensemble" || meta.mode === "gbm" ? meta.mode : "heuristic",
      trainedAt: null,
      data: { synthetic: 0, real: 0, realDataSufficient: false },
      metrics: {},
    },
    asOf: new Date().toISOString(),
    kpis,
    briefing: buildBriefing(kpis, ranked[0]),
    horizon: buildHorizon(items),
    timeline,
    spark,
    byDepot,
    byBand: buildByBand(items),
    playbook: buildPlaybookQueue(ranked),
    items: ranked,
  };
}

async function scoreViaAi(features) {
  if (isAiLikelyOffline() || isAiBusy()) {
    return { ...localExpiryWaste(features), mode: "local" };
  }
  try {
    const response = await aiFetch("/expiry-waste", {
      body: { lots: features },
      timeoutMs: TIMEOUT_MS,
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.items)) {
        return { ...data, mode: data.mode || "ai" };
      }
    }
  } catch (err) {
    // 429 : score local, la sonde /health ne doit pas passer « offline ».
    if (err instanceof AiBusyError) {
      return { ...localExpiryWaste(features), mode: "local" };
    }
  }
  return { ...localExpiryWaste(features), mode: "local" };
}

async function getExpiryWasteRisk(societeId, { preferLocal = false } = {}) {
  const sid = requireActiveSocieteId(societeId);
  const rawLots = (await loadCandidateLots(sid)).filter((l) => !isLegacyNumero(l.numero));
  if (!rawLots.length) return emptyPayload({ mode: "empty" });

  const articleIds = [...new Set(rawLots.map((l) => l.articleId))];
  const ventes30 = await ventes30ByArticle(sid, articleIds);
  const ventes28 = await ventesQuotidiennes28(sid, articleIds);
  const draft = rawLots.map((l) => enrichLot(l, ventes30, ventes28.get(l.articleId), 0));
  const devant = await qteDevantByLot(sid, draft);
  const enriched = draft.map((l) => ({
    ...l,
    features: { ...l.features, q_devant: Number(devant.get(l.lotId) || 0) },
  }));
  const features = enriched.map((l) => l.features);
  const scored =
    preferLocal || isAiLikelyOffline()
      ? { ...localExpiryWaste(features), mode: "local" }
      : await scoreViaAi(features);
  const byId = new Map();
  for (const row of scored.items || []) {
    const id = Number(row.lot_id ?? row.lotId);
    if (id) byId.set(id, row);
  }
  if (scored.mode === "ensemble" || scored.mode === "gbm") {
    await journalSnapshots(sid, enriched, scored);
  }
  const items = attachScores(enriched, byId);
  return summarize(items, scored);
}

function toDashboardCard(payload) {
  const kpis = payload?.kpis || emptyPayload().kpis;
  const top = (payload?.items || []).slice(0, 4).map((x) => ({
    lotId: x.lotId,
    numero: x.numero,
    articleCode: x.articleCode,
    articleLibelle: x.articleLibelle,
    depotLibelle: x.depotLibelle,
    joursRestants: x.joursRestants,
    qtePrediteDlc: x.qtePrediteDlc,
    valeurPredite: x.valeurPredite,
    probaWaste: x.probaWaste,
    band: x.band,
    horizon: x.horizon,
    priorite: x.priorite,
    playbook: x.playbook?.code || null,
  }));
  return {
    kind: payload?.kind || KIND,
    mode: payload?.mode || "local",
    version: payload?.version || VERSION,
    scorerVersion: payload?.scorerVersion || payload?.version || VERSION,
    pklLoaded: Boolean(payload?.pklLoaded),
    asOf: payload?.asOf || null,
    briefing: payload?.briefing || null,
    kpis,
    top,
    horizon: payload?.horizon || [],
    playbook: (payload?.playbook || []).slice(0, 3),
    spark: payload?.spark || [],
    byDepot: (payload?.byDepot || []).slice(0, 4),
    model: payload?.model || null,
  };
}

function asOfUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildJournalRows(sid, enriched, scored) {
  const byId = new Map();
  for (const row of scored.items || []) {
    const id = Number(row.lot_id ?? row.lotId);
    if (id) byId.set(id, row);
  }
  const asOf = asOfUtc();
  const rows = [];
  for (const lot of enriched) {
    const s = byId.get(lot.lotId);
    if (!s) continue;
    const q50 = Number(s.qte_p50 ?? s.qte_predite_dlc) || 0;
    const q90 = Number(s.qte_p90 ?? q50) || 0;
    const q10 = Number(s.qte_p10 ?? q50) || 0;
    rows.push({
      societeId: sid,
      lotId: lot.lotId,
      asOf,
      joursRestants: Math.round(Number(lot.joursRestants) || 0),
      qteRestante: Number(lot.quantiteRestante) || 0,
      pWaste: Math.max(0, Math.min(1, Number(s.proba_waste) || 0)),
      qteP50: q50,
      qteP90: q90,
      modelVersion: String(scored.version || VERSION),
      features: { ...lot.features, _qteP10: q10, _qteP50: q50, _qteP90: q90 },
    });
  }
  return rows;
}

async function journalSnapshots(sid, enriched, scored, writer) {
  const rows = buildJournalRows(sid, enriched, scored);
  const write = writer || ((data) => prisma.expiryPrediction.createMany({ data, skipDuplicates: true }));
  try {
    if (rows.length) await write(rows);
    return { ok: true, n: rows.length };
  } catch (error) {
    console.warn("[expiry] journal ignoré:", error?.message || error);
    return { ok: false, n: 0 };
  }
}

function emptyMonitoring() {
  return { labeled: 0, brier: null, mae: null, coverage: null, drift: null, series: [], ready: false };
}

function predictionOutcome(row) {
  const q = Number(row.qteRestante) || 0;
  const obs = Number(row.observedWasteQty) || 0;
  const y = q > 0 ? (obs / q > 0.05 ? 1 : 0) : obs > 0 ? 1 : 0;
  const p = Math.max(0, Math.min(1, Number(row.pWaste) || 0));
  const p10 = Number(row.features?._qteP10);
  const p90 = Number(row.qteP90);
  const covered = Number.isFinite(p10) && Number.isFinite(p90) && obs >= p10 - EPS && obs <= p90 + EPS;
  return { y, p, abs: Math.abs((Number(row.qteP50) || 0) - obs), covered, hasBand: Number.isFinite(p10) && Number.isFinite(p90) };
}

async function getExpiryMonitoring(societeId) {
  const sid = requireActiveSocieteId(societeId);
  let rows = [];
  try {
    rows = await prisma.expiryPrediction.findMany({
      where: { societeId: sid, observedAt: { not: null } },
      select: {
        pWaste: true,
        qteP50: true,
        qteP90: true,
        qteRestante: true,
        observedWasteQty: true,
        observedAt: true,
        features: true,
      },
    });
  } catch (error) {
    if (error?.code === "P2021" || /ExpiryPrediction/i.test(String(error?.message || ""))) {
      return emptyMonitoring();
    }
    throw error;
  }
  if (!rows.length) return emptyMonitoring();
  const stats = rows.map(predictionOutcome);
  const mean = (xs) => (xs.length ? xs.reduce((s, n) => s + n, 0) / xs.length : null);
  const brier = mean(stats.map((s) => (s.p - s.y) ** 2));
  const mae = mean(stats.map((s) => s.abs));
  const covered = stats.filter((s) => s.hasBand);
  const coverage = covered.length ? covered.filter((s) => s.covered).length / covered.length : null;
  const now = Date.now();
  const day = 86400000;
  const inWindow = (row, from, to) => {
    const t = new Date(row.observedAt).getTime();
    return t >= from && t < to;
  };
  const brierOf = (subset) => {
    if (!subset.length) return null;
    return mean(subset.map((row) => {
      const s = predictionOutcome(row);
      return (s.p - s.y) ** 2;
    }));
  };
  const recent = rows.filter((row) => inWindow(row, now - 30 * day, now + day));
  const previous = rows.filter((row) => inWindow(row, now - 60 * day, now - 30 * day));
  const recentBrier = brierOf(recent);
  const previousBrier = brierOf(previous);
  const weeks = new Map();
  for (const row of rows) {
    const t = new Date(row.observedAt);
    const monday = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
    const shift = (monday.getUTCDay() + 6) % 7;
    monday.setUTCDate(monday.getUTCDate() - shift);
    const key = monday.toISOString().slice(0, 10);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key).push(row);
  }
  const series = [...weeks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([label, bucket]) => ({ label, brier: brierOf(bucket) }));
  return {
    labeled: rows.length,
    brier,
    mae,
    coverage,
    drift: {
      recentBrier,
      previousBrier,
      delta: recentBrier != null && previousBrier != null ? recentBrier - previousBrier : null,
    },
    series,
    ready: rows.length >= 5,
  };
}

async function getExpiryModelCard() {
  try {
    const response = await aiFetch("/expiry-waste/status", { method: "GET", timeoutMs: 8000 });
    if (response.ok) return await response.json();
  } catch (error) {
    if (!(error instanceof AiBusyError)) {
      /* carte vide : l'UI reste sur le dernier score */
    }
  }
  return { job: null, model: null };
}

const LOT_SELECT = {
  id: true,
  numero: true,
  articleId: true,
  depotId: true,
  dateFabrication: true,
  dateExpiration: true,
  quantiteInitiale: true,
  quantiteRestante: true,
  statut: true,
  article: {
    select: {
      id: true,
      code: true,
      libelle: true,
      imageUrl: true,
      prixAchat: true,
      prixVente: true,
      strategieSortie: true,
      modeTracage: true,
      familleId: true,
      famille: { select: { id: true, code: true, nom: true } },
    },
  },
  depot: { select: { id: true, code: true, libelle: true } },
  couchesFifo: {
    where: { quantiteRestante: { gt: 0 } },
    orderBy: { dateEntree: "desc" },
    take: 1,
    select: { prixUnitaire: true },
  },
};

function packWhatIf(item, prix) {
  const q50 = Number(item?.qte_p50 ?? item?.qte_predite_dlc) || 0;
  const q90 = Number(item?.qte_p90 ?? q50) || 0;
  const q10 = Number(item?.qte_p10 ?? q50) || 0;
  return {
    probaWaste: Number(item?.proba_waste) || 0,
    qteP10: q10,
    qteP50: q50,
    qteP90: q90,
    valeurP50: Number(item?.valeur_predite) || q50 * prix,
    valeurP90: Number(item?.valeur_p90) || q90 * prix,
    drivers: Array.isArray(item?.drivers) ? item.drivers : [],
    modeLot: item?.mode_lot || null,
  };
}

async function whatIfExpiry(societeId, { lotId, velocityMultiplier, extraDays }) {
  const sid = requireActiveSocieteId(societeId);
  const raw = await prisma.lot.findFirst({
    where: { id: Number(lotId), article: { societeId: sid } },
    select: LOT_SELECT,
  });
  if (!raw) {
    const error = new Error("Lot introuvable");
    error.status = 404;
    throw error;
  }
  const ventes30 = await ventes30ByArticle(sid, [raw.articleId]);
  const ventes28 = await ventesQuotidiennes28(sid, [raw.articleId]);
  const draft = enrichLot(raw, ventes30, ventes28.get(raw.articleId), 0);
  const devant = await qteDevantByLot(sid, [draft]);
  const baseFeatures = { ...draft.features, q_devant: Number(devant.get(raw.id) || 0) };
  const beforeScored = await scoreViaAi([baseFeatures]);
  const mult = Math.min(3, Math.max(0.5, Number(velocityMultiplier) || 1));
  const extra = Math.min(14, Math.max(0, Math.round(Number(extraDays) || 0)));
  const afterFeatures = {
    ...baseFeatures,
    ventes_28j: (baseFeatures.ventes_28j || []).map((n) => Number(n) * mult),
    ventes_30j: Number(baseFeatures.ventes_30j || 0) * mult,
    vitesse_moyenne_journaliere: Number(baseFeatures.vitesse_moyenne_journaliere || 0) * mult,
    jours_restants: Number(baseFeatures.jours_restants || 0) + extra,
    jours_restants_avant_expiration: Number(baseFeatures.jours_restants_avant_expiration || 0) + extra,
  };
  const afterScored = await scoreViaAi([afterFeatures]);
  const prix = Number(draft.prixUnitaire) || 0;
  const before = packWhatIf((beforeScored.items || [])[0], prix);
  const after = packWhatIf((afterScored.items || [])[0], prix);
  return {
    before,
    after,
    deltaValeurP50: round2(after.valeurP50 - before.valeurP50),
    mode: afterScored.mode || beforeScored.mode || "local",
  };
}

async function labelExpiryOutcomes() {
  const pending = await prisma.expiryPrediction.findMany({
    where: { observedAt: null },
    take: 2000,
    select: { id: true, lotId: true },
  });
  if (!pending.length) return { labeled: 0 };
  const lots = await prisma.lot.findMany({
    where: { id: { in: [...new Set(pending.map((p) => p.lotId))] } },
    select: { id: true, quantiteRestante: true, dateExpiration: true },
  });
  const byLot = new Map(lots.map((lot) => [lot.id, lot]));
  const today = todayUtcMs();
  const ops = [];
  for (const pred of pending) {
    const lot = byLot.get(pred.lotId);
    if (!lot) continue;
    const dlc = utcDayMs(lot.dateExpiration);
    const qty = Number(lot.quantiteRestante) || 0;
    let observed = null;
    if (qty <= EPS && (dlc == null || today <= dlc)) observed = 0;
    else if (dlc != null && today > dlc) observed = qty;
    if (observed == null) continue;
    ops.push(
      prisma.expiryPrediction.update({
        where: { id: pred.id },
        data: { observedWasteQty: observed, observedAt: new Date() },
      })
    );
  }
  if (!ops.length) return { labeled: 0 };
  await prisma.$transaction(ops);
  return { labeled: ops.length };
}

const TRAIN_KEYS = [
  "quantite_restante",
  "quantite_initiale",
  "jours_restants",
  "duree_vie",
  "age",
  "prix_unitaire",
  "strategie_sortie",
  "q_devant",
  "ventes_28j",
  "ventes_30j",
  "dow",
];

function numericFeatures(features) {
  const src = features && typeof features === "object" ? features : {};
  const out = {};
  for (const key of TRAIN_KEYS) {
    if (src[key] != null) out[key] = src[key];
  }
  return out;
}

async function retrainExpiryFromLabels() {
  let trainedAt = new Date(0);
  try {
    const statusRes = await aiFetch("/expiry-waste/status", { method: "GET", timeoutMs: 8000 });
    if (statusRes.ok) {
      const status = await statusRes.json();
      if (status?.model?.trainedAt) trainedAt = new Date(status.model.trainedAt);
    }
  } catch (error) {
    return { ok: false, reason: error?.message || "statut IA indisponible" };
  }
  const fresh = await prisma.expiryPrediction.count({
    where: { observedAt: { gt: trainedAt }, observedWasteQty: { not: null } },
  });
  if (fresh < 25) return { ok: false, reason: "pas assez d'étiquettes", fresh };
  const rows = await prisma.expiryPrediction.findMany({
    where: { observedWasteQty: { not: null } },
    orderBy: { observedAt: "desc" },
    take: 20000,
    select: { features: true, observedWasteQty: true, qteRestante: true },
  });
  const realRows = rows
    .map((row) => ({
      features: numericFeatures(row.features),
      observedWasteQty: row.observedWasteQty,
      qteRestante: row.qteRestante,
    }))
    .filter((row) => row.features && row.features.quantite_restante != null);
  const response = await aiFetch("/expiry-waste/train", {
    body: { realRows, synthetic: 60000, epochs: 40 },
    timeoutMs: 20000,
  });
  const body = response.ok ? await response.json().catch(() => ({})) : {};
  return { ok: response.status === 202, status: response.status, jobId: body.jobId || null, sent: realRows.length };
}

module.exports = {
  getExpiryWasteRisk,
  toDashboardCard,
  emptyPayload,
  journalSnapshots,
  getExpiryMonitoring,
  getExpiryModelCard,
  whatIfExpiry,
  labelExpiryOutcomes,
  retrainExpiryFromLabels,
};
