import { z } from "zod";
import { emptyToUndef, requiredId } from "./helpers";

export const inventaireConfigSchema = z.object({
  reference: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ required_error: "Code inventaire requis" })
      .min(1, "Code inventaire requis")
      .max(50, "Code : max. 50 caractères")
  ),
  date: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string({ required_error: "Date requise" }).min(1, "Date requise")
  ),
  depotId: requiredId("Dépôt requis"),
  typeInventaire: z
    .enum(["complet", "partiel", "tournant"], {
      errorMap: () => ({ message: "Type d'inventaire invalide" }),
    })
    .optional(),
  modeAveugle: z.preprocess(
    (v) => (v === "" || v == null ? false : Boolean(v)),
    z.boolean().optional()
  ),
  note: z.preprocess(emptyToUndef, z.string().max(500, "Notes : max. 500 caractères").optional()),
});

/** Alias aligné sur articleCreateSchema. */
export const inventaireCreateSchema = inventaireConfigSchema;
