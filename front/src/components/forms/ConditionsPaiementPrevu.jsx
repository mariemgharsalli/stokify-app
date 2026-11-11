import ModePaiementSelector from "../ui/ModePaiementSelector";
import { CONDITIONS_PAIEMENT_ACHAT } from "../../constants/modesPaiement";
import { labelClass, inputClass, selectClass } from "./formStyles";

/**
 * Mode de paiement prévu (conditions commerciales) — pas un règlement réel.
 */
export default function ConditionsPaiementPrevu({ variant, form, setForm }) {
  const isAchat = variant === "achat";
  const mode = form.modePaiement || "ESPECES";
  const champs = form.champsReglement || {};

  const handleModeChange = (newMode) => {
    setForm((f) => ({ ...f, modePaiement: newMode, champsReglement: {} }));
  };

  const handleChampsChange = (updater) => {
    setForm((f) => ({
      ...f,
      champsReglement: typeof updater === "function" ? updater(f.champsReglement || {}) : updater,
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>
          Mode de paiement prévu
          <span className="ml-1.5 text-[11px] font-normal normal-case tracking-normal text-[var(--text-muted)]">
            (optionnel — peut être défini plus tard)
          </span>
        </label>
        <div className="mt-2">
          <ModePaiementSelector
            value={mode}
            onChange={handleModeChange}
            champsValues={champs}
            onChampsChange={handleChampsChange}
          />
        </div>
      </div>

      {isAchat ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Échéance de paiement</label>
            <input
              type="date"
              className={inputClass}
              value={form.echeancePaiement || ""}
              onChange={(e) => setForm((f) => ({ ...f, echeancePaiement: e.target.value }))}
            />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">Date limite pour payer le fournisseur</p>
          </div>
          <div>
            <label className={labelClass}>Conditions commerciales</label>
            <select
              className={selectClass}
              value={form.conditionsPaiement || ""}
              onChange={(e) => setForm((f) => ({ ...f, conditionsPaiement: e.target.value }))}
            >
              {CONDITIONS_PAIEMENT_ACHAT.map((o) => (
                <option key={o.value || "empty"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div
        className="flex items-start gap-2 rounded-lg border p-3 text-xs"
        style={
          isAchat
            ? {
                background: "rgba(55,138,221,0.08)",
                borderColor: "rgba(55,138,221,0.2)",
                color: "#378ADD",
              }
            : {
                background: "rgba(29,158,117,0.08)",
                borderColor: "rgba(29,158,117,0.2)",
                color: "#1D9E75",
              }
        }
      >
        <i className="ti ti-info-circle mt-0.5 shrink-0 text-[15px]" aria-hidden="true" />
        <span>
          {isAchat ? (
            <>
              Le paiement réel au fournisseur se fait depuis la liste des achats après réception des
              marchandises — bouton « Ajouter un règlement ».
            </>
          ) : (
            <>
              L&apos;encaissement du client se fait depuis la liste des ventes après confirmation ou
              livraison — bouton « Encaisser ».
            </>
          )}
        </span>
      </div>
    </div>
  );
}

