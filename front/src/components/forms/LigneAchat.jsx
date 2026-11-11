import { AlertTriangle, Trash2 } from "lucide-react";
import { calcTotalLigne, joursAvantExpiration, resolveModeTracage } from "../../utils/formHelpers";
import { inputClass, labelClass, selectClass } from "./formStyles";
import { LIGNE_ACHAT_GRID_COLS } from "./ligneAchatGrid";

const ligneInputClass = `${inputClass} !py-2.5 !text-[15px]`;
const ligneSelectClass = `${selectClass} !py-2.5 !text-[15px]`;

function FieldLabel({ children }) {
  return (
    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
      {children}
    </span>
  );
}

export default function LigneAchat({ ligne, index, readonly, onUpdate, onRemove }) {
  const art = ligne.article;
  const modeTracage = resolveModeTracage(art);
  const auto = Boolean(art?.tracageAuto) && modeTracage !== "AUCUN";
  const showLot = (modeTracage === "LOT" || modeTracage === "LOT_SERIE") && !auto;
  const showSerie = modeTracage === "SERIE" || modeTracage === "LOT_SERIE";
  const total = calcTotalLigne(ligne);
  const brut = (Number(ligne.quantite) || 0) * (Number(ligne.prixUnitHT) || 0);
  const hasRemise = Number(ligne.remise) > 0;

  const removeBtn = !readonly ? (
    <button
      type="button"
      onClick={onRemove}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#E24B4A] transition hover:bg-red-500/10"
      title="Retirer cet article"
      aria-label="Retirer"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  ) : null;

  return (
    <div className="ligne-enter bg-[var(--bg-card)] transition-colors hover:bg-white/[0.02]">
      {/* Mobile / tablette — carte */}
      <div className="space-y-4 px-5 py-5 md:hidden">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#7c3aed]/12 text-xs font-semibold text-[#7c3aed]">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-[var(--text-primary)]">{art?.libelle || "—"}</p>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              <span className="font-mono">{art?.code}</span> · {art?.unite || "UN"}
              {showLot ? (
                <span className="ml-1 text-[#EF9F27]">· Lots</span>
              ) : null}
              {showSerie ? (
                <span className="ml-1 text-[#7c3aed]">· N° série{auto ? " auto" : ""}</span>
              ) : null}
            </p>
          </div>
          {removeBtn}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <FieldLabel>Quantité</FieldLabel>
            <input
              type="number"
              min="0.001"
              step="1"
              disabled={readonly}
              className={`${ligneInputClass} text-right`}
              value={ligne.quantite}
              onChange={(e) => onUpdate("quantite", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Prix unit. HT</FieldLabel>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.001"
                disabled={readonly}
                className={`${ligneInputClass} pr-11 text-right`}
                value={ligne.prixUnitHT}
                onChange={(e) => onUpdate("prixUnitHT", e.target.value)}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
                TND
              </span>
            </div>
          </div>
          <div>
            <FieldLabel>Remise %</FieldLabel>
            <input
              type="number"
              min="0"
              max="100"
              disabled={readonly}
              className={`${ligneInputClass} text-right`}
              value={ligne.remise || 0}
              onChange={(e) => onUpdate("remise", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>TVA</FieldLabel>
            <select
              disabled={readonly}
              className={ligneSelectClass}
              value={ligne.tauxTVA ?? 19}
              onChange={(e) => onUpdate("tauxTVA", e.target.value)}
            >
              <option value={0}>0%</option>
              <option value={7}>7%</option>
              <option value={13}>13%</option>
              <option value={19}>19%</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-[#7c3aed]/20 bg-[#7c3aed]/5 px-4 py-3">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Total ligne HT</span>
          <div className="text-right">
            <p className={`text-sm font-semibold tabular-nums ${hasRemise ? "text-[#1D9E75]" : "text-[#7c3aed]"}`}>
              {total.toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND
            </p>
            {hasRemise ? (
              <p className="text-[10px] text-[var(--text-muted)] line-through tabular-nums">{brut.toFixed(3)}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Desktop — grille alignée en-tête */}
      <div
        className="hidden items-center gap-4 px-5 py-4 md:grid"
        style={{ gridTemplateColumns: LIGNE_ACHAT_GRID_COLS }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed]/12 text-center text-xs font-semibold text-[#7c3aed]">
          {index + 1}
        </span>
        <div className="min-w-0 pr-2">
          <p className="text-[15px] font-medium leading-snug text-[var(--text-primary)]">{art?.libelle || "—"}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
            {art?.code} · {art?.unite || "UN"}
            {showLot ? <span className="text-[#EF9F27]"> · Lot</span> : null}
            {showSerie ? <span className="text-[#7c3aed]"> · Série{auto ? " auto" : ""}</span> : null}
          </p>
        </div>
        <input
          type="number"
          min="0.001"
          step="1"
          disabled={readonly}
          className={`${ligneInputClass} text-right`}
          value={ligne.quantite}
          onChange={(e) => onUpdate("quantite", e.target.value)}
        />
        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.001"
            disabled={readonly}
            className={`${ligneInputClass} pr-11 text-right`}
            value={ligne.prixUnitHT}
            onChange={(e) => onUpdate("prixUnitHT", e.target.value)}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
            TND
          </span>
        </div>
        <input
          type="number"
          min="0"
          max="100"
          disabled={readonly}
          className={`${ligneInputClass} text-right`}
          value={ligne.remise || 0}
          onChange={(e) => onUpdate("remise", e.target.value)}
        />
        <select
          disabled={readonly}
          className={ligneSelectClass}
          value={ligne.tauxTVA ?? 19}
          onChange={(e) => onUpdate("tauxTVA", e.target.value)}
        >
          <option value={0}>0%</option>
          <option value={7}>7%</option>
          <option value={13}>13%</option>
          <option value={19}>19%</option>
        </select>
        <div className="text-right">
          <p className={`text-base font-semibold tabular-nums ${hasRemise ? "text-[#1D9E75]" : "text-[#7c3aed]"}`}>
            {total.toLocaleString("fr-FR", { minimumFractionDigits: 3 })}
          </p>
          {hasRemise ? (
            <p className="text-[10px] text-[var(--text-muted)] line-through tabular-nums">{brut.toFixed(3)}</p>
          ) : null}
        </div>
        {removeBtn || <span />}
      </div>

      {showLot ? (
        <div
          className="mx-5 mb-5 grid gap-3 rounded-xl border border-[rgba(239,159,39,0.25)] p-4 md:mx-5 md:ml-[60px]"
          style={{ background: "rgba(239,159,39,0.06)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#EF9F27]">Traçabilité lot</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>N° de lot *</label>
              <input
                disabled={readonly}
                className={inputClass}
                value={ligne.numeroLot || ""}
                onChange={(e) => onUpdate("numeroLot", e.target.value)}
                placeholder="LOT-2026-001"
              />
            </div>
            <div>
              <label className={labelClass}>Date fabrication</label>
              <input
                type="date"
                disabled={readonly}
                className={inputClass}
                value={ligne.dateFabrication || ""}
                onChange={(e) => onUpdate("dateFabrication", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Date expiration</label>
              <input
                type="date"
                disabled={readonly}
                className={inputClass}
                value={ligne.dateExpiration || ""}
                onChange={(e) => onUpdate("dateExpiration", e.target.value)}
              />
              {ligne.dateExpiration && joursAvantExpiration(ligne.dateExpiration) < 90 ? (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[#EF9F27]">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Expire dans {joursAvantExpiration(ligne.dateExpiration)} jours
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
