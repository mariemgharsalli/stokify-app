import { z } from "zod";
import { emptyToUndef, optionalEmail } from "./helpers";

export const utilisateurSchema = z
  .object({
    email: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string({ required_error: "Email requis" }).email("Email invalide")
    ),
    motDePasse: z
      .string({ required_error: "Mot de passe requis" })
      .min(8, "Mot de passe : min. 8 caractères"),
    motDePasseConfirmation: z.string().optional(),
    nom: z.preprocess(emptyToUndef, z.string().optional()),
    prenom: z.preprocess(emptyToUndef, z.string().optional()),
  })
  .superRefine((data, ctx) => {
    if (
      data.motDePasseConfirmation != null &&
      data.motDePasseConfirmation !== "" &&
      data.motDePasseConfirmation !== data.motDePasse
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La confirmation ne correspond pas",
        path: ["motDePasseConfirmation"],
      });
    }
  });

export const loginSchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string({ required_error: "Email requis" }).email("Email invalide")
  ),
  motDePasse: z.string({ required_error: "Mot de passe requis" }).min(1, "Mot de passe requis"),
});

export const registerSchema = z
  .object({
    nom: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string({ required_error: "Nom requis" }).min(2, "Nom : min. 2 caractères")
    ),
    prenom: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string({ required_error: "Prénom requis" }).min(2, "Prénom : min. 2 caractères")
    ),
    email: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string({ required_error: "Email requis" }).email("Email invalide")
    ),
    motDePasse: z.string({ required_error: "Mot de passe requis" }).min(8, "Mot de passe : min. 8 caractères"),
    motDePasseConfirmation: z.string({ required_error: "Confirmation requise" }),
    role: z.preprocess(emptyToUndef, z.string().optional()),
    societeCode: z.preprocess(emptyToUndef, z.string().optional()),
  })
  .superRefine((data, ctx) => {
    if (data.motDePasseConfirmation !== data.motDePasse) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La confirmation ne correspond pas",
        path: ["motDePasseConfirmation"],
      });
    }
  });

export const changePasswordSchema = z
  .object({
    ancienMotDePasse: z.string().min(1, "Ancien mot de passe requis"),
    nouveauMotDePasse: z.string().min(8, "Mot de passe : min. 8 caractères"),
    confirmation: z.string().min(1, "Confirmation requise"),
  })
  .superRefine((data, ctx) => {
    if (data.confirmation !== data.nouveauMotDePasse) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La confirmation ne correspond pas",
        path: ["confirmation"],
      });
    }
  });

export { optionalEmail };
