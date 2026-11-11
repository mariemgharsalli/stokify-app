/** Configuration UI des modes de paiement (formulaires + modales règlement). */
export const MODES_CONFIG = {
  ESPECES: {
    label: "Espèces",
    icon: "ti-cash",
    color: "#1D9E75",
    bg: "rgba(29,158,117,0.1)",
    border: "rgba(29,158,117,0.3)",
    desc: "Paiement immédiat en cash",
    badge: "Réglé immédiatement",
    badgeBg: "rgba(29,158,117,0.12)",
    champsSup: [],
  },
  CHEQUE: {
    label: "Chèque",
    icon: "ti-file-invoice",
    color: "#EF9F27",
    bg: "rgba(239,159,39,0.1)",
    border: "rgba(239,159,39,0.3)",
    desc: "Chèque bancaire",
    badge: "En attente encaissement",
    badgeBg: "rgba(239,159,39,0.12)",
    champsSup: [
      { key: "numeroCheque", label: "Numéro de chèque *", type: "text", placeholder: "Ex: 0012345", required: true },
      { key: "banque", label: "Banque émettrice", type: "text", placeholder: "Ex: BNA, STB, BIAT", required: false },
      { key: "dateEcheance", label: "Date d'encaissement prévue", type: "date", placeholder: "", required: false },
    ],
  },
  VIREMENT: {
    label: "Virement",
    icon: "ti-transfer",
    color: "#378ADD",
    bg: "rgba(55,138,221,0.1)",
    border: "rgba(55,138,221,0.3)",
    desc: "Virement bancaire",
    badge: "Traçable par référence",
    badgeBg: "rgba(55,138,221,0.12)",
    champsSup: [
      { key: "referenceVirement", label: "Référence virement *", type: "text", placeholder: "Ex: VIR-2026-001", required: true },
      { key: "banque", label: "Banque", type: "text", placeholder: "Ex: BNA", required: false },
      { key: "dateValeur", label: "Date de valeur", type: "date", placeholder: "", required: false },
    ],
  },
  CARTE: {
    label: "Carte bancaire",
    icon: "ti-credit-card",
    color: "#7F77DD",
    bg: "rgba(127,119,221,0.1)",
    border: "rgba(127,119,221,0.3)",
    desc: "TPE ou paiement en ligne",
    badge: "Réglé immédiatement",
    badgeBg: "rgba(127,119,221,0.12)",
    champsSup: [
      { key: "referenceTransaction", label: "Référence transaction", type: "text", placeholder: "Ex: TXN-20260519", required: false },
    ],
  },
  EFFET: {
    label: "Effet de commerce",
    icon: "ti-receipt",
    color: "#D4537E",
    bg: "rgba(212,83,126,0.1)",
    border: "rgba(212,83,126,0.3)",
    desc: "Traite / lettre de change",
    badge: "Différé à l'échéance",
    badgeBg: "rgba(212,83,126,0.12)",
    champsSup: [
      { key: "referenceEffet", label: "Référence de l'effet *", type: "text", placeholder: "Ex: LDC-2026-001", required: true },
      { key: "dateEcheance", label: "Date d'échéance *", type: "date", placeholder: "", required: true },
      { key: "banque", label: "Banque domiciliataire", type: "text", placeholder: "Ex: BNA", required: false },
    ],
  },
  AUTRE: {
    label: "Autre",
    icon: "ti-dots",
    color: "#888780",
    bg: "rgba(136,135,128,0.1)",
    border: "rgba(136,135,128,0.3)",
    desc: "Compensation, avoir, etc.",
    badge: "À préciser",
    badgeBg: "rgba(136,135,128,0.12)",
    champsSup: [
      { key: "descriptionAutre", label: "Préciser le mode *", type: "text", placeholder: "Ex: Compensation, Avoir...", required: true },
    ],
  },
};

export function getModeConfig(mode) {
  const raw = MODES_CONFIG[mode] || MODES_CONFIG.ESPECES;
  return { ...raw, champs: raw.champs || raw.champsSup || [] };
}

/** Valide les champs obligatoires du mode ; retourne un message d'erreur ou null. */
export function validateModeChamps(mode, champsValues = {}) {
  const config = getModeConfig(mode);
  for (const champ of config.champs) {
    if (champ.required && !String(champsValues[champ.key] || "").trim()) {
      return `Champ requis : ${champ.label.replace(" *", "")}`;
    }
  }
  return null;
}

/** Payload API règlement (reglements/achats|ventes). */
export function buildReglementApiPayload({ montant, mode, datePayment, commentaire, champsSupValues = {} }) {
  const modeStr = mode || "ESPECES";
  let reference = null;
  if (modeStr === "CHEQUE") reference = champsSupValues.numeroCheque?.trim() || null;
  else if (modeStr === "VIREMENT") reference = champsSupValues.referenceVirement?.trim() || null;
  else if (modeStr === "EFFET") reference = champsSupValues.referenceEffet?.trim() || null;
  else if (modeStr === "CARTE") reference = champsSupValues.referenceTransaction?.trim() || null;

  return {
    montant: parseFloat(montant),
    mode: modeStr,
    datePayment,
    commentaire: commentaire?.trim() || null,
    reference,
    numeroCheque: champsSupValues.numeroCheque?.trim() || null,
    banque: champsSupValues.banque?.trim() || null,
    dateEcheance: champsSupValues.dateEcheance || null,
    referenceVirement: champsSupValues.referenceVirement?.trim() || null,
    dateValeur: champsSupValues.dateValeur || null,
    referenceTransaction: champsSupValues.referenceTransaction?.trim() || null,
    referenceEffet: champsSupValues.referenceEffet?.trim() || null,
    descriptionAutre: champsSupValues.descriptionAutre?.trim() || null,
  };
}

/** Libellés secondaires pour l'historique des règlements. */
export function getReglementDetailLines(r) {
  const parts = [];
  if (r.numeroCheque) parts.push(`N° ${r.numeroCheque}`);
  if (r.referenceVirement) parts.push(`Réf: ${r.referenceVirement}`);
  if (r.referenceEffet) parts.push(`Effet: ${r.referenceEffet}`);
  if (r.referenceTransaction) parts.push(`Txn: ${r.referenceTransaction}`);
  if (r.descriptionAutre) parts.push(r.descriptionAutre);
  if (!parts.length && r.reference) parts.push(`Réf: ${r.reference}`);
  return parts;
}
