const MODES = new Set(["AUCUN", "LOT", "SERIE", "LOT_SERIE"]);
const LEGACY_LOT_MODES = new Set(["LOTS", "FIFO", "LOT", "FEFO"]);

function resolveModeTracage(article) {
  const mt = String(article?.modeTracage || "").trim().toUpperCase();
  if (MODES.has(mt)) return mt;
  const mg = String(article?.modeGestion || "STANDARD").trim().toUpperCase();
  if (LEGACY_LOT_MODES.has(mg)) return "LOT";
  return "AUCUN";
}

function isTracageAuto(article) {
  return Boolean(article?.tracageAuto) && resolveModeTracage(article) !== "AUCUN";
}

function tracksLot(modeTracage) {
  return modeTracage === "LOT" || modeTracage === "LOT_SERIE";
}

function tracksSerie(modeTracage) {
  return modeTracage === "SERIE" || modeTracage === "LOT_SERIE";
}

function modeGestionFromTracage(modeTracage) {
  if (modeTracage === "LOT" || modeTracage === "LOT_SERIE") return "LOTS";
  if (modeTracage === "SERIE") return "SERIE";
  return "STANDARD";
}

function assertIntegerQuantite(quantite, message) {
  const n = Number(quantite);
  if (!Number.isFinite(n) || n <= 0 || Math.abs(n - Math.round(n)) > 1e-6) {
    const err = new Error(message || "La quantité doit être un entier positif");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return Math.round(n);
}

module.exports = {
  resolveModeTracage,
  isTracageAuto,
  tracksLot,
  tracksSerie,
  modeGestionFromTracage,
  assertIntegerQuantite,
};
