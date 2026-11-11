import { useNavigate } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { IconPencil, IconTruck } from "@tabler/icons-react";
import { Package, Truck, Warehouse, CalendarDays } from "lucide-react";
import { StatutBadgeAchat, PaiementBadge } from "../ui/StatutBadge";
import { formatDate, num3, initials } from "../../utils/commerceUi";
import { isAchatEnRetard, normalizeStatutAchat, statutAchatColor } from "../../constants/statuts";
import CommerceDocCardShell, {
  CommerceAvatarRing,
  CommerceMiniGauge,
  COMMERCE_THEME,
  useAnimatedNumber,
} from "../commerce/CommerceDocCardShell";

function paymentPct(achat) {
  const pay = String(achat.statutPaiement || "NON_REGLE").toUpperCase();
  if (pay === "REGLE") return 100;
  if (pay === "PARTIEL") return 55;
  const s = normalizeStatutAchat(achat.statut);
  if (s === "CONFIRME" || s === "RECU") return 35;
  if (s === "BROUILLON") return 12;
  return 20;
}

function PrimaryBtn({ action, variant }) {
  const Icon = action.icon;
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        action.action?.();
      }}
      title={action.tooltip}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150 hover:scale-[1.02]"
      style={{
        background: isPrimary ? action.color : `${action.color}18`,
        border: `1px solid ${action.color}55`,
        color: isPrimary ? "#fff" : action.color,
        boxShadow: isPrimary ? `0 6px 16px -8px ${action.color}` : undefined,
      }}
    >
      {Icon ? <Icon size={14} stroke={2} /> : null}
      <span className="hidden lg:inline">{action.label}</span>
    </button>
  );
}

function ActionsAchat({ achat, canWrite, onConfirm }) {
  const navigate = useNavigate();
  const s = normalizeStatutAchat(achat.statut);

  const primary = [];
  if (canWrite && s === "BROUILLON") {
    primary.push({
      label: "Confirmer",
      icon: IconTruck,
      color: COMMERCE_THEME.success,
      variant: "primary",
      tooltip: "Confirmer et mettre à jour le stock",
      action: () => onConfirm?.(achat),
    });
    primary.push({
      label: "Modifier",
      icon: IconPencil,
      color: COMMERCE_THEME.warning,
      tooltip: "Modifier le brouillon",
      action: () => navigate(`/achats/${achat.id}/edit`),
    });
  }

  if (primary.length === 0) return null;

  return (
    <div
      className="flex shrink-0 flex-wrap items-center justify-end gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {primary.map((a) => (
        <PrimaryBtn key={a.label} action={a} variant={a.variant} />
      ))}
    </div>
  );
}

export default function AchatCard({ achat, index = 0, canWrite, onConfirm, onClick }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const enRetard = isAchatEnRetard(achat);
  const accent = enRetard ? COMMERCE_THEME.danger : statutAchatColor(achat.statut);
  const pct = paymentPct(achat);
  const ttc = Number(achat.totalTTC) || 0;
  const animatedTtc = useAnimatedNumber(ttc, 900);
  const needsPulse = !reduceMotion && enRetard;

  return (
    <CommerceDocCardShell
      accent={accent}
      index={index}
      pulse={needsPulse}
      WatermarkIcon={Package}
      onClick={() => (onClick ? onClick(achat) : navigate(`/achats/${achat.id}`))}
    >
      <div className="flex flex-wrap items-center gap-3 px-3.5 py-3.5">
        <CommerceAvatarRing
          pct={pct}
          accent={accent}
          size={56}
          pulse={needsPulse}
          chipLabel={`${pct}%`}
        >
          {initials(achat.fournisseur?.nom)}
        </CommerceAvatarRing>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold text-[#378ADD]">{achat.reference}</span>
            <StatutBadgeAchat statut={achat.statut} />
            {enRetard ? (
              <span
                className="relative inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{
                  background: "rgba(226,75,74,0.18)",
                  color: "#fca5a5",
                }}
              >
                <span
                  className="commerce-doc-live-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: COMMERCE_THEME.danger }}
                  aria-hidden
                />
                En retard
              </span>
            ) : null}
            <PaiementBadge statut={achat.statutPaiement || "NON_REGLE"} />
          </div>

          <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
            {achat.fournisseur?.nom || "Fournisseur —"}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <Warehouse className="h-3 w-3 text-sky-400/80" aria-hidden />
              {achat.depot?.libelle || "—"}
            </span>
            <span className="text-[var(--border-default)]">·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-sky-400/80" aria-hidden />
              {formatDate(achat.dateCommande)}
            </span>
            {achat.dateLivraisonPrevue ? (
              <>
                <span className="text-[var(--border-default)]">·</span>
                <span className="inline-flex items-center gap-1">
                  <Truck className="h-3 w-3 text-sky-400/80" aria-hidden />
                  Liv. {formatDate(achat.dateLivraisonPrevue)}
                </span>
              </>
            ) : null}
          </div>

          <CommerceMiniGauge pct={pct} accent={accent} reduceMotion={reduceMotion} />
        </div>

        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tabular-nums leading-none" style={{ color: accent }}>
            {Number(animatedTtc).toLocaleString("fr-FR", {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}
          </p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            TTC
          </p>
          <p className="mt-1.5 text-[11px] font-semibold tabular-nums text-sky-400/90">{num3(ttc)}</p>
        </div>

        <ActionsAchat achat={achat} canWrite={canWrite} onConfirm={onConfirm} />
      </div>
    </CommerceDocCardShell>
  );
}
