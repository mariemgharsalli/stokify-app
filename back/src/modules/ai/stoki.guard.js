/**
 * Garde de domaine STOKI — Stokify / WMS uniquement.
 * Ce n'est pas un routeur d'intent métier (le LLM + tools s'en chargent).
 */

const PEDAGOGICAL_RE =
  /\b(fifo|fefo|wms|dlc|dluo|inventaire|réception|reception|réceptionner|receptionner|marchandise|emplacement|dépôt|depot|lot|seuil|rupture|transfert|valorisation|rotation|anomalie|prévision|prevision|forecast|stock|article|fournisseur|client|commande|vente|achat|mouvement|magasin|entrep[oô]t|quai|réappro|reappro|picking|slotting)\b/i;

const IN_DOMAIN_RE =
  /\b(stokify|stoki|stock|stocks|stock-?out|out of stock|article|articles|produit|produits|product|products|item|items|sku|r[ée]f[eé]rence|famille|sous-famille|d[ée]p[oô]t|depots|emplacement|lot|lots|fifo|fefo|dlc|dluo|vente|ventes|vendu|vendus|sell|selling|achat|achats|commande|commandes|mouvement|mouvements|inventaire|inventaires|client|clients|fournisseur|fournisseurs|pr[ée]vision|forecast|anomalie|anomalies|rotation|dead.?stock|valorisation|cmp|alerte|rupture|ruptura|seuil|r[ée]appro|r[ée]ception|r[ée]ceptionner|marchandise|transfert|quai|palette|magasin|entrep[oô]t|wms|hub ia|module|manque|nulle|indisponible|[ée]puis[ée]?|critique|expir)\b/i;

const TEACHING_RE =
  /c['’]?est quoi|cest quoi|comment (fonctionne|faire|r[ée]ceptionner|utiliser|naviguer)|d[ée]finition|expliquer (fifo|fefo|l['’]?inventaire|un inventaire)/i;

const OUT_DOMAIN_RE =
  /\b(m[ée]t[ée]o|weather|football|soccer|ligue 1|champions league|actualit[ée]|news|c[ée]l[eé]brit[ée]|recette de cuisine|horoscope|crypto bitcoin|jeu vid[ée]o|netflix|spotify|blague coquine)\b/i;

const OUT_OF_DOMAIN_REPLY = `Je suis **STOKI**, l'assistant intelligent de Stokify. Je peux vous aider avec votre stock, vos ventes, vos achats, vos dépôts, vos analyses, vos prévisions et les fonctionnalités de votre plateforme.

Reformulez autour du magasin — par exemple une rupture, un lot, un dépôt, une prévision ou « c'est quoi FIFO ? ».`;

function fold(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function classifyDomain(message) {
  const raw = String(message || "").trim();
  if (!raw) {
    return { inDomain: true, pedagogical: false, reason: "empty" };
  }
  if (OUT_DOMAIN_RE.test(raw) && !IN_DOMAIN_RE.test(raw)) {
    return { inDomain: false, pedagogical: false, reason: "explicit_off_topic" };
  }
  if (TEACHING_RE.test(raw) && (PEDAGOGICAL_RE.test(raw) || IN_DOMAIN_RE.test(raw))) {
    return { inDomain: true, pedagogical: true, reason: "wms_pedagogy" };
  }
  if (IN_DOMAIN_RE.test(raw) || PEDAGOGICAL_RE.test(raw)) {
    return { inDomain: true, pedagogical: false, reason: "stokify_lexicon" };
  }

  const folded = fold(raw);
  const off = /\b(meteo|football|actualite|horoscope|bitcoin|netflix|blague|président|president|capitale de)\b/.test(
    folded
  );
  if (off) {
    return { inDomain: false, pedagogical: false, reason: "folded_off_topic" };
  }

  // Court et ambigu (salut, aide) → on reste dans le domaine.
  if (raw.split(/\s+/).length <= 4) {
    return { inDomain: true, pedagogical: false, reason: "short_ambiguous" };
  }

  return { inDomain: false, pedagogical: false, reason: "no_stokify_signal" };
}

module.exports = { classifyDomain, OUT_OF_DOMAIN_REPLY };
