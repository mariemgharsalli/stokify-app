import { z } from "zod";
import { emptyToUndef, optionalNonNeg } from "./helpers";

export const depotSchema = z
  .object({
    code: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string({ required_error: "Code requis" }).min(1, "Code requis")
    ),
    libelle: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string({ required_error: "Libellé requis" }).min(1, "Libellé requis")
    ),
    ville: z.preprocess(emptyToUndef, z.string().optional()),
    adresse: z.preprocess(emptyToUndef, z.string().optional()),
    region: z.preprocess(emptyToUndef, z.string().optional()),
    capacite: optionalNonNeg,
    qteMin: optionalNonNeg,
    qteMax: optionalNonNeg,
    capaciteVolume: optionalNonNeg,
    capacitePoids: optionalNonNeg,
    latitude: z.preprocess(emptyToUndef, z.coerce.number().optional()),
    longitude: z.preprocess(emptyToUndef, z.coerce.number().optional()),
    storageRefrigere: z.boolean().optional(),
    storageChimique: z.boolean().optional(),
    storageInflammable: z.boolean().optional(),
    storageFragile: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.qteMin != null &&
      data.qteMax != null &&
      Number(data.qteMin) > Number(data.qteMax)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le seuil minimum ne peut pas dépasser le seuil maximum",
        path: ["qteMax"],
      });
    }

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

export const emplacementSchema = z.object({
  depotId: z.preprocess(
    emptyToUndef,
    z.coerce.number({ invalid_type_error: "Dépôt requis" }).int().min(1, "Dépôt requis")
  ),
  code: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string({ required_error: "Code requis" }).min(1, "Code requis")
  ),
  libelle: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string({ required_error: "Libellé requis" }).min(1, "Libellé requis")
  ),
  categorie: z.preprocess(emptyToUndef, z.string().optional()),
  barcode: z.preprocess(emptyToUndef, z.string().optional()),
  distanceQuai: optionalNonNeg,
  capaciteSlots: optionalNonNeg,
  niveaux: z.preprocess(emptyToUndef, z.coerce.number().int().min(0, "Doit être ≥ 0").optional()),
  zoneDangereuse: z.boolean().optional(),
  categorieAutorisee: z.preprocess(emptyToUndef, z.string().optional()),
});
