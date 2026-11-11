import { useNavigate } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import {
  IconCash,
  IconDownload,
  IconPencil,
  IconShoppingBag,
} from "@tabler/icons-react";
import { CalendarDays, Globe, Receipt, ShoppingBag, Warehouse } from "lucide-react";
import api from "../../services/api";
import { StatutBadgeVente, PaiementBadge } from "../ui/StatutBadge";
import { formatDate, num3, initials } from "../../utils/commerceUi";
import { isVenteConfirmee, normalizeStatutVente, statutVenteColor } from "../../constants/statuts";
import CommerceDocCardShell, {
  CommerceAvatarRing,
  CommerceMiniGauge,
  COMMERCE_THEME,
  useAnimatedNumber,
} from "../commerce/CommerceDocCardShell";

function regleSum(v) {
  if (v.montantRegle != null && v.montantRegle !== "") return Number(v.montantRegle || 0);
  return (v.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
}

function paiementStatut(v) {
  if (v.statutPaiement) return v.statutPaiement;
  const ttc = Number(v.totalTTC || 0);
  const r = regleSum(v);
  if (ttc <= 0) return "NON_REGLE";
  if (r + 1e-6 >= ttc) return "REGLE";
  if (r > 0) return "PARTIEL";
  return "NON_REGLE";
}

function paymentPct(v) {
  const ttc = Number(v.totalTTC || 0);
  if (ttc <= 0) {
    const s = normalizeStatutVente(v.statut);
    if (s === "CONFIRME") return 40;
    if (s === "BROUILLON") return 12;
    return 20;
  }
  const r = regleSum(v);
  return Math.min(100, Math.round((r / ttc) * 100));
}

function creditDepasse(client) {
  const plafond = client?.plafondCredit;
  const enc = client?.encours;
  return plafond != null && plafond > 0 && enc != null && enc > plafond;
}

function isEnRetard(v) {
  const pay = paiementStatut(v);
  if (pay === "REGLE") return false;
  const echeance = v.facture?.dateEcheance;
  if (echeance) return new Date(echeance) < new Date();
  if (!v.dateVente) return false;
  const d = new Date(v.dateVente);
  d.setDate(d.getDate() + 30);
  return d < new Date() && isVenteConfirmee(v.statut);
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

export default function VenteCard({ vente, index = 0, canWrite, onValidate, onReglement }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const brouillon = normalizeStatutVente(vente.statut) === "BROUILLON";
  const confirme = isVenteConfirmee(vente.statut);
  const depasse = creditDepasse(vente.client);
  const retard = isEnRetard(vente);
  const accent =
    retard || depasse ? COMMERCE_THEME.danger : statutVenteColor(vente.statut);
  const pct = paymentPct(vente);
  const ttc = Number(vente.totalTTC) || 0;
  const animatedTtc = useAnimatedNumber(ttc, 900);
  const needsPulse = !reduceMotion && (retard || depasse);

  const primary = [];
  if (canWrite) {
    if (brouillon) {
      primary.push({
        label: "Confirmer",
        icon: IconShoppingBag,
        color: COMMERCE_THEME.success,
        variant: "primary",
        tooltip: "Confirmer la vente — stock déduit automatiquement",
        action: () => onValidate?.(vente),
      });
      primary.push({
        label: "Modifier",
        icon: IconPencil,
        color: COMMERCE_THEME.accent,
        action: () => navigate(`/ventes/${vente.id}/edit`),
      });
    } else if (confirme) {
      const statut = paiementStatut(vente);
      const regle = statut === "REGLE";
      const partiel = statut === "PARTIEL";
      const reste = Math.max(0, ttc - regleSum(vente));
      primary.push({
        label: regle ? "Encaissé ✓" : partiel ? `Encaisser (${reste.toFixed(0)})` : "Encaisser",
        icon: IconCash,
        color: COMMERCE_THEME.success,
        tooltip: regle ? "Vente entièrement encaissée" : "Enregistrer un paiement client",
        action: () => onReglement?.(vente),
      });
      if (vente.facture) {
        primary.push({
          label: "PDF",
          icon: IconDownload,
          color: COMMERCE_THEME.accent,
          tooltip: "Télécharger la facture PDF",
          action: async () => {
            const resp = await api.get(`factures/${vente.facture.id}/pdf`, { responseType: "blob" });
            const url = URL.createObjectURL(resp.data);
            window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60000);
          },
        });
      }
    }
  }

  return (
    <CommerceDocCardShell
      accent={accent}
      index={index}
      pulse={needsPulse}
      WatermarkIcon={ShoppingBag}
      onClick={() => navigate(`/ventes/${vente.id}`)}
    >
      <div className="flex flex-wrap items-center gap-3 px-3.5 py-3.5">
        <CommerceAvatarRing
          pct={pct}
          accent={accent}
          size={56}
          pulse={needsPulse}
          chipLabel={`${pct}%`}
        >
          {initials(vente.client?.nom)}
        </CommerceAvatarRing>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold text-[#378ADD]">{vente.reference}</span>
            <StatutBadgeVente statut={vente.statut} />
            {vente.typeVente === "COMMANDE_WEB" ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{
                  background: "rgba(14,165,233,0.16)",
                  color: "#7dd3fc",
                }}
              >
                <Globe className="h-2.5 w-2.5" aria-hidden />
                Web
              </span>
            ) : null}
            {confirme ? <PaiementBadge statut={paiementStatut(vente)} enRetard={retard} /> : null}
            {retard ? (
              <span
                className="relative inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ background: "rgba(226,75,74,0.18)", color: "#fca5a5" }}
              >
                Échéance dépassée
              </span>
            ) : null}
            {depasse ? (
              <span
                className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ background: "rgba(226,75,74,0.18)", color: "#fca5a5" }}
              >
                Crédit dépassé
              </span>
            ) : null}
          </div>

          <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
            <span className={depasse ? "text-[#E24B4A]" : ""}>{vente.client?.nom || "Client —"}</span>
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <Warehouse className="h-3 w-3 text-sky-400/80" aria-hidden />
              {vente.depot?.libelle || "—"}
            </span>
            <span className="text-[var(--border-default)]">·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-sky-400/80" aria-hidden />
              {formatDate(vente.dateVente)}
            </span>
            {vente.facture?.reference ? (
              <>
                <span className="text-[var(--border-default)]">·</span>
                <span className="inline-flex items-center gap-1">
                  <Receipt className="h-3 w-3 text-sky-400/80" aria-hidden />
                  {vente.facture.reference}
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

        {primary.length > 0 ? (
          <div
            className="flex shrink-0 flex-wrap items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {primary.map((a) => (
              <PrimaryBtn key={a.label} action={a} variant={a.variant} />
            ))}
          </div>
        ) : null}
      </div>
    </CommerceDocCardShell>
  );
}
