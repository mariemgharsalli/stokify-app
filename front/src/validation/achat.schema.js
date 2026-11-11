import { z } from "zod";
import { dateAfterOrEqual, emptyToUndef, requiredId } from "./helpers";
import { ligneCommerceUiSchema } from "./vente.schema";

const achatSchemaBase = z.object({
  fournisseurId: requiredId(),
  depotId: requiredId(),
  dateCommande: z.preprocess(emptyToUndef, z.string().optional()),
  dateLivraisonPrevue: z.preprocess(emptyToUndef, z.string().optional()),
  modePaiement: z.preprocess(emptyToUndef, z.string().optional()),
  notes: z.preprocess(emptyToUndef, z.string().optional()),
  lignes: z
    .array(ligneCommerceUiSchema)
    .min(1, "Ajoutez au moins une ligne")
    .optional(),
});

export const achatSchema = dateAfterOrEqual(
  "dateCommande",
  "dateLivraisonPrevue",
  "La livraison prévue ne peut pas précéder la date d'achat"
)(achatSchemaBase);

export const achatStep1Schema = dateAfterOrEqual(
  "dateCommande",
  "dateLivraisonPrevue",
  "La livraison prévue ne peut pas précéder la date d'achat"
)(
  achatSchemaBase.pick({
    fournisseurId: true,
    depotId: true,
    dateCommande: true,
    dateLivraisonPrevue: true,
  })
);

export const achatLignesSchema = z.object({
  lignes: z.array(ligneCommerceUiSchema).min(1, "Ajoutez au moins une ligne"),
});

export { ligneCommerceUiSchema };
