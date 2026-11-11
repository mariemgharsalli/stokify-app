import { z } from "zod";
import { dateAfterOrEqual, emptyToUndef, requiredId } from "./helpers";

const COUT_CATEGORIES = ["STOCKAGE", "LOGISTIQUE", "MANUTENTION", "AUTRE"];

function normalizeDecimalInput(v) {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "string") return v.trim().replace(/\s/g, "").replace(",", ".");
  return v;
}

const montantPositif = z.preprocess(
  normalizeDecimalInput,
  z.coerce
    .number({ invalid_type_error: "Montant invalide", required_error: "Le montant est requis" })
    .gt(0, "Le montant doit être supérieur à 0")
    .max(999_999_999.999, "Montant trop élevé")
);

export const coutEntrySchema = z.object({
  nom: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ required_error: "Le nom est requis" })
      .min(2, "Le nom doit contenir au moins 2 caractères")
      .max(120, "120 caractères maximum")
  ),
  description: z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      return typeof v === "string" ? v.trim() : v;
    },
    z.string().max(500, "500 caractères maximum").optional()
  ),
  montant: montantPositif,
  categorie: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.enum(COUT_CATEGORIES).nullable().optional()
  ),
  recurrent: z.boolean().optional(),
});

const coutStockageBase = z.object({
  articleId: requiredId("Sélectionnez un article"),
  depotId: requiredId("Sélectionnez un dépôt"),
  coutUnitaire: montantPositif,
  devise: z.preprocess(
    emptyToUndef,
    z.string().min(1, "Devise requise").default("TND")
  ),
  periodeDebut: z.preprocess(
    emptyToUndef,
    z.string({ required_error: "La date de début est requise" }).min(1, "La date de début est requise")
  ),
  periodeFin: z.preprocess(emptyToUndef, z.string().optional()),
  commentaire: z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      return typeof v === "string" ? v.trim() : v;
    },
    z.string().max(500, "500 caractères maximum").optional()
  ),
});

export const coutStockageSchema = dateAfterOrEqual(
  "periodeDebut",
  "periodeFin",
  "La date de fin doit être postérieure ou égale à la date de début"
)(coutStockageBase);
