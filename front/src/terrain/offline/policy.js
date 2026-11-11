const ACTIONS = {
  "inventaire.comptage": true,
  "inventaire.ajout": false,
  "reception.ligne": false,
  "transfert": false,
};

export function peutMettreEnFile(kind) {
  return ACTIONS[kind] === true;
}

function memeQuantite(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const left = Number(a);
  const right = Number(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.abs(left - right) < 1e-6;
}

export function decisionRejeu(ligne, action) {
  if (!ligne) return { action: "conflict", reason: "missing" };
  if (action?.force && ligne) return { action: "send" };
  if (memeQuantite(ligne.qteReelle, action?.qteReelle)) return { action: "skip" };
  if (memeQuantite(ligne.qteReelle, action?.qteAvant)) return { action: "send" };
  return {
    action: "conflict",
    reason: "changed",
    server: ligne.qteReelle ?? null,
    wanted: action?.qteReelle ?? null,
  };
}
