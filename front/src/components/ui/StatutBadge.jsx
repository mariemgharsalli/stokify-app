import { STATUTS_ACHAT, STATUTS_VENTE, PAIEMENT_STATUTS, normalizeStatutAchat, normalizeStatutVente } from "../../constants/statuts";

function Badge({ config, showTooltip = true, className = "", pulse = false }) {
  if (!config) return null;
  const { label, bg, border, color, Icon, description } = config;
  return (
    <span
      title={showTooltip ? description || label : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${pulse ? "animate-pulse" : ""} ${className}`}
      style={{ background: bg, borderColor: border, color }}
    >
      {Icon ? <Icon size={12} stroke={2} aria-hidden /> : null}
      {label}
    </span>
  );
}

export function StatutBadgeAchat({ statut, showTooltip = true, className = "" }) {
  const key = normalizeStatutAchat(statut);
  const config = STATUTS_ACHAT[key] || STATUTS_ACHAT.BROUILLON;
  return <Badge config={config} showTooltip={showTooltip} className={className} pulse={config.pulse} />;
}

export function StatutBadgeVente({ statut, showTooltip = true, className = "" }) {
  const key = normalizeStatutVente(statut);
  const config = STATUTS_VENTE[key] || STATUTS_VENTE.BROUILLON;
  return <Badge config={config} showTooltip={showTooltip} className={className} pulse={config.pulse} />;
}

export function PaiementBadge({ statut, showTooltip = true, className = "", enRetard = false }) {
  const key = enRetard && statut !== "REGLE" ? "EN_RETARD" : statut;
  const config = PAIEMENT_STATUTS[key] || PAIEMENT_STATUTS.NON_REGLE;
  return (
    <Badge
      config={config}
      showTooltip={showTooltip}
      className={className}
      pulse={Boolean(config.pulse)}
    />
  );
}
