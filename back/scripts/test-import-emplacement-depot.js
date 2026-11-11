/**
 * Test findOrCreateEmplacement — 3 cas de résolution dépôt.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const ExcelJS = require("exceljs");
const prisma = require("../src/config/database");
const { importArticlesFromFile } = require("../src/modules/articles/articles.service");

const HEADERS = [
  "code",
  "designation",
  "famille",
  "sous_famille",
  "marque",
  "fournisseur",
  "prix_unitaire",
  "prix_catalogue",
  "stock_min",
  "stock",
  "depot",
  "emplacement",
];

function baseRow(code, emplacement, depot = "") {
  return [
    code,
    "Produit test emplacement",
    "Famille Import Emp",
    "SF Import Emp",
    "Marque Import Emp",
    "Fournisseur Import Emp",
    10,
    15,
    2,
    5,
    depot,
    emplacement,
  ];
}

async function buildWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Import");
  ws.addRow(HEADERS);
  for (const row of rows) ws.addRow(row);
  return wb.xlsx.writeBuffer();
}

async function ensureReferentiel(societeId) {
  if (!(await prisma.fournisseur.findFirst({ where: { societeId, nom: "Fournisseur Import Emp" } }))) {
    await prisma.fournisseur.create({
      data: { code: "FOU_IMP_EMP", nom: "Fournisseur Import Emp", societeId },
    });
  }
  if (!(await prisma.marque.findFirst({ where: { societeId, nom: "Marque Import Emp" } }))) {
    await prisma.marque.create({
      data: { code: "MAR_IMP_EMP", nom: "Marque Import Emp", societeId },
    });
  }
}

async function main() {
  const stamp = Date.now();
  const societeId = 1;
  await ensureReferentiel(societeId);
  let failed = false;

  const depotCountInitial = await prisma.depot.count({ where: { societeId } });
  console.log(`Société ${societeId} — ${depotCountInitial} dépôt(s) en base`);

  // --- Cas 1 : un seul dépôt → résolution auto ---
  console.log("\n=== Cas 1 : un seul dépôt, colonne depot vide ===");
  const singleDepotGroup = (
    await prisma.depot.groupBy({ by: ["societeId"], _count: { id: true } })
  ).find((g) => g._count.id === 1);
  if (singleDepotGroup) {
    const sid1 = singleDepotGroup.societeId;
    await ensureReferentiel(sid1);
    const buf1 = await buildWorkbook([baseRow(`EMP1-${stamp}`, `Zone Auto ${stamp}`)]);
    const r1 = await importArticlesFromFile(buf1, sid1);
    console.log(`Société ${sid1} (1 dépôt):`, r1);
    if (r1.success === 1 && r1.entitesCreees?.emplacements?.includes(`Zone Auto ${stamp}`)) {
      console.log("OK cas 1");
    } else {
      console.error("ECHEC cas 1");
      failed = true;
    }
  } else if (depotCountInitial === 1) {
    const buf1 = await buildWorkbook([baseRow(`EMP1-${stamp}`, `Zone Auto ${stamp}`)]);
    const r1 = await importArticlesFromFile(buf1, societeId);
    console.log(r1);
    if (r1.success === 1) console.log("OK cas 1");
    else {
      failed = true;
      console.error("ECHEC cas 1");
    }
  } else {
    console.log("SKIP cas 1 sur société 1 (plusieurs dépôts — voir société à dépôt unique ci-dessus si disponible)");
  }

  // --- Cas 2 & 3 : deux dépôts de test ---
  const depA = await prisma.depot.create({
    data: {
      code: `DEP_TEST_A_${stamp}`,
      libelle: `Depot Test A ${stamp}`,
      societeId,
    },
  });
  const depB = await prisma.depot.create({
    data: {
      code: `DEP_TEST_B_${stamp}`,
      libelle: `Depot Test B ${stamp}`,
      societeId,
    },
  });

  console.log("\n=== Cas 2 : plusieurs dépôts + colonne depot renseignée ===");
  const buf2 = await buildWorkbook([
    baseRow(`EMP2-${stamp}`, `Zone Explicit ${stamp}`, depA.libelle),
  ]);
  const r2 = await importArticlesFromFile(buf2, societeId);
  console.log(r2);
  const emp2 = await prisma.emplacement.findFirst({
    where: { libelle: `Zone Explicit ${stamp}`, depotId: depA.id },
  });
  if (r2.success === 1 && emp2) {
    console.log("OK cas 2");
  } else {
    console.error("ECHEC cas 2");
    failed = true;
  }

  console.log("\n=== Cas 3 : plusieurs dépôts + colonne depot vide ===");
  const buf3 = await buildWorkbook([baseRow(`EMP3-${stamp}`, `Zone Ambigue ${stamp}`, "")]);
  const r3 = await importArticlesFromFile(buf3, societeId);
  console.log(r3);
  const msg = r3.errors?.[0]?.message || "";
  if (r3.failed === 1 && msg.includes("précisez une colonne 'depot'")) {
    console.log("OK cas 3 — message:", msg);
  } else {
    console.error("ECHEC cas 3");
    failed = true;
  }

  // Template brut (Fournisseur A/B + Rayon A1/B2)
  console.log("\n=== Bonus : modèle type (2 lignes) ===");
  const tpl = [
    [
      `TPL-${stamp}-1`,
      "Exemple produit A",
      "Famille A",
      "Sous-famille A",
      "Marque A",
      "Fournisseur A",
      12.5,
      18.9,
      5,
      25,
      depA.libelle,
      `Rayon A1 ${stamp}`,
    ],
    [
      `TPL-${stamp}-2`,
      "Exemple produit B",
      "Famille B",
      "Sous-famille B",
      "Marque B",
      "Fournisseur B",
      8.2,
      14.0,
      10,
      40,
      depA.libelle,
      `Rayon B2 ${stamp}`,
    ],
  ];
  const bufTpl = await buildWorkbook(tpl);
  const rTpl = await importArticlesFromFile(bufTpl, societeId);
  console.log(rTpl);
  if (rTpl.success === 2) {
    console.log("OK modèle — 2/2 avec emplacements auto-créés:", rTpl.entitesCreees?.emplacements);
  } else {
    console.error("ECHEC modèle", rTpl.errors);
    failed = true;
  }

  if (failed) process.exitCode = 1;
  else console.log("\nTous les tests emplacement/dépôt : OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
