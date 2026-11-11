/**
 * Test manuel import Excel (.xlsx) — aller-retour modèle → import.
 * Usage : node scripts/test-import-xlsx.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const prisma = require("../src/config/database");
const { importArticlesFromFile, importArticlesFromCsv } = require("../src/modules/articles/articles.service");

async function buildTestWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Modèle import");
  for (const row of rows) {
    ws.addRow(row);
  }
  return wb.xlsx.writeBuffer();
}

async function main() {
  if (importArticlesFromCsv !== importArticlesFromFile) {
    throw new Error("Alias importArticlesFromCsv doit pointer vers importArticlesFromFile");
  }

  const societe = await prisma.societe.findFirst({ select: { id: true, code: true, nom: true } });
  if (!societe) throw new Error("Aucune société en base");

  const fournisseur = await prisma.fournisseur.findFirst({
    where: { societeId: societe.id },
    select: { code: true, nom: true },
  });
  const emplacement = await prisma.emplacement.findFirst({
    where: { depot: { societeId: societe.id } },
    select: { code: true, libelle: true },
  });
  const marque = await prisma.marque.findFirst({
    where: { societeId: societe.id },
    select: { code: true, nom: true },
  });

  const fournisseurLabel = fournisseur?.nom || fournisseur?.code || "FOURNISSEUR_INCONNU";
  const emplacementLabel = emplacement?.libelle || emplacement?.code || "EMPL_INCONNU";
  const marqueLabel = marque?.nom || marque?.code || "MARQUE_INCONNUE";

  const stamp = Date.now();
  const headers = [
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
    "emplacement",
  ];
  const dataRows = [
    [`XLSX-${stamp}-01`, "Produit Excel test 1", "Famille Xlsx Test", "SF Xlsx A", marqueLabel, fournisseurLabel, 10, 15, 2, 5, emplacementLabel],
    [`XLSX-${stamp}-02`, "Produit Excel test 2", "Famille Xlsx Test", "SF Xlsx B", marqueLabel, fournisseurLabel, 20, 28, 3, 8, emplacementLabel],
    ["", "", "", "", "", "", "", "", "", "", ""],
    [`XLSX-${stamp}-03`, "Produit Excel test 3", "Famille Xlsx Test", "SF Xlsx C", "", fournisseurLabel, 5, 9, 1, 12, emplacementLabel],
  ];

  const buffer = await buildTestWorkbook([headers, ...dataRows]);
  const tmpPath = path.join(__dirname, `test-import-${stamp}.xlsx`);
  fs.writeFileSync(tmpPath, buffer);

  console.log("Société:", societe);
  console.log("Fichier Excel généré (ExcelJS, format binaire réel):", tmpPath);
  console.log("Signature PK:", buffer[0] === 0x50 && buffer[1] === 0x4b ? "OK" : "MANQUANTE");

  const result = await importArticlesFromFile(buffer, societe.id);

  const codes = dataRows.map((r) => r[0]).filter(Boolean);
  const created = await prisma.article.findMany({
    where: { societeId: societe.id, code: { in: codes } },
    select: { code: true, libelle: true },
    orderBy: { code: "asc" },
  });

  console.log("\n=== Résultat import Excel ===");
  console.log(JSON.stringify(result, null, 2));
  console.log("\n=== Articles créés en base ===");
  console.log(created);

  const expectedSuccess = marque ? 3 : 2;
  if (result.success < expectedSuccess) {
    console.error(`\nÉCHEC: seulement ${result.success} succès (attendu >= ${expectedSuccess})`);
    process.exitCode = 1;
  } else {
    console.log(`\nOK: ${result.success} lignes importées via .xlsx, ${result.failed} rejetée(s).`);
  }

  fs.unlinkSync(tmpPath);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
