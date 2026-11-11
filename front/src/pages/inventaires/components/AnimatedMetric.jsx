import { useEffect, useState } from "react";

export default function AnimatedMetric({ value, suffix = "", decimals = 0, duration = 1200 }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = null;
    let raf;
    const from = 0;
    const run = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      setDisplay(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString("fr-TN");

  return (
    <span>
      {formatted}
      {suffix}
    </span>
  );
}
