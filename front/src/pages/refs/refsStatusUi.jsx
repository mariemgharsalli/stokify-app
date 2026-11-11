/** Badge et libellés statut référentiels (ACTIF | INACTIF). */

export function parseRefsStatut(row) {
  const raw = String(row?.statut ?? "ACTIF").trim().toUpperCase();
  return raw === "INACTIF" ? "INACTIF" : "ACTIF";
}

export const REFS_STATUT_FILTER_OPTIONS = [
  { value: "", label: "Tous", color: "#378ADD", activeBg: "rgba(55,138,221,0.18)" },
  { value: "ACTIF", label: "Actifs", color: "#1D9E75", activeBg: "rgba(29,158,117,0.18)" },
  { value: "INACTIF", label: "Inactifs", color: "#94a3b8", activeBg: "rgba(148,163,184,0.15)" },
];

export function refsStatutLabel(key) {
  return key === "INACTIF" ? "Inactif" : "Actif";
}

export function RefsStatutBadge({ row, className = "" }) {
  const statutKey = parseRefsStatut(row);
  const isActif = statutKey === "ACTIF";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${className}`}
      style={{
        background: isActif ? "rgba(29,158,117,0.12)" : "var(--color-background-secondary, var(--bg-app))",
        borderColor: isActif ? "rgba(29,158,117,0.25)" : "var(--color-border-tertiary, var(--border-default))",
        color: isActif ? "#1D9E75" : "var(--color-text-tertiary, var(--text-muted))",
      }}
    >
      {refsStatutLabel(statutKey)}
    </span>
  );
}

export function canDeleteMarquePermanent(marque) {
  if (parseRefsStatut(marque) !== "INACTIF") return false;
  const count = marque._count?.articles ?? marque.articleCount ?? 0;
  return Number(count) === 0;
}

export function canDeleteFamillePermanent(famille) {
  if (parseRefsStatut(famille) !== "INACTIF") return false;
  const count = famille._count?.articles ?? famille.articleCount ?? 0;
  return Number(count) === 0;
}

export function canDeleteSousFamillePermanent(sf) {
  if (parseRefsStatut(sf) !== "INACTIF") return false;
  const count = sf._count?.articles ?? sf.articleCount ?? 0;
  return Number(count) === 0;
}

/** Options de sélection : ACTIF + valeur déjà sélectionnée si inactive. */
export function refsSelectOptions(list, selectedId) {
  const arr = Array.isArray(list) ? list : [];
  const sid = selectedId != null && selectedId !== "" ? String(selectedId) : null;
  return arr.filter(
    (item) => parseRefsStatut(item) === "ACTIF" || (sid && String(item.id) === sid)
  );
}
