import { Trash2 } from "lucide-react";
import { calcTotalLigne, calcTVALigne, resolveModeTracage, tracksLot } from "../../utils/formHelpers";
import { inputClass, selectClass } from "./formStyles";
import { LIGNE_VENTE_GRID_COLS } from "./ligneVenteGrid";
import StockIndicateur from "./StockIndicateur";
import LotSelector from "./LotSelector";

const ligneInputClass = `${inputClass} !py-2.5 !text-[15px]`;
const ligneSelectClass = `${selectClass} !py-2.5 !text-[15px]`;

function FieldLabel({ children }) {
  return (
    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
      {children}
    </span>
  );
}

export default function LigneVente({
  ligne,
  index,
  readonly,
  stockInfo,
  lots = [],
  onUpdate,
  onRemove,
  onLotSelect,
}) {
  const art = ligne.article;
  const mode = tracksLot(resolveModeTracage(art)) ? String(art?.strategieSortie || "FIFO").toUpperCase() : "STANDARD";
  const total = calcTotalLigne(ligne);
  const tvaLigne = calcTVALigne(ligne);
  const totalTTC = parseFloat((total + tvaLigne).toFixed(3));
  const brut = (Number(ligne.quantite) || 0) * (Number(ligne.prixUnitHT) || 0);
  const cmp = Number(art?.cmp ?? art?.prixAchat) || 0;
  const pu = Number(ligne.prixUnitHT) || 0;
  const marge = pu > 0 ? ((pu - cmp) / pu) * 100 : 0;
  const hasRemise = Number(ligne.remise) > 0;
  const margeColor = marge < 0 ? "#E24B4A" : marge < 10 ? "#EF9F27" : "#1D9E75";

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

  const articleBlock = (
    <>
      <p className="text-[15px] font-medium leading-snug text-[var(--text-primary)]">{art?.libelle || "—"}</p>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
        <span className="font-mono">{art?.code}</span> · {art?.unite || "UN"}
      </p>
      <StockIndicateur disponible={stockInfo?.disponible} loading={stockInfo?.loading} quantite={ligne.quantite} />
      <p className="mt-1 text-[11px] font-medium" style={{ color: margeColor }}>
        Marge {marge.toFixed(1)}% · CMP {cmp.toFixed(3)} TND
      </p>
    </>
  );

  return (
    <div className="ligne-enter bg-[var(--bg-card)] transition-colors hover:bg-white/[0.02]">
      {/* Mobile */}
      <div className="space-y-4 px-5 py-5 md:hidden">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#7c3aed]/12 text-xs font-semibold text-[#7c3aed]">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">{articleBlock}</div>
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
            <FieldLabel>Prix vente HT</FieldLabel>
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
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
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

        <div className="rounded-lg border border-[var(--border-default)]/60 bg-[var(--bg-app)]/40 p-3">
          <LotSelector ligne={ligne} lots={lots} modeGestion={mode} onSelect={(lotId) => onLotSelect(lotId)} />
        </div>
      </div>

      {/* Desktop */}
      <div
        className="hidden items-start gap-4 px-5 py-4 md:grid"
        style={{ gridTemplateColumns: LIGNE_VENTE_GRID_COLS }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed]/12 text-xs font-semibold text-[#7c3aed]">
          {index + 1}
        </span>
        <div className="min-w-0 pr-2">{articleBlock}</div>
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
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
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
          <p className="text-[10px] tabular-nums text-[var(--text-muted)]">
            TTC {totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 3 })}
          </p>
        </div>
        {removeBtn || <span />}
      </div>

      <div className="hidden px-5 pb-4 md:block md:pl-[60px]">
        <LotSelector ligne={ligne} lots={lots} modeGestion={mode} onSelect={(lotId) => onLotSelect(lotId)} />
      </div>
    </div>
  );
}
