import { corpsComptage } from "../lib/inventory";
import { decisionRejeu } from "./policy";
import { ecrire, lireTout, retirerId, useMemoryQueueForTests } from "./persist";

export { useMemoryQueueForTests };

export function newRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function lireFile(sessionKey) {
  const rows = await lireTout();
  return rows
    .filter((row) => !sessionKey || row.sessionKey === sessionKey)
    .filter((row) => row.status !== "done")
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function mettreEnFile(input) {
  const id = input.id || newRequestId();
  const row = {
    id,
    clientRequestId: input.clientRequestId || id,
    sessionKey: input.sessionKey,
    kind: "inventaire.comptage",
    status: "pending",
    createdAt: Date.now(),
    inventaireId: input.inventaireId,
    ligneId: input.ligneId,
    qteReelle: input.qteReelle,
    qteAvant: input.qteAvant ?? null,
    label: input.label || "",
    force: false,
    conflict: null,
  };
  return ecrire(row);
}

export async function retirerAction(id) {
  await retirerId(id);
}

export async function purgerFile(sessionKey) {
  const rows = await lireTout();
  const cibles = sessionKey ? rows.filter((row) => row.sessionKey === sessionKey) : rows;
  await Promise.all(cibles.map((row) => retirerId(row.id)));
}

export async function rejouerElement(item, api) {
  const { data } = await api.get(`inventaires/${item.inventaireId}`);
  const ligne = (data?.lignes || []).find((row) => Number(row.id) === Number(item.ligneId)) || null;
  const decision = decisionRejeu(ligne, item);
  if (decision.action === "skip") return { ...item, status: "done", conflict: null, force: false };
  if (decision.action === "conflict") {
    return { ...item, status: "failed", force: false, conflict: { server: decision.server, wanted: decision.wanted } };
  }
  await api.patch(`inventaires/${item.inventaireId}/lignes/${item.ligneId}`, corpsComptage(item.qteReelle));
  return { ...item, status: "done", conflict: null, force: false };
}

export async function rejouerFile(sessionKey, api) {
  const rows = await lireFile(sessionKey);
  const ordre = rows.filter((row) => row.status === "pending" || row.status === "sending");
  for (const row of ordre) {
    await ecrire({ ...row, status: "sending" });
    try {
      const suivant = await rejouerElement(row, api);
      if (suivant.status === "done") await retirerId(row.id);
      else await ecrire(suivant);
    } catch {
      await ecrire({ ...row, status: "pending" });
    }
  }
}

export async function forcerAction(id) {
  const rows = await lireTout();
  const row = rows.find((item) => item.id === id);
  if (!row) return null;
  const suivant = { ...row, status: "pending", force: true, conflict: null };
  await ecrire(suivant);
  return suivant;
}
