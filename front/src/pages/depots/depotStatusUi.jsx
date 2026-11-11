/** Badge et libellés statut dépôt / emplacement (ACTIF | INACTIF). */

export function parseDepotStatut(row) {
  const raw = String(row?.statut ?? "ACTIF").trim().toUpperCase();
  return raw === "INACTIF" ? "INACTIF" : "ACTIF";
}

/** "" = Tous — filtre liste dépôts + emplacements imbriqués */
export function applyDepotStatutFilter(depots, statutFilter) {
  const f = String(statutFilter ?? "").trim().toUpperCase();
  if (!f || f === "ALL" || f === "TOUS") return depots;

  return depots
    .filter((d) => {
      const ds = parseDepotStatut(d);
      const emps = d.emplacements || [];
      if (f === "ACTIF") return ds === "ACTIF";
      if (f === "INACTIF") {
        return ds === "INACTIF" || emps.some((e) => parseDepotStatut(e) === "INACTIF");
      }
      return true;
    })
    .map((d) => ({
      ...d,
      emplacements: (d.emplacements || []).filter((e) => parseDepotStatut(e) === f),
    }));
}

export const DEPOT_STATUT_FILTER_OPTIONS = [
  { value: "", label: "Tous", color: "#378ADD", activeBg: "rgba(55,138,221,0.18)" },
  { value: "ACTIF", label: "Actifs", color: "#1D9E75", activeBg: "rgba(29,158,117,0.18)" },
  { value: "INACTIF", label: "Inactifs", color: "#94a3b8", activeBg: "rgba(148,163,184,0.15)" },
];

export function depotStatutLabel(key) {
  return key === "INACTIF" ? "Inactif" : "Actif";
}

export function DepotStatutBadge({ row, className = "" }) {
  const statutKey = parseDepotStatut(row);
  if (statutKey === "ACTIF") return null;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${className}`}
      style={{
        background: "var(--color-background-secondary, var(--bg-app))",
        borderColor: "var(--color-border-tertiary, var(--border-default))",
        color: "var(--color-text-tertiary, var(--text-muted))",
      }}
    >
      Inactif
    </span>
  );
}

export function canDeleteDepotPermanent(depot) {
  if (parseDepotStatut(depot) !== "INACTIF") return false;
  const emps = depot.emplacements || [];
  const stock = Number(depot.stockSummary?.stockTotal ?? 0);
  return emps.length === 0 && stock === 0;
}

export function canDeleteEmplacementPermanent(emp) {
  if (parseDepotStatut(emp) !== "INACTIF") return false;
  return Number(emp.stockActuel ?? 0) === 0;
}
