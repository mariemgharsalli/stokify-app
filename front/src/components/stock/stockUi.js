export const STATUT_CONFIG = {
  ACTIF: { label: "Actif", color: "#1D9E75", bg: "rgba(29,158,117,0.1)", border: "rgba(29,158,117,0.25)" },
  ARCHIVE: { label: "Archivé", color: "#EF9F27", bg: "rgba(239,159,39,0.1)", border: "rgba(239,159,39,0.25)" },
  BLOQUE: { label: "Bloqué", color: "#E24B4A", bg: "rgba(226,75,74,0.1)", border: "rgba(226,75,74,0.25)" },
};

export const MODE_GESTION_CONFIG = {
  FEFO: { color: "#D4537E", bg: "rgba(212,83,126,0.1)", border: "rgba(212,83,126,0.25)" },
  FIFO: { color: "#378ADD", bg: "rgba(55,138,221,0.1)", border: "rgba(55,138,221,0.25)" },
  STANDARD: { color: "#888780", bg: "rgba(136,135,128,0.1)", border: "rgba(136,135,128,0.2)" },
};

export function parseLineStatut(row) {
  const raw = String(row?.statut ?? "ACTIF").trim().toUpperCase();
  if (raw === "ARCHIVE") return "ARCHIVE";
  if (raw === "BLOQUE") return "BLOQUE";
  return "ACTIF";
}

export function fmtMoney(n) {
  return Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
