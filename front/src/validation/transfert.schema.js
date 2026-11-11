import { z } from "zod";
import { emptyToUndef, requiredId, requiredPositive } from "./helpers";

/** Transfert inter-dépôts. */
export const transfertSchema = z.object({
  depotDestId: requiredId(),
  emplacementDestId: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).optional()),
  quantite: requiredPositive,
  commentaire: z.preprocess(emptyToUndef, z.string().optional()),
});

/** Transfert entre emplacements. */
export const transferEmplacementSchema = z.object({
  articleId: requiredId(),
  depotOrigineId: requiredId(),
  emplacementOrigineId: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).optional()),
  depotDestId: requiredId(),
  emplacementDestId: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).optional()),
  quantite: requiredPositive,
  commentaire: z.preprocess(emptyToUndef, z.string().optional()),
});

/** Réception d'une ligne d'achat. */
export const receptionLigneSchema = z.object({
  quantiteRecue: requiredPositive,
  numeroLot: z.preprocess(emptyToUndef, z.string().optional()),
  dateExpiration: z.preprocess(emptyToUndef, z.string().optional()),
  numerosSerie: z.array(z.string()).optional(),
});

/** Rattachement contact client. */
export const rattacherContactSchema = z.object({
  utilisateurId: requiredId(),
});
