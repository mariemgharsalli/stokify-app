/**
 * Test import du fichier modèle (Fournisseur A/B, Marque A/B, emplacements auto-créés).
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const ExcelJS = require("exceljs");
const prisma = require("../src/config/database");
const { importArticlesFromFile } = require("../src/modules/articles/articles.service");

const HEADERS = [
  "code",
  "designation",
  "famille",
  "sous_famille",
  "marque",
  "fournisseur",
  "prix_unitaire",
  "prix_catalogue",
  "stock_min",
  "stock",
  "depot",
  "emplacement",
];

async function buildTemplateWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Modèle import");
  ws.addRow(HEADERS);
  for (const row of rows) ws.addRow(row);
  return wb.xlsx.writeBuffer();
}

async function main() {
  const societe = await prisma.societe.findFirst({ select: { id: true, nom: true } });
  if (!societe) throw new Error("Aucune société en base");

  const depots = await prisma.depot.findMany({ where: { societeId: societe.id } });
  if (!depots.length) throw new Error("Aucun dépôt — créez-en un avant le test");
  const depotLabel = depots[0].libelle || depots[0].code;

  const stamp = Date.now();
  const rows = [
    [
      `TPL-${stamp}-1`,
      "Exemple produit A",
      "Famille A",
      "Sous-famille A",
      "Marque A",
      "Fournisseur A",
      12.5,
      18.9,
      5,
      25,
      depots.length === 1 ? "" : depotLabel,
      "Rayon A1",
    ],
    [
      `TPL-${stamp}-2`,
      "Exemple produit B",
      "Famille B",
      "Sous-famille B",
      "Marque B",
      "Fournisseur B",
      8.2,
      14.0,
      10,
      40,
      depots.length === 1 ? "" : depotLabel,
      "Rayon B2",
    ],
  ];

  const buffer = await buildTemplateWorkbook(rows);
  const result = await importArticlesFromFile(buffer, societe.id);

  console.log("Société:", societe, `(${depots.length} dépôt(s) utilisé(s) pour le test)`);
  console.log("Import modèle:", result);

  if (result.success !== rows.length || result.failed > 0) {
    console.error("ÉCHEC:", result.errors);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: import modèle ${result.success}/${rows.length} succès (100%)`);
  console.log("Entités créées:", result.entitesCreees);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
