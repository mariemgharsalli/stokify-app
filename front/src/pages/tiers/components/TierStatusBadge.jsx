/** Badge statut tier (fournisseur / client) — Actif teal + pulse / Désactivé rouge doux */
export default function TierStatusBadge({ actif, className = "" }) {
  const isActive = actif !== false;

  if (isActive) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
        style={{
          background: "rgba(29,158,117,0.12)",
          color: "#1D9E75",
          borderColor: "rgba(29,158,117,0.35)",
        }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: "#1D9E75" }}
          />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "#1D9E75" }} />
        </span>
        Actif
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
      style={{
        background: "rgba(226,75,74,0.1)",
        color: "#E24B4A",
        borderColor: "rgba(226,75,74,0.3)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#E24B4A" }} />
      Désactivé
    </span>
  );
}
