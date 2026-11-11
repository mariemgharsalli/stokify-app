import {
  IconAlertCircle,
  IconCash,
  IconCheck,
  IconClock,
  IconFileText,
  IconPencil,
  IconTruck,
  IconX,
} from "@tabler/icons-react";

export const STATUTS_ACHAT = {
  BROUILLON: {
    label: "Brouillon",
    bg: "rgba(186,117,23,0.12)",
    border: "rgba(186,117,23,0.4)",
    color: "var(--commerce-warning, #BA7517)",
    Icon: IconPencil,
    description: "En cours de saisie — pas encore confirmé",
    pulse: true,
  },
  CONFIRME: {
    label: "Confirmé",
    bg: "rgba(29,158,117,0.12)",
    border: "rgba(29,158,117,0.4)",
    color: "var(--commerce-success, #1D9E75)",
    Icon: IconCheck,
    description: "Commande confirmée — stock et lots créés",
  },
  COMMANDE: {
    label: "Confirmé",
    bg: "rgba(29,158,117,0.12)",
    border: "rgba(29,158,117,0.4)",
    color: "var(--commerce-success, #1D9E75)",
    Icon: IconCheck,
    description: "Commande confirmée — stock et lots créés",
  },
  RECU: {
    label: "Confirmé",
    bg: "rgba(29,158,117,0.12)",
    border: "rgba(29,158,117,0.4)",
    color: "var(--commerce-success, #1D9E75)",
    Icon: IconCheck,
    description: "Commande confirmée — stock et lots créés",
  },
  RECEPTIONNE: {
    label: "Confirmé",
    bg: "rgba(29,158,117,0.12)",
    border: "rgba(29,158,117,0.4)",
    color: "var(--commerce-success, #1D9E75)",
    Icon: IconCheck,
    description: "Commande confirmée — stock et lots créés",
  },
};

export const STATUTS_VENTE = {
  BROUILLON: {
    label: "Brouillon",
    bg: "rgba(186,117,23,0.12)",
    border: "rgba(186,117,23,0.4)",
    color: "var(--commerce-warning, #BA7517)",
    Icon: IconPencil,
    description: "Devis en préparation — le stock n'est pas réservé",
    pulse: true,
  },
  CONFIRME: {
    label: "Confirmé",
    bg: "rgba(29,158,117,0.12)",
    border: "rgba(29,158,117,0.4)",
    color: "var(--commerce-success, #1D9E75)",
    Icon: IconCheck,
    description: "Vente confirmée — stock sorti, facture émise",
  },
  VALIDE: {
    label: "Confirmé",
    bg: "rgba(29,158,117,0.12)",
    border: "rgba(29,158,117,0.4)",
    color: "var(--commerce-success, #1D9E75)",
    Icon: IconCheck,
    description: "Vente confirmée — stock sorti",
  },
  LIVRE: {
    label: "Confirmé",
    bg: "rgba(29,158,117,0.12)",
    border: "rgba(29,158,117,0.4)",
    color: "var(--commerce-success, #1D9E75)",
    Icon: IconCheck,
    description: "Vente confirmée",
  },
  EN_ATTENTE: {
    label: "Brouillon",
    bg: "rgba(186,117,23,0.12)",
    border: "rgba(186,117,23,0.4)",
    color: "var(--commerce-warning, #BA7517)",
    Icon: IconPencil,
    description: "En attente (legacy)",
    pulse: true,
  },
  ANNULE: {
    label: "Annulé",
    bg: "rgba(100,116,139,0.12)",
    border: "rgba(226,75,74,0.4)",
    color: "#E24B4A",
    Icon: IconX,
    description: "Vente annulée",
  },
  ANNULEE: {
    label: "Annulée",
    bg: "rgba(100,116,139,0.14)",
    border: "rgba(148,163,184,0.45)",
    color: "#94a3b8",
    Icon: IconX,
    description: "Vente entièrement annulée par avoir(s) — exclue du chiffre d'affaires",
  },
  RETOUR: {
    label: "Avoir",
    bg: "rgba(250,238,218,0.9)",
    border: "rgba(186,117,23,0.4)",
    color: "#BA7517",
    Icon: IconFileText,
    description: "Avoir client",
  },
};

export const PAIEMENT_STATUTS = {
  NON_REGLE: {
    label: "Non réglé",
    bg: "color-mix(in srgb, var(--accent-danger) 12%, transparent)",
    border: "color-mix(in srgb, var(--accent-danger) 40%, transparent)",
    color: "var(--accent-danger)",
    Icon: IconAlertCircle,
  },
  PARTIEL: {
    label: "Partiellement réglé",
    bg: "color-mix(in srgb, var(--accent-warning) 12%, transparent)",
    border: "color-mix(in srgb, var(--accent-warning) 40%, transparent)",
    color: "var(--accent-warning)",
    Icon: IconCash,
  },
  REGLE: {
    label: "Réglé",
    bg: "color-mix(in srgb, var(--accent-success) 12%, transparent)",
    border: "color-mix(in srgb, var(--accent-success) 40%, transparent)",
    color: "var(--accent-success)",
    Icon: IconCheck,
  },
  EN_RETARD: {
    label: "En retard",
    bg: "color-mix(in srgb, var(--accent-danger) 14%, transparent)",
    border: "color-mix(in srgb, var(--accent-danger) 45%, transparent)",
    color: "var(--accent-danger)",
    Icon: IconAlertCircle,
    pulse: true,
  },
};

