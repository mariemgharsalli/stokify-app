import { z } from "zod";
import { emptyToUndef, optionalEmail } from "./helpers";

export const societeSchema = z.object({
  nom: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ required_error: "Nom requis" })
      .min(2, "Nom : min. 2 caractères")
      .max(80, "Nom : max. 80 caractères")
  ),
  code: z.preprocess(emptyToUndef, z.string().optional()),
  email: optionalEmail,
  adresse: z.preprocess(emptyToUndef, z.string().optional()),
  ville: z.preprocess(emptyToUndef, z.string().optional()),
  telephone: z.preprocess(emptyToUndef, z.string().optional()),
});
