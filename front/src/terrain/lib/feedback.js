import { useTerrainStore } from "../store/terrainStore";

let audioCtx = null;

/** iOS exige un geste utilisateur : appeler au premier tap (ex. bouton SCAN). */
export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch {
    /* audio indisponible : on continue sans son */
  }
}

function vibrate(pattern) {
  if (!useTerrainStore.getState().hapticsOn) return;
  try {
    navigator.vibrate?.(pattern); // absent sur iOS Safari : sans effet, sans erreur
  } catch {
    /* ignore */
  }
}

function beep(freq, ms, type = "sine", gain = 0.08) {
  if (!useTerrainStore.getState().soundOn || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch {
    /* ignore */
  }
}

export const feedback = {
  success() {
    vibrate(40);
    beep(880, 90);
  },
  warn() {
    vibrate([30, 40, 30]);
    beep(520, 140, "triangle");
  },
  error() {
    vibrate([80, 50, 80]);
    beep(220, 220, "square");
  },
};
