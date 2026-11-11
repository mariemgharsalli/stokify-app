import { motion, useReducedMotion } from "framer-motion";

export default function WizardSteps({ steps, current }) {
  const reduceMotion = useReducedMotion();
  const total = Math.max(1, steps?.length || 1);
  const progressPct = Math.min(100, ((Number(current) || 1) - 1) / (total - 1 || 1) * 100);

  return (
    <div className="space-y-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-hover)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--accent-primary)" }}
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
          }
        />
      </div>

      <div className="flex items-start gap-0">
        {steps.map((step, i) => {
          const num = i + 1;
          const done = num < current;
          const active = num === current;
          const circleBg = done
            ? "var(--accent-success)"
            : active
              ? "var(--accent-primary)"
              : "var(--bg-hover)";
          const circleColor = done || active ? "#fff" : "var(--text-muted)";
          const textColor = active
            ? "var(--accent-primary)"
            : done
              ? "var(--accent-success)"
              : "var(--text-muted)";
          const connectorDone = done || active;

          return (
            <div key={step.key || step.label} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {i > 0 ? (
                  <div
                    className="h-0.5 flex-1 transition-colors duration-300"
                    style={{
                      background: connectorDone ? "var(--accent-success)" : "var(--border-default)",
                    }}
                  />
                ) : (
                  <div className="flex-1" />
                )}
                <motion.div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: circleBg, color: circleColor }}
                  animate={
                    reduceMotion
                      ? undefined
                      : active
                        ? { scale: [1, 1.08, 1] }
                        : { scale: 1 }
                  }
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  {done ? "✓" : num}
                </motion.div>
                {i < steps.length - 1 ? (
                  <div
                    className="h-0.5 flex-1 transition-colors duration-300"
                    style={{
                      background: num < current ? "var(--accent-success)" : "var(--border-default)",
                    }}
                  />
                ) : (
                  <div className="flex-1" />
                )}
              </div>
              <span
                className="mt-1.5 max-w-[90px] truncate text-center text-[11px] font-medium"
                style={{ color: textColor }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
