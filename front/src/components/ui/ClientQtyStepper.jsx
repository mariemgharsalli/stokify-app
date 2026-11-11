import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { CLIENT_MAX_QTY, normalizeQty } from "../../utils/clientQty";

/**
 * Stepper quantité client — saisie libre pour petites OU très grandes quantités.
 */
export default function ClientQtyStepper({
  value,
  onChange,
  min = 1,
  max = CLIENT_MAX_QTY,
  size = "md",
  className = "",
  onExceedMax,
}) {
  const qty = normalizeQty(value, { min, max });
  const [draft, setDraft] = useState(String(qty));
  const pad = size === "sm" ? "p-2" : "p-2.5";
  const inputW = size === "sm" ? "w-16" : "w-24";

  useEffect(() => {
    setDraft(String(qty));
  }, [qty]);

  function notifyIfExceed(attempted) {
    const n = Math.floor(Number(attempted));
    if (Number.isFinite(n) && n > max) {
      onExceedMax?.(max);
    }
  }

  function bump(delta) {
    const attempted = qty + delta;
    notifyIfExceed(attempted);
    onChange(normalizeQty(attempted, { min, max }));
  }

  function commit(raw) {
    const digits = String(raw).replace(/[^\d]/g, "");
    if (digits === "") {
      onChange(min);
      setDraft(String(min));
      return;
    }
    notifyIfExceed(digits);
    const next = normalizeQty(digits, { min, max });
    onChange(next);
    setDraft(String(next));
  }

  return (
    <div className={`client-qty ${className}`.trim()} data-size={size}>
      <button type="button" className={pad} onClick={() => bump(-1)} aria-label="Diminuer" disabled={qty <= min}>
        <Minus className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className={`client-qty__input font-mono-data ${inputW}`}
        value={draft}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "");
          setDraft(digits);
          if (digits !== "") onChange(normalizeQty(digits, { min, max }));
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        aria-label="Quantité"
        title={`1 – ${max.toLocaleString("fr-FR")}`}
      />
      <button type="button" className={pad} onClick={() => bump(1)} aria-label="Augmenter" disabled={qty >= max}>
        <Plus className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </button>
    </div>
  );
}
