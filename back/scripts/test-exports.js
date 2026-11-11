/**
 * Smoke-test CSV (;) and Excel exports via authenticated API.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const BASE = `http://127.0.0.1:${process.env.PORT || 5000}/api`;
const OUT = path.join(__dirname, "_export_test_out");

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "superadmin@stokify.com", motDePasse: "SuperAdmin123!" }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.token || data.accessToken;
}

async function download(token, url, filename) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${url} => ${res.status} ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(OUT, { recursive: true });
  const filePath = path.join(OUT, filename);
  fs.writeFileSync(filePath, buf);
  return { buf, filePath };
}

function checkCsvSemicolon(buf, label) {
  const text = buf.toString("utf8").replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/)[0] || "";
  const commaCols = firstLine.split(",").length;
  const semiCols = firstLine.split(";").length;
  if (semiCols <= 1 && commaCols > 1) {
    throw new Error(`${label}: expected semicolon delimiter, got comma-separated header`);
  }
  console.log(`  OK CSV ${label}: ${semiCols} colonnes (délimiteur ;)`);
}

async function checkExcel(filePath, label, numericHeaders = []) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error(`${label}: no worksheet`);
  const headerRow = ws.getRow(ws.headerRowIndex || 1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: false }, (cell) => headers.push(String(cell.value)));
  for (const h of numericHeaders) {
    const colIdx = headers.indexOf(h) + 1;
    if (colIdx <= 0) continue;
    const dataRow = ws.getRow((ws.headerRowIndex || 1) + 1);
    const cell = dataRow.getCell(colIdx);
    if (cell.value != null && typeof cell.value !== "number") {
      throw new Error(`${label}: column "${h}" is not numeric (${typeof cell.value})`);
    }
  }
  console.log(`  OK Excel ${label}: ${ws.rowCount} rows, headers: ${headers.slice(0, 4).join(", ")}…`);
}

async function main() {
  console.log("Login…");
  const token = await login();

  const csvTests = [
    ["/stock/export", "stock.csv"],
    ["/mouvements/export?format=csv", "mouvements.csv"],
    ["/ventes/export?format=csv", "ventes.csv"],
    ["/achats/export?format=csv", "achats.csv"],
    ["/lots/export/expiring?format=csv&days=30", "lots.csv"],
  ];

  const invRes = await fetch(`${BASE}/inventaires?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (invRes.ok) {
    const invData = await invRes.json();
    const invId = invData?.items?.[0]?.id || invData?.data?.[0]?.id;
    if (invId) {
      const { buf } = await download(token, `/inventaires/${invId}/export`, "inventaire.csv");
      checkCsvSemicolon(buf, "inventaire.csv");
    } else {
      console.log("  SKIP inventaire CSV (aucun inventaire en base)");
    }
  }

  console.log("\nCSV exports (;):");
  for (const [url, name] of csvTests) {
    const { buf } = await download(token, url, name);
    checkCsvSemicolon(buf, name);
  }

  const excelTests = [
    ["/articles/export-excel", "articles.xlsx", ["Prix unitaire (TND)", "Stock actuel"]],
    ["/stock/export-excel", "stock.xlsx", ["Quantité"]],
    ["/achats/export?format=excel", "achats.xlsx", ["Total HT"]],
    ["/ventes/export?format=excel", "ventes.xlsx", ["Total HT"]],
    ["/mouvements/export?format=excel", "mouvements.xlsx", []],
    ["/lots/export/expiring?format=excel&days=30", "lots.xlsx", ["Quantité restante"]],
  ];

  console.log("\nExcel exports:");
  for (const [url, name, nums] of excelTests) {
    const { filePath } = await download(token, url, name);
    await checkExcel(filePath, name, nums);
  }

  console.log(`\nAll exports saved to ${OUT}`);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