export const WORKFLOW_ACHAT = [
  { key: "BROUILLON", label: "Brouillon" },
  { key: "CONFIRME", label: "Confirmé", match: ["CONFIRME", "COMMANDE", "RECU", "RECEPTIONNE"] },
];

export const WORKFLOW_VENTE = [
  { key: "BROUILLON", label: "Brouillon" },
  { key: "CONFIRME", label: "Confirmé", match: ["CONFIRME", "VALIDE", "LIVRE"] },
];

export const STATUTS_STOCK = {
  ACTIF: {
    label: "Actif",
    bg: "rgba(29,158,117,0.12)",
    border: "rgba(29,158,117,0.4)",
    color: "#1D9E75",
  },
  ARCHIVE: {
    label: "Archivé",
    bg: "rgba(239,159,39,0.12)",
    border: "rgba(239,159,39,0.4)",
    color: "#EF9F27",
  },
  BLOQUE: {
    label: "Bloqué",
    bg: "rgba(226,75,74,0.12)",
    border: "rgba(226,75,74,0.4)",
    color: "#E24B4A",
  },
  RUPTURE: {
    label: "Rupture",
    bg: "rgba(226,75,74,0.12)",
    border: "rgba(226,75,74,0.4)",
    color: "#E24B4A",
  },
  CRITIQUE: {
    label: "Critique",
    bg: "rgba(239,159,39,0.12)",
    border: "rgba(239,159,39,0.4)",
    color: "#EF9F27",
  },
};

export const WORKFLOW_STOCK = [
  { key: "ACTIF", label: "Actif" },
  { key: "RUPTURE", label: "Ruptures" },
  { key: "CRITIQUE", label: "Critique" },
];

export const STATUTS_REGLEMENT = {
  ventes: {
    label: "Encaissements clients",
    bg: "rgba(29,158,117,0.12)",
    border: "rgba(29,158,117,0.4)",
    color: "#1D9E75",
  },
  achats: {
    label: "Paiements fournisseurs",
    bg: "rgba(55,138,221,0.12)",
    border: "rgba(55,138,221,0.4)",
    color: "#378ADD",
  },
};

export const WORKFLOW_REGLEMENT = [
  { key: "ventes", label: "Encaissements clients" },
  { key: "achats", label: "Paiements fournisseurs" },
];

export function normalizeStatutAchat(statut) {
  const s = String(statut || "BROUILLON").toUpperCase();
  if (["CONFIRME", "COMMANDE", "RECU", "RECEPTIONNE"].includes(s)) return "CONFIRME";
  return "BROUILLON";
}

export function isAchatConfirme(statut) {
  return normalizeStatutAchat(statut) === "CONFIRME";
}

export function isAchatEnRetard(achat) {
  if (!achat?.dateLivraisonPrevue || normalizeStatutAchat(achat.statut) !== "BROUILLON") return false;
  return new Date() > new Date(achat.dateLivraisonPrevue);
}

export function statutAchatColor(statut) {
  const key = normalizeStatutAchat(statut);
  const s = STATUTS_ACHAT[key] || STATUTS_ACHAT.BROUILLON;
  return s.color;
}

export function statutVenteColor(statut) {
  const raw = String(statut || "").toUpperCase();
  if (raw === "ANNULEE" || raw === "ANNULE") {
    return (STATUTS_VENTE.ANNULEE || STATUTS_VENTE.ANNULE).color;
  }
  const key = normalizeStatutVente(statut);
  const s = STATUTS_VENTE[key] || STATUTS_VENTE.BROUILLON;
  return s.color;
}

export function normalizeStatutVente(statut) {
  const s = String(statut || "BROUILLON").toUpperCase();
  if (["CONFIRME", "VALIDE", "LIVRE"].includes(s)) return "CONFIRME";
  if (s === "EN_ATTENTE") return "BROUILLON";
  if (s === "ANNULEE" || s === "ANNULE") return "ANNULEE";
  if (s === "RETOUR") return "RETOUR";
  return "BROUILLON";
}

export function isVenteConfirmee(statut) {
  return normalizeStatutVente(statut) === "CONFIRME";
}

export function statutStockColor(statut) {
  const s = STATUTS_STOCK[statut] || STATUTS_STOCK.ACTIF;
  return s.color;
}

export const STRATEGIE_COLORS = {
  FIFO: { bg: "rgba(55,138,221,0.12)", color: "#378ADD", label: "FIFO" },
  FEFO: { bg: "rgba(29,158,117,0.12)", color: "#1D9E75", label: "FEFO" },
  STANDARD: { bg: "rgba(136,135,128,0.12)", color: "#888780", label: "STANDARD" },
};
