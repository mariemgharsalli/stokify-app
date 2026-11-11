/** Theme & constants — Sociétés (enterprise SaaS console) */

export const SOCIETES_THEME = {
  accent: "#378ADD",
  accentSoft: "rgba(55,138,221,0.12)",
  accentBorder: "rgba(55,138,221,0.25)",
  success: "#1D9E75",
  successSoft: "rgba(29,158,117,0.12)",
  danger: "#E24B4A",
  dangerSoft: "rgba(226,75,74,0.12)",
  cyan: "#0EA5E9",
};

/** Filter tabs for the Sociétés filter board (sliding indicator) */
export const FILTER_PILLS = [
  {
    id: "ALL",
    label: "Toutes",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    glow: "rgba(59, 130, 246, 0.45)",
  },
  {
    id: "VISIBLE",
    label: "Visibles",
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    glow: "rgba(16, 185, 129, 0.45)",
  },
  {
    id: "HIDDEN",
    label: "Désactivées",
    gradient: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
    glow: "rgba(244, 63, 94, 0.4)",
  },
  {
    id: "LOCATED",
    label: "Localisées",
    gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
    glow: "rgba(6, 182, 212, 0.45)",
  },
];

export const SOCIETES_ANIMATIONS = `
  @keyframes societesFadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes societesSlideInRight {
    from { opacity: 0; transform: translateX(32px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes societesToastIn {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes societesMenuIn {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes societesShimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .societes-shimmer {
    background: linear-gradient(90deg,
      var(--bg-input) 25%,
      var(--bg-card-hover) 50%,
      var(--bg-input) 75%
    );
    background-size: 400px 100%;
    animation: societesShimmer 1.4s ease infinite;
  }

  /* —— Tableau Sociétés pro / animé —— */
  @keyframes societeTableRowIn {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes societeTableHeadShine {
    from { transform: translateX(-100%); }
    to { transform: translateX(100%); }
  }
  @keyframes societeStatPop {
    0% { transform: scale(0.85); opacity: 0.5; }
    60% { transform: scale(1.08); }
    100% { transform: scale(1); opacity: 1; }
  }
  .societe-table-shell {
    position: relative;
    overflow: hidden;
    border-radius: 1.25rem;
    border: 1px solid var(--border-default);
    background: var(--bg-card);
    box-shadow: var(--shadow-card);
  }
  .societe-table-shell::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    z-index: 3;
    background: linear-gradient(90deg, #0B1F3A, #378ADD, #0EA5E9, #67E8F9);
  }
  .societe-table-wrap {
    overflow-x: auto;
  }
  .societe-table-wrap table {
    width: 100%;
    min-width: 720px;
    border-collapse: separate;
    border-spacing: 0;
  }
  .societe-table-head {
    position: sticky;
    top: 0;
    z-index: 2;
    background:
      linear-gradient(135deg,
        color-mix(in srgb, #0B1F3A 88%, #378ADD),
        color-mix(in srgb, #0B1F3A 92%, #0EA5E9));
  }
  .societe-table-head th {
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
  }
  .societe-table-head th::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%);
    transform: translateX(-100%);
    animation: societeTableHeadShine 2.8s ease-in-out infinite;
    pointer-events: none;
  }
  .societe-table-head__cell {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .societe-table-head__icon {
    width: 1.85rem;
    height: 1.85rem;
    border-radius: 0.55rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(55, 138, 221, 0.22);
    color: #7dd3fc;
    border: 1px solid rgba(125, 211, 252, 0.25);
  }
  .societe-table-row {
    transition: background-color 0.22s ease, box-shadow 0.22s ease;
  }
  .societe-table-row td {
    padding: 0.95rem 1rem;
    border-bottom: 1px solid var(--border-subtle);
    vertical-align: middle;
  }
  .societe-table-row:nth-child(even) td {
    background: color-mix(in srgb, var(--bg-hover) 55%, transparent);
  }
  .societe-table-row:hover td {
    background: color-mix(in srgb, #378ADD 7%, var(--bg-card)) !important;
  }
  .societe-table-row:hover {
    box-shadow: inset 3px 0 0 #378ADD;
  }
  .societe-stat-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.55rem;
    border-radius: 0.65rem;
    border: 1px solid;
    font-size: 0.75rem;
    font-weight: 700;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .societe-table-row:hover .societe-stat-chip {
    transform: translateY(-1px);
    animation: societeStatPop 0.35s ease;
  }
  .societe-code-pill {
    display: inline-flex;
    align-items: center;
    margin-top: 0.25rem;
    padding: 0.1rem 0.45rem;
    border-radius: 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #378ADD;
    background: rgba(55, 138, 221, 0.1);
    border: 1px solid rgba(55, 138, 221, 0.22);
  }
  .societe-action-btn {
    display: inline-flex;
    height: 2.1rem;
    width: 2.1rem;
    align-items: center;
    justify-content: center;
    border-radius: 0.7rem;
    border: 1px solid rgba(55, 138, 221, 0.22);
    background: rgba(55, 138, 221, 0.08);
    color: #378ADD;
    opacity: 0.7;
    transition: all 0.22s ease;
  }
  .societe-table-row:hover .societe-action-btn {
    opacity: 1;
  }
  .societe-action-btn:hover {
    background: linear-gradient(135deg, #378ADD, #0EA5E9);
    color: #fff;
    border-color: transparent;
    transform: scale(1.08);
    box-shadow: 0 8px 18px -8px rgba(55, 138, 221, 0.55);
  }
  .societe-logo-ring {
    position: relative;
  }
  .societe-logo-ring::after {
    content: "";
    position: absolute;
    inset: -3px;
    border-radius: 0.9rem;
    border: 1.5px solid transparent;
    background: linear-gradient(135deg, #378ADD, #0EA5E9) border-box;
    -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  .societe-table-row:hover .societe-logo-ring::after {
    opacity: 0.7;
  }
  @media (prefers-reduced-motion: reduce) {
    .societe-table-head th::after,
    .societe-table-row:hover .societe-stat-chip {
      animation: none !important;
    }
  }

  /* KPI cards dynamiques (entrée via Framer Motion) */
  .societe-kpi-card {
    background: var(--bg-card);
    border: 0.5px solid var(--border-subtle);
    border-left: 3px solid;
    border-radius: var(--border-radius-lg, 12px);
    padding: 1.25rem;
    transition: box-shadow 0.28s ease, border-color 0.28s ease;
  }
  .societe-kpi-card:hover {
    border-color: color-mix(in srgb, var(--kpi-accent) 35%, var(--border-subtle)) !important;
    box-shadow: 0 16px 40px -12px var(--kpi-glow), 0 8px 20px -8px rgba(0,0,0,0.2);
  }
  .societe-kpi-card--pulse {
    animation: societeKpiPulse 2.5s ease-in-out infinite;
  }
  @keyframes societeKpiPulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--kpi-accent) 10%, transparent); }
    50% { box-shadow: 0 0 20px 2px color-mix(in srgb, var(--kpi-accent) 20%, transparent); }
  }
  .societe-kpi-shine {
    background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.07) 50%, transparent 62%);
    transform: translateX(-100%);
    animation: societeKpiShine 1.1s ease forwards;
  }
  .societe-kpi-card:hover .societe-kpi-shine {
    animation: societeKpiShineHover 0.7s ease;
  }
  @keyframes societeKpiShine { to { transform: translateX(100%); } }
  @keyframes societeKpiShineHover {
    from { transform: translateX(-100%); opacity: 0.5; }
    to { transform: translateX(100%); opacity: 0; }
  }
  .societe-kpi-bar {
    animation: societeKpiBarGrow 1.2s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @keyframes societeKpiBarGrow {
    from { width: 0 !important; opacity: 0.4; }
    to { opacity: 1; }
  }
  @keyframes societeKpiIconPop {
    0% { transform: scale(0.85); opacity: 0.6; }
    60% { transform: scale(1.08); }
    100% { transform: scale(1); opacity: 1; }
  }
  .societe-kpi-icon {
    animation: societeKpiIconPop 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .societe-kpi-icon--pulse {
    animation: societeKpiIconPop 0.5s ease both, societeKpiIconBounce 2s ease-in-out infinite;
  }
  @keyframes societeKpiIconBounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.06); }
  }
  @keyframes societeIconWiggle {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-6deg); }
    75% { transform: rotate(6deg); }
  }
  .societe-card-stat:hover .societe-stat-icon {
    animation: societeIconWiggle 0.45s ease;
  }
  .societe-card-action:hover svg {
    transform: scale(1.12);
  }
  .societe-card-action svg {
    transition: transform 0.2s ease;
  }

  /* —— Modal société centrée —— */
  .societe-modal-root {
    position: fixed;
    inset: 0;
    z-index: 9990;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(11, 31, 58, 0.55);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .societe-modal {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(100%, 42rem);
    max-height: min(90vh, 52rem);
    overflow: hidden;
    border-radius: 1.35rem;
    border: 1px solid rgba(55, 138, 221, 0.28);
    background: var(--bg-modal, #fff);
    box-shadow:
      0 32px 72px -24px rgba(11, 31, 58, 0.55),
      0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  }
  .societe-modal__beam {
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    z-index: 2;
    background: linear-gradient(90deg, #378ADD, #0EA5E9, #67E8F9, #378ADD);
    background-size: 200% 100%;
    animation: societeModalBeam 4s linear infinite;
  }
  @keyframes societeModalBeam {
    to { background-position: 200% 0; }
  }
  .societe-modal__glow {
    position: absolute;
    inset: 0 0 auto 0;
    height: 8rem;
    pointer-events: none;
    background: radial-gradient(ellipse 80% 100% at 20% 0%, rgba(55,138,221,0.16), transparent 70%);
  }
  .societe-modal__header {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.35rem 1rem;
    border-bottom: 1px solid var(--border-default);
  }
  .societe-modal__brand {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    min-width: 0;
  }
  .societe-modal__avatar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    flex-shrink: 0;
    border-radius: 0.9rem;
    color: #fff;
    background: linear-gradient(145deg, #378ADD, #0EA5E9);
    box-shadow: 0 12px 24px -12px rgba(55, 138, 221, 0.7);
  }
  .societe-modal__avatar-spark {
    position: absolute;
    top: -4px;
    right: -4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.15rem;
    height: 1.15rem;
    border-radius: 999px;
    background: #fff;
    color: #0EA5E9;
    box-shadow: 0 4px 10px rgba(14, 165, 233, 0.35);
  }
  .societe-modal__kicker {
    margin: 0 0 0.15rem;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #0284c7;
  }
  .societe-modal__header h2 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--text-primary);
  }
  .societe-modal__sub {
    margin: 0.2rem 0 0;
    font-size: 0.78rem;
    color: var(--text-muted);
  }
  .societe-modal__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.15rem;
    height: 2.15rem;
    flex-shrink: 0;
    border: none;
    border-radius: 0.65rem;
    background: var(--bg-input);
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;
  }
  .societe-modal__close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .societe-modal__body {
    position: relative;
    z-index: 1;
    flex: 1;
    overflow-y: auto;
    padding: 1.15rem 1.35rem;
    display: flex;
    flex-direction: column;
    gap: 1.35rem;
  }
  .societe-modal__section-head {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 0.85rem;
  }
  .societe-modal__section-head span {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 800;
    color: #0284c7;
    background: rgba(55, 138, 221, 0.12);
  }
  .societe-modal__section-head h3 {
    margin: 0;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .societe-modal__section-head div {
    height: 1px;
    flex: 1;
    background: var(--border-subtle);
  }
  .societe-modal__fields {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .societe-modal__field label {
    display: block;
    margin-bottom: 0.4rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .societe-modal__field label em {
    font-style: normal;
    color: var(--danger-text);
  }
  .societe-modal__input {
    position: relative;
  }
  .societe-modal__input > svg {
    position: absolute;
    left: 0.85rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }
  .societe-modal__input input {
    width: 100%;
    border-radius: 0.8rem;
    border: 1px solid var(--border-default);
    background: var(--bg-input);
    color: var(--text-primary);
    padding: 0.7rem 0.9rem 0.7rem 2.5rem;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .societe-modal__input input:focus {
    border-color: rgba(55, 138, 221, 0.55);
    box-shadow: 0 0 0 3px rgba(55, 138, 221, 0.15);
  }
  .societe-modal__code {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-radius: 0.9rem;
    border: 1px solid var(--border-default);
    background: var(--bg-input);
    color: var(--text-muted);
  }
  .societe-modal__code p {
    margin: 0;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .societe-modal__code strong {
    display: block;
    margin-top: 0.1rem;
    font-family: ui-monospace, monospace;
    font-size: 0.9rem;
    color: #378ADD;
  }
  .societe-modal__icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: 0.55rem;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }
  .societe-modal__icon-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .societe-modal__coords {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.65rem;
    padding: 0.45rem 0.7rem;
    border-radius: 0.65rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--success-text);
    background: var(--success-bg);
    border: 1px solid var(--success-border);
  }
  .societe-modal__toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.95rem 1rem;
    border-radius: 0.95rem;
    border: 1px solid var(--border-default);
    background: var(--bg-input);
  }
  .societe-modal__toggle-row p {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  .societe-modal__toggle-row span {
    display: block;
    margin-top: 0.15rem;
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .societe-modal__switch {
    position: relative;
    width: 2.75rem;
    height: 1.5rem;
    flex-shrink: 0;
    border: none;
    border-radius: 999px;
    background: var(--border-default);
    cursor: pointer;
    transition: background 0.2s ease;
  }
  .societe-modal__switch.is-on { background: #1D9E75; }
  .societe-modal__switch span {
    position: absolute;
    top: 0.2rem;
    left: 0.2rem;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.18);
    transition: transform 0.2s ease;
  }
  .societe-modal__switch.is-on span { transform: translateX(1.25rem); }
  .societe-modal__alert {
    margin: 0;
    padding: 0.7rem 0.85rem;
    border-radius: 0.75rem;
    border: 1px solid;
    font-size: 0.82rem;
  }
  .societe-modal__alert--error {
    border-color: var(--danger-border);
    background: var(--danger-bg);
    color: var(--danger-text);
  }
  .societe-modal__alert--success {
    border-color: var(--success-border);
    background: var(--success-bg);
    color: var(--success-text);
  }
  .societe-modal__footer {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.35rem;
    border-top: 1px solid var(--border-default);
    background: var(--bg-card);
  }
  .societe-modal__btn-ghost {
    flex: 1;
    padding: 0.7rem 1rem;
    border-radius: 0.8rem;
    border: 1px solid var(--border-default);
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }
  .societe-modal__btn-ghost:hover { background: var(--bg-hover); }
  .societe-modal__btn-primary {
    flex: 1.2;
    padding: 0.7rem 1rem;
    border: none;
    border-radius: 0.8rem;
    color: #fff;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    background: linear-gradient(135deg, #378ADD 0%, #0EA5E9 100%);
    box-shadow: 0 10px 24px -12px rgba(55, 138, 221, 0.65);
  }
  .societe-modal__btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* —— Modal détail localisation —— */
  .societe-detail-modal-root {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(11, 31, 58, 0.55);
    backdrop-filter: blur(8px);
  }
  .societe-detail-modal {
    width: min(100%, 32rem);
    overflow: hidden;
    border-radius: 1.35rem;
    border: 1px solid rgba(55, 138, 221, 0.28);
    background: var(--bg-modal, #fff);
    box-shadow: 0 32px 72px -24px rgba(11, 31, 58, 0.55);
  }
  .societe-detail-modal__beam {
    height: 3px;
    background: linear-gradient(90deg, #378ADD, #0EA5E9, #67E8F9);
  }
  .societe-detail-modal__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1.1rem 1.2rem;
    border-bottom: 1px solid var(--border-default);
  }
  .societe-detail-modal__head h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 800;
    color: var(--text-primary);
  }
  .societe-detail-modal__head p {
    margin: 0.25rem 0 0;
    font-family: ui-monospace, monospace;
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .societe-detail-modal__kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.35rem;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #0284c7;
  }
  .societe-detail-modal__map {
    height: 300px;
    width: 100%;
    background: var(--bg-input);
  }
  .societe-detail-modal__foot {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.85rem 1.2rem;
    border-top: 1px solid var(--border-default);
    font-size: 0.82rem;
    color: var(--text-secondary);
  }

  /* —— Grille sociétés simple & pro —— */
  .societe-grid-card {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1.15rem;
    border-radius: 1.15rem;
    border: 1px solid var(--border-default);
    border-left: 3px solid var(--societe-accent, #378ADD);
    background: var(--bg-card);
    box-shadow: var(--shadow-card);
    transition: border-color 0.25s ease, box-shadow 0.3s ease;
  }
  .societe-grid-card:hover {
    border-color: var(--societe-border, rgba(55,138,221,0.35));
    box-shadow: 0 18px 40px -18px var(--societe-soft, rgba(55,138,221,0.35));
  }
  .societe-grid-card__top {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .societe-grid-card__logo {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 0.85rem;
    background: linear-gradient(145deg, #378ADD, #0EA5E9);
    color: #fff;
    font-size: 1.05rem;
    font-weight: 800;
    cursor: default;
  }
  .societe-grid-card__logo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .societe-grid-card__logo-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(11, 31, 58, 0.55);
    color: #fff;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .societe-grid-card__logo:hover .societe-grid-card__logo-overlay { opacity: 1; }
  .societe-grid-card__identity { min-width: 0; flex: 1; }
  .societe-grid-card__identity h3,
  .societe-grid-card__name-btn {
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    text-align: left;
    cursor: pointer;
  }
  .societe-grid-card__name-btn:hover {
    color: #0284c7;
  }
  .societe-grid-card__identity span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.3rem;
    padding: 0.15rem 0.45rem;
    border-radius: 0.4rem;
    font-family: ui-monospace, monospace;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--societe-accent, #378ADD);
    background: var(--societe-soft, rgba(55,138,221,0.12));
  }
  .societe-grid-card__tools {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }
  .societe-grid-card__more {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: 0.55rem;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
  }
  .societe-grid-card__more:hover { background: var(--bg-hover); }
  .societe-grid-card__stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }
  .societe-grid-card__stats span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.6rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 650;
    color: var(--text-secondary);
    background: var(--bg-input);
    border: 1px solid var(--border-subtle);
  }
  .societe-grid-card__stats svg { color: var(--societe-accent, #378ADD); }
  .societe-grid-card__meta {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .societe-grid-card__meta p {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-secondary);
  }
  .societe-grid-card__meta span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .societe-grid-card__meta svg {
    flex-shrink: 0;
    color: var(--text-muted);
  }
  .societe-grid-card__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.15rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-subtle);
  }
  .societe-grid-card__actions button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.7rem;
    border-radius: 0.6rem;
    border: 1px solid var(--border-default);
    background: var(--bg-input);
    color: var(--text-secondary);
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  }
  .societe-grid-card__actions button:hover {
    border-color: rgba(55, 138, 221, 0.4);
    color: #0284c7;
    background: rgba(55, 138, 221, 0.08);
  }
  .societe-grid-card__actions button.is-danger:hover {
    border-color: rgba(226, 75, 74, 0.4);
    color: #E24B4A;
    background: rgba(226, 75, 74, 0.08);
  }
  .societe-grid-card__actions button.is-ok:hover {
    border-color: rgba(29, 158, 117, 0.4);
    color: #1D9E75;
    background: rgba(29, 158, 117, 0.08);
  }
  .societe-grid-card--skeleton {
    gap: 0.75rem;
    min-height: 11rem;
  }
  .societe-grid-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3.5rem 1.5rem;
    text-align: center;
    border-radius: 1.25rem;
    border: 1.5px dashed var(--border-default);
    background: var(--bg-card);
  }
  .societe-grid-empty__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    margin-bottom: 1rem;
    border-radius: 1rem;
    color: #378ADD;
    background: rgba(55, 138, 221, 0.12);
    border: 1px solid rgba(55, 138, 221, 0.22);
  }
  .societe-grid-empty h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  .societe-grid-empty p {
    margin: 0.5rem 0 0;
    max-width: 22rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  .societe-grid-empty button {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin-top: 1.25rem;
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 0.8rem;
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    background: linear-gradient(135deg, #378ADD, #0EA5E9);
    box-shadow: 0 8px 20px -10px rgba(55, 138, 221, 0.55);
  }

  /* —— Modal détail société —— */
  .societe-view-modal-root {
    position: fixed;
    inset: 0;
    z-index: 9992;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(11, 31, 58, 0.55);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .societe-view-modal {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(100%, 34rem);
    max-height: min(90vh, 44rem);
    overflow: hidden;
    border-radius: 1.4rem;
    border: 1px solid rgba(55, 138, 221, 0.3);
    background: var(--bg-modal, #fff);
    box-shadow: 0 32px 72px -24px rgba(11, 31, 58, 0.55);
  }
  .societe-view-modal__beam {
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    z-index: 2;
    background: linear-gradient(90deg, #378ADD, #0EA5E9, #67E8F9, #378ADD);
    background-size: 200% 100%;
    animation: societeModalBeam 4s linear infinite;
  }
  .societe-view-modal__glow {
    position: absolute;
    inset: 0 0 auto 0;
    height: 9rem;
    pointer-events: none;
    background: radial-gradient(ellipse 70% 100% at 15% 0%, var(--societe-soft, rgba(55,138,221,0.18)), transparent 70%);
  }
  .societe-view-modal__header {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.25rem 1rem;
    border-bottom: 1px solid var(--border-default);
  }
  .societe-view-modal__brand {
    display: flex;
    align-items: flex-start;
    gap: 0.9rem;
    min-width: 0;
  }
  .societe-view-modal__logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 1rem;
    color: #fff;
    font-size: 1.25rem;
    font-weight: 800;
    box-shadow: 0 12px 24px -12px var(--societe-soft, rgba(55,138,221,0.55));
    border: 1px solid var(--societe-border, rgba(55,138,221,0.25));
  }
  .societe-view-modal__logo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .societe-view-modal__kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin: 0 0 0.25rem;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #0284c7;
  }
  .societe-view-modal__header h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1.2;
  }
  .societe-view-modal__badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    margin-top: 0.55rem;
  }
  .societe-view-modal__code {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    border-radius: 0.45rem;
    font-family: ui-monospace, monospace;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--societe-accent, #378ADD);
    background: var(--societe-soft, rgba(55,138,221,0.12));
  }
  .societe-view-modal__body {
    position: relative;
    z-index: 1;
    flex: 1;
    overflow-y: auto;
    padding: 1.15rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }
  .societe-view-modal__stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
  }
  .societe-view-modal__stat {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    padding: 0.8rem 0.75rem;
    border-radius: 0.95rem;
    border: 1px solid var(--border-default);
    background: var(--bg-input);
  }
  .societe-view-modal__stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    border-radius: 0.65rem;
    color: #fff;
    background: linear-gradient(145deg, #378ADD, #0EA5E9);
  }
  .societe-view-modal__stat p {
    margin: 0;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .societe-view-modal__stat strong {
    display: block;
    margin-top: 0.15rem;
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--text-primary);
  }
  .societe-view-modal__info h3 {
    margin: 0 0 0.65rem;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .societe-view-modal__info ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .societe-view-modal__info li {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    padding: 0.7rem 0.8rem;
    border-radius: 0.85rem;
    border: 1px solid var(--border-subtle);
    background: var(--bg-card);
  }
  .societe-view-modal__info li > svg {
    margin-top: 0.15rem;
    flex-shrink: 0;
    color: var(--societe-accent, #378ADD);
  }
  .societe-view-modal__info li p {
    margin: 0;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .societe-view-modal__info li span,
  .societe-view-modal__info li a {
    display: block;
    margin-top: 0.15rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
    text-decoration: none;
    word-break: break-word;
  }
  .societe-view-modal__info li a:hover {
    color: #0284c7;
  }
  .societe-view-modal__coords-card {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.85rem 1rem;
    border-radius: 0.95rem;
    border: 1px solid rgba(55, 138, 221, 0.25);
    background: linear-gradient(135deg, rgba(55,138,221,0.1), rgba(14,165,233,0.05));
    color: var(--societe-accent, #378ADD);
  }
  .societe-view-modal__coords-card p {
    margin: 0;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .societe-view-modal__coords-card strong {
    display: block;
    margin-top: 0.1rem;
    font-family: ui-monospace, monospace;
    font-size: 0.82rem;
    color: var(--text-primary);
  }
  .societe-view-modal__coords-card > div {
    flex: 1;
    min-width: 0;
  }
  .societe-view-modal__coords-card button {
    flex-shrink: 0;
    padding: 0.4rem 0.7rem;
    border-radius: 0.6rem;
    border: 1px solid rgba(55, 138, 221, 0.35);
    background: rgba(255,255,255,0.7);
    color: #0284c7;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
  }
  .societe-view-modal__map-section {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  .societe-view-modal__map-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .societe-view-modal__map-head h3 {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .societe-view-modal__map-head span {
    font-family: ui-monospace, monospace;
    font-size: 0.68rem;
    color: var(--text-muted);
  }
  .societe-view-modal__map {
    height: 220px;
    width: 100%;
    border-radius: 0.95rem;
    overflow: hidden;
    border: 1px solid rgba(55, 138, 221, 0.22);
    background: var(--bg-input);
    box-shadow: 0 12px 28px -18px rgba(11, 31, 58, 0.35);
  }
  .societe-view-modal__map-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    height: 140px;
    border-radius: 0.95rem;
    border: 1.5px dashed var(--border-default);
    background: var(--bg-input);
    color: var(--text-muted);
    font-size: 0.8rem;
    text-align: center;
    padding: 1rem;
  }
  .societe-view-modal__footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.55rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border-default);
    background: var(--bg-card);
  }
  .societe-view-modal__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 0.85rem;
    border-radius: 0.7rem;
    border: 1px solid var(--border-default);
    background: var(--bg-input);
    color: var(--text-secondary);
    font-size: 0.78rem;
    font-weight: 650;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  }
  .societe-view-modal__btn:hover {
    border-color: rgba(55, 138, 221, 0.4);
    color: #0284c7;
    background: rgba(55, 138, 221, 0.08);
  }
  .societe-view-modal__btn.is-danger:hover {
    border-color: rgba(226, 75, 74, 0.4);
    color: #E24B4A;
    background: rgba(226, 75, 74, 0.08);
  }
  .societe-view-modal__btn.is-ok:hover {
    border-color: rgba(29, 158, 117, 0.4);
    color: #1D9E75;
    background: rgba(29, 158, 117, 0.08);
  }
  .societe-view-modal__btn-primary {
    margin-left: auto;
    padding: 0.55rem 1.1rem;
    border: none;
    border-radius: 0.7rem;
    color: #fff;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    background: linear-gradient(135deg, #378ADD, #0EA5E9);
    box-shadow: 0 8px 20px -10px rgba(55, 138, 221, 0.55);
  }
`;

