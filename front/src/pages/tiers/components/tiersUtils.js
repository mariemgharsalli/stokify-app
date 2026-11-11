/** Utilitaires partagés — carnet d'adresses tiers */

/** Map filtre UI → query param API */
export function statutToApiParam(statutFilter) {
  if (statutFilter === "tous") return "tous";
  if (statutFilter === "inactifs") return "inactifs";
  return "actifs";
}

/** Messages liste vide selon filtre actif */
export function getTierEmptyMessage({ statutFilter, searchInput, entityLabel }) {
  if (searchInput) {
    return {
      title: `Aucun ${entityLabel} trouvé`,
      subtitle: `Aucun résultat pour « ${searchInput} »`,
    };
  }
  if (statutFilter === "inactifs") {
    return {
      title: `Aucun ${entityLabel} désactivé`,
      subtitle: `Tous vos ${entityLabel}s sont actifs. Désactivez-en un pour le voir ici.`,
    };
  }
  if (statutFilter === "actifs") {
    return {
      title: `Aucun ${entityLabel} actif`,
      subtitle: `Créez un ${entityLabel} ou consultez l'onglet « Tous ».`,
    };
  }
  return {
    title: `Aucun ${entityLabel} créé`,
    subtitle: `Créez votre premier ${entityLabel}.`,
  };
}

export function fmtTnd(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`;
}

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

/** Prochaine valeur actif après toggle */
export function nextActifValue(current) {
  return current === false;
}

export function getEncoursPillStyle(encours, plafondCredit) {
  const enc = Number(encours) || 0;
  const plaf = Number(plafondCredit) || 0;
  if (plaf > 0 && enc > plaf) {
    return {
      background: "rgba(226,75,74,0.12)",
      color: "#E24B4A",
      border: "0.5px solid rgba(226,75,74,0.35)",
    };
  }
  if (enc > 500) {
    return {
      background: "rgba(245,158,11,0.12)",
      color: "#f59e0b",
      border: "0.5px solid rgba(245,158,11,0.35)",
    };
  }
  return {
    background: "rgba(29,158,117,0.12)",
    color: "#1D9E75",
    border: "0.5px solid rgba(29,158,117,0.28)",
  };
}

export const TIERS_KEYFRAMES = `
  @keyframes tierCardFadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes tierMarkerBounce {
    0%, 100% { transform: rotate(-45deg) translateY(0); }
    40% { transform: rotate(-45deg) translateY(-6px); }
    70% { transform: rotate(-45deg) translateY(-2px); }
  }
  @keyframes tierModalIn {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes tierModalOut {
    from { opacity: 1; transform: scale(1); }
    to { opacity: 0; transform: scale(0.96); }
  }
  @keyframes tierSortSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(180deg); }
  }
  .tiers-page .c-card,
  .tiers-page .f-card {
    background: var(--bg-card);
    border: 1px solid var(--border-default);
    border-radius: 12px;
    padding: 1.1rem 1.25rem;
    box-shadow: var(--shadow-card);
  }
  .tier-card {
    transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  }
  .tier-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-modal);
    border-color: color-mix(in srgb, var(--accent-primary) 28%, var(--border-default)) !important;
  }
  .tier-card:hover .tier-map-marker {
    animation: tierMarkerBounce 0.55s ease;
  }
  .tier-table-row {
    transition: background-color 0.2s ease;
    background: var(--bg-card);
  }
  .tier-table-row--alt {
    background: var(--bg-hover);
  }
  .light .tier-table-row--alt {
    background: #f8fafc;
  }
  .tier-table-row:hover {
    background: var(--bg-active) !important;
  }
  .tier-sort-arrow {
    display: inline-block;
    transition: transform 0.25s ease;
  }
  .tier-sort-arrow--desc {
    transform: rotate(180deg);
  }
  .tier-action-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, filter 0.15s ease;
  }
  .tier-action-btn:hover {
    filter: brightness(1.08);
  }
  .tier-btn-edit {
    background: rgba(55,138,221,0.1) !important;
    border-color: rgba(55,138,221,0.3) !important;
    color: #378ADD !important;
  }
  .tier-btn-deactivate {
    background: rgba(226,75,74,0.1) !important;
    border-color: rgba(226,75,74,0.3) !important;
    color: #E24B4A !important;
  }
  .tier-btn-reactivate {
    background: rgba(29,158,117,0.1) !important;
    border-color: rgba(29,158,117,0.3) !important;
    color: #1D9E75 !important;
  }
  .tier-btn-view {
    background: var(--bg-hover) !important;
    border-color: var(--border-default) !important;
    color: var(--text-secondary) !important;
  }
  .tier-btn-view:hover {
    color: var(--accent-primary) !important;
    border-color: color-mix(in srgb, var(--accent-primary) 35%, var(--border-default)) !important;
  }
  .tier-detail-modal {
    background: var(--bg-modal);
    border-color: var(--border-default);
    color: var(--text-primary);
  }
  .tier-detail-stat {
    background: var(--bg-input);
    border-color: var(--border-default);
  }
  .tier-detail-label {
    color: var(--text-muted);
  }
  .tier-detail-value {
    color: var(--text-primary);
  }
  .tier-detail-section {
    border-color: var(--border-default);
  }
  .tier-detail-link {
    color: var(--text-link);
  }
  .tier-map-preview.map-container {
    border-color: var(--border-default) !important;
  }
  .light .tier-map-preview.map-container {
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
`;
