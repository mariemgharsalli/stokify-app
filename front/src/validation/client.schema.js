import { z } from "zod";
import { emptyToUndef, optionalEmail } from "./helpers";

const PHONE_REGEX = /^[+]?[0-9\s().-]{6,20}$/;
const telephoneOptionnel = z.preprocess(
  emptyToUndef,
  z.string().regex(PHONE_REGEX, "Numéro de téléphone invalide").optional()
);
const tauxRemiseSchema = z.preprocess(
  emptyToUndef,
  z.coerce.number({ invalid_type_error: "Remise invalide" }).min(0, "Remise ≥ 0").max(100, "Remise ≤ 100").optional()
);
const montantPositifSchema = z.preprocess(
  emptyToUndef,
  z.coerce.number({ invalid_type_error: "Montant invalide" }).min(0, "Doit être ≥ 0").optional()
);

function withCoordsPaired(schema) {
  return schema.superRefine((data, ctx) => {
    const hasLat = data.latitude != null;
    const hasLng = data.longitude != null;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Renseignez latitude ET longitude, ou aucune des deux",
        path: [hasLat ? "longitude" : "latitude"],
      });
    }
  });
}

export const clientSchema = withCoordsPaired(
  z.object({
    code: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1, "Code requis").optional()),
    nom: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string({ required_error: "Nom / raison sociale requis" }).min(1, "Nom / raison sociale requis")),
    email: optionalEmail,
    telephone: telephoneOptionnel,
    contact: z.preprocess(emptyToUndef, z.string().optional()),
    adresse: z.preprocess(emptyToUndef, z.string().optional()),
    ville: z.preprocess(emptyToUndef, z.string().optional()),
    pays: z.preprocess(emptyToUndef, z.string().optional()),
    plafondCredit: montantPositifSchema,
    tauxRemise: tauxRemiseSchema,
    modePaiement: z.preprocess(emptyToUndef, z.string().optional()),
    latitude: z.preprocess(emptyToUndef, z.coerce.number().min(-90).max(90).optional()),
    longitude: z.preprocess(emptyToUndef, z.coerce.number().min(-180).max(180).optional()),
  })
);

export const fournisseurSchema = withCoordsPaired(
  z.object({
    code: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1, "Code requis").optional()),
    nom: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string({ required_error: "Nom / raison sociale requis" }).min(1, "Nom / raison sociale requis")),
    email: optionalEmail,
    telephone: telephoneOptionnel,
    contact: z.preprocess(emptyToUndef, z.string().optional()),
    adresse: z.preprocess(emptyToUndef, z.string().optional()),
    ville: z.preprocess(emptyToUndef, z.string().optional()),
    pays: z.preprocess(emptyToUndef, z.string().optional()),
    tauxRemise: tauxRemiseSchema,
    delaiPaiement: z.preprocess(emptyToUndef, z.coerce.number().int().min(0, "Doit être ≥ 0").max(365, "Doit être ≤ 365 jours").optional()),
    noteCredit: montantPositifSchema,
    latitude: z.preprocess(emptyToUndef, z.coerce.number().min(-90).max(90).optional()),
    longitude: z.preprocess(emptyToUndef, z.coerce.number().min(-180).max(180).optional()),
  })
);
