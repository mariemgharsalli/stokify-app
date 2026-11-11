const cron = require("node-cron");
const prisma = require("../config/database");
const {
  detectAndPersistAnomalies,
  trainAnomalyModels,
} = require("../modules/stock/anomalies.service");

let scheduled = false;

async function forEachSociete(fn, label) {
  const societes = await prisma.societe.findMany({
    where: { actif: true },
    select: { id: true },
  });
  for (const s of societes) {
    try {
      const result = await fn(s.id);
      // eslint-disable-next-line no-console
      console.log(`[anomalies.cron] ${label} société ${s.id}:`, result);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[anomalies.cron] ${label} société ${s.id}:`, e?.message || e);
    }
  }
}

async function runAnomaliesDetection() {
  await forEachSociete(async (id) => {
    const result = await detectAndPersistAnomalies(id);
    return `détectées=${result.detected}, persistées=${result.persisted}, mode=${result.mode}`;
  }, "detect");
}

async function runAnomaliesRetrain() {
  await forEachSociete(async (id) => {
    const result = await trainAnomalyModels(id);
    if (!result?.ok) return `skip ${result?.reason || ""}`;
    const sup = result.supervised || {};
    return `n=${result.nTrain} supervisé=${Boolean(sup.trained)} pos=${sup.nPos || 0} neg=${sup.nNeg || 0}`;
  }, "retrain");
}

function startAnomaliesCron() {
  if (scheduled || process.env.DISABLE_ANOMALIES_CRON === "1") return;
  scheduled = true;
  cron.schedule("0 3,15 * * *", () => {
    runAnomaliesDetection().catch((e) => {
      // eslint-disable-next-line no-console
      console.warn("[anomalies.cron]", e?.message || e);
    });
  });
  cron.schedule("20 3 * * *", () => {
    runAnomaliesRetrain().catch((e) => {
      // eslint-disable-next-line no-console
      console.warn("[anomalies.cron] retrain", e?.message || e);
    });
  });
  // eslint-disable-next-line no-console
  console.log("[anomalies.cron] planifié (detect 03:00/15:00 · retrain 03:20)");
}

module.exports = startAnomaliesCron;
module.exports.runAnomaliesDetection = runAnomaliesDetection;
module.exports.runAnomaliesRetrain = runAnomaliesRetrain;
