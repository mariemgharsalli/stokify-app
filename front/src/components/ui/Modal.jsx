import { useEffect } from "react";
import { X } from "lucide-react";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";

export default function Modal({ title, children, onClose, footer, size = "md" }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const maxW = size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-md" : "max-w-xl";

  const stop = (e) => e.stopPropagation();

  return (
    <div className="pointer-events-auto fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <div
        className="modal-overlay-backdrop absolute inset-0 z-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className={`modal-overlay-dialog modal-panel pointer-events-auto relative z-[1] w-full ${maxW} max-h-[90vh] overflow-hidden rounded-2xl border border-[var(--border-default)] shadow-[var(--shadow-modal)] flex flex-col`}
        style={{ background: "var(--bg-modal)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={stop}
        onMouseDown={stop}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-5 py-4 shrink-0">
          <h2 id="modal-title" className="text-base font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onClose?.();
            }}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1 text-[var(--text-primary)]">{children}</div>
        {footer ? (
          <div className="border-t border-[var(--border-default)] px-5 py-4 shrink-0">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function ModalInfo({ children, variant = "info" }) {
  const styles =
    variant === "danger"
      ? { bg: "rgba(226,75,74,0.08)", border: "rgba(226,75,74,0.2)", color: "#E24B4A" }
      : variant === "success"
        ? { bg: "rgba(29,158,117,0.08)", border: "rgba(29,158,117,0.2)", color: "#1D9E75" }
        : { bg: "rgba(55,138,221,0.08)", border: "rgba(55,138,221,0.2)", color: "#378ADD" };
  return (
    <div
      className="mb-4 rounded-lg border px-3 py-2.5 text-xs leading-relaxed"
      style={{ background: styles.bg, borderColor: styles.border, color: styles.color }}
    >
      {children}
    </div>
  );
}

export const btnPrimary = PRIMARY_BTN_CLASSES;
export { primaryButtonStyle };
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]";
export const inputStyle =
  "w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-focus)] focus:outline-none";
