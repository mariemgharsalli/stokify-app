"use strict";

/**
 * Client HTTP unique vers le micro-service FastAPI.
 * Un 429 arme un court repli local sans déclarer l'IA hors ligne.
 */
const { resolveAiServiceUrl } = require("../modules/stock/aiLocal.fallback");

class AiBusyError extends Error {}

let busyUntil = 0;
const isAiBusy = () => Date.now() < busyUntil;

async function aiFetch(path, { method = "POST", body, timeoutMs = 8000 } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (process.env.AI_SERVICE_KEY) headers["X-AI-Key"] = process.env.AI_SERVICE_KEY;
  const res = await fetch(`${resolveAiServiceUrl()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 429) {
    busyUntil = Date.now() + 5000;
    throw new AiBusyError("IA occupée");
  }
  return res;
}

module.exports = { aiFetch, AiBusyError, isAiBusy };
