import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import WizardSteps from "./WizardSteps";

/**
 * Fenêtre centrée animée pour les assistants vente / achat.
 * Portail sur document.body (hors #stokify-overlay-root pointer-events:none).
 */
export default function CommerceFormDrawer({
  title,
  subtitle,
  steps,
  currentStep,
  onClose,
  footer,
  children,
  /** Panneau plus large (ex. achats avec tableau de lignes) */
  wide = false,
  /** Accent visuel : "vente" | "achat" */
  accent = "vente",
}) {
  const instanceId = useId();
  const panelMaxW = wide ? "max-w-[min(960px,94vw)]" : "max-w-[min(720px,94vw)]";
  const bodyPad = wide ? "px-6 py-6" : "px-5 py-5";
  const isAchat = accent === "achat";
  const accentColor = isAchat ? "#1D9E75" : "#7c3aed";
  const accentSoft = isAchat ? "rgba(29,158,117,0.12)" : "rgba(124,58,237,0.12)";
  const accentGlow = isAchat ? "rgba(29,158,117,0.28)" : "rgba(124,58,237,0.28)";

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Une seule fenêtre commerce à la fois
    document.querySelectorAll("[data-commerce-form-root]").forEach((el) => {
      if (el.getAttribute("data-commerce-form-root") !== instanceId) {
        el.remove();
      }
    });
    return () => {
      document.body.style.overflow = prev;
    };
  }, [instanceId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const content = (
    <div
      className="commerce-drawer-root fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6"
      data-commerce-form-root={instanceId}
      role="presentation"
    >
      <button
        type="button"
        className="commerce-modal-backdrop absolute inset-0 cursor-pointer border-0"
        onClick={onClose}
        aria-label="Fermer le formulaire"
      />

      <aside
        className={`commerce-form-modal relative z-[1] flex max-h-[min(92vh,900px)] w-full ${panelMaxW} flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] shadow-2xl`}
        style={{
          background: "var(--bg-card)",
          boxShadow: `0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px ${accentSoft}, 0 0 48px -12px ${accentGlow}`,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="commerce-drawer-title"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="commerce-modal-accent-bar absolute inset-x-0 top-0 h-1"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          }}
          aria-hidden="true"
        />

        <div
          className="commerce-modal-glow pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-35 blur-2xl"
          style={{ background: accentSoft }}
          aria-hidden="true"
        />
        <div
          className="commerce-modal-glow-delayed pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full opacity-25 blur-2xl"
          style={{ background: accentSoft }}
          aria-hidden="true"
        />

        <header className="relative shrink-0 border-b border-[var(--border-default)] px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="commerce-modal-pulse-dot inline-block h-2 w-2 rounded-full"
                  style={{ background: accentColor }}
                  aria-hidden="true"
                />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: accentColor }}>
                  {isAchat ? "Achats" : "Ventes"}
                </span>
              </div>
              <h2 id="commerce-drawer-title" className="truncate text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                {title}
              </h2>
              {subtitle ? <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="commerce-modal-close shrink-0 rounded-xl p-2 text-[var(--text-muted)] transition-all duration-200 hover:scale-105 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {steps?.length ? (
            <div className="mt-5">
              <WizardSteps steps={steps} current={currentStep} />
            </div>
          ) : null}
        </header>

        <div
          className={`commerce-form-drawer-body relative min-h-0 flex-1 overflow-y-auto ${wide ? "overflow-x-auto" : "overflow-x-hidden"} ${bodyPad}`}
        >
          {children}
        </div>

        {footer ? (
          <footer className="relative shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-card)]">{footer}</footer>
        ) : null}
      </aside>
    </div>
  );

  return createPortal(content, document.body);
}
