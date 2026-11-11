/**
 * Génère un PDF de test local (monogramme sans logo) pour valider l'habillage stock dormant.
 * Usage : npx vite-node scripts/test-dead-stock-pdf.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "test-dead-stock-report.pdf");

const CHARTE = {
  amber: [186, 117, 23],
  red: [226, 75, 74],
  teal: [29, 158, 117],
  white: [255, 255, 255],
  slate: [100, 116, 139],
};

function drawReportLogoOrMonogram(doc, { societeName, accentColor, x = 10, y = 5, size = 20 }) {
  const letter = (String(societeName || "S").trim()[0] || "S").toUpperCase();
  doc.setFillColor(...accentColor);
  doc.roundedRect(x, y, size, size, 4, 4, "F");
  doc.setTextColor(...CHARTE.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(Math.round(size * 0.52));
  doc.text(letter, x + size / 2, y + size * 0.63, { align: "center" });
}

function tableHeadStyles(fillColor) {
  return { fillColor, textColor: CHARTE.white, fontStyle: "bold", fontSize: 9 };
}

const doc = new jsPDF({ orientation: "landscape" });
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();

doc.setFillColor(...CHARTE.amber);
doc.rect(0, 0, pageWidth, 30, "F");
drawReportLogoOrMonogram(doc, { societeName: "Stokify Demo", accentColor: CHARTE.amber });

doc.setTextColor(...CHARTE.white);
doc.setFont("helvetica", "bold");
doc.setFontSize(16);
doc.text("Rapport stock dormant", 36, 13);
doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.text("Stokify Demo", 36, 20);

let y = 38;
doc.setTextColor(30, 41, 59);
doc.setFontSize(10);
doc.text("Dépôt : DEP-01 — Entrepôt central", 14, y);
y += 6;
doc.text("Seuil : 90 jours sans mouvement", 14, y);

autoTable(doc, {
  startY: y + 8,
  head: [["Tranche", "Nb articles"]],
  body: [["> 90 jours", 3], ["60 – 90 jours", 3], ["30 – 60 jours", 2]],
  theme: "grid",
  headStyles: tableHeadStyles(CHARTE.amber),
});

autoTable(doc, {
  startY: doc.lastAutoTable.finalY + 8,
  head: [["Article", "Code", "Jours", "Valeur", "Recommandation"]],
  body: [["Palette bois", "PAL-120", "142", "8 640,000", "Liquider"]],
  theme: "striped",
  headStyles: tableHeadStyles(CHARTE.red),
  styles: { fontSize: 8 },
});

const generated = new Date().toLocaleDateString("fr-FR");
doc.setDrawColor(226, 232, 240);
doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
doc.setFontSize(8);
doc.setTextColor(...CHARTE.slate);
doc.text(`Stokify · Généré le ${generated}`, 14, pageHeight - 8);
doc.text("Page 1 / 1", pageWidth - 14, pageHeight - 8, { align: "right" });

writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
console.log("PDF de test écrit :", outPath);
