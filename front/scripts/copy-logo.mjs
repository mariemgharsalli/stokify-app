/**
 * Met à jour le logo Stokify partout : `src/assets` (import Vite) + `public` (favicon).
 * Usage : npm run logo -- "C:\chemin\vers\ton-logo.png"
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = process.argv[2];

if (!src) {
  console.error('Indiquez le fichier PNG : npm run logo -- "chemin\\logo.png"');
  process.exit(1);
}

const abs = path.isAbsolute(src) ? src : path.join(process.cwd(), src);

if (!fs.existsSync(abs)) {
  console.error("Fichier introuvable :", abs);
  process.exit(1);
}

const targets = [
  path.join(root, "src", "assets", "logo-stokify.png"),
  path.join(root, "public", "logo-stokify.png"),
  path.join(root, "public", "logo-stokify-full.png"),
];

fs.mkdirSync(path.dirname(targets[0]), { recursive: true });
fs.mkdirSync(path.dirname(targets[1]), { recursive: true });

for (const t of targets) {
  fs.copyFileSync(abs, t);
  console.log("OK", t);
}

console.log("\nRedemarrez `npm run dev` (ou videz le cache du navigateur).");
