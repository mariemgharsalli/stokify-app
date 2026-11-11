import { fr } from "../strings/fr";

export default function UpdateToast({ onUpdate, onDismiss }) {
  return (
    <div
      role="status"
      aria-label={`${fr.updateAvailable} — ${fr.updateAction}`}
      className="fixed start-3 end-3 z-40 flex flex-col gap-3 rounded-2xl border p-4 shadow-lg"
      style={{
        bottom: "calc(5.75rem + env(safe-area-inset-bottom))",
        background: "var(--bg-card)",
        color: "var(--text-primary)",
        borderColor: "var(--border-default)",
      }}
    >
      <p className="text-base font-semibold">
        {fr.updateAvailable} — {fr.updateAction}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onUpdate}
          className="terrain-primary inline-flex min-h-12 flex-1 items-center justify-center rounded-xl px-4 text-base font-semibold touch-manipulation"
        >
          {fr.updateAction}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-base font-semibold touch-manipulation"
          style={{ color: "var(--text-secondary)" }}
        >
          {fr.updateLater}
        </button>
      </div>
    </div>
  );
}
