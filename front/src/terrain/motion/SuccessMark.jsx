import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { feedback } from "../lib/feedback";
import { fr } from "../strings/fr";
import { checkDraw } from "./presets";

export default function SuccessMark({ label = fr.successDone, quiet = false }) {
  const reduce = useReducedMotion();
  const draw = checkDraw(Boolean(reduce));

  useEffect(() => {
    if (!quiet) feedback.success();
  }, [quiet]);

  return (
    <span className="terrain-success" role="img" aria-label={label}>
      <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <motion.path
          d="M14 25 l7 7 l14-16"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          {...draw}
        />
      </svg>
    </span>
  );
}