export function matchSocieteFilter(s, filter) {
  if (filter === "ALL") return true;
  if (filter === "VISIBLE") return s.actif !== false;
  if (filter === "HIDDEN") return s.actif === false;
  if (filter === "LOCATED") {
    return s.latitude != null && s.longitude != null;
  }
  return true;
}

/** Palette professionnelle pour les cartes tenant (bleu / cyan / émeraude / ambre) */
export const CARD_ACCENT_PALETTE = [
  {
    accent: "#378ADD",
    soft: "rgba(55,138,221,0.14)",
    border: "rgba(55,138,221,0.28)",
    gradient: "linear-gradient(135deg, #378ADD 0%, #2563eb 100%)",
    header: "linear-gradient(135deg, rgba(55,138,221,0.18) 0%, rgba(55,138,221,0.04) 100%)",
  },
  {
    accent: "#0EA5E9",
    soft: "rgba(14,165,233,0.14)",
    border: "rgba(14,165,233,0.28)",
    gradient: "linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)",
    header: "linear-gradient(135deg, rgba(14,165,233,0.18) 0%, rgba(14,165,233,0.04) 100%)",
  },
  {
    accent: "#06B6D4",
    soft: "rgba(6,182,212,0.14)",
    border: "rgba(6,182,212,0.28)",
    gradient: "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)",
    header: "linear-gradient(135deg, rgba(6,182,212,0.18) 0%, rgba(6,182,212,0.04) 100%)",
  },
  {
    accent: "#D97706",
    soft: "rgba(217,119,6,0.14)",
    border: "rgba(217,119,6,0.28)",
    gradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
    header: "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.04) 100%)",
  },
  {
    accent: "#1D9E75",
    soft: "rgba(29,158,117,0.14)",
    border: "rgba(29,158,117,0.28)",
    gradient: "linear-gradient(135deg, #1D9E75 0%, #059669 100%)",
    header: "linear-gradient(135deg, rgba(29,158,117,0.18) 0%, rgba(29,158,117,0.04) 100%)",
  },
];

