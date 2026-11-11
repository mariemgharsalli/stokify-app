import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

function formatCount(shown, target) {
  if (Number.isInteger(target)) return String(Math.round(shown));
  return shown.toFixed(1);
}

export default function CountUp({ value, duration = 700, className = "", label }) {
  const reduce = useReducedMotion();
  const target = Number.isFinite(Number(value)) ? Number(value) : 0;
  const [shown, setShown] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setShown(target);
      return undefined;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setShown(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduce, duration]);

  return (
    <span
      className={`terrain-mono ${className}`.trim()}
      aria-label={label}
    >
      {formatCount(shown, target)}
    </span>
  );
}
