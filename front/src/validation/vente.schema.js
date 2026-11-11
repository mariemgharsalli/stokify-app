import { z } from "zod";
import {
  dateAfterOrEqual,
  emptyToUndef,
  quantiteValideePourUnite,
  requiredId,
  requiredNonNeg,
  requiredPositive,
  remisePct,
} from "./helpers";

export const ligneVenteSchema = z.object({
  articleId: requiredId().or(
    z.object({ id: requiredId() }).transform((a) => a.id)
  ).or(
    z.any().refine((v) => v?.id != null || (typeof v === "number" && v >= 1) || (typeof v === "string" && v), {
      message: "Article requis",
    })
  ),
  quantite: requiredPositive,
  prixUnitHT: requiredNonNeg,
  remise: remisePct.default(0),
  tauxTVA: z.preprocess(emptyToUndef, z.coerce.number().min(0).max(100).optional()),
});

/** Schéma pour valider un objet ligne tel qu'il est dans le state UI. */
export const ligneCommerceUiSchema = z
  .object({
    article: z
      .any()
      .refine((a) => a != null && (a.id != null || a.code), { message: "Article requis" }),
    quantite: requiredPositive,
    prixUnitHT: requiredNonNeg,
    remise: remisePct.default(0),
  })
  .superRefine((data, ctx) => {
    if (!quantiteValideePourUnite(data.quantite, data.article?.unite)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quantité entière requise pour cette unité",
        path: ["quantite"],
      });
    }
  });

const venteSchemaBase = z.object({
  clientId: requiredId(),
  depotId: requiredId(),
  dateVente: z.preprocess(emptyToUndef, z.string().optional()),
  dateLivraison: z.preprocess(emptyToUndef, z.string().optional()),
  remiseGlobale: z.preprocess(emptyToUndef, z.coerce.number().min(0).max(100).optional()),
  modePaiement: z.preprocess(emptyToUndef, z.string().optional()),
  notes: z.preprocess(emptyToUndef, z.string().optional()),
  lignes: z
    .array(ligneCommerceUiSchema)
    .min(1, "Ajoutez au moins une ligne")
    .optional(),
});

export const venteSchema = dateAfterOrEqual(
  "dateVente",
  "dateLivraison",
  "La livraison ne peut pas précéder la date de vente"
)(venteSchemaBase);

export const venteStep1Schema = dateAfterOrEqual(
  "dateVente",
  "dateLivraison",
  "La livraison ne peut pas précéder la date de vente"
)(
  venteSchemaBase.pick({
    clientId: true,
    depotId: true,
    dateVente: true,
    dateLivraison: true,
  })
);

export const venteLignesSchema = z.object({
  lignes: z.array(ligneCommerceUiSchema).min(1, "Ajoutez au moins une ligne"),
});
