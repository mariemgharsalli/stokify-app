import { z } from "zod";
import { emptyToUndef, requiredId } from "./helpers";

/** Formulaire famille avec champ `nom` (UI refs). */
export const familleNomSchema = z.object({
  nom: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ required_error: "Libellé requis" })
      .min(2, "Nom : min. 2 caractères")
      .max(60, "Nom : max. 60 caractères")
  ),
});

export const familleSchema = familleNomSchema;

export const sousFamilleSchema = z.object({
  familleId: requiredId(),
  nom: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ required_error: "Libellé requis" })
      .min(2, "Nom : min. 2 caractères")
      .max(60, "Nom : max. 60 caractères")
  ),
});

export const marqueSchema = z.object({
  nom: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ required_error: "Libellé requis" })
      .min(2, "Nom : min. 2 caractères")
      .max(60, "Nom : max. 60 caractères")
  ),
  libelle: z.preprocess(emptyToUndef, z.string().optional()),
});
