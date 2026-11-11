import { useEffect, useState } from "react";

export default function ConfirmToggleTierModal({ tier, tierType, nextActif, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!tier) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tier, loading]);

  if (!tier) return null;

  const isDeactivating = nextActif === false;
  const label = tierType === "client" ? "client" : "fournisseur";
  const impact =
    tierType === "client"
      ? "Ce client ne sera plus proposé dans les nouvelles ventes. Aucune donnée ne sera perdue."
      : "Ce fournisseur ne sera plus proposé dans les nouveaux achats. Aucune donnée ne sera perdue.";

  function handleClose() {
    if (loading) return;
    setClosing(true);
    window.setTimeout(onClose, 180);
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[250] flex items-center justify-center p-4"
      style={{
        background: "var(--overlay-backdrop)",
        animation: closing ? "tierModalOut 0.18s ease forwards" : "tierModalIn 0.2s ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{
          background: "var(--bg-modal)",
          borderColor: isDeactivating ? "rgba(226,75,74,0.3)" : "rgba(29,158,117,0.3)",
          boxShadow: "var(--shadow-modal)",
          animation: closing ? "tierModalOut 0.18s ease forwards" : "tierModalIn 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          {isDeactivating ? `Désactiver ce ${label} ?` : `Réactiver ce ${label} ?`}
        </h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-primary)" }}>{tier.nom}</strong> ({tier.code})
          {isDeactivating ? " sera désactivé." : " sera de nouveau disponible."}
        </p>
        {isDeactivating && (
          <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
            {impact}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await onConfirm(tier, nextActif);
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{
              background: isDeactivating ? "#E24B4A" : "linear-gradient(135deg,#1D9E75,#059669)",
            }}
          >
            {loading ? "En cours…" : isDeactivating ? "Désactiver" : "Réactiver"}
          </button>
        </div>
      </div>
    </div>
  );
}
