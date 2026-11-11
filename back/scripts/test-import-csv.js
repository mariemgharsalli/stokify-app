/**
 * Test manuel import CSV multi-lignes (sans serveur HTTP).
 * Usage : node scripts/test-import-csv.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const prisma = require("../src/config/database");
const { importArticlesFromCsv } = require("../src/modules/articles/articles.service");

async function main() {
  const societe = await prisma.societe.findFirst({ select: { id: true, code: true, nom: true } });
  if (!societe) throw new Error("Aucune société en base");

  const fournisseur = await prisma.fournisseur.findFirst({
    where: { societeId: societe.id },
    select: { code: true, nom: true },
  });
  const emplacement = await prisma.emplacement.findFirst({
    where: { depot: { societeId: societe.id } },
    select: { code: true, libelle: true },
  });
  const marque = await prisma.marque.findFirst({
    where: { societeId: societe.id },
    select: { code: true, nom: true },
  });

  const fournisseurLabel = fournisseur?.nom || fournisseur?.code || "FOURNISSEUR_INCONNU";
  const emplacementLabel = emplacement?.libelle || emplacement?.code || "EMPL_INCONNU";
  const marqueLabel = marque?.nom || marque?.code || "MARQUE_INCONNUE";

  const stamp = Date.now();
  const rows = [
    ["code", "designation", "famille", "sous_famille", "marque", "fournisseur", "prix_unitaire", "prix_catalogue", "stock_min", "stock", "emplacement"],
    [`IMP-${stamp}-01`, "Produit test import 1", "Famille Import Test", "SF Import A", marqueLabel, fournisseurLabel, "10", "15", "2", "5", emplacementLabel],
    [`IMP-${stamp}-02`, "Produit test import 2", "Famille Import Test", "SF Import B", marqueLabel, fournisseurLabel, "20", "28", "3", "8", emplacementLabel],
    [`IMP-${stamp}-03`, "Produit test import 3", "Famille Import Test", "SF Import C", "", fournisseurLabel, "5", "9", "1", "12", emplacementLabel],
    [`IMP-${stamp}-04`, "Produit fournisseur invalide", "Famille Import Test", "SF Import D", "", "FOURNISSEUR_QUI_NEXISTE_PAS_XYZ", "10", "12", "1", "1", emplacementLabel],
    [`IMP-${stamp}-05`, "Produit emplacement invalide", "Famille Import Test", "SF Import E", "", fournisseurLabel, "10", "12", "1", "1", "EMPLACEMENT_INEXISTANT_XYZ"],
    ["", "Ligne sans code", "Famille Import Test", "SF Import F", "", fournisseurLabel, "10", "12", "1", "1", emplacementLabel],
    [`IMP-${stamp}-06`, "Produit marque invalide", "Famille Import Test", "SF Import G", "MARQUE_INEXISTANTE_XYZ", fournisseurLabel, "10", "12", "1", "1", emplacementLabel],
    [`IMP-${stamp}-07`, "Produit test import 7", "Famille Import Test", "SF Import H", marqueLabel, fournisseurLabel, "30", "45", "5", "20", emplacementLabel],
    [`IMP-${stamp}-08`, "Prix incohérent", "Famille Import Test", "SF Import I", "", fournisseurLabel, "50", "40", "1", "1", emplacementLabel],
    [`IMP-${stamp}-09`, "Produit test import 9", "Famille Import Test", "SF Import J", marqueLabel, fournisseurLabel, "7.5", "11", "2", "6", emplacementLabel],
  ];

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const tmpPath = path.join(__dirname, `test-import-${stamp}.csv`);
  fs.writeFileSync(tmpPath, csv, "utf8");

  console.log("Société:", societe);
  console.log("Référentiel utilisé:", { fournisseurLabel, emplacementLabel, marqueLabel: marque ? marqueLabel : "(aucune marque en base — lignes avec marque échoueront)" });
  console.log("Fichier CSV:", tmpPath);

  const result = await importArticlesFromCsv(Buffer.from(csv, "utf8"), societe.id);

  const codes = rows.slice(1).map((r) => r[0]).filter(Boolean);
  const created = await prisma.article.findMany({
    where: { societeId: societe.id, code: { in: codes } },
    select: { code: true, libelle: true },
    orderBy: { code: "asc" },
  });

  console.log("\n=== Résultat import ===");
  console.log(JSON.stringify(result, null, 2));
  console.log("\n=== Articles créés en base (codes attendus valides) ===");
  console.log(created);

  const expectedSuccessMin = marque ? 5 : 4;
  if (result.success < expectedSuccessMin) {
    console.error(`\nÉCHEC: seulement ${result.success} succès (attendu >= ${expectedSuccessMin})`);
    process.exitCode = 1;
  } else if (result.failed < 4) {
    console.error(`\nÉCHEC: seulement ${result.failed} échecs (attendu >= 4 lignes invalides)`);
    process.exitCode = 1;
  } else {
    console.log(`\nOK: ${result.success} lignes importées, ${result.failed} rejetées individuellement.`);
  }

  fs.unlinkSync(tmpPath);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
