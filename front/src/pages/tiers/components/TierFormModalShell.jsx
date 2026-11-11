import { createPortal } from "react-dom";
import { UserPlus, Truck, X } from "lucide-react";

const ACCENT = "#378ADD";
const CYAN = "#0EA5E9";

/**
 * Coque partagée — Nouveau / Modifier client ou fournisseur.
 * z-index élevé pour passer au-dessus des cartes Leaflet de la grille.
 */
export default function TierFormModalShell({
  variant = "client",
  title,
  subtitle,
  avatar = null,
  onClose,
  tabs = [],
  activeTab,
  onTabChange,
  footer,
  children,
  slideKey = "clientSlideUp",
}) {
  const Icon = variant === "fournisseur" ? Truck : UserPlus;
  const spinName = variant === "fournisseur" ? "fournSpin" : "clientSpin";

  return createPortal(
    <div
      role="presentation"
      className="tier-form-modal-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        overflowY: "auto",
        background: "rgba(11, 31, 58, 0.42)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        @keyframes ${slideKey} {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ${spinName} { to { transform: rotate(360deg); } }
        .tier-form-modal {
          position: relative;
          width: 100%;
          max-width: 580px;
          margin: auto;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, ${ACCENT} 28%, var(--border-default));
          background: var(--bg-modal);
          box-shadow:
            0 28px 64px -24px rgba(11, 31, 58, 0.55),
            0 0 0 1px rgba(255,255,255,0.04) inset;
          animation: ${slideKey} 0.28s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .tier-form-modal__beam {
          position: absolute;
          inset: 0 0 auto 0;
          height: 3px;
          background: linear-gradient(90deg, #0B1F3A, ${ACCENT}, ${CYAN}, #67E8F9);
          z-index: 2;
        }
        .tier-form-modal__header {
          position: relative;
          padding: 1.25rem 1.35rem 1.1rem;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background:
            linear-gradient(135deg,
              color-mix(in srgb, #0B1F3A 88%, ${ACCENT}),
              #0B1F3A 55%,
              color-mix(in srgb, #0B1F3A 90%, ${CYAN}));
        }
        .tier-form-modal__close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.85);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .tier-form-modal__close:hover {
          background: rgba(255,255,255,0.16);
          color: white;
        }
        .tier-form-modal__avatar {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: linear-gradient(145deg, ${ACCENT}, ${CYAN});
          box-shadow: 0 10px 22px -10px rgba(55,138,221,0.75);
          color: white;
        }
        .tier-form-modal__kicker {
          margin: 0 0 2px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(125, 211, 252, 0.85);
        }
        .tier-form-modal__title {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: white;
          line-height: 1.25;
        }
        .tier-form-modal__sub {
          margin: 4px 0 0;
          font-size: 12px;
          color: rgba(186, 230, 253, 0.75);
        }
        .tier-form-modal__body {
          padding: 1.15rem 1.35rem 0.5rem;
        }
        .tier-form-modal__tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          margin-bottom: 1.15rem;
          border-radius: 12px;
          background: color-mix(in srgb, var(--color-background-secondary) 92%, ${ACCENT});
          border: 1px solid color-mix(in srgb, ${ACCENT} 12%, transparent);
        }
        .tier-form-modal__tab {
          flex: 1;
          padding: 8px 10px;
          border: none;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          background: transparent;
          color: var(--color-text-secondary);
          white-space: nowrap;
        }
        .tier-form-modal__tab.is-active {
          background: color-mix(in srgb, ${ACCENT} 18%, var(--color-background-primary));
          color: var(--color-text-primary);
          box-shadow: 0 1px 6px rgba(55, 138, 221, 0.18);
          outline: 1px solid color-mix(in srgb, ${ACCENT} 35%, transparent);
        }
        .tier-form-modal__footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          padding: 1rem 1.35rem 1.25rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          margin-top: 0.75rem;
        }
        .tier-form-btn-ghost {
          padding: 9px 16px;
          font-size: 13px;
          border-radius: 10px;
          cursor: pointer;
          background: transparent;
          border: 1px solid var(--color-border-secondary);
          color: var(--color-text-secondary);
        }
        .tier-form-btn-ghost:hover {
          border-color: color-mix(in srgb, ${ACCENT} 40%, var(--color-border-secondary));
          color: var(--color-text-primary);
        }
        .tier-form-btn-primary {
          padding: 9px 20px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          color: white;
          background: linear-gradient(135deg, ${ACCENT}, ${CYAN});
          box-shadow: 0 8px 20px -8px rgba(55, 138, 221, 0.65);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .tier-form-btn-primary:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }
        .tier-form-modal .c-label,
        .tier-form-modal .f-label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-secondary);
          margin-bottom: 5px;
        }
        .tier-form-modal input:not([type="range"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]),
        .tier-form-modal select,
        .tier-form-modal textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 9px 12px;
          border-radius: 10px;
          border: 1px solid var(--color-border-secondary);
          background: var(--color-background-secondary);
          color: var(--color-text-primary);
          font-size: 14px;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .tier-form-modal input:focus,
        .tier-form-modal select:focus,
        .tier-form-modal textarea:focus {
          outline: none;
          border-color: color-mix(in srgb, ${ACCENT} 55%, var(--color-border-secondary));
          box-shadow: 0 0 0 3px rgba(55, 138, 221, 0.18);
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tier-form-modal-title"
        className="tier-form-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tier-form-modal__beam" aria-hidden />

        <header className="tier-form-modal__header">
          <button type="button" className="tier-form-modal__close" onClick={onClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 40 }}>
            {avatar ? (
              avatar
            ) : (
              <div className="tier-form-modal__avatar">
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </div>
            )}
            <div>
              <p className="tier-form-modal__kicker">
                {variant === "fournisseur" ? "Fournisseur" : "Client"}
              </p>
              <h2 id="tier-form-modal-title" className="tier-form-modal__title">
                {title}
              </h2>
              {subtitle ? <p className="tier-form-modal__sub">{subtitle}</p> : null}
            </div>
          </div>
        </header>

        <div className="tier-form-modal__body">
          {tabs.length > 0 ? (
            <div className="tier-form-modal__tabs" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.id}
                  className={`tier-form-modal__tab${activeTab === t.id ? " is-active" : ""}`}
                  onClick={() => onTabChange?.(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}
          {children}
        </div>

        {footer ? <div className="tier-form-modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export { ACCENT as TIER_FORM_ACCENT, CYAN as TIER_FORM_CYAN };
