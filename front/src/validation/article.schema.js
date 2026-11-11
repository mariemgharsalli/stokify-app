import { z } from "zod";
import { emptyToUndef, optionalNonNeg, requiredId } from "./helpers";

const optionalRelationId = (message) =>
  z.preprocess(
    emptyToUndef,
    z.coerce.number({ invalid_type_error: message }).int().min(1, message).optional()
  );

const modeTracageField = z.enum(["AUCUN", "LOT", "SERIE", "LOT_SERIE"]).default("AUCUN");
const tracageAutoField = z.boolean().default(false);
const strategieSortieField = z.enum(["FIFO", "FEFO", "STANDARD"]).default("FIFO");

function refineTracageStrategie(data, ctx) {
  if (data.modeTracage && data.modeTracage !== "AUCUN") {
    if (data.strategieSortie === "STANDARD") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choisissez FIFO ou FEFO lorsque la traçabilité lot/série est activée",
        path: ["strategieSortie"],
      });
    }
  }
}

export const articleSchema = z
  .object({
    code: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string({ required_error: "Code requis" }).min(1, "Code requis")
    ),
    libelle: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string({ required_error: "Libellé requis" }).min(2, "Libellé : min. 2 caractères")
    ),
    familleId: optionalRelationId("Famille requise"),
    sousFamilleId: optionalRelationId("Sous-famille requise"),
    fournisseurId: optionalRelationId("Fournisseur requis"),
    depotId: optionalRelationId("Dépôt requis"),
    emplacementId: optionalRelationId("Emplacement requis"),
    poids: optionalNonNeg,
    volume: optionalNonNeg,
    prixAchat: optionalNonNeg,
    prixVente: optionalNonNeg,
    stockMin: optionalNonNeg,
    stockMax: optionalNonNeg,
    tauxTva: z.preprocess(
      emptyToUndef,
      z.coerce.number({ invalid_type_error: "Taux de TVA invalide" }).min(0).max(100).optional()
    ),
    modeTracage: modeTracageField.optional(),
    tracageAuto: tracageAutoField.optional(),
    strategieSortie: strategieSortieField.optional(),
  })
  .superRefine((data, ctx) => {
    const min = data.stockMin;
    const max = data.stockMax;
    if (min != null && max != null && min > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Stock min doit être ≤ stock max",
        path: ["stockMin"],
      });
    }
    refineTracageStrategie(data, ctx);
  });

/** Schéma création stricte (relations requises). */
export const articleCreateSchema = z
  .object({
    code: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string({ required_error: "Code requis" }).min(1, "Code requis")
    ),
    libelle: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string({ required_error: "Libellé requis" }).min(2, "Libellé : min. 2 caractères")
    ),
    familleId: requiredId("Famille requise"),
    sousFamilleId: requiredId("Sous-famille requise"),
    fournisseurId: requiredId("Fournisseur requis"),
    depotId: requiredId("Dépôt requis"),
    emplacementId: requiredId("Emplacement requis"),
    poids: optionalNonNeg,
    volume: optionalNonNeg,
    prixAchat: optionalNonNeg,
    prixVente: optionalNonNeg,
    stockMin: optionalNonNeg,
    stockMax: optionalNonNeg,
    tauxTva: z.preprocess(
      emptyToUndef,
      z.coerce.number({ invalid_type_error: "Taux de TVA invalide" }).min(0).max(100).optional()
    ),
    modeTracage: modeTracageField.optional(),
    tracageAuto: tracageAutoField.optional(),
    strategieSortie: strategieSortieField.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.stockMin != null && data.stockMax != null && data.stockMin > data.stockMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Stock min doit être ≤ stock max",
        path: ["stockMin"],
      });
    }
    refineTracageStrategie(data, ctx);
  });
