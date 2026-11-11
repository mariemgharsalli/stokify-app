import { Package } from "lucide-react";
import { formatDate } from "../../utils/commerceUi";
import { joursAvantExpiration } from "../../utils/formHelpers";

export default function LotSelector({ ligne, lots = [], modeGestion, onSelect }) {
  if (!["FIFO", "FEFO"].includes(modeGestion)) return null;

  const available = (lots || []).filter(
    (lot) => String(lot.statut || "ACTIF").toUpperCase() !== "DESACTIVE"
  );

  if (!available.length) {
    return (
      <div
        className="col-span-full rounded-md border border-[rgba(55,138,221,0.2)] px-3 py-2 text-xs text-[var(--text-muted)]"
        style={{ background: "rgba(55,138,221,0.06)" }}
      >
        Aucun lot disponible pour cet article dans ce dépôt.
      </div>
    );
  }

  return (
    <div
      className="col-span-full rounded-md border border-[rgba(55,138,221,0.2)] p-3"
      style={{ background: "rgba(55,138,221,0.06)" }}
    >
      <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-[#378ADD]">
        <Package className="h-3.5 w-3.5" />
        Lots disponibles ({modeGestion === "FEFO" ? "triés par date expiration" : "triés par date entrée"})
      </p>
      <div className="flex flex-col gap-1">
        {available.map((lot) => {
          const jours = lot.dateExpiration ? joursAvantExpiration(lot.dateExpiration) : null;
          const selected = ligne.lotId === lot.id;
          return (
            <label
              key={lot.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors"
              style={{
                background: selected ? "rgba(55,138,221,0.15)" : "transparent",
                border: `1px solid ${selected ? "#378ADD40" : "transparent"}`,
              }}
            >
              <input
                type="radio"
                name={`lot-${ligne.id}`}
                checked={selected}
                onChange={() => onSelect(lot.id)}
              />
              <span className="font-medium">{lot.numero}</span>
              <span className="text-[var(--text-muted)]">· Qté : {lot.quantiteRestante}</span>
              <span className="ml-auto">
                {lot.dateExpiration ? (
                  <span style={{ color: jours != null && jours < 30 ? "#E24B4A" : "#1D9E75" }}>
                    Exp : {formatDate(lot.dateExpiration)}
                    {jours != null && jours < 30 ? (
                      <>
                        {" "}
                        · <b>{jours}j</b>
                      </>
                    ) : null}
                  </span>
                ) : (
                  "Pas d'expiration"
                )}
              </span>
              {modeGestion === "FEFO" && (
                <span
                  className="rounded-full border px-1.5 py-0.5 text-[10px]"
                  style={{
                    background: "rgba(239,159,39,0.12)",
                    color: "#EF9F27",
                    borderColor: "rgba(239,159,39,0.3)",
                  }}
                >
                  FEFO conseillé
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

