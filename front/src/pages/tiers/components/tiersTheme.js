/** Theme tiers (Clients / Fournisseurs) — glass navy, aligné Sociétés */

export const TIERS_ACCENT = "#378ADD";
export const TIERS_CYAN = "#0EA5E9";
export const TIERS_NAVY = "#0B1F3A";

export const TIERS_FILTER_PILLS = [
  {
    id: "actifs",
    label: "Actifs",
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    glow: "rgba(16, 185, 129, 0.45)",
  },
  {
    id: "tous",
    label: "Tous",
    gradient: "linear-gradient(135deg, #378ADD 0%, #2563eb 100%)",
    glow: "rgba(55, 138, 221, 0.45)",
  },
  {
    id: "inactifs",
    label: "Désactivés",
    gradient: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
    glow: "rgba(244, 63, 94, 0.4)",
  },
];

export const TIERS_TABLE_CSS = `
  @keyframes tierProRowIn {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes tierProHeadShine {
    from { transform: translateX(-100%); }
    to { transform: translateX(100%); }
  }
  @keyframes tierProShimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes tierToolbarShine {
    from { transform: translateX(-120%); }
    to { transform: translateX(120%); }
  }
  .tier-pro-shimmer {
    background: linear-gradient(90deg,
      var(--bg-input) 25%,
      var(--bg-card-hover, var(--bg-hover)) 50%,
      var(--bg-input) 75%
    );
    background-size: 400px 100%;
    animation: tierProShimmer 1.4s ease infinite;
  }
  .tier-pro-shell {
    position: relative;
    overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid var(--border-default);
    background: var(--bg-card);
    box-shadow: 0 22px 48px -28px rgba(55, 138, 221, 0.28), var(--shadow-card);
  }
  .tier-pro-shell::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    z-index: 3;
    background: linear-gradient(90deg, #0B1F3A, #378ADD, #0EA5E9, #67E8F9);
  }
  .tier-pro-wrap { overflow-x: auto; }
  .tier-pro-wrap table {
    width: 100%;
    min-width: 780px;
    border-collapse: separate;
    border-spacing: 0;
  }
  .tier-pro-head {
    position: sticky;
    top: 0;
    z-index: 2;
    background:
      linear-gradient(135deg,
        color-mix(in srgb, #0B1F3A 88%, #378ADD),
        color-mix(in srgb, #0B1F3A 92%, #0EA5E9));
  }
  .tier-pro-head th {
    position: relative;
    overflow: hidden;
    padding: 0.95rem 1rem;
    text-align: left;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.92);
    white-space: nowrap;
    border-bottom: 1px solid rgba(55, 138, 221, 0.35);
    cursor: pointer;
    user-select: none;
  }
  .tier-pro-head th.no-sort { cursor: default; }
  .tier-pro-head th::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%);
    transform: translateX(-100%);
    animation: tierProHeadShine 2.8s ease-in-out infinite;
    pointer-events: none;
  }
  .tier-pro-head__cell {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    position: relative;
    z-index: 1;
  }
  .tier-pro-head__icon {
    width: 1.85rem;
    height: 1.85rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.55rem;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.12);
    color: #7dd3fc;
  }
  .tier-pro-row {
    transition: background-color 0.2s ease;
    background: var(--bg-card);
  }
  .tier-pro-row:nth-child(even) {
    background: color-mix(in srgb, var(--bg-hover) 55%, transparent);
  }
  .tier-pro-row:hover {
    background: color-mix(in srgb, #378ADD 8%, var(--bg-card)) !important;
  }
  .tier-pro-row td {
    padding: 0.85rem 1rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border-default) 70%, transparent);
    vertical-align: middle;
  }
  .tier-pro-row.is-disabled {
    opacity: 0.72;
  }
  .tier-pro-code {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 0.15rem 0.55rem;
    font-family: ui-monospace, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #7dd3fc;
    background: rgba(55, 138, 221, 0.14);
    border: 1px solid rgba(55, 138, 221, 0.28);
  }
  .tier-pro-avatar {
    display: flex;
    height: 2.65rem;
    width: 2.65rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 0.75rem;
    font-size: 0.85rem;
    font-weight: 800;
    color: #fff;
    transition: transform 0.3s ease;
  }
  .tier-pro-row:hover .tier-pro-avatar {
    transform: scale(1.05);
  }
  .tier-pro-action {
    display: inline-flex;
    height: 2rem;
    width: 2rem;
    align-items: center;
    justify-content: center;
    border-radius: 0.65rem;
    border: 1px solid;
    transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  }
  .tier-pro-action:hover {
    transform: scale(1.08);
  }
  .tier-pro-action:active {
    transform: scale(0.95);
  }
  .tier-toolbar-pro {
    position: relative;
    overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid color-mix(in srgb, #378ADD 22%, var(--border-default));
    background:
      linear-gradient(135deg, color-mix(in srgb, #0B1F3A 92%, #378ADD) 0%, #0B1F3A 55%, color-mix(in srgb, #0B1F3A 88%, #0EA5E9) 100%);
    box-shadow: 0 18px 40px -22px rgba(11, 31, 58, 0.55);
    padding: 1rem 1.1rem;
  }
  .tier-toolbar-pro::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.07) 50%, transparent 60%);
    animation: tierToolbarShine 4.5s ease-in-out infinite;
    pointer-events: none;
  }
  .tier-kpi-strip {
    /* layout defined in TierKpiStrip.jsx */
  }
  @media (prefers-reduced-motion: reduce) {
    .tier-pro-head th::after,
    .tier-pro-shimmer,
    .tier-toolbar-pro::after {
      animation: none !important;
    }
  }
`;
