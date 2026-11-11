/**
 * Backfill Article.modeTracage / tracageAuto from legacy modeGestion.
 * Safe to re-run. Does not drop modeGestion.
 *
 *   node scripts/migrate-mode-tracage.js
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const lotModes = ["LOTS", "FIFO", "LOT", "FEFO"];
  const result = await prisma.article.updateMany({
    where: {
      OR: lotModes.map((m) => ({ modeGestion: { equals: m } })),
    },
    data: { modeTracage: "LOT", tracageAuto: false },
  });
  const rest = await prisma.article.updateMany({
    where: {
      AND: [
        { modeTracage: { not: "LOT" } },
        { modeTracage: { not: "SERIE" } },
      ],
    },
    data: { modeTracage: "AUCUN", tracageAuto: false },
  });
  console.log(`Lots migrés : ${result.count}. Autres articles alignés AUCUN : ${rest.count}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
