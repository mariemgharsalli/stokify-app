/** Theme Dépôts — glass navy, bleu/cyan Stokify, animations. */

export const DEPOT_ACCENT = "#378ADD";
export const DEPOT_CYAN = "#0EA5E9";
export const DEPOT_NAVY = "#0B1F3A";

export const DEPOT_KPI_ACCENTS = [DEPOT_ACCENT, "#1D9E75", DEPOT_CYAN, "#EF9F27"];

export const DEPOT_COLORS = [
  ["#378ADD", "#2563eb"],
  ["#0EA5E9", "#0284C7"],
  ["#06B6D4", "#0891B2"],
  ["#1D9E75", "#059669"],
  ["#EF9F27", "#D97706"],
];

export const DEPOTS_CSS = `
  @keyframes depotFadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes depotFadeDown {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes depotSlideInRight {
    from { opacity: 0; transform: translateX(16px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes depotModalIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes depotDrawerIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  @keyframes depotShine {
    from { transform: translateX(-100%); }
    to { transform: translateX(100%); }
  }
  @keyframes depotBarGrow {
    from { width: 0; opacity: 0.4; }
    to { opacity: 1; }
  }
  .depot-kpi-card {
    position: relative;
    overflow: hidden;
    border-radius: 1.15rem;
    border: 1px solid var(--border-default);
    background: var(--bg-card);
    padding: 1rem;
    transition: transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease;
  }
  .depot-kpi-card:hover {
    border-color: color-mix(in srgb, var(--kpi-accent) 40%, var(--border-default));
    box-shadow: 0 16px 36px -18px color-mix(in srgb, var(--kpi-accent) 35%, transparent);
  }
  .depot-card-pro {
    position: relative;
    overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid var(--border-default);
    background:
      linear-gradient(165deg, color-mix(in srgb, #378ADD 4%, var(--bg-card)), var(--bg-card));
    box-shadow: var(--shadow-card);
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease, border-color 0.25s ease;
  }
  .depot-card-pro:hover {
    transform: translateY(-5px);
    border-color: rgba(55, 138, 221, 0.4);
    box-shadow: 0 22px 44px -20px rgba(55, 138, 221, 0.35);
  }
  .depot-card-pro::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, #0B1F3A, #378ADD, #0EA5E9);
    opacity: 0.85;
  }
  .depot-card-pro__mesh {
    pointer-events: none;
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 50% 60% at 100% 0%, rgba(55,138,221,0.1), transparent 55%);
  }
  .depot-toolbar {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1rem;
    border-radius: 1.25rem;
    border: 1px solid var(--border-default);
    background: var(--bg-card);
    box-shadow: var(--shadow-card);
  }
  .depot-view-toggle {
    display: inline-flex;
    gap: 0.25rem;
    padding: 0.3rem;
    border-radius: 0.9rem;
    border: 1px solid var(--border-default);
    background: var(--bg-hover);
  }
  .depot-view-toggle button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.75rem;
    border-radius: 0.7rem;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 700;
    transition: color 0.2s ease, background 0.2s ease;
  }
  .depot-view-toggle button.is-active {
    color: #fff;
    background: linear-gradient(135deg, #378ADD, #0EA5E9);
    box-shadow: 0 8px 16px -8px rgba(55,138,221,0.55);
  }
  .depot-table-shell {
    overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid var(--border-default);
    background: var(--bg-card);
    box-shadow: var(--shadow-card);
  }
  .depot-table-shell::before {
    content: "";
    display: block;
    height: 3px;
    background: linear-gradient(90deg, #0B1F3A, #378ADD, #0EA5E9);
  }
  .depot-table-head {
    background:
      linear-gradient(135deg,
        color-mix(in srgb, #0B1F3A 88%, #378ADD),
        color-mix(in srgb, #0B1F3A 92%, #0EA5E9));
  }
  .depot-table-head th {
    padding: 0.85rem 1rem;
    text-align: left;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.92);
    white-space: nowrap;
    border-bottom: 1px solid rgba(55,138,221,0.3);
  }
  .depot-table-row {
    transition: background-color 0.2s ease;
  }
  .depot-table-row:hover td {
    background: color-mix(in srgb, #378ADD 7%, var(--bg-card)) !important;
  }
  .depot-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border-radius: 999px;
    padding: 0.35rem 0.75rem;
    font-size: 0.7rem;
    font-weight: 700;
  }
  .depot-emplacements-collapse {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-height 0.35s ease, opacity 0.3s ease;
  }
  .depot-emplacements-collapse.is-open {
    max-height: 900px;
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .depot-kpi-card, .depot-card-pro { transition: none !important; }
  }
`;

export function occupationColor(rate) {
  if (rate < 50) return "#1D9E75";
  if (rate <= 80) return "#EF9F27";
  return "#E24B4A";
}
