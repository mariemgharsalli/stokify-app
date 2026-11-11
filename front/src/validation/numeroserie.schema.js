import { z } from "zod";
import { emptyToUndef, requiredId } from "./helpers";

export const numeroSerieSchema = z.object({
  numero: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
    z.string({ required_error: "Numéro de série requis" }).min(1, "Numéro de série requis")
  ),
  articleId: requiredId("Article requis"),
  depotId: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).optional()),
});
