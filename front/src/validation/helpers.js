import { z } from "zod";

/** Convertit "" / null / undefined en undefined (champs optionnels). */
export function emptyToUndef(v) {
  if (v === "" || v === null || v === undefined) return undefined;
  return v;
}

/** Nombre optionnel >= 0 (accepte string depuis input). */
export const optionalNonNeg = z.preprocess(
  emptyToUndef,
  z.coerce.number({ invalid_type_error: "Nombre invalide" }).min(0, "Doit être ≥ 0").optional()
);

/** Nombre requis > 0. */
export const requiredPositive = z.preprocess(
  emptyToUndef,
  z.coerce.number({ invalid_type_error: "Nombre invalide" }).gt(0, "Doit être > 0")
);

/** Nombre requis >= 0. */
export const requiredNonNeg = z.preprocess(
  emptyToUndef,
  z.coerce.number({ invalid_type_error: "Nombre invalide" }).min(0, "Doit être ≥ 0")
);

/** ID relation (int >= 1), accepte string. */
export const requiredId = (message = "Sélection requise") =>
  z.preprocess(
    emptyToUndef,
    z.coerce
      .number({ invalid_type_error: message, required_error: message })
      .int()
      .min(1, message)
  );

/** ID optionnel. */
export const optionalId = z.preprocess(
  emptyToUndef,
  z.coerce.number().int().min(1).optional()
);

/** Email optionnel : vide OK, sinon format valide. */
export const optionalEmail = z.preprocess(
  emptyToUndef,
  z.string().email("Email invalide").optional()
);

/** Remise 0–100. */
export const remisePct = z.preprocess(
  emptyToUndef,
  z.coerce.number({ invalid_type_error: "Remise invalide" }).min(0, "Remise ≥ 0").max(100, "Remise ≤ 100")
);

/** Vérifie que endKey >= startKey (dates ISO ou Date). */
export function dateAfterOrEqual(startKey, endKey, message) {
  return (schema) =>
    schema.superRefine((data, ctx) => {
      const start = data[startKey];
      const end = data[endKey];
      if (start && end && new Date(end) < new Date(start)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [endKey] });
      }
    });
}

export const UNITES_ENTIERES = ["PIECE", "PC", "UNITE", "U"];

export function quantiteValideePourUnite(quantite, unite) {
  if (!unite) return true;
  const u = String(unite).toUpperCase();
  if (UNITES_ENTIERES.includes(u) && !Number.isInteger(Number(quantite))) return false;
  return true;
}

/**
 * Mappe les erreurs API 422 `{ field, message }` (ou format express-validator)
 * vers un objet `{ [field]: message }` pour le hook front.
 */
export function mapApiErrors(apiErrors) {
  const out = {};
  if (!Array.isArray(apiErrors)) return out;
  for (const e of apiErrors) {
    const field = e.field || e.path || e.param;
    const msg = e.message || e.msg;
    if (field != null && msg && out[field] == null) {
      out[String(field)] = msg;
    }
  }
  return out;
}

/** Aplatit les issues Zod en `{ "a.b": message }`. */
export function flattenZodIssues(issues) {
  const out = {};
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    if (out[key] == null) out[key] = issue.message;
  }
  return out;
}
