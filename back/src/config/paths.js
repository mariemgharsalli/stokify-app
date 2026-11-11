const path = require("path");
/** Racine des uploads. Par défaut = comportement historique (back/public/uploads). */
const UPLOAD_ROOT = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.join(__dirname, "../../public/uploads");
const uploadDir = (...parts) => path.join(UPLOAD_ROOT, ...parts);
module.exports = { UPLOAD_ROOT, uploadDir };
