require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const prisma = require("../src/config/database");

async function main() {
  const total = await prisma.article.count();
  const bySociete = await prisma.article.groupBy({
    by: ["societeId"],
    _count: { id: true },
  });
  const sample = await prisma.article.findMany({
    take: 10,
    select: { id: true, code: true, libelle: true, societeId: true },
    orderBy: { id: "desc" },
  });
  console.log("Total articles:", total);
  console.log("By societe:", bySociete);
  console.log("Sample:", sample);
}

main()
  .finally(() => prisma.$disconnect());
