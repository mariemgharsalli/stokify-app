import { motion, useReducedMotion } from "framer-motion";
import { clamp01, ringMotion } from "./presets";

export default function ProgressRing({ progress = 0, label }) {
  const reduce = useReducedMotion();
  const ratio = clamp01(progress);
  const motionProps = ringMotion(Boolean(reduce), ratio);
  const percent = Math.round(ratio * 100);

  return (
    <div className="terrain-ring" role="img" aria-label={label || `${percent}%`}>
      <svg viewBox="0 0 36 36" width="72" height="72" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
        <motion.circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth="3"
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
          {...motionProps}
        />
      </svg>
      <span className="terrain-mono terrain-ring-value">{percent}</span>
    </div>
  );
}
