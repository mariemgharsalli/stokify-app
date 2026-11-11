/**
 * Supprime les lignes métier dont societeId est 0, NULL ou ne référence aucune Société
 * (fuite cross-société / effets de Number(null) côté API).
 *
 * Depuis le dossier back/ :
 *   node src/scripts/cleanNullSociete.js
 *
 * Ne touche pas à Utilisateur (comptes).
 */
const prisma = require("../config/database");

/** Tables avec colonne societeId (schéma Prisma / MySQL). */
const TABLES = [
  "CoutStockage",
  "NumeroSerie",
  "Achat",
  "Vente",
  "Article",
  "Fournisseur",
  "Client",
  "Depot",
  "SousFamille",
  "Famille",
  "Marque",
  "Groupe",
];

async function clean() {
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0");
  try {
    for (const table of TABLES) {
      const sql = `
        DELETE FROM \`${table}\`
        WHERE \`societeId\` IS NULL
           OR \`societeId\` = 0
           OR \`societeId\` NOT IN (SELECT \`id\` FROM \`Societe\`)
      `;
      const n = await prisma.$executeRawUnsafe(sql);
      const count = typeof n === "bigint" ? Number(n) : Number(n) || 0;
      console.log(`${table}: deleted ${count} row(s)`);
    }
  } finally {
    await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1");
    await prisma.$disconnect();
  }
}

clean().catch((e) => {
  console.error(e);
  process.exit(1);
});
