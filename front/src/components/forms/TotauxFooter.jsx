import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { btnPrimary, btnSecondary, primaryButtonStyle } from "./formStyles";

function useLiveAmount(target, duration = 450) {
  const [value, setValue] = useState(Number(target) || 0);
  const fromRef = useRef(Number(target) || 0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const end = Number(target) || 0;
    if (reduceMotion) {
      fromRef.current = end;
      setValue(end);
      return undefined;
    }
    const startVal = fromRef.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = startVal + (end - startVal) * eased;
      fromRef.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduceMotion]);

  return value;
}

function fmt(n) {
  return Number(n || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export default function TotauxFooter({
  totaux,
  margeGlobale,
  backLabel,
  nextLabel,
  onBack,
  onNext,
  nextDisabled,
  shakeNext,
}) {
  const ht = useLiveAmount(totaux?.ht);
  const tva = useLiveAmount(totaux?.tva);
  const ttc = useLiveAmount(totaux?.ttc);

  return (
    <div className="grid grid-cols-1 items-center gap-4 px-5 py-3 sm:grid-cols-[1fr_auto]">
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <div className="text-[11px] text-[var(--text-muted)]">Total HT</div>
          <div className="text-[15px] font-medium tabular-nums text-[var(--text-primary)]">
            {fmt(ht)} TND
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[var(--text-muted)]">TVA</div>
          <div className="text-[15px] font-medium tabular-nums text-[var(--accent-warning)]">
            {fmt(tva)} TND
          </div>
        </div>
        <div className="border-l border-[var(--border-default)] pl-6">
          <div className="text-[11px] text-[var(--text-muted)]">Total TTC</div>
          <div className="text-xl font-medium tabular-nums text-[var(--accent-primary)]">
            {fmt(ttc)} TND
          </div>
        </div>
        {margeGlobale != null ? (
          <div
            className="text-[11px] font-medium"
            style={{
              color:
                margeGlobale < 0
                  ? "var(--accent-danger)"
                  : margeGlobale < 10
                    ? "var(--accent-warning)"
                    : "var(--accent-success)",
            }}
          >
            Marge estimée : {margeGlobale.toFixed(1)}%
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onBack ? (
          <button type="button" onClick={onBack} className={btnSecondary}>
            {backLabel}
          </button>
        ) : null}
        {onNext ? (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={`${btnPrimary} ${shakeNext ? "btn-shake" : ""}`}
            style={primaryButtonStyle}
          >
            {nextLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
