export const MODES_PAIEMENT_PREVU = [
  { value: "ESPECES", label: "Espèces", icon: "ti-cash", desc: "Paiement immédiat" },
  { value: "CHEQUE", label: "Chèque", icon: "ti-file-invoice", desc: "N° chèque requis" },
  { value: "VIREMENT", label: "Virement", icon: "ti-transfer", desc: "Référence bancaire" },
  { value: "CARTE", label: "Carte", icon: "ti-credit-card", desc: "TPE ou en ligne" },
  { value: "EFFET", label: "Effet", icon: "ti-receipt", desc: "Traite / lettre de change" },
  { value: "AUTRE", label: "Autre", icon: "ti-dots", desc: "Autre mode" },
];

export const MODES_PAIEMENT_REGLEMENT = [
  { value: "ESPECES", label: "Espèces", icon: "ti-cash" },
  { value: "CHEQUE", label: "Chèque", icon: "ti-file-invoice" },
  { value: "VIREMENT", label: "Virement", icon: "ti-transfer" },
  { value: "CARTE", label: "Carte", icon: "ti-credit-card" },
  { value: "EFFET", label: "Effet", icon: "ti-receipt" },
  { value: "AUTRE", label: "Autre", icon: "ti-dots" },
];

export const MODES_PAIEMENT_LABEL = {
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  VIREMENT: "Virement",
  CARTE: "Carte",
  EFFET: "Effet",
  AUTRE: "Autre",
  TRAITE: "Traite",
  CREDIT: "Crédit",
};

export const CONDITIONS_PAIEMENT_ACHAT = [
  { value: "", label: "Sélectionner" },
  { value: "IMMEDIAT", label: "Paiement immédiat" },
  { value: "30J", label: "À 30 jours" },
  { value: "60J", label: "À 60 jours" },
  { value: "90J", label: "À 90 jours" },
  { value: "AVANCE", label: "Paiement d'avance" },
  { value: "ECHEANCE", label: "Selon échéancier" },
];
