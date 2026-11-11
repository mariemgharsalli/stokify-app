/**
 * One-shot: remove validationResult checks from controllers
 * (validation now handled by middleware/validate.js).
 */
const fs = require("fs");
const path = require("path");

const controllers = [
  "ventes/ventes.controller.js",
  "lots/lots.controller.js",
  "companies/companies.controller.js",
  "achats/achats.controller.js",
  "auth/auth.controller.js",
  "inventaires/inventaires.controller.js",
  "coutStockage/coutStockage.controller.js",
  "mouvements/mouvements.controller.js",
  "clients/clients.controller.js",
  "numeroserie/numeroserie.controller.js",
  "stock/stock.controller.js",
  "fournisseurs/fournisseurs.controller.js",
  "reglements/reglements.controller.js",
  "marques/marques.controller.js",
  "users/users.controller.js",
  "rapports/rapports.controller.js",
  "depots/depots.controller.js",
  "articles/articles.controller.js",
  "emplacements/emplacements.controller.js",
  "vehicules/vehicules.controller.js",
  "groupes/groupes.controller.js",
];

const base = path.join(__dirname, "../src/modules");

for (const rel of controllers) {
  const file = path.join(base, rel);
  let src = fs.readFileSync(file, "utf8");
  const orig = src;

  src = src.replace(/function rejectIfInvalid\(req, res\) \{[\s\S]*?\n\}\n\n?/g, "");
  src = src.replace(/\s*if \(rejectIfInvalid\(req, res\)\) return;\n/g, "\n");

  src = src.replace(
    /\s*const errors = validationResult\(req\);\s*if \(!errors\.isEmpty\(\)\) \{[\s\S]*?\}\n/g,
    "\n"
  );

  src = src.replace(/const \{ validationResult \} = require\("express-validator"\);\n?/g, "");
  src = src.replace(
    /const \{ body, validationResult \} = require\("express-validator"\);/g,
    'const { body } = require("express-validator");'
  );
  src = src.replace(
    /const \{ validationResult, body \} = require\("express-validator"\);/g,
    'const { body } = require("express-validator");'
  );

  if (src !== orig) {
    fs.writeFileSync(file, src);
    console.log("cleaned", rel);
  } else {
    console.log("unchanged", rel);
  }
}
