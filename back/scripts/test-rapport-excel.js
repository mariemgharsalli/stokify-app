require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { generateRapportExcel } = require("../src/utils/excelHelper");
const accountingService = require("../src/modules/accounting/accounting.service");
const prisma = require("../src/config/database");

const EXPECTED_SHEETS = [
  "Synthèse",
  "Évolution 6 mois",
  "Top clients",
  "Top fournisseurs",
  "Impayés clients",
  "Impayés fournisseurs",
];

async function main() {
  const user = await prisma.utilisateur.findFirst({ where: { email: "superadmin@stokify.com" } });
  if (!user) throw new Error("Utilisateur test introuvable");

  const dashboard = await accountingService.getSyntheseComptable(user, {
    periode: "custom",
    dateDebut: "2020-01-01",
    dateFin: "2030-12-31",
  });
  const societe = await prisma.societe.findUnique({ where: { id: Number(user.societeId) } });

  console.log("Dashboard sample:");
  console.log("  ventesMois:", dashboard.ventesMois);
  console.log("  topClients[0]:", dashboard.topClients[0] || "(vide)");
  console.log("  topFournisseurs[0]:", dashboard.topFournisseurs[0] || "(vide)");
  console.log("  chartData rows:", dashboard.chartData?.length);
  console.log("  impayesVentes:", dashboard.impayesVentes?.length);
  console.log("  impayesAchats:", dashboard.impayesAchats?.length);

  const buf = await generateRapportExcel({ societe, dashboard });
  const out = path.join(__dirname, "_export_test_out/rapport-comptabilite-test.xlsx");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(buf));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(out);
  const names = wb.worksheets.map((w) => w.name);
  console.log("\nFeuilles:", names.join(" | "));

  for (const expected of EXPECTED_SHEETS) {
    if (!names.includes(expected)) throw new Error(`Feuille manquante: ${expected}`);
  }

  const synth = wb.getWorksheet("Synthèse");
  const hdr = synth.__headerRowNum || 4;
  console.log("\nSynthèse row1:", synth.getRow(hdr + 1).values.slice(1, 3));
  console.log("Top clients row1:", wb.getWorksheet("Top clients").getRow(hdr + 1).values.slice(1, 3));
  console.log("Évolution row1:", wb.getWorksheet("Évolution 6 mois").getRow(hdr + 1).values.slice(1, 5));

  if (dashboard.topClients.length) {
    const caCell = wb.getWorksheet("Top clients").getRow(hdr + 1).getCell(2).value;
    if (caCell == null || caCell === "") throw new Error("Top clients CA vide");
  }

  console.log("\nOK — 6 feuilles, fichier:", out);
}

main()
  .catch((e) => {
    console.error("FAIL", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
