import { z } from "zod";
import { emptyToUndef, requiredPositive } from "./helpers";

export const reglementSchema = z.object({
  montant: requiredPositive,
  mode: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string({ required_error: "Mode de paiement requis" }).min(1, "Mode de paiement requis")
  ),
  datePayment: z.preprocess(emptyToUndef, z.string().optional()),
  reference: z.preprocess(emptyToUndef, z.string().optional()),
  commentaire: z.preprocess(emptyToUndef, z.string().optional()),
});
