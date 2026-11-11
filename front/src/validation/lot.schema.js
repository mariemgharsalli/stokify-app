import { z } from "zod";
import { emptyToUndef, requiredId, requiredPositive } from "./helpers";

export const lotSchema = z
  .object({
    numero: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string({ required_error: "Numéro de lot requis" }).min(1, "Numéro de lot requis")
    ),
    articleId: requiredId(),
    depotId: requiredId(),
    emplacementId: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).optional()),
    quantiteInitiale: requiredPositive,
    dateFabrication: z.preprocess(emptyToUndef, z.string().optional()),
    dateExpiration: z.preprocess(emptyToUndef, z.string().optional()),
    statut: z.preprocess(emptyToUndef, z.string().optional()),
  })
  .superRefine((data, ctx) => {
    if (data.dateFabrication && data.dateExpiration) {
      const fab = new Date(data.dateFabrication);
      const exp = new Date(data.dateExpiration);
      if (!Number.isNaN(fab.getTime()) && !Number.isNaN(exp.getTime()) && exp <= fab) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La date d'expiration doit être postérieure à la fabrication",
          path: ["dateExpiration"],
        });
      }
    }
  });
