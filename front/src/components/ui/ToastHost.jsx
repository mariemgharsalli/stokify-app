import { useToastStore } from "../../store/toastStore";
import { useLangStore } from "../../store/langStore";
import { translatePhrase } from "../../i18n/tx";
import { RichStockToast } from "../notifications/RichStockToast";

const VARIANTS = {
  success: {
    color: "#1D9E75",
    bg: "rgba(29,158,117,0.1)",
    border: "rgba(29,158,117,0.3)",
    icon: "ti-check-circle",
  },
  warning: {
    color: "#EF9F27",
    bg: "rgba(239,159,39,0.1)",
    border: "rgba(239,159,39,0.3)",
    icon: "ti-alert-triangle",
  },
  error: {
    color: "#E24B4A",
    bg: "rgba(226,75,74,0.1)",
    border: "rgba(226,75,74,0.3)",
    icon: "ti-alert-circle",
  },
  info: {
    color: "#378ADD",
    bg: "rgba(55,138,221,0.1)",
    border: "rgba(55,138,221,0.3)",
    icon: "ti-info-circle",
  },
};

export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismissToast);
  const lang = useLangStore((s) => s.lang);
  const rtl = lang === "ar";
  if (toasts.length === 0) return null;

  return (
    <div
      className={`pointer-events-none fixed bottom-6 z-[2000] flex max-w-[360px] flex-col gap-2 px-3 ${
        rtl ? "left-6 items-start" : "right-6 items-end"
      }`}
      aria-live="polite"
    >
      {toasts.map((t) => {
        if (t.kind === "rich") {
          return <RichStockToast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />;
        }

        const v = VARIANTS[t.variant] || VARIANTS.info;
        return (
          <div
            key={t.id}
            className="toast-slide-in pointer-events-auto flex w-full items-start gap-2.5 rounded-[10px] border bg-[var(--bg-card)] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
            style={{
              borderColor: v.border,
              [rtl ? "borderRight" : "borderLeft"]: `3px solid ${v.color}`,
            }}
          >
            <i
              className={`ti ${v.icon} mt-px shrink-0 text-lg`}
              style={{ color: v.color }}
              aria-hidden="true"
            />
            <p className="flex-1 text-[13px] leading-snug text-[var(--text-primary)]">
              {translatePhrase(t.message, lang)}
            </p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label={translatePhrase("Fermer", lang)}
            >
              <i className="ti ti-x text-base" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
