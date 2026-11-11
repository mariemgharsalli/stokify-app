import { useCallback, useMemo, useState } from "react";
import { flattenZodIssues, mapApiErrors } from "../validation/helpers";

/**
 * Validation de formulaire basée sur un schéma Zod.
 *
 * @param {import("zod").ZodTypeAny} schema
 * @param {Record<string, unknown>} values — valeurs actuelles du formulaire
 * @returns {{
 *   errors: Record<string, string>,
 *   validate: () => boolean,
 *   validateField: (name: string) => boolean,
 *   isValid: boolean,
 *   setErrors: (e: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void,
 *   clearError: (name: string) => void,
 *   clearErrors: () => void,
 *   applyApiErrors: (payload: unknown) => Record<string, string>,
 * }}
 */
export function useFormValidation(schema, values) {
  const [errors, setErrors] = useState({});

  const isValid = useMemo(() => {
    if (!schema) return true;
    return schema.safeParse(values).success;
  }, [schema, values]);

  const validate = useCallback(() => {
    if (!schema) {
      setErrors({});
      return true;
    }
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return true;
    }
    setErrors(flattenZodIssues(result.error.issues));
    return false;
  }, [schema, values]);

  const validateField = useCallback(
    (name) => {
      if (!schema || !name) return true;
      const result = schema.safeParse(values);
      if (result.success) {
        setErrors((prev) => {
          if (prev[name] == null) return prev;
          const next = { ...prev };
          delete next[name];
          // Clear nested keys for this field (e.g. lignes.0.quantite)
          for (const k of Object.keys(next)) {
            if (k === name || k.startsWith(`${name}.`)) delete next[k];
          }
          return next;
        });
        return true;
      }
      const flat = flattenZodIssues(result.error.issues);
      const fieldMsg =
        flat[name] ||
        Object.entries(flat).find(([k]) => k === name || k.startsWith(`${name}.`))?.[1];

      setErrors((prev) => {
        const next = { ...prev };
        // Remove previous errors for this field path
        for (const k of Object.keys(next)) {
          if (k === name || k.startsWith(`${name}.`)) delete next[k];
        }
        if (fieldMsg) {
          next[name] = fieldMsg;
        }
        return next;
      });
      return !fieldMsg;
    },
    [schema, values]
  );

  const clearError = useCallback((name) => {
    setErrors((prev) => {
      if (prev[name] == null) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const clearErrors = useCallback(() => setErrors({}), []);

  /** Mappe une réponse API 422 `{ errors:[{field,message}] }` vers les erreurs de champs. */
  const applyApiErrors = useCallback((payload) => {
    const list = Array.isArray(payload)
      ? payload
      : payload?.errors || payload?.response?.data?.errors || [];
    const mapped = mapApiErrors(list);
    if (Object.keys(mapped).length) {
      setErrors((prev) => ({ ...prev, ...mapped }));
    }
    return mapped;
  }, []);

  return {
    errors,
    validate,
    validateField,
    isValid,
    setErrors,
    clearError,
    clearErrors,
    applyApiErrors,
  };
}

export default useFormValidation;
