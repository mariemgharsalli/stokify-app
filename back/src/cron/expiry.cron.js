const cron = require("node-cron");
const prisma = require("../config/database");
const { aiFetch } = require("../utils/aiClient");
const {
  getExpiryWasteRisk,
  labelExpiryOutcomes,
  retrainExpiryFromLabels,
} = require("../modules/stock/expiryWaste.service");

let scheduled = false;

async function forEachSociete(fn, label) {
  const societes = await prisma.societe.findMany({
    where: { actif: true },
    select: { id: true },
  });
  for (const s of societes) {
    try {
      const result = await fn(s.id);
      console.log(`[expiry.cron] ${label} société ${s.id}:`, result);
    } catch (e) {
      console.warn(`[expiry.cron] ${label} société ${s.id}:`, e?.message || e);
    }
  }
}

async function runExpirySnapshot() {
  await forEachSociete(async (id) => {
    const data = await getExpiryWasteRisk(id);
    return `lots=${data?.kpis?.lotsSuivis || 0} mode=${data?.mode}`;
  }, "snapshot");
}

async function runExpiryLabel() {
  const result = await labelExpiryOutcomes();
  console.log(`[expiry.cron] étiquettes=${result.labeled}`);
  return result;
}

async function waitTrainVerdict(jobId) {
  for (let i = 0; i < 90; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    try {
      const res = await aiFetch("/expiry-waste/status", { method: "GET", timeoutMs: 8000 });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.job?.id === jobId && (data.job.status === "done" || data.job.status === "error")) {
        console.log(`[expiry.cron] verdict ${data.job.verdict || data.job.status}`);
        return data.job;
      }
    } catch (error) {
      console.warn("[expiry.cron] statut:", error?.message || error);
    }
  }
  console.log("[expiry.cron] entraînement toujours en cours");
  return null;
}

async function runExpiryRetrain() {
  const result = await retrainExpiryFromLabels();
  if (!result?.ok) {
    console.log(`[expiry.cron] réentraînement ignoré: ${result?.reason || result?.status || "skip"}`);
    return result;
  }
  console.log(`[expiry.cron] réentraînement lancé job=${result.jobId} lignes=${result.sent}`);
  if (result.jobId) await waitTrainVerdict(result.jobId);
  return result;
}

function startExpiryCron() {
  if (scheduled || process.env.DISABLE_EXPIRY_CRON === "1") return;
  scheduled = true;
  cron.schedule("30 2 * * *", () => {
    runExpirySnapshot().catch((e) => console.warn("[expiry.cron] snapshot", e?.message || e));
  });
  cron.schedule("50 2 * * *", () => {
    runExpiryLabel().catch((e) => console.warn("[expiry.cron] label", e?.message || e));
  });
  cron.schedule("40 3 * * 0", () => {
    runExpiryRetrain().catch((e) => console.warn("[expiry.cron] retrain", e?.message || e));
  });
  console.log("[expiry.cron] planifié (snapshot 02:30 · étiquettes 02:50 · réentraînement dim. 03:40)");
}

module.exports = startExpiryCron;
module.exports.runExpirySnapshot = runExpirySnapshot;
module.exports.runExpiryLabel = runExpiryLabel;
module.exports.runExpiryRetrain = runExpiryRetrain;
