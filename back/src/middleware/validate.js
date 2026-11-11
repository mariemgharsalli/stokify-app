const { validationResult } = require("express-validator");

/**
 * Middleware générique de validation express-validator.
 * Répond 422 avec { success: false, errors: [{ field, message }] }
 * — format aligné sur le mapping front (mapApiErrors).
 */
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array({ onlyFirstError: true }).map((e) => ({
    field: e.path || e.param || e.location || "_form",
    message: e.msg,
  }));

  return res.status(422).json({
    success: false,
    message: errors[0]?.message || "Données invalides",
    errors,
  });
}

module.exports = { validate };
