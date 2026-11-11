/**
 * Test POST /articles/import via HTTP (même chemin que l'interface web).
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const BASE = `http://127.0.0.1:${process.env.PORT || 5000}/api`;

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
  "emplacement",
];

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "superadmin@stokify.com",
      motDePasse: "SuperAdmin123!",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${JSON.stringify(data)}`);
  return data.token;
}

async function buildXlsxBuffer(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Modèle import");
  ws.addRow(HEADERS);
  for (const row of rows) ws.addRow(row);
  return wb.xlsx.writeBuffer();
}

async function main() {
  const token = await login();
  const stamp = Date.now();
  const rows = [
    [`HTTP-${stamp}-1`, "Exemple produit A", "Famille A", "Sous-famille A", "Marque A", "Fournisseur A", 12.5, 18.9, 5, 25, "Rayon A1"],
    [`HTTP-${stamp}-2`, "Exemple produit B", "Famille B", "Sous-famille B", "Marque B", "Fournisseur B", 8.2, 14.0, 10, 40, "Rayon B2"],
  ];
  const buffer = await buildXlsxBuffer(rows);
  const tmp = path.join(__dirname, `http-import-${stamp}.xlsx`);
  fs.writeFileSync(tmp, buffer);

  const form = new FormData();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  form.append("file", blob, "modele-import-produits.xlsx");

  const res = await fetch(`${BASE}/articles/import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-societe-id": "1",
    },
    body: form,
  });
  const result = await res.json();
  fs.unlinkSync(tmp);

  console.log("HTTP status:", res.status);
  console.log("Import result:", JSON.stringify(result, null, 2));

  if (result.success === 2 && result.failed === 0) {
    console.log("OK: import HTTP identique à l'interface web — 2/2 succès");
  } else {
    console.error("ECHEC: l'API web renvoie encore des erreurs");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
