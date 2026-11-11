/**
 * Filtre société obligatoire pour les listes métier (contexte req.user, dont x-societe-id).
 * @param {{ societeId?: number | null }} user
 * @returns {{ societeId: number }}
 */
function getSocieteWhere(user) {
  const sid = user?.societeId;
  if (sid == null || sid === "") {
    const err = new Error("Aucune société active. Sélectionnez une société.");
    err.status = 403;
    throw err;
  }
  const n = Number(sid);
  if (!Number.isInteger(n) || n < 1) {
    const err = new Error("Aucune société active. Sélectionnez une société.");
    err.status = 403;
    throw err;
  }
  return { societeId: n };
}

/** societeId exploitable pour create/update (jamais depuis le body client). */
function requireActiveSocieteId(societeId) {
  return getSocieteWhere({ societeId }).societeId;
}

/** Retire societeId du payload pour éviter qu'un client force une autre société. */
function stripSocieteFromBody(data) {
  if (!data || typeof data !== "object") return data;
  const { societeId: _ignored, ...rest } = data;
  return rest;
}

module.exports = { getSocieteWhere, requireActiveSocieteId, stripSocieteFromBody };
