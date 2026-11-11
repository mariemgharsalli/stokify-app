const fs = require("fs");
const path = require("path");
const { UPLOAD_ROOT } = require("./paths");
const SOURCE = path.join(__dirname, "../../public/uploads");

/** Copie UNE SEULE FOIS les images du dépôt vers le volume persistant (jamais d'écrasement). */
function seedUploadsOnce() {
  if (path.resolve(SOURCE) === path.resolve(UPLOAD_ROOT)) return;
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  const marker = path.join(UPLOAD_ROOT, ".seeded");
  if (fs.existsSync(marker) || !fs.existsSync(SOURCE)) return;
  fs.cpSync(SOURCE, UPLOAD_ROOT, { recursive: true, force: false, errorOnExist: false });
  fs.writeFileSync(marker, new Date().toISOString());
}
module.exports = { seedUploadsOnce };
