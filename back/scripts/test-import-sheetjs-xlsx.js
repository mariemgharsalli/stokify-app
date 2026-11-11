/**
 * Test import d'un .xlsx généré par SheetJS (même lib que le frontend).
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const path = require("path");
const fs = require("fs");
const XLSX = require("../../front/node_modules/xlsx");
const prisma = require("../src/config/database");
const { importArticlesFromFile } = require("../src/modules/articles/articles.service");

async function main() {
  const societe = await prisma.societe.findFirst();
  const fournisseur = await prisma.fournisseur.findFirst({ where: { societeId: societe.id } });
  const emplacement = await prisma.emplacement.findFirst({ where: { depot: { societeId: societe.id } } });
  const marque = await prisma.marque.findFirst({ where: { societeId: societe.id } });
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
  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    [
      `SJS-${stamp}`,
      "SheetJS test",
      "Famille SJS",
      "SF SJS",
      marque.nom,
      fournisseur.nom,
      11,
      16,
      2,
      7,
      emplacement.libelle || emplacement.code,
    ],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modèle import");
  const tmp = path.join(__dirname, `sheetjs-test-${stamp}.xlsx`);
  XLSX.writeFile(wb, tmp);
  const buffer = fs.readFileSync(tmp);
  console.log("PK signature:", buffer[0] === 0x50 && buffer[1] === 0x4b);
  const result = await importArticlesFromFile(buffer, societe.id);
  console.log("Import SheetJS xlsx:", result);
  fs.unlinkSync(tmp);
  if (result.success !== 1) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
