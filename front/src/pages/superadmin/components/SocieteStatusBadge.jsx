/** Badge statut tenant — actif (teal + pulse) ou désactivé (gris/rouge sourd). */
export default function SocieteStatusBadge({ actif, className = "" }) {
  const isActive = actif !== false;

  if (isActive) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${className}`}
        style={{
          background: "var(--success-bg)",
          color: "var(--success-text)",
          borderColor: "var(--success-border)",
        }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: "var(--success-text)" }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--success-text)" }}
          />
        </span>
        Visible
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${className}`}
      style={{
        background: "rgba(226,75,74,0.08)",
        color: "rgba(226,75,74,0.85)",
        borderColor: "rgba(226,75,74,0.22)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "rgba(226,75,74,0.55)" }}
      />
      Désactivée
    </span>
  );
}
