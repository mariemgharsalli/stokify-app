/**
 * Backfill categorie sur CoutEntry existantes (categorie = null).
 * Usage :
 *   node scripts/backfill-categorie-cout-entries.js          # dry-run (liste les correspondances)
 *   node scripts/backfill-categorie-cout-entries.js --apply  # applique en base
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/** Même mapping que SUGGESTED_COST_NAMES dans front/src/pages/stock/CoutStockage.jsx */
const SUGGESTED_COST_NAMES = {
  STOCKAGE: ["Loyer", "Assurance", "Maintenance"],
  LOGISTIQUE: ["Transport", "Internet", "Sécurité"],
  MANUTENTION: ["Personnel", "Manutention", "Nettoyage"],
  AUTRE: ["Eau", "Électricité", "Énergie"],
};

function normalizeNom(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function resolveCategory(nom) {
  const norm = normalizeNom(nom);
  if (!norm) return null;
  for (const [categorie, names] of Object.entries(SUGGESTED_COST_NAMES)) {
    for (const name of names) {
      if (normalizeNom(name) === norm) return categorie;
    }
  }
  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const entries = await prisma.coutEntry.findMany({
    where: { categorie: null },
    select: { id: true, nom: true, depotId: true, periode: true, societeId: true },
    orderBy: [{ societeId: "asc" }, { periode: "asc" }, { id: "asc" }],
  });

  const proposed = [];
  const unmatched = [];

  for (const entry of entries) {
    const categorie = resolveCategory(entry.nom);
    if (categorie) {
      proposed.push({ ...entry, categorie });
    } else {
      unmatched.push(entry);
    }
  }

  console.log("=== Correspondances proposées (dry-run) ===\n");
  if (proposed.length === 0) {
    console.log("(aucune correspondance trouvée)");
  } else {
    for (const row of proposed) {
      console.log(
        `#${row.id} | société ${row.societeId} | dépôt ${row.depotId} | ${row.periode} | "${row.nom}" → ${row.categorie}`
      );
    }
  }

  console.log(`\nRésumé : ${proposed.length} correspondance(s) / ${entries.length} entrée(s) sans catégorie`);
  if (unmatched.length > 0) {
    console.log(`\nSans correspondance (${unmatched.length}) — restent en AUTRE :`);
    for (const row of unmatched) {
      console.log(`  #${row.id} "${row.nom}" (${row.periode})`);
    }
  }

  if (!apply) {
    console.log("\nMode dry-run : aucune modification en base.");
    console.log("Relancez avec --apply pour appliquer les mises à jour.");
    return;
  }

  if (proposed.length === 0) {
    console.log("\nRien à appliquer.");
    return;
  }

  let updated = 0;
  for (const row of proposed) {
    await prisma.coutEntry.update({
      where: { id: row.id },
      data: { categorie: row.categorie },
    });
    updated += 1;
  }
  console.log(`\n✓ ${updated} entrée(s) mise(s) à jour.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
