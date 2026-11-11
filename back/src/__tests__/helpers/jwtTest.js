"use strict";

const jwt = require("jsonwebtoken");

/** Secret dédié aux tests. Identique à celui posé dans jest.setup.js. */
const JWT_SECRET_TEST = "cle-de-test-jwt-stokify-32chars";

function installerSecretJwtTest() {
  process.env.JWT_SECRET = JWT_SECRET_TEST;
  if (!process.env.JWT_EXPIRES_IN) process.env.JWT_EXPIRES_IN = "1h";
  return JWT_SECRET_TEST;
}

/**
 * Même charge utile que auth.service.buildToken :
 * { id, role, societeId }.
 */
function genererJwtDeTest(utilisateur, options = {}) {
  const secret = options.secret || JWT_SECRET_TEST;
  const expiresIn = options.expiresIn ?? "1h";
  return jwt.sign(
    {
      id: utilisateur.id,
      role: utilisateur.role,
      societeId: utilisateur.societeId ?? null,
    },
    secret,
    { expiresIn }
  );
}

function genererJwtExpire(utilisateur, options = {}) {
  const secret = options.secret || JWT_SECRET_TEST;
  return jwt.sign(
    {
      id: utilisateur.id,
      role: utilisateur.role,
      societeId: utilisateur.societeId ?? null,
      exp: Math.floor(Date.now() / 1000) - 60,
    },
    secret
  );
}

function enteteAuthorization(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = {
  JWT_SECRET_TEST,
  installerSecretJwtTest,
  genererJwtDeTest,
  genererJwtExpire,
  enteteAuthorization,
};
