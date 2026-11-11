import { create } from "zustand";
import { useAuthStore } from "../../store/authStore";

const PREFIX = "stokify-terrain-pick:";
const MAX_AGE = 24 * 60 * 60 * 1000;

export function ventesFraiches(ventes, now = Date.now()) {
  const suivantes = {};
  for (const [id, row] of Object.entries(ventes || {})) {
    if (!row?.updatedAt || now - Number(row.updatedAt) > MAX_AGE) continue;
    suivantes[id] = row;
  }
  return suivantes;
}

function lire(sessionKey) {
  if (!sessionKey || typeof localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFIX + sessionKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function ecrire(sessionKey, ventes) {
  if (!sessionKey || typeof localStorage === "undefined") return;
  localStorage.setItem(PREFIX + sessionKey, JSON.stringify(ventes));
}

function fusion(precedent, patch) {
  const suivantes = { ...(precedent || {}) };
  for (const [ligneId, entries] of Object.entries(patch || {})) {
    suivantes[ligneId] = { ...(suivantes[ligneId] || {}), ...entries };
  }
  return suivantes;
}

export function purgerPick() {
  if (typeof localStorage !== "undefined") {
    const cles = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const cle = localStorage.key(index);
      if (cle && cle.startsWith(PREFIX)) cles.push(cle);
    }
    cles.forEach((cle) => localStorage.removeItem(cle));
  }
  usePickStore.setState({ sessionKey: null, ventes: {} });
}

export const usePickStore = create((set, get) => ({
  sessionKey: null,
  ventes: {},
  bind(sessionKey) {
    const suivante = String(sessionKey || "");
    if (!suivante) return;
    const precedente = get().sessionKey;
    if (precedente === suivante) return;
    if (precedente && typeof localStorage !== "undefined") localStorage.removeItem(PREFIX + precedente);
    const ventes = ventesFraiches(lire(suivante));
    ecrire(suivante, ventes);
    set({ sessionKey: suivante, ventes });
  },
  enregistrer(venteId, patch = {}) {
    const id = String(venteId);
    const sessionKey = get().sessionKey;
    if (!sessionKey) return;
    const now = Date.now();
    const ventes = ventesFraiches(get().ventes, now);
    const prev = ventes[id] || {
      lignes: {},
      scans: 0,
      blocked: 0,
      startedAt: now,
      finishedAt: null,
      fingerprint: patch.fingerprint || "",
      complete: false,
      updatedAt: now,
    };
    const complete = patch.complete ?? prev.complete;
    ventes[id] = {
      ...prev,
      fingerprint: patch.fingerprint || prev.fingerprint,
      updatedAt: now,
      startedAt: prev.startedAt || now,
      scans: prev.scans + (patch.scan ? 1 : 0),
      blocked: prev.blocked + (patch.blocked ? 1 : 0),
      lignes: patch.lignes ? fusion(prev.lignes, patch.lignes) : prev.lignes,
      anomalies: patch.anomalie ? [...(prev.anomalies || []), patch.anomalie] : prev.anomalies || [],
      bloquees: patch.bloquee
        ? { ...(prev.bloquees || {}), [String(patch.bloquee.ligneId)]: patch.bloquee }
        : prev.bloquees || {},
      complete,
      finishedAt: complete && !prev.finishedAt ? now : prev.finishedAt,
    };
    ecrire(sessionKey, ventes);
    set({ ventes });
  },
  invalider(venteId) {
    const id = String(venteId);
    const ventes = { ...get().ventes };
    delete ventes[id];
    ecrire(get().sessionKey, ventes);
    set({ ventes });
  },
}));

export function subscribePickAuthReset() {
  return useAuthStore.subscribe((state, prev) => {
    if (prev?.token && !state.token) purgerPick();
  });
}
