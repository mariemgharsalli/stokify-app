/**
 * Normalise un code / référence métier pour éviter les doublons invisibles
 * (ex. "frs-001" vs "FRS-001" vs " FRS-001 ").
 */
function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

/**
 * Création avec code auto-généré + retry sur conflit unique (P2002).
 * À n'utiliser que pour le chemin "code auto" — pas pour un code saisi
 * manuellement différent de la suggestion.
 *
 * @param {number|string} societeId
 * @param {object} data
 * @param {(societeId: number|string) => Promise<string>} generateFn
 * @param {(data: object) => Promise<any>} createFn
 * @param {number} [maxRetries=3]
 * @param {string} [codeField="code"]
 */
async function createWithAutoCode(societeId, data, generateFn, createFn, maxRetries = 3, codeField = "code") {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const provided = data[codeField];
      const code =
        i === 0 && provided != null && String(provided).trim() !== ""
          ? normalizeCode(provided)
          : normalizeCode(await generateFn(societeId));
      return await createFn({ ...data, [codeField]: code });
    } catch (err) {
      if (err.code === "P2002" && i < maxRetries - 1) continue;
      throw err;
    }
  }
}

/**
 * Détermine si le code fourni est "auto" (vide ou égal à la suggestion courante).
 */
async function resolveAutoCode(societeId, providedCode, generateFn) {
  const normalized =
    providedCode != null && String(providedCode).trim() !== ""
      ? normalizeCode(providedCode)
      : "";
  if (!normalized) {
    return { isAuto: true, code: null };
  }
  const suggested = normalizeCode(await generateFn(societeId));
  if (normalized === suggested) {
    return { isAuto: true, code: normalized };
  }
  return { isAuto: false, code: normalized };
}

module.exports = {
  normalizeCode,
  createWithAutoCode,
  resolveAutoCode,
};
