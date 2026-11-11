import { useEffect, useRef, useState } from "react";

/**
 * Anime une valeur numérique de 0 (ou de la valeur précédente) vers `target`.
 * Respecte prefers-reduced-motion en sautant directement à la valeur finale.
 *
 * @param {number} target - valeur cible
 * @param {number} duration - durée en ms
 * @param {number} decimals - nombre de décimales affichées
 */
export function useCountUp(target, duration = 900, decimals = 0) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const safeTarget = Number.isFinite(target) ? target : 0;

    if (prefersReduced) {
      setValue(safeTarget);
      return undefined;
    }

    fromRef.current = value;
    startRef.current = null;

    function tick(ts) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic — démarre vite, ralentit en douceur
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = fromRef.current + (safeTarget - fromRef.current) * eased;
      setValue(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export default useCountUp;