/** Rouge clair — aligné sur l'interface Ventes (badges, KPI « Non encaissé ») */
export const VENTES_RED = {
  accent: "#E24B4A",
  soft: "rgba(226,75,74,0.12)",
  softAlt: "rgba(226,75,74,0.1)",
  border: "rgba(226,75,74,0.4)",
  iconBg: "#E24B4A18",
};

export const STAT_COLORS = {
  users: {
    color: "#0EA5E9",
    bg: "rgba(14,165,233,0.12)",
    border: "rgba(14,165,233,0.4)",
    iconBg: "#0EA5E918",
  },
  articles: {
    color: VENTES_RED.accent,
    bg: VENTES_RED.soft,
    border: VENTES_RED.border,
    iconBg: VENTES_RED.iconBg,
  },
  depots: {
    color: "#1D9E75",
    bg: "rgba(29,158,117,0.12)",
    border: "rgba(29,158,117,0.4)",
    iconBg: "#1D9E7518",
  },
};

export function getCardAccent(societe) {
  const key = Number(societe?.id ?? 0) || (societe?.nom?.charCodeAt(0) ?? 0);
  return CARD_ACCENT_PALETTE[Math.abs(key) % CARD_ACCENT_PALETTE.length];
}

export function societeHue(nom) {
  return ((nom?.charCodeAt(0) || 65) * 137) % 360;
}

export function societeGradient(nom) {
  const palette = CARD_ACCENT_PALETTE[societeHue(nom) % CARD_ACCENT_PALETTE.length];
  return palette.gradient;
}
