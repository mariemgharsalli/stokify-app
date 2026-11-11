import { useState } from "react";
import { Building2 } from "lucide-react";
import { clientContactLine, clientLocationLine } from "../../utils/clientBranding";

/**
 * Bandeau d'identité client pour les écrans entrepôt / rapports.
 * Affiche le logo et la marque de la société propriétaire (pas Stokify).
 */
export default function ClientBrandBar({ branding, compact = false, className = "" }) {
  const [imgError, setImgError] = useState(false);
  const logoSrc = branding?.logoUrl || branding?.logo;
  const location = clientLocationLine(branding);
  const contact = clientContactLine(branding);

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border sm:flex-row sm:items-center sm:justify-between ${className}`}
      style={{
        background: "linear-gradient(135deg, color-mix(in srgb, var(--bg-card) 96%, #1B3A5C 4%) 0%, var(--bg-card) 100%)",
        borderColor: "color-mix(in srgb, var(--border-default) 80%, #1B3A5C 20%)",
        boxShadow: "var(--shadow-card)",
        padding: compact ? "12px 16px" : "16px 20px",
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{
            width: compact ? 44 : 52,
            height: compact ? 44 : 52,
            background: branding?.accentHex || "#1B3A5C",
            boxShadow: "0 4px 14px rgba(27, 58, 92, 0.22)",
          }}
        >
          {logoSrc && !imgError ? (
            <img
              src={logoSrc}
              alt={`Logo ${branding?.nom || "client"}`}
              className="h-full w-full object-contain p-1.5"
              onError={() => setImgError(true)}
            />
          ) : (
            <Building2 className="h-6 w-6 text-white" strokeWidth={1.75} />
          )}
        </div>
        <div className="min-w-0">
          <p
            className="truncate font-semibold tracking-tight"
            style={{
              color: "var(--color-text-primary, var(--text-primary))",
              fontSize: compact ? "0.9rem" : "1rem",
            }}
          >
            {branding?.nom || "—"}
          </p>
          {!compact && branding?.tagline && (
            <p className="truncate text-xs" style={{ color: branding?.accentSecondaryHex || "#2A9D8F" }}>
              {branding.tagline}
            </p>
          )}
          {!compact && location !== "—" && (
            <p className="truncate text-[11px] text-[var(--color-text-tertiary,var(--text-muted))]">
              {location}
            </p>
          )}
        </div>
      </div>

      {!compact && contact && (
        <div className="hidden text-right text-[11px] leading-relaxed text-[var(--color-text-secondary,var(--text-secondary))] md:block">
          {contact.split(" · ").map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
