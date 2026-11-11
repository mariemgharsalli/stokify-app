/**
 * Test cycle export → import : vérifie que les en-têtes canoniques et les valeurs
 * (prix_catalogue, fournisseur, marque, stock_min) sont reconnus sans perte.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const ExcelJS = require("exceljs");
const prisma = require("../src/config/database");
const articlesService = require("../src/modules/articles/articles.service");

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
  "emplacement",
];

function mapArticleToExportRow(a) {
  const stock = Array.isArray(a.stocks)
    ? a.stocks.reduce((sum, s) => sum + (Number(s.quantite) || 0), 0)
    : 0;
  const emp = a.stocks?.[0]?.emplacement;
  return [
    a.code,
    a.libelle,
    a.famille?.nom ?? "",
    a.sousFamille?.nom ?? "",
    a.marque?.nom ?? "",
    a.fournisseur?.nom ?? a.fournisseur?.code ?? "",
    Number(a.prixAchat) || 0,
    Number(a.prixVente) || 0,
    a.stockMin != null ? Number(a.stockMin) : "",
    stock,
    emp?.libelle ?? emp?.code ?? "",
  ];
}

async function buildWorkbookBuffer(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Articles");
  ws.addRow(HEADERS);
  for (const row of rows) ws.addRow(row);
  return wb.xlsx.writeBuffer();
}

async function main() {
  const societeId = 1;
  const stamp = Date.now();

  const sourceArticles = await prisma.article.findMany({
    where: {
      societeId,
      marqueId: { not: null },
      stockMin: { not: null },
      fournisseurId: { not: null },
    },
    include: {
      famille: true,
      sousFamille: true,
      marque: true,
      fournisseur: true,
      stocks: { include: { emplacement: true } },
    },
    take: 5,
    orderBy: { id: "desc" },
  });

  if (sourceArticles.length < 1) {
    throw new Error("Pas assez d'articles avec marque/stockMin/fournisseur pour le test");
  }

  const exportRows = sourceArticles.map((a, i) => {
    const row = mapArticleToExportRow(a);
    row[0] = `RT-${stamp}-${i + 1}`;
    return row;
  });

  const buffer = await buildWorkbookBuffer(exportRows);
  const result = await articlesService.importArticlesFromFile(buffer, societeId);

  const created = await prisma.article.findMany({
    where: { societeId, code: { in: exportRows.map((r) => r[0]) } },
    include: { marque: true, fournisseur: true },
    orderBy: { code: "asc" },
  });

  console.log("Import result:", result);
  console.log("Articles créés:", created.length, "/", exportRows.length);

  const failures = [];
  for (let i = 0; i < sourceArticles.length; i += 1) {
    const src = sourceArticles[i];
    const code = exportRows[i][0];
    const createdRow = created.find((c) => c.code === code);
    if (!createdRow) {
      failures.push(`${code}: non créé`);
      continue;
    }
    if (Number(createdRow.prixVente) !== Number(src.prixVente)) {
      failures.push(`${code}: prix_catalogue perdu (${createdRow.prixVente} vs ${src.prixVente})`);
    }
    if (Number(createdRow.prixAchat) !== Number(src.prixAchat)) {
      failures.push(`${code}: prix_unitaire perdu`);
    }
    if (Number(createdRow.stockMin) !== Number(src.stockMin)) {
      failures.push(`${code}: stock_min perdu (${createdRow.stockMin} vs ${src.stockMin})`);
    }
    if (createdRow.marqueId !== src.marqueId) {
      failures.push(`${code}: marque perdue`);
    }
    if (createdRow.fournisseurId !== src.fournisseurId) {
      failures.push(`${code}: fournisseur perdu`);
    }
  }

  if (result.success !== exportRows.length) {
    console.error("Échecs import:", result.errors);
    process.exitCode = 1;
  }
  if (failures.length) {
    console.error("Pertes de données détectées:", failures);
    process.exitCode = 1;
  } else {
    console.log(`OK: cycle export→import sans perte sur ${created.length} article(s) (codes RT-${stamp}-*)`);
  }

  // Réimport des mêmes codes → doit échouer (doublons, pas mise à jour)
  const dupResult = await articlesService.importArticlesFromFile(buffer, societeId);
  const dupErrors = dupResult.errors.filter((e) => /déjà existant/i.test(e.message));
  console.log(
    "\nRéimport sans modification:",
    dupResult.success,
    "succès,",
    dupErrors.length,
    "erreur(s) code déjà existant (comportement attendu: création uniquement, pas de mise à jour)"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
