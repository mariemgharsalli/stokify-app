/** Libellés métier pour le slotting — aucun vocabulaire ML en vue simple. */

export const SLOTTING_VIEW_KEY = "stokify.slotting.viewMode";

export function readSlottingViewMode() {
  try {
    return localStorage.getItem(SLOTTING_VIEW_KEY) === "expert" ? "expert" : "simple";
  } catch {
    return "simple";
  }
}

export function persistSlottingViewMode(mode) {
  try {
    localStorage.setItem(SLOTTING_VIEW_KEY, mode === "expert" ? "expert" : "simple");
  } catch {
    /* quota / private mode */
  }
}

/** Classe ABC → formulation magasinier. */
export const ABC_COPY = {
  A: {
    letter: "A",
    short: "Forte rotation",
    hint: "A = à ranger près du quai, forte rotation",
    zone: "Près du quai",
  },
  B: {
    letter: "B",
    short: "Rotation moyenne",
    hint: "B = zone intermédiaire, accès équilibré",
    zone: "Zone intermédiaire",
  },
  C: {
    letter: "C",
    short: "Faible rotation",
    hint: "C = à ranger en réserve, rotation faible",
    zone: "Fond du dépôt",
  },
};

export const RELIABILITY = {
  high: { id: "high", label: "Élevée" },
  medium: { id: "medium", label: "Moyenne" },
  low: { id: "low", label: "Faible" },
};

export const ROTATION_COPY = {
  Fort: "Forte rotation",
  Moyen: "Rotation moyenne",
  Faible: "Faible rotation",
};

export const SIMPLE_COPY = {
  pageSubtitle:
    "Rapprochez les articles les plus demandés du quai de préparation — un déplacement recommandé, un temps gagné.",
  kicker: "Aide au rangement",
  badge: "Recommandé",
  chips: ["Près du quai", "Forte rotation", "Souvent ensemble"],
  articleTab: "Par article",
  auditTab: "Tout le dépôt",
  priorityTab: "À faire en priorité",
  optionalTab: "Optionnel",
  apply: "Appliquer ce déplacement",
  whyLabel: "Pourquoi ?",
  emptyArticleTitle: "Où ranger cet article ?",
  emptyArticle:
    "Choisissez un article et un dépôt. Nous indiquons l'emplacement le plus proche du quai selon la rotation réelle.",
  emptyAuditTitle: "Optimiser tout le dépôt",
  emptyAudit:
    "Choisissez un dépôt pour voir les articles trop loin du quai, et ceux qui peuvent libérer de la place en picking.",
  loadingArticle: "Recherche du meilleur emplacement…",
  loadingAudit: "Analyse du dépôt en cours…",
  alreadyOptimalTitle: "Déjà bien placé",
  alreadyOptimal:
    "Cet article est déjà à un emplacement adapté à sa rotation. Aucun déplacement n'est nécessaire.",
  noCompatible: "Aucun emplacement compatible n'est libre dans ce dépôt.",
  noPriority: "Rien d'urgent pour le moment.",
  noOptional: "Pas d'autre option sur ce filtre.",
  noMatch: "Aucun article ne correspond à cette recherche.",
  auditLead: "Articles à mieux ranger",
  auditHint:
    "Les priorités rapprochent du quai les produits qui tournent le plus. Le reste reste optionnel.",
  towardsDock: "À rapprocher du quai",
  towardsReserve: "À ranger en réserve",
  kpiMisaligned: "À déplacer",
  kpiPickGain: "Temps gagné",
  kpiPriority: "Prioritaires",
  kpiTrip: "Vers le quai",
  planTitle: "Plan du dépôt",
  planLegend: "Zones de rangement",
  zoneA: "Près du quai",
  zoneB: "Zone intermédiaire",
  zoneC: "Fond du dépôt",
  currentSlot: "Emplacement actuel",
  recommendedSlot: "Emplacement recommandé",
  reliability: "Fiabilité",
  viewSimple: "Vue simple",
  viewExpert: "Mode expert",
  allItems: "Tous",
  filterA: "Forte rotation",
  filterB: "Rotation moyenne",
  filterC: "Faible rotation",
  flowAll: "Tous les déplacements",
  flowDock: "Rapprocher du quai",
  flowReserve: "Ranger en réserve",
  searchPlaceholder: "Article ou emplacement…",
  depotLabel: "Dépôt",
  articleLabel: "Article",
  emptyPlan: "Ce dépôt n'a pas encore d'emplacements à visualiser.",
  optimalDepotTitle: "Dépôt déjà bien rangé",
  optimalDepot:
    "Tous les articles sont dans une zone adaptée à leur rotation. Aucun déplacement prioritaire.",
  moveComment: "Déplacement recommandé — rapprochement du quai de préparation",
};

export const EXPERT_COPY = {
  pageSubtitle:
    "GMM 3 classes, HGB 90 j, affinité co-picking — studio SKU et audit dépôt sur les mêmes règles ML.",
  articleTab: "Studio SKU",
  auditTab: "Audit dépôt",
};

/**
 * Posterior / confidence (0–100) → étiquette métier, jamais un % brut.
 */
export function reliabilityFromConfidence(confidence) {
  const n = Number(confidence);
  if (!Number.isFinite(n)) return RELIABILITY.medium;
  if (n >= 75) return RELIABILITY.high;
  if (n >= 50) return RELIABILITY.medium;
  return RELIABILITY.low;
}

export function abcMeta(abcClass) {
  return ABC_COPY[abcClass] || ABC_COPY.C;
}

export function rotationPhrase(label) {
  return ROTATION_COPY[label] || ROTATION_COPY.Faible;
}

