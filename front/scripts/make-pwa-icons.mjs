/**
 * Icônes PWA Stokify Terrain.
 * Source : le logo copié par scripts/copy-logo.mjs, sinon le favicon déjà servi.
 * Si aucune source : monogramme « S » sur #0f1117 (signalé dans la console).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "pwa");

const candidates = [
  path.join(root, "src", "assets", "logo-stokify.png"),
  path.join(root, "public", "logo-stokify.png"),
  path.join(root, "public", "logo-stokify-full.png"),
  path.join(root, "public", "logos", "logo-stokify.png"),
  path.join(root, "public", "logos", "logo-stokify-full.png"),
];

const BG = { r: 15, g: 17, b: 23, alpha: 1 };

function placeholderSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f1117"/>
  <text x="256" y="340" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="300" font-weight="700" fill="#f1f5f9">S</text>
</svg>`);
}

async function renderIcon(input, size, file, ratio) {
  const inner = Math.max(1, Math.round(size * ratio));
  const resized = await sharp(input)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: resized, gravity: "centre" }])
    .png()
    .toFile(path.join(outDir, file));
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const src = candidates.find((file) => fs.existsSync(file));
  let input;
  if (!src) {
    console.warn("PWA_ICON_PLACEHOLDER: logo source introuvable, monogramme S généré.");
    input = placeholderSvg();
  } else {
    console.log("Source logo:", src);
    input = src;
  }

  await renderIcon(input, 192, "icon-192.png", 0.78);
  await renderIcon(input, 512, "icon-512.png", 0.78);
  // Zone sûre maskable = 80 % du carré.
  await renderIcon(input, 512, "icon-maskable-512.png", 0.8);
  await renderIcon(input, 180, "apple-touch-icon.png", 0.78);
  console.log("Icônes écrites dans", outDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
