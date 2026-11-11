import { AlertTriangle, Building2, Package, Users, Warehouse } from "lucide-react";
import { primaryButtonStyle } from "../../../utils/brandStyles";

export default function ConfirmDeleteModal({ company, onClose, onConfirm, loading }) {
  if (!company) return null;

  const counts = company._count || {};

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: "var(--overlay-backdrop)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
        role="presentation"
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border shadow-2xl"
        style={{
          background: "var(--bg-modal)",
          borderColor: "var(--border-default)",
          animation: "societesFadeUp 0.22s ease",
        }}
      >
        <div
          className="px-6 pb-4 pt-6"
          style={{
            background: "linear-gradient(180deg, var(--danger-bg) 0%, transparent 100%)",
          }}
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)" }}
          >
            <AlertTriangle className="h-6 w-6" style={{ color: "var(--danger-text)" }} />
          </div>
          <h3 className="text-center text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Supprimer cette société ?
          </h3>
          <p className="mt-2 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>{company.nom}</strong>
            {" "}({company.code}) sera définitivement supprimée.
          </p>
        </div>

        <div className="px-6 pb-2">
          <div
            className="rounded-lg border p-4"
            style={{
              background: "var(--bg-input)",
              borderColor: "var(--border-default)",
            }}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Données associées
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Users, value: counts.utilisateurs, label: "Utilisateurs" },
                { icon: Package, value: counts.articles, label: "Articles" },
                { icon: Warehouse, value: counts.depots, label: "Dépôts" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="text-center">
                  <Icon className="mx-auto h-4 w-4 mb-1" style={{ color: "var(--danger-text)" }} />
                  <p className="text-lg font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {value ?? 0}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-3 flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Cette action est irréversible. Toutes les données du tenant seront perdues.
          </p>
        </div>

        <div className="flex gap-3 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="stokify-btn-action flex-1 rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
            style={primaryButtonStyle}
          >
            {loading ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </>
  );
}
