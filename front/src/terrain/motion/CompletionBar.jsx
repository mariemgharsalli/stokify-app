import { useReducedMotion } from "framer-motion";
import { clamp01 } from "./presets";

export default function CompletionBar({ ratio, label }) {
  const reduce = useReducedMotion();
  const value = clamp01(ratio);
  return (
    <span
      className="terrain-meter"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <span
        className={`terrain-meter-fill${reduce ? " is-still" : ""}`}
        style={{ transform: `scaleX(${value})` }}
      />
    </span>
  );
}
