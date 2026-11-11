/**
 * Recalcule montantRegle / statutPaiement pour toutes les ventes confirmées.
 * Corrige les valeurs stagnantes laissées par syncVentePaiement (bug pré-correctif).
 *
 * Usage :
 *   node scripts/fix-statut-paiement-ventes.js          # dry-run
 *   node scripts/fix-statut-paiement-ventes.js --apply  # applique en base
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const STATUTS_CONFIRMES = ["VALIDE", "LIVRE", "FACTUREE", "CONFIRME"];

function computeStatut(totalRegle, totalTTC) {
  if (totalRegle >= totalTTC - 1e-6) return "REGLE";
  if (totalRegle > 0) return "PARTIEL";
  return "NON_REGLE";
}

async function main() {
  const apply = process.argv.includes("--apply");

  const ventes = await prisma.vente.findMany({
    where: {
      statut: { in: STATUTS_CONFIRMES },
      typeVente: { not: "AVOIR" },
    },
    select: {
      id: true,
      reference: true,
      totalTTC: true,
      montantRegle: true,
      statutPaiement: true,
      reglements: {
        where: { statut: { in: ["VALIDE", "EN_ATTENTE"] } },
        select: { montant: true },
      },
    },
    orderBy: { id: "asc" },
  });

  const toFix = [];
  for (const v of ventes) {
    const total = (v.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
    const statutPaiement = computeStatut(total, Number(v.totalTTC));
    const montantChanged = Math.abs(Number(v.montantRegle || 0) - total) > 1e-6;
    const statutChanged = String(v.statutPaiement || "NON_REGLE") !== statutPaiement;
    if (montantChanged || statutChanged) {
      toFix.push({
        id: v.id,
        reference: v.reference,
        oldMontant: Number(v.montantRegle || 0),
        newMontant: total,
        oldStatut: v.statutPaiement || "NON_REGLE",
        newStatut: statutPaiement,
      });
    }
  }

  console.log(`=== Correction statut paiement ventes ===`);
  console.log(`Ventes confirmées analysées : ${ventes.length}`);
  console.log(`À corriger                 : ${toFix.length}\n`);

  if (toFix.length === 0) {
    console.log("Aucune vente à corriger.");
    return;
  }

  for (const row of toFix.slice(0, 50)) {
    console.log(
      `#${row.id} ${row.reference} | ${row.oldMontant.toFixed(3)}/${row.oldStatut} → ${row.newMontant.toFixed(3)}/${row.newStatut}`
    );
  }
  if (toFix.length > 50) {
    console.log(`... et ${toFix.length - 50} autre(s)`);
  }

  if (!apply) {
    console.log("\nMode dry-run : aucune modification en base.");
    console.log("Relancez avec --apply pour appliquer les mises à jour.");
    return;
  }

  let updated = 0;
  for (const row of toFix) {
    await prisma.vente.update({
      where: { id: row.id },
      data: { montantRegle: row.newMontant, statutPaiement: row.newStatut },
    });
    updated += 1;
  }

  console.log(`\nOK — ${updated} vente(s) corrigée(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
