/**
 * Export lecture seule des ventes mensuelles confirmées (36 mois).
 * Prisma : findMany uniquement. Aucune écriture.
 */
"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs = require("fs");
const path = require("path");
const prisma = require("../src/config/database");

const STATUTS = ["CONFIRME", "VALIDE", "LIVRE"];

function monthKey(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 35);
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  const lignes = await prisma.ligneVente.findMany({
    where: {
      vente: { statut: { in: STATUTS }, dateVente: { gte: since } },
    },
    select: {
      articleId: true,
      quantite: true,
      vente: { select: { dateVente: true } },
    },
  });

  const buckets = new Map();
  for (const ligne of lignes) {
    const mois = monthKey(ligne.vente?.dateVente);
    if (!mois) continue;
    const key = `${ligne.articleId}|${mois}`;
    buckets.set(key, (buckets.get(key) || 0) + (Number(ligne.quantite) || 0));
  }

  const rows = [...buckets.entries()]
    .map(([key, quantite]) => {
      const [articleId, mois] = key.split("|");
      return { articleId: Number(articleId), mois, quantite: Math.round(quantite * 100) / 100 };
    })
    .sort((a, b) => a.articleId - b.articleId || a.mois.localeCompare(b.mois));

  const outDir = path.join(__dirname, "../../ai-service/eval/data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "sales_monthly.json");
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  console.log(`export ${rows.length} lignes -> ${outPath}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  try { await prisma.$disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
