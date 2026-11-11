import Modal, { btnPrimary, btnSecondary } from "./Modal";

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "danger",
  onClose,
  onConfirm,
  loading = false,
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`${btnPrimary} ${variant === "danger" ? "!bg-red-600 hover:!bg-red-500" : variant === "primary" ? "!bg-[#378ADD] hover:!bg-[#2d7bc4]" : ""}`}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{message}</p>
    </Modal>
  );
}
