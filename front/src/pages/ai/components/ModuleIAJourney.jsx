import { motion, useReducedMotion } from "framer-motion";
import { IA, JOURNEY } from "../moduleIaTheme";

const STEP_TAB = {
  stock: "overview",
  analyse: "prevision",
  reco: "optimisation",
  decision: "optimisation",
  action: "optimisation",
};

export default function ModuleIAJourney({ active = "analyse", onNavigate, compact = false }) {
  const reduceMotion = useReducedMotion();
  const activeIndex = Math.max(0, JOURNEY.findIndex((s) => s.id === active));

  return (
    <nav aria-label="Parcours décisionnel" className={compact ? "" : "mb-1"}>
      <ol className="relative grid grid-cols-5 gap-0">
        <span
          className="pointer-events-none absolute left-[10%] right-[10%] top-[15px] hidden h-px overflow-hidden sm:block"
          style={{ background: IA.border }}
          aria-hidden
        >
          <motion.span
            className="absolute inset-y-0 left-0 block w-full origin-left"
            style={{ background: IA.accent }}
            initial={false}
            animate={{ scaleX: JOURNEY.length > 1 ? activeIndex / (JOURNEY.length - 1) : 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </span>
        {JOURNEY.map((step, i) => {
          const isActive = step.id === active;
          const isDone = i < activeIndex;
          const tone = isActive || isDone ? IA.accent : IA.muted;
          return (
            <li key={step.id} className="relative z-[1] flex flex-col items-center text-center">
              <motion.button
                type="button"
                onClick={() => onNavigate?.(STEP_TAB[step.id] || "overview")}
                className="flex flex-col items-center gap-1.5"
                whileHover={reduceMotion ? undefined : { y: -1 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              >
                <span
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full font-mono text-[10px] font-bold"
                  style={{
                    background: isActive ? IA.accent : isDone ? IA.accentDim : IA.bgElevated,
                    color: isActive ? IA.onAccent : tone,
                    border: `1px solid ${isActive || isDone ? IA.borderStrong : IA.border}`,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  className="text-[11px] font-semibold sm:text-[12px]"
                  style={{ color: isActive ? IA.text : IA.textSecondary, fontFamily: IA.fontTitle }}
                >
                  {step.label}
                </span>
                {!compact ? (
                  <span className="hidden text-[10px] sm:block" style={{ color: IA.muted }}>
                    {step.hint}
                  </span>
                ) : null}
              </motion.button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
