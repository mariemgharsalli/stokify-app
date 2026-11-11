/**
 * Aide pédagogique Stokify / WMS — faits métier, pas des chiffres société.
 */
const TOPICS = {
  fifo: {
    titre: "FIFO (First In, First Out)",
    texte:
      "FIFO : le premier article entré en stock est le premier à sortir. Utile pour une rotation régulière. Dans Stokify, les sorties sur lots peuvent suivre cette stratégie. Module concerné : Lots / Stock / Mouvements.",
  },
  fefo: {
    titre: "FEFO (First Expired, First Out)",
    texte:
      "FEFO : on sort d'abord le lot dont la DLC/DLUO est la plus proche. C'est la règle à privilégier pour les produits périssables. Dans Stokify : Lots (expirant bientôt) puis sortie FEFO. Le score Péremption (Module IA) estime si le restant sera encore là à la DLC — il complète FEFO, il ne le remplace pas. Évitez de détruire d'office : promo interne ou sortie prioritaire.",
  },
  inventaire: {
    titre: "Inventaire",
    texte:
      "Un inventaire compare le stock théorique (système) et le stock réel (comptage). Dans Stokify : module Inventaires → créer sur un dépôt → saisir les quantités réelles → valider pour générer les écarts et ajuster le stock. Un inventaire « en cours » bloque souvent un second inventaire sur le même dépôt.",
  },
  reception: {
    titre: "Réception d'achat",
    texte:
      "Parcours : Achats → commande fournisseur confirmée → réception (totale ou partielle) → le stock augmente dans le dépôt indiqué, avec lots/n° de série si l'article est tracé. Vérifiez emplacement et DLC à la réception.",
  },
  rupture: {
    titre: "Rupture et seuil",
    texte:
      "Rupture : quantité ≤ 0. Critique : quantité > 0 mais ≤ seuil d'alerte (ou stock min). Le seuil est défini sur l'article. STOKI s'appuie sur les alertes stock live, pas sur une estimation.",
  },
  emplacement: {
    titre: "Dépôt et emplacement",
    texte:
      "Le dépôt est l'entrepôt. L'emplacement est la localisation interne (allée, rack, quai). Un article peut exister dans plusieurs dépôts. Pour localiser une référence : code article → lignes de stock (dépôt / emplacement / qty).",
  },
  mouvement: {
    titre: "Mouvements",
    texte:
      "Chaque entrée, sortie ou transfert crée un mouvement horodaté. Le module Mouvements permet de filtrer par dépôt, article, type et période. Le dépôt le plus « chaud » se mesure au nombre de mouvements, pas au stock restant.",
  },
  prevision: {
    titre: "Prévisions",
    texte:
      "Les prévisions Stokify s'appuient sur l'historique des ventes (et un micro-service IA s'il est en ligne, sinon un fallback local). Elles indiquent une tendance, pas une certitude. STOKI doit les présenter comme une interprétation IA, distincte du stock live.",
  },
  anomalie: {
    titre: "Anomalies",
    texte:
      "Le module Stock / Anomalies détecte des mouvements atypiques (pic, chute, écart vs moyenne). Statuts : non résolu, confirmé, résolu. Ce n'est pas la même chose qu'une rupture (la rupture est un niveau de stock).",
  },
  commande: {
    titre: "Ventes, achats, commandes clients",
    texte:
      "Ventes = pièces internes (devis → confirmé → livré). Achats = commandes fournisseurs + réception. Commandes clients B2B = espace client (panier → commande). STELLA aide le client ; STOKI aide l'équipe magasin.",
  },
  navigation: {
    titre: "Se repérer dans Stokify",
    texte:
      "Modules utiles : Stock (alertes, prévisions, anomalies), Articles, Dépôts / Emplacements, Lots, Mouvements, Inventaires, Ventes, Achats, Clients, Fournisseurs, Rapports (rotation, dead stock), Valorisation, Hub IA.",
  },
};

const KEYWORD_TO_TOPIC = [
  { re: /\bfifo\b|premier entre|premier sort/i, id: "fifo" },
  { re: /\bfefo\b|premier expir|dlc|dluo|pérem/i, id: "fefo" },
  { re: /inventaire|comptage|écart de stock/i, id: "inventaire" },
  { re: /réception|receptionner|réceptionner|marchandise/i, id: "reception" },
  { re: /rupture|seuil|critique|stock min/i, id: "rupture" },
  { re: /emplacement|dépôt|depot|quai|rack/i, id: "emplacement" },
  { re: /mouvement|transfert|entrée|sortie/i, id: "mouvement" },
  { re: /prévision|prevision|forecast/i, id: "prevision" },
  { re: /anomal/i, id: "anomalie" },
  { re: /commande|vente|achat|panier|fournisseur|client/i, id: "commande" },
];

function lookupHelp(query) {
  const q = String(query || "").trim();
  const hits = [];
  for (const { re, id } of KEYWORD_TO_TOPIC) {
    if (re.test(q) && !hits.includes(id)) hits.push(id);
  }
  if (!hits.length) hits.push("navigation");
  return hits.slice(0, 3).map((id) => TOPICS[id]);
}

function allTopicsSummary() {
  return Object.values(TOPICS).map((t) => `- **${t.titre}** : ${t.texte}`);
}

module.exports = { TOPICS, lookupHelp, allTopicsSummary };
