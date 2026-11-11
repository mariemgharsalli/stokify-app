const svc = require("../src/modules/reglements/reglements.service");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const vente = await prisma.vente.findFirst({
    where: {
      statut: "CONFIRME",
      typeVente: { not: "AVOIR" },
      statutPaiement: { in: ["NON_REGLE", "PARTIEL"] },
      totalTTC: { gt: 0.5 },
    },
    orderBy: { id: "desc" },
  });
  if (!vente) {
    console.log("Aucune vente CONFIRME a regler");
    return;
  }

  const existing = await prisma.reglement.aggregate({
    where: { venteId: vente.id, statut: { in: ["VALIDE", "EN_ATTENTE"] } },
    _sum: { montant: true },
  });
  const deja = Number(existing._sum.montant || 0);
  const reste = Number(vente.totalTTC) - deja;
  const montant = Math.min(0.5, Math.round(reste * 1000) / 1000);
  console.log(`Test vente #${vente.id} ${vente.reference} statut=${vente.statut} reste=${reste}`);

  const row = await svc.createVenteReglement(
    { venteId: vente.id, montant, mode: "ESPECES", datePayment: new Date().toISOString() },
    vente.societeId
  );
  console.log(`OK encaissement id=${row.id} montant=${row.montant}`);

  const after = await prisma.vente.findUnique({
    where: { id: vente.id },
    select: { montantRegle: true, statutPaiement: true, statut: true },
  });
  console.log("Apres:", after);

  await svc.deleteVenteReglement(row.id, vente.societeId);
  const cleaned = await prisma.vente.findUnique({
    where: { id: vente.id },
    select: { montantRegle: true, statutPaiement: true },
  });
  console.log("Nettoye:", cleaned);
}

main()
  .catch((e) => {
    console.error("FAIL:", e.message, "status=", e.status);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
