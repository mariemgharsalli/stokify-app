/**
 * Simule la logique fetchAllArticlesFromApi + filtres pour vérifier le volume d'export.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const articlesService = require("../src/modules/articles/articles.service");
const prisma = require("../src/config/database");

async function main() {
  const societe = await prisma.societe.findFirst({ where: { id: 1 } });
  if (!societe) throw new Error("Societe 1 introuvable");

  const user = { societeId: societe.id, role: "ADMIN" };
  let page = 1;
  let all = [];
  let pages = 1;
  while (page <= pages) {
    const res = await articlesService.listArticles({ user, page, limit: 100 });
    all = all.concat(res.items);
    pages = res.pages;
    page += 1;
  }

  console.log("Articles societe 1 via pagination API:", all.length);
  console.log("Total API (page 1):", (await articlesService.listArticles({ user, page: 1, limit: 100 })).total);
}

main()
  .finally(() => prisma.$disconnect());