/** Impact concret : secondes par prélèvement, pas de score abstrait. */
export function formatPickGain(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s <= 0) {
    return {
      value: 0,
      unit: "s",
      headline: "—",
      sentence: "Peu d'effet sur le temps, mais un rangement plus cohérent avec la rotation.",
    };
  }
  return {
    value: s,
    unit: "s",
    headline: `−${s} s`,
    sentence: `Réduit le temps de préparation d'environ ${s} seconde${s > 1 ? "s" : ""} par prélèvement`,
  };
}

/** Distance 0–100 exposée comme trajet en mètres, avec variation en %. */
export function formatTrip(from, to) {
  const a = Number(from);
  const b = Number(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const delta = a - b;
  const pct = a > 0 ? Math.round((delta / a) * 100) : 0;
  let change = "";
  if (pct > 0) change = ` (−${pct}%)`;
  else if (pct < 0) change = ` (+${Math.abs(pct)}%)`;
  return {
    from: a,
    to: b,
    delta,
    pct,
    closer: delta > 0,
    sentence: `Trajet actuel : ${a} m — Trajet proposé : ${b} m${change}`,
  };
}

export function moveTitle({ articleCode, articleLibelle, currentCode, recommendedCode }) {
  const article = [articleCode, articleLibelle].filter(Boolean).join(" — ") || "cet article";
  if (!currentCode && recommendedCode) {
    return `Ranger ${article} à ${recommendedCode}`;
  }
  if (currentCode && recommendedCode) {
    return `Déplacer ${article} de ${currentCode} vers ${recommendedCode}`;
  }
  return `Revoir l'emplacement de ${article}`;
}

export function whyRecommendation({
  abcClass,
  rotationLabel,
  currentDistance,
  recommendedDistance,
  affinityNeighbors,
  isOptimal,
}) {
  if (isOptimal) {
    return "Cet article est déjà à un emplacement adapté à sa rotation — aucun déplacement n'est nécessaire.";
  }

  const from = Number(currentDistance);
  const to = Number(recommendedDistance);
  const closer = Number.isFinite(from) && Number.isFinite(to) && to < from;
  const farther = Number.isFinite(from) && Number.isFinite(to) && to > from;
  const high = abcClass === "A" || rotationLabel === "Fort";
  const mid = abcClass === "B" || rotationLabel === "Moyen";
  const names = (affinityNeighbors || [])
    .slice(0, 2)
    .map((n) => n.code || n.libelle)
    .filter(Boolean);
  const together = names.length
    ? ` Il est souvent commandé avec ${names.join(" et ")}.`
    : "";

  if (high && closer) {
    return `Cet article est commandé très souvent et son emplacement actuel est trop loin du quai de préparation.${together}`;
  }
  if (high && farther) {
    return `Malgré une forte rotation, un emplacement plus adapté (place disponible, produits souvent commandés ensemble) est disponible.${together}`;
  }
  if (high) {
    return `Cet article tourne beaucoup : il gagne à rester dans la zone de picking, près du quai.${together}`;
  }
  if (mid && closer) {
    return `Cet article a une rotation régulière et serait plus rapide à préparer plus près du quai.${together}`;
  }
  if (farther) {
    return `Cet article tourne peu : le ranger plus loin libère de la place près du quai pour les produits à forte rotation.${together}`;
  }
  return `Un emplacement plus cohérent avec la rotation et les commandes habituelles est disponible.${together}`;
}

/**
 * Priorité magasinier (pas un cluster ML) :
 * A près du quai, gain de temps net, ou 1er choix d'un article.
 */
export function isPriorityMove(row) {
  if (row?.isOptimal) return false;
  if (row?.rank === 0) return true;
  const abc = row?.abcClass;
  const gain = Number(row?.estimatedPickGainSec) || 0;
  const from = Number(row?.currentEmplacementDistance);
  const to = Number(row?.recommendedDistance);
  const towardsDock = Number.isFinite(from) && Number.isFinite(to) && to < from;
  if (abc === "A" && (towardsDock || gain >= 4)) return true;
  if (gain >= 12) return true;
  if (towardsDock && abc === "B" && gain >= 8) return true;
  return false;
}

export function splitPriority(items = []) {
  const priority = [];
  const optional = [];
  for (const row of items) {
    if (isPriorityMove(row)) priority.push(row);
    else optional.push(row);
  }
  return { priority, optional };
}

export function suggestionToMoveRows(suggestion) {
  if (!suggestion) return [];
  return (suggestion.suggestions || []).map((slot, i) => ({
    emplacementId: slot.emplacementId,
    articleCode: suggestion.articleCode,
    articleLibelle: suggestion.articleLibelle,
    currentEmplacementCode: suggestion.currentEmplacementCode,
    currentEmplacementDistance: suggestion.currentEmplacementDistance,
    recommendedEmplacementCode: slot.code,
    recommendedDistance: slot.distanceQuai,
    estimatedPickGainSec:
      slot.estimatedPickGainSec ?? (i === 0 ? suggestion.estimatedPickGainSec : 0),
    confidence: suggestion.confidence,
    abcClass: suggestion.abcClass,
    rotationLabel: suggestion.rotationLabel,
    affinityNeighbors: i === 0 ? suggestion.affinityNeighbors : [],
    isOptimal: Boolean(
      suggestion.isOptimal && slot.emplacementId === suggestion.currentEmplacementId
    ),
    rank: i,
  }));
}

export function auditRowToMove(row) {
  return {
    ...row,
    recommendedEmplacementCode: row.recommendedEmplacementCode,
    recommendedDistance: row.recommendedDistance,
    rank: undefined,
    isOptimal: false,
  };
}
