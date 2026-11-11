import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Banknote,
  CreditCard,
  FileText,
  ArrowLeftRight,
  Wallet,
  Clock,
  Check,
} from "lucide-react";
import { MODES_CONFIG } from "../../constants/modesPaiementConfig";
import { formatDate, initials, hashColor } from "../../utils/commerceUi";

const MODE_ICONS = {
  ESPECES: Wallet,
  CHEQUE: FileText,
  VIREMENT: ArrowLeftRight,
  CARTE: CreditCard,
  EFFET: FileText,
  AUTRE: Banknote,
};

function StatusBadge({ statut }) {
  const valide = !statut || statut === "VALIDE";
  if (valide) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(29,158,117,0.25)] bg-[rgba(29,158,117,0.1)] px-2.5 py-0.5 text-[11px] font-medium text-[#1D9E75]">
        <Check className="h-3 w-3" aria-hidden="true" />
        Validé
      </span>
    );
  }
  if (statut === "EN_ATTENTE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(239,159,39,0.3)] bg-[rgba(239,159,39,0.1)] px-2.5 py-0.5 text-[11px] font-medium text-[#EF9F27]">
        <Clock className="h-3 w-3" aria-hidden="true" />
        En attente
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
      {statut}
    </span>
  );
}

export default function ReglementCard({ reglement, type, index = 0 }) {
  const navigate = useNavigate();
  const isVente = type === "ventes";
  const accent = isVente ? "#1D9E75" : "#378ADD";

  const nom = isVente ? reglement.vente?.client?.nom : reglement.achat?.fournisseur?.nom;
  const ref = isVente ? reglement.vente?.reference : reglement.achat?.reference;
  const entityId = isVente ? reglement.venteId ?? reglement.vente?.id : reglement.achatId ?? reglement.achat?.id;
  const datePay = reglement.datePayment || reglement.dateReglement;
  const modeConf = MODES_CONFIG[reglement.mode] || MODES_CONFIG.AUTRE;
  const ModeIcon = MODE_ICONS[reglement.mode] || Banknote;
  const montant = Number(reglement.montant || 0);

  const details = [
    reglement.numeroCheque ? `Chèque N° ${reglement.numeroCheque}` : null,
    reglement.referenceVirement ? `Vir. ${reglement.referenceVirement}` : null,
    reglement.referenceEffet ? `Effet ${reglement.referenceEffet}` : null,
  ].filter(Boolean);

  return (
    <article
      className="commerce-card group cursor-pointer rounded-xl border border-[var(--border-default)] px-4 py-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
      style={{
        background: "var(--bg-card)",
        borderLeft: `3px solid ${accent}`,
        animationDelay: `${index * 40}ms`,
      }}
      onClick={() => {
        if (entityId) navigate(isVente ? `/ventes/${entityId}` : `/achats/${entityId}`);
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
          style={{ background: hashColor(nom) }}
        >
          {initials(nom)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-[var(--text-link)]">{ref || "—"}</span>
            <StatusBadge statut={reglement.statut} />
            {reglement.type === "REMBOURSEMENT" && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5"
                style={{ background: "var(--accent-danger-soft, rgba(245,101,74,0.14))", color: "var(--accent-danger, #f5654a)" }}
              >
                ↩ À rembourser
              </motion.span>
            )}
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
              style={{
                background: modeConf.bg,
                borderColor: modeConf.border,
                color: modeConf.color,
              }}
            >
              <ModeIcon className="h-3 w-3" aria-hidden="true" />
              {modeConf.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {nom || "—"} · {formatDate(datePay)}
            {details.length ? ` · ${details.join(" · ")}` : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className="text-base font-semibold tabular-nums"
            style={{ color: reglement.type === "REMBOURSEMENT" || montant < 0 ? "var(--accent-danger, #f5654a)" : accent }}
          >
            {reglement.type === "REMBOURSEMENT" || montant < 0
              ? ""
              : isVente
                ? "+"
                : "−"}
            {Number(reglement.type === "REMBOURSEMENT" || montant < 0 ? montant : Math.abs(montant)).toLocaleString(
              "fr-FR",
              { minimumFractionDigits: 3, maximumFractionDigits: 3 }
            )}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">TND</p>
        </div>
      </div>
    </article>
  );
}
