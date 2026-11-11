import { AlertTriangle, Building2, Package, Power, Users, Warehouse } from "lucide-react";
import { primaryButtonStyle } from "../../../utils/brandStyles";

export default function ConfirmToggleSocieteModal({
  company,
  nextActif,
  onClose,
  onConfirm,
  loading,
}) {
  if (!company) return null;

  const counts = company._count || {};
  const isDeactivating = nextActif === false;
  const userCount = counts.utilisateurs ?? 0;
  const articleCount = counts.articles ?? 0;
  const depotCount = counts.depots ?? 0;

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
            background: isDeactivating
              ? "linear-gradient(180deg, var(--danger-bg) 0%, transparent 100%)"
              : "linear-gradient(180deg, var(--success-bg) 0%, transparent 100%)",
          }}
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{
              background: isDeactivating ? "var(--danger-bg)" : "var(--success-bg)",
              border: `1px solid ${isDeactivating ? "var(--danger-border)" : "var(--success-border)"}`,
            }}
          >
            {isDeactivating ? (
              <AlertTriangle className="h-6 w-6" style={{ color: "var(--danger-text)" }} />
            ) : (
              <Power className="h-6 w-6" style={{ color: "var(--success-text)" }} />
            )}
          </div>
          <h3 className="text-center text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {isDeactivating ? "Désactiver cette société ?" : "Réactiver cette société ?"}
          </h3>
          <p className="mt-2 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>{company.nom}</strong> ({company.code})
            {isDeactivating
              ? " ne sera plus accessible pour ses utilisateurs."
              : " sera de nouveau accessible pour tous ses utilisateurs."}
          </p>
        </div>

        <div className="px-6 pb-2">
          {isDeactivating ? (
            <>
              <div
                className="rounded-lg border p-4"
                style={{
                  background: "var(--bg-input)",
                  borderColor: "var(--border-default)",
                }}
              >
                <p
                  className="mb-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  Impact de la désactivation
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Users, value: userCount, label: "Utilisateurs" },
                    { icon: Package, value: articleCount, label: "Articles" },
                    { icon: Warehouse, value: depotCount, label: "Dépôts" },
                  ].map(({ icon: Icon, value, label }) => (
                    <div key={label} className="text-center">
                      <Icon
                        className="mx-auto mb-1 h-4 w-4"
                        style={{ color: "var(--danger-text)" }}
                      />
                      <p
                        className="text-lg font-bold tabular-nums"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {value}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--text-primary)" }}>
                  {userCount} utilisateur{userCount !== 1 ? "s" : ""}
                </strong>{" "}
                ne pourront plus se connecter. Aucune donnée ne sera supprimée. Vous pourrez réactiver
                cette société à tout moment.
              </p>
            </>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Les utilisateurs de cette société pourront à nouveau se connecter et accéder à leurs
              données. Aucune donnée n&apos;a été supprimée pendant la désactivation.
            </p>
          )}

          <p className="mt-3 flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {isDeactivating
              ? "Action réversible — les données du tenant sont conservées."
              : "La société réapparaîtra dans les sélecteurs et listes d'inscription."}
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
            {loading
              ? "En cours…"
              : isDeactivating
                ? "Désactiver la société"
                : "Réactiver la société"}
          </button>
        </div>
      </div>
    </>
  );
}
