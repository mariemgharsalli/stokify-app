require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const XLSX = require("../../front/node_modules/xlsx");
const articlesService = require("../src/modules/articles/articles.service");
const prisma = require("../src/config/database");

async function main() {
  const user = { societeId: 1, role: "ADMIN" };
  let page = 1;
  let all = [];
  let pages = 1;
  while (page <= pages) {
    const res = await articlesService.listArticles({ user, page, limit: 100 });
    all = all.concat(res.items);
    pages = res.pages;
    page += 1;
  }

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
  const rows = all.map((a) => [
    a.code,
    a.libelle,
    a.famille?.nom || "",
    a.sousFamille?.nom || "",
    a.marque?.nom || "",
    a.fournisseur?.nom || "",
    a.prixAchat || 0,
    a.prixVente || 0,
    a.stockMin ?? "",
    a.totalStock || 0,
    "",
  ]);

  console.log("rowsToExport.length (simulated exportArticles):", all.length);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Articles");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const read = XLSX.read(buf, { type: "buffer" });
  const data = XLSX.utils.sheet_to_json(read.Sheets.Articles);

  console.log("Rows in generated xlsx:", data.length);
  console.log(all.length >= 12 && data.length === all.length ? "OK: export 12+ lignes confirmé" : "ECHEC");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
