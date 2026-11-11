import {
  Check,
  Hash,
  Package,
  Pencil,
  Power,
  PowerOff,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { parseRefsStatut, refsStatutLabel } from "../refsStatusUi";

export const MARQUES_TABLE_CSS = `
  @keyframes marquesRowIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes marquesStatutPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.55; transform: scale(0.85); }
  }
  .marques-pro-shell {
    border: 1px solid var(--border-default);
    background: var(--bg-card);
    box-shadow: var(--shadow-card);
    backdrop-filter: blur(12px);
  }
  .marques-pro-shell__bar {
    height: 2px;
    background: linear-gradient(
      90deg,
      var(--accent-info) 0%,
      var(--accent-primary) 50%,
      var(--accent-info) 100%
    );
  }
  .marques-pro-thead {
    background: var(--bg-input);
    border-bottom: 1px solid var(--border-default);
  }
  .marques-pro-row {
    border-top: 1px solid var(--border-subtle);
    transition: background 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
  }
  .marques-pro-row:hover {
    background: var(--bg-hover);
    box-shadow: inset 3px 0 0 var(--accent-info);
  }
  .marques-pro-row.is-inactive {
    opacity: 0.82;
  }
  .marques-col-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 1px solid transparent;
    flex-shrink: 0;
  }
  .marques-col-icon--info {
    background: var(--info-bg);
    color: var(--info-text);
    border-color: var(--info-border);
  }
  .marques-col-icon--success {
    background: var(--success-bg);
    color: var(--success-text);
    border-color: var(--success-border);
  }
  .marques-col-icon--warning {
    background: var(--warning-bg);
    color: var(--warning-text);
    border-color: var(--warning-border);
  }
  .marques-col-icon--muted {
    background: var(--bg-badge);
    color: var(--text-secondary);
    border-color: var(--border-subtle);
  }
  .marques-col-icon--accent {
    background: var(--accent-soft);
    color: var(--accent-primary);
    border-color: var(--border-subtle);
  }
  .marques-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
  }
  .marques-icon-btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }
  .marques-icon-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
  }
  .marques-icon-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .marques-icon-btn--info {
    color: #378ADD;
  }
  .marques-icon-btn--info:hover:not(:disabled) {
    background: rgba(55, 138, 221, 0.12);
  }
  .marques-icon-btn--success {
    color: #1D9E75;
  }
  .marques-icon-btn--success:hover:not(:disabled) {
    background: rgba(29, 158, 117, 0.12);
  }
  .marques-icon-btn--danger {
    color: #E24B4A;
  }
  .marques-icon-btn--danger:hover:not(:disabled) {
    background: rgba(226, 75, 74, 0.12);
  }
  .marques-icon-btn--muted {
    color: var(--text-muted);
  }
  .marques-icon-btn--muted:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  .marques-icon-btn--warning {
    color: #BA7517;
  }
  .marques-icon-btn--warning:hover:not(:disabled) {
    background: rgba(186, 117, 23, 0.12);
  }
  .marques-actions-bar {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .marques-statut-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: 1px solid transparent;
  }
  .marques-statut-pill.is-actif {
    background: var(--success-bg);
    color: var(--success-text);
    border-color: var(--success-border);
  }
  .marques-statut-pill.is-inactif {
    background: var(--bg-input);
    color: var(--text-muted);
    border-color: var(--border-default);
  }
  .marques-statut-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .marques-statut-dot.is-actif {
    background: var(--accent-success);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-success) 25%, transparent);
    animation: marquesStatutPulse 2s ease-in-out infinite;
  }
  .marques-statut-dot.is-inactif {
    background: var(--text-muted);
  }
  .marques-articles-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    border: 1px solid transparent;
  }
  .marques-articles-badge.has-items {
    background: var(--success-bg);
    color: var(--success-text);
    border-color: var(--success-border);
  }
  .marques-articles-badge.is-empty {
    background: var(--bg-input);
    color: var(--text-muted);
    border-color: var(--border-default);
  }
  .marques-articles-badge__icon {
    display: inline-flex;
    padding: 3px;
    border-radius: 6px;
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
  .marques-code-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 10px;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    border: 1px solid var(--info-border);
    background: var(--info-bg);
    color: var(--info-text);
  }
  .marques-avatar-ring {
    position: relative;
    border-radius: 14px;
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }
  .marques-pro-row:hover .marques-avatar-ring {
    transform: scale(1.06);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-info) 22%, transparent);
  }
  .familles-tree-row--parent {
    border-top: 1px solid var(--border-subtle);
    transition: background 0.22s ease, box-shadow 0.22s ease;
  }
  .familles-tree-row--parent:hover {
    background: var(--bg-hover);
    box-shadow: inset 4px 0 0 var(--famille-accent, var(--accent-info));
  }
  .familles-tree-row--child {
    border-top: 1px solid var(--border-subtle);
    background: color-mix(in srgb, var(--bg-input) 55%, transparent);
    transition: background 0.22s ease, box-shadow 0.22s ease;
  }
  .familles-tree-row--child:hover {
    background: var(--bg-hover);
    box-shadow: inset 4px 0 0 var(--accent-success);
  }
  .familles-tree-expand {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 1px solid var(--border-default);
    background: var(--bg-input);
    color: var(--text-muted);
    flex-shrink: 0;
    transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  }
  .familles-tree-expand.is-open {
    background: var(--info-bg);
    color: var(--info-text);
    border-color: var(--info-border);
    transform: rotate(90deg);
  }
  .familles-tree-row--parent:hover .familles-tree-expand:not(.is-open) {
    border-color: var(--info-border);
    color: var(--info-text);
  }
  .familles-sf-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    border: 1px solid var(--border-default);
    background: var(--bg-badge);
    color: var(--text-muted);
  }
  .familles-sf-count.has-items {
    background: var(--accent-soft);
    color: var(--accent-primary);
    border-color: color-mix(in srgb, var(--accent-primary) 25%, transparent);
  }
  .familles-child-connector {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 2.75rem;
  }
  .familles-child-line {
    width: 2px;
    height: 28px;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--accent-success), transparent);
    flex-shrink: 0;
    opacity: 0.45;
  }
  .familles-child-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--success-bg);
    color: var(--success-text);
    border: 1px solid var(--success-border);
    flex-shrink: 0;
  }
`;

const COL_TONES = {
  info: "marques-col-icon--info",
  success: "marques-col-icon--success",
  warning: "marques-col-icon--warning",
  muted: "marques-col-icon--muted",
  accent: "marques-col-icon--accent",
};

const BTN_VARIANTS = {
  edit: { className: "marques-icon-btn--info", Icon: Pencil },
  deactivate: { className: "marques-icon-btn--warning", Icon: PowerOff },
  activate: { className: "marques-icon-btn--success", Icon: Power },
  delete: { className: "marques-icon-btn--danger", Icon: Trash2 },
  save: { className: "marques-icon-btn--success", Icon: Check },
  cancel: { className: "marques-icon-btn--muted", Icon: X },
};

export function MarquesTableStyles() {
  return <style>{MARQUES_TABLE_CSS}</style>;
}

export function MarquesTableShell({
  resultCount,
  title = "Référentiel marques",
  subtitle = "Gestion centralisée du catalogue",
  icon: HeaderIcon = Sparkles,
  children,
}) {
  return (
    <div className="marques-pro-shell overflow-hidden rounded-2xl animate-fadeUp">
      <div className="marques-pro-shell__bar" aria-hidden />
      <div
        className="flex items-center justify-between gap-3 border-b px-5 py-3.5"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="marques-col-icon marques-col-icon--accent">
            <HeaderIcon size={14} />
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {title}
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tabular-nums"
          style={{
            background: "var(--info-bg)",
            color: "var(--info-text)",
            border: "1px solid var(--info-border)",
          }}
        >
          <Zap size={12} />
          {resultCount} résultat{resultCount !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function MarquesColHead({ icon: Icon, label, tone = "info" }) {
  return (
    <th className="px-5 py-3.5">
      <div className="flex items-center gap-2">
        <span className={`marques-col-icon ${COL_TONES[tone] || COL_TONES.info}`}>
          <Icon size={13} strokeWidth={2.25} />
        </span>
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
      </div>
    </th>
  );
}

export function MarquesColHeadActions() {
  return (
    <th className="px-5 py-3.5 text-right">
      <div className="inline-flex items-center justify-end gap-2">
        <span className={`marques-col-icon ${COL_TONES.accent}`}>
          <SlidersHorizontal size={13} strokeWidth={2.25} />
        </span>
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Actions
        </span>
      </div>
    </th>
  );
}

export function MarquesIconBtn({ variant, onClick, title, disabled }) {
  const cfg = BTN_VARIANTS[variant] || BTN_VARIANTS.edit;
  const { Icon, className } = cfg;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`marques-icon-btn ${className}`}
    >
      <Icon size={16} strokeWidth={2.25} />
    </button>
  );
}

export function MarquesActionsBar({ children }) {
  return <div className="marques-actions-bar">{children}</div>;
}

export function MarquesStatutPill({ row }) {
  const statut = parseRefsStatut(row);
  const isActif = statut === "ACTIF";
  return (
    <span className={`marques-statut-pill ${isActif ? "is-actif" : "is-inactif"}`}>
      <span className={`marques-statut-dot ${isActif ? "is-actif" : "is-inactif"}`} />
      {refsStatutLabel(statut)}
    </span>
  );
}

export function MarquesArticlesBadge({ count }) {
  const n = Number(count) || 0;
  const hasItems = n > 0;
  return (
    <span className={`marques-articles-badge ${hasItems ? "has-items" : "is-empty"}`}>
      <span className="marques-articles-badge__icon">
        <Package size={13} strokeWidth={2.25} />
      </span>
      {n}
    </span>
  );
}

export function MarquesCodeChip({ code }) {
  return (
    <span className="marques-code-chip">
      <Hash size={11} strokeWidth={2.5} />
      {code}
    </span>
  );
}

export function MarquesAvatarWrap({ children }) {
  return <div className="marques-avatar-ring flex-shrink-0">{children}</div>;
}

export const MARQUES_COL_ICONS = { Tag, Hash, Package, Zap, SlidersHorizontal };
