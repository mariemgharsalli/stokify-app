/**
 * Colonnes canoniques import/export articles.
 * Garder en synchronisation avec normalizeImportRow (back/src/modules/articles/articles.service.js).
 *
 * fournisseur : on exporte le nom (ou le code) du fournisseur principal, pas le libellé
 * d'affichage « code — nom » utilisé dans le tableau (non reconnu tel quel à l'import).
 * depot : optionnel — si vide et un seul dépôt existe pour la société, utilisé par défaut à l'import.
 */

export const ARTICLE_IMPORT_EXPORT_COLUMNS = [
  { key: "code", header: "code" },
  { key: "designation", header: "designation" },
  { key: "famille", header: "famille" },
  { key: "sousFamille", header: "sous_famille" },
  { key: "marque", header: "marque" },
  { key: "fournisseur", header: "fournisseur" },
  { key: "prixUnitaire", header: "prix_unitaire" },
  { key: "prixCatalogue", header: "prix_catalogue" },
  { key: "stockMin", header: "stock_min" },
  { key: "stock", header: "stock" },
  { key: "depot", header: "depot" },
  { key: "emplacement", header: "emplacement" },
];

export const ARTICLE_IMPORT_TEMPLATE_EXAMPLE_ROWS = [
  [
    "ART-0001",
    "Exemple produit A",
    "Famille A",
    "Sous-famille A",
    "Marque A",
    "Fournisseur A",
    12.5,
    18.9,
    5,
    25,
    "",
    "Rayon A1",
  ],
  [
    "ART-0002",
    "Exemple produit B",
    "Famille B",
    "Sous-famille B",
    "Marque B",
    "Fournisseur B",
    8.2,
    14.0,
    10,
    40,
    "",
    "Rayon B2",
  ],
];

export function getArticleImportExportHeaders() {
  return ARTICLE_IMPORT_EXPORT_COLUMNS.map((c) => c.header);
}

function getFournisseurImportValue(item) {
  const linked = item.fournisseur;
  if (linked && typeof linked === "object") {
    const nom = linked.nom ?? linked.name;
    if (nom) return String(nom).trim();
    if (linked.code) return String(linked.code).trim();
  }
  if (typeof linked === "string" && linked.trim()) return linked.trim();

  const display = item.fournisseurs || item.fournisseurNom || "";
  if (String(display).includes(" — ")) {
    const parts = String(display).split(" — ");
    return (parts[parts.length - 1] || parts[0] || "").trim();
  }
  return String(display).trim();
}

function getDepotImportValue(item) {
  const firstStock = Array.isArray(item.stocks) && item.stocks.length > 0 ? item.stocks[0] : null;
  const depot = firstStock?.depot ?? item.depot;
  if (depot && typeof depot === "object") {
    return String(depot.libelle ?? depot.nom ?? depot.code ?? "").trim();
  }
  return "";
}

function getEmplacementImportValue(item) {
  const firstStock = Array.isArray(item.stocks) && item.stocks.length > 0 ? item.stocks[0] : null;
  const emp = firstStock?.emplacement ?? item.emplacement;
  if (emp && typeof emp === "object") {
    return String(emp.libelle ?? emp.nom ?? emp.code ?? "").trim();
  }
  return String(item.emplacementNom ?? item.emplacement ?? "").trim();
}

function getColumnValue(item, key) {
  switch (key) {
    case "code":
      return item.code ?? "";
    case "designation":
      return item.designation ?? item.libelle ?? "";
    case "famille":
      return item.familleNom ?? item.famille?.nom ?? "";
    case "sousFamille":
      return item.sousFamilleNom ?? item.sousFamille?.nom ?? "";
    case "marque":
      return item.marqueNom ?? item.marque?.nom ?? "";
    case "fournisseur":
      return getFournisseurImportValue(item);
    case "prixUnitaire":
      return item.prixUnitaire ?? item.prixAchat ?? "";
    case "prixCatalogue":
      return item.prixCatalogue ?? item.prixVente ?? "";
    case "stockMin":
      return item.stockMin != null && item.stockMin !== "" ? item.stockMin : "";
    case "stock":
      return item.stock ?? item.totalStock ?? "";
    case "depot":
      return getDepotImportValue(item);
    case "emplacement":
      return getEmplacementImportValue(item);
    default:
      return "";
  }
}

export function mapArticleToImportExportRow(item) {
  return ARTICLE_IMPORT_EXPORT_COLUMNS.map(({ key }) => getColumnValue(item, key));
}
