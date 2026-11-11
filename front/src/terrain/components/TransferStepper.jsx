import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { stepMotion } from "../motion/presets";
import { fr } from "../strings/fr";

export default function TransferStepper({ etape }) {
  const reduce = useReducedMotion();
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label={fr.transferTitle}>
      {fr.transferStep.map((label, index) => {
        const actif = index === etape;
        const fait = index < etape;
        const motionProps = stepMotion(Boolean(reduce), actif);
        const Step = actif && !reduce ? motion.li : "li";
        return (
          <Step
            key={label}
            aria-current={actif ? "step" : undefined}
            className={`terrain-step flex min-h-12 items-center justify-center gap-1 rounded-xl border border-border px-1 text-center text-xs font-semibold ${actif ? "is-current" : ""} ${fait ? "is-done" : ""}`}
            {...(actif && !reduce ? motionProps : {})}
          >
            {fait ? <Check size={14} aria-hidden="true" /> : null}
            {label}
          </Step>
        );
      })}
    </ol>
  );
}
