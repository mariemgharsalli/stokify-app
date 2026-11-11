const { modeGestionFromTracage } = require("../utils/tracage");

const MODE_TRACAGE = ["AUCUN", "LOT", "SERIE", "LOT_SERIE"];
const STRATEGIES = ["FIFO", "FEFO", "STANDARD"];

function normalizeModeTracage(value) {
  const s = String(value ?? "AUCUN").trim().toUpperCase();
  return MODE_TRACAGE.includes(s) ? s : "AUCUN";
}

function normalizeStrategie(value, fallback = "FIFO") {
  const s = String(value ?? fallback).trim().toUpperCase();
  return STRATEGIES.includes(s) ? s : fallback;
}

/**
 * Contrat équivalent Zod :
 *   modeTracage: z.enum(["AUCUN", "LOT", "SERIE", "LOT_SERIE"]).default("AUCUN")
 *   tracageAuto: z.boolean().default(false)
 *   .refine() : si modeTracage !== AUCUN, strategieSortie doit être FIFO ou FEFO
 */
function parseArticleTracage(data = {}) {
  const modeTracage = normalizeModeTracage(data.modeTracage);
  const tracageAuto = modeTracage !== "AUCUN" && Boolean(data.tracageAuto);
  const strategieSortie = normalizeStrategie(data.strategieSortie);
  if (modeTracage !== "AUCUN" && strategieSortie === "STANDARD") {
    const err = new Error(
      "La stratégie de sortie doit être FIFO ou FEFO lorsque la traçabilité lot ou série est activée"
    );
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return {
    modeTracage,
    tracageAuto,
    strategieSortie: modeTracage !== "AUCUN" && strategieSortie === "STANDARD" ? "FIFO" : strategieSortie,
    modeGestion: modeGestionFromTracage(modeTracage),
  };
}

module.exports = {
  MODE_TRACAGE,
  normalizeModeTracage,
  parseArticleTracage,
};
