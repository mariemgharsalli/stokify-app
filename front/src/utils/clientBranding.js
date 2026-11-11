import defaultClientLogo from "../assets/logi-nord-logo.svg";
import { buildLogoUrl } from "./logoUrl";

/** Marque fictive utilisée lorsqu'aucune identité client n'est configurée. */
export const DEFAULT_CLIENT_BRAND = {
  nom: "LogiNord Distribution",
  code: "LOGINORD",
  tagline: "Solutions logistiques intégrées",
  adresse: "Zone Industrielle Poudrière",
  ville: "Sfax",
  email: "contact@loginord.tn",
  telephones: "+216 74 000 000",
  logo: defaultClientLogo,
  accentRgb: [27, 58, 92],
  accentHex: "#1B3A5C",
  accentSecondaryHex: "#2A9D8F",
  isDefault: true,
};

function pickSocieteRecord({ user, publicCompanies, activeSocieteId, societeScope }) {
  const sid =
    user?.role === "SUPER_ADMIN"
      ? activeSocieteId ?? societeScope
      : user?.societeId ?? societeScope;

  if (sid == null) return null;

  return (
    publicCompanies?.find((c) => Number(c.id) === Number(sid)) ||
    (user?.societe?.code
      ? publicCompanies?.find(
          (c) => String(c.code).toLowerCase() === String(user.societe.code).toLowerCase()
        )
      : null) ||
    user?.societe ||
    null
  );
}

/**
 * Résout l'identité visuelle du client (société propriétaire du dépôt).
 * Utilise le logo et le nom de la société active. Fallback LogiNord seulement hors tenant.
 */
export function resolveClientBranding({
  user,
  publicCompanies = [],
  activeSocieteId,
  societeScope,
} = {}) {
  const record = pickSocieteRecord({ user, publicCompanies, activeSocieteId, societeScope });
  const societeExtra = user?.societe || {};
  const logoPath = String(record?.logo || societeExtra.logo || "").trim();
  const hasLogo = Boolean(logoPath);
  const hasIdentity = Boolean(
    record?.nom || record?.code || societeExtra.nom || societeExtra.code || user?.societeNom
  );

  if (!hasIdentity && !hasLogo) {
    return {
      ...DEFAULT_CLIENT_BRAND,
      logoUrl: buildLogoUrl(DEFAULT_CLIENT_BRAND.logo) || DEFAULT_CLIENT_BRAND.logo,
    };
  }

  const nom =
    record?.nom || societeExtra.nom || user?.societeNom || DEFAULT_CLIENT_BRAND.nom;

  return {
    nom,
    code: record?.code || societeExtra.code || DEFAULT_CLIENT_BRAND.code,
    tagline: societeExtra.tagline || record?.tagline || "",
    adresse: record?.adresse || societeExtra.adresse || "",
    ville: record?.ville || societeExtra.ville || "",
    email: record?.email || societeExtra.email || "",
    telephones: record?.telephones || societeExtra.telephones || "",
    logo: hasLogo ? logoPath : null,
    logoUrl: hasLogo ? buildLogoUrl(logoPath) || logoPath : null,
    accentRgb: DEFAULT_CLIENT_BRAND.accentRgb,
    accentHex: DEFAULT_CLIENT_BRAND.accentHex,
    accentSecondaryHex: DEFAULT_CLIENT_BRAND.accentSecondaryHex,
    isDefault: !hasIdentity,
  };
}

export function clientLocationLine(branding) {
  const parts = [branding?.adresse, branding?.ville].filter(Boolean);
  return parts.join(", ") || "—";
}

export function clientContactLine(branding) {
  const parts = [];
  if (branding?.email) parts.push(branding.email);
  if (branding?.telephones) parts.push(branding.telephones);
  return parts.join(" · ") || "";
}
