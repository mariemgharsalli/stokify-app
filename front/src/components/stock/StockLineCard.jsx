import { MapPin, Warehouse } from "lucide-react";
import { stockLevelColor, getLineStockMin } from "../../hooks/useStockGroupes";
import { parseLineStatut, STATUT_CONFIG, fmtMoney } from "./stockUi";
import StockLineActions from "./StockLineActions";

const ROTATION_STYLES = {
  Fort: { bg: "rgba(29,158,117,0.15)", color: "#1D9E75" },
  Moyen: { bg: "rgba(186,117,23,0.15)", color: "#BA7517" },
  Faible: { bg: "rgba(226,75,74,0.15)", color: "#E24B4A" },
};

function StatutBadge({ row }) {
  const key = parseLineStatut(row);
  const s = STATUT_CONFIG[key] || STATUT_CONFIG.ACTIF;
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
      style={{ background: s.bg, borderColor: s.border, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function RotationBadge({ label }) {
  if (!label) return null;
  const style = ROTATION_STYLES[label] || ROTATION_STYLES.Faible;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: style.bg, color: style.color }}
    >
      {label}
    </span>
  );
}

/** Ligne de stock — style commerce-card (comme VenteCard / AchatCard) */
export default function StockLineCard({
  ligne,
  index = 0,
  onTransfer,
  onEmplacementTransfer,
  onQrClick,
  actionsPending,
  rotationLabel,
  nested = false,
}) {
  const q = Number(ligne.quantite) || 0;
  const min = getLineStockMin(ligne);
  const borderColor = stockLevelColor(q, min);
  const cmp = ligne.cmp ?? (Number(ligne.article?.prixAchat) || 0);

  return (
    <article
      className={`commerce-card rounded-xl border border-[var(--border-default)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] ${
        nested ? "px-3 py-2.5" : "px-4 py-3.5"
      }`}
      style={{
        background: "var(--bg-card)",
        borderLeft: `3px solid ${borderColor}`,
        animationDelay: `${index * 40}ms`,
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
          style={{ background: "#378ADD" }}
        >
          <Warehouse className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-[var(--text-link)]">{ligne.article?.code}</span>
            <StatutBadge row={ligne} />
            <RotationBadge label={rotationLabel} />
            {q === 0 ? (
              <span className="text-[10px] font-semibold text-[#E24B4A]">Rupture</span>
            ) : min != null && q <= min ? (
              <span className="text-[10px] font-semibold text-[#EF9F27]">Critique</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {ligne.article?.libelle || "—"} · {ligne.depot?.libelle || "—"}
            {ligne.emplacement ? (
              <>
                {" "}
                · <MapPin className="inline h-3 w-3 text-[#EF9F27]" aria-hidden="true" />{" "}
                {ligne.emplacement.code}
              </>
            ) : (
              ""
            )}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-base font-semibold tabular-nums" style={{ color: borderColor }}>
            {q.toLocaleString("fr-FR")}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">
            {ligne.unite || ligne.article?.unite} · {fmtMoney(q * cmp)} TND
          </p>
        </div>

        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <StockLineActions
            ligne={{ ...ligne, cmp }}
            onTransfer={onTransfer}
            onEmplacementTransfer={onEmplacementTransfer}
            onQrClick={onQrClick}
            pending={actionsPending}
          />
        </div>
      </div>
    </article>
  );
}
