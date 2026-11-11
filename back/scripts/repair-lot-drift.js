/**
 * Correction ponctuelle : aligner Σ(Lot.quantiteRestante) sur Stock.quantite
 * après l'ancien bug (ventes confirmées sans décrément des lots).
 *
 * Usage (depuis back/) :
 *   node scripts/repair-lot-drift.js
 *   node scripts/repair-lot-drift.js 41 8
 *
 * À exécuter une seule fois, puis archiver ou supprimer ce script.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const prisma = require("../src/config/database");

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

async function sumStockQuantite(articleId, depotId) {
  const rows = await prisma.stock.findMany({
    where: { articleId: Number(articleId), depotId: Number(depotId) },
    select: { quantite: true },
  });
  return rows.reduce((s, row) => s + Number(row.quantite || 0), 0);
}

async function repairLotDrift(articleId, depotId) {
  const aid = Number(articleId);
  const did = Number(depotId);

  const article = await prisma.article.findUnique({
    where: { id: aid },
    select: { id: true, code: true, libelle: true },
  });
  const depot = await prisma.depot.findUnique({
    where: { id: did },
    select: { id: true, code: true, libelle: true },
  });

  const stockQty = await sumStockQuantite(aid, did);
  const lots = await prisma.lot.findMany({
    where: {
      articleId: aid,
      depotId: did,
      quantiteRestante: { gt: 0 },
    },
    orderBy: [{ dateFabrication: "asc" }, { id: "asc" }],
  });

  const totalLots = lots.reduce((s, l) => s + Number(l.quantiteRestante || 0), 0);
  const drift = round3(totalLots - stockQty);

  console.log(`\nArticle ${aid}${article ? ` (${article.code} — ${article.libelle})` : ""}`);
  console.log(`Dépôt ${did}${depot ? ` (${depot.code} — ${depot.libelle || ""})` : ""}`);
  console.log(`  Stock actuel (Σ lignes stock): ${stockQty}`);
  console.log(`  Total lots restants (dépôt):   ${totalLots}`);
  console.log(`  Écart à corriger:              ${drift}`);

  if (Math.abs(drift) < 0.001) {
    console.log("  ✓ Aucune correction nécessaire");
    return { corrected: false, drift: 0 };
  }

  if (drift < 0) {
    console.log(
      "  ⚠ Les lots totalisent MOINS que le stock — correction automatique non appliquée (vérifier manuellement)."
    );
    return { corrected: false, drift, reason: "lots_below_stock" };
  }

  let remaining = drift;
  for (const lot of lots) {
    if (remaining <= 1e-9) break;
    const rest = Number(lot.quantiteRestante);
    const taken = round3(Math.min(rest, remaining));
    const newQ = round3(rest - taken);

    await prisma.lot.update({
      where: { id: lot.id },
      data: {
        quantiteRestante: newQ,
        ...(newQ <= 1e-9 ? { statut: "EPUISE" } : {}),
      },
    });

    console.log(`  → Lot ${lot.numero} (id ${lot.id}): -${taken} → reste ${newQ} (correction historique)`);
    remaining = round3(remaining - taken);
  }

  if (remaining > 1e-6) {
    console.log(`  ⚠ Écart résiduel non couvert par les lots: ${remaining}`);
    return { corrected: false, drift, reason: "insufficient_lots" };
  }

  const afterLots = await prisma.lot.findMany({
    where: { articleId: aid, depotId: did, quantiteRestante: { gt: 0 } },
    select: { numero: true, quantiteRestante: true },
  });
  const afterTotal = afterLots.reduce((s, l) => s + Number(l.quantiteRestante || 0), 0);
  console.log(`  ✓ Après correction — stock: ${stockQty}, lots: ${afterTotal}`);

  return { corrected: true, drift, afterTotal };
}

async function main() {
  const articleId = Number(process.argv[2] || 41);
  const depotId = Number(process.argv[3] || 8);

  if (!Number.isInteger(articleId) || !Number.isInteger(depotId)) {
    console.error("Usage: node scripts/repair-lot-drift.js [articleId] [depotId]");
    process.exit(1);
  }

  console.log("=== Repair lot drift (one-time) ===");
  await repairLotDrift(articleId, depotId);
  console.log("\nTerminé.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
