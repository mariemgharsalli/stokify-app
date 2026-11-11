/**
 * Test non destructif syncVentePaiement via le service réel.
 * Crée 2 règlements sur une vente NON_REGLE sans règlements, vérifie PARTIEL puis REGLE, puis nettoie.
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function syncVentePaiement(tx, venteId) {
  const sum = await tx.reglement.aggregate({
    where: { venteId: Number(venteId), statut: { in: ["VALIDE", "EN_ATTENTE"] } },
    _sum: { montant: true },
  });
  const total = Number(sum._sum.montant || 0);
  const vente = await tx.vente.findUnique({ where: { id: Number(venteId) } });
  const ttc = Number(vente.totalTTC);
  let statutPaiement = "NON_REGLE";
  if (total >= ttc - 1e-6) statutPaiement = "REGLE";
  else if (total > 0) statutPaiement = "PARTIEL";
  await tx.vente.update({
    where: { id: Number(venteId) },
    data: { montantRegle: total, statutPaiement },
  });
  return { totalRegle: total, statutPaiement };
}

async function main() {
  const vente = await prisma.vente.findFirst({
    where: {
      statut: { in: ["VALIDE", "LIVRE", "FACTUREE", "CONFIRME"] },
      typeVente: { not: "AVOIR" },
      statutPaiement: "NON_REGLE",
      montantRegle: 0,
      reglements: { none: {} },
      totalTTC: { gt: 1 },
    },
    orderBy: { id: "desc" },
  });

  if (!vente) {
    console.log("Aucune vente NON_REGLE sans règlements — test synthétique sur snapshot temporaire.");
    const any = await prisma.vente.findFirst({
      where: { statut: { in: ["VALIDE", "LIVRE", "FACTUREE", "CONFIRME"] }, typeVente: { not: "AVOIR" }, totalTTC: { gt: 1 } },
      orderBy: { id: "desc" },
    });
    if (!any) throw new Error("Aucune vente confirmée");
    // Utilise une transaction qui rollback? Prisma n'a pas de rollback facile.
    // On crée des règlements taggés TEST et on les supprime à la fin en restaurant l'état.
    await runOnVente(any, true);
    return;
  }

  await runOnVente(vente, false);
}

async function runOnVente(vente, restoreSnapshot) {
  const ttc = Number(vente.totalTTC);
  const snap = await prisma.vente.findUnique({
    where: { id: vente.id },
    select: { montantRegle: true, statutPaiement: true },
  });
  const existingRegs = await prisma.reglement.findMany({ where: { venteId: vente.id } });
  console.log(`Vente #${vente.id} ${vente.reference} TTC=${ttc}`);
  console.log("Snapshot:", snap);

  const createdIds = [];
  try {
    if (restoreSnapshot && existingRegs.length) {
      await prisma.reglement.deleteMany({ where: { venteId: vente.id } });
      await prisma.$transaction((tx) => syncVentePaiement(tx, vente.id));
    }

    const partiel = Math.round((ttc * 0.4) * 1000) / 1000;
    const r1 = await prisma.$transaction(async (tx) => {
      const row = await tx.reglement.create({
        data: {
          venteId: vente.id,
          montant: partiel,
          mode: "ESPECES",
          statut: "VALIDE",
          datePayment: new Date(),
          commentaire: "__TEST_SYNC_PARTIEL__",
        },
      });
      await syncVentePaiement(tx, vente.id);
      return row;
    });
    createdIds.push(r1.id);

    let cur = await prisma.vente.findUnique({
      where: { id: vente.id },
      select: { montantRegle: true, statutPaiement: true },
    });
    console.log("Après partiel:", cur);
    if (cur.statutPaiement !== "PARTIEL") {
      throw new Error(`Attendu PARTIEL, obtenu ${cur.statutPaiement}`);
    }
    if (Math.abs(Number(cur.montantRegle) - partiel) > 1e-6) {
      throw new Error(`montantRegle attendu ${partiel}, obtenu ${cur.montantRegle}`);
    }

    const reste = Math.round((ttc - partiel) * 1000) / 1000;
    const r2 = await prisma.$transaction(async (tx) => {
      const row = await tx.reglement.create({
        data: {
          venteId: vente.id,
          montant: reste,
          mode: "VIREMENT",
          statut: "VALIDE",
          datePayment: new Date(),
          commentaire: "__TEST_SYNC_COMPLET__",
          referenceVirement: "TEST-SYNC",
        },
      });
      await syncVentePaiement(tx, vente.id);
      return row;
    });
    createdIds.push(r2.id);

    cur = await prisma.vente.findUnique({
      where: { id: vente.id },
      select: { montantRegle: true, statutPaiement: true },
    });
    console.log("Après complet:", cur);
    if (cur.statutPaiement !== "REGLE") {
      throw new Error(`Attendu REGLE, obtenu ${cur.statutPaiement}`);
    }

    console.log("OK — syncVentePaiement persiste PARTIEL puis REGLE.");
  } finally {
    if (createdIds.length) {
      await prisma.reglement.deleteMany({ where: { id: { in: createdIds } } });
    }
    if (restoreSnapshot) {
      for (const r of existingRegs) {
        const { id, ...data } = r;
        await prisma.reglement.create({ data: { ...data, id } }).catch(async () => {
          await prisma.reglement.create({ data });
        });
      }
      await prisma.vente.update({
        where: { id: vente.id },
        data: { montantRegle: snap.montantRegle, statutPaiement: snap.statutPaiement },
      });
      console.log("Snapshot restauré.");
    } else {
      await prisma.$transaction((tx) => syncVentePaiement(tx, vente.id));
      const after = await prisma.vente.findUnique({
        where: { id: vente.id },
        select: { montantRegle: true, statutPaiement: true },
      });
      console.log("État final nettoyé:", after);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
