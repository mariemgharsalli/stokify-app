import { IconCheck, IconPencil } from "@tabler/icons-react";
import { WORKFLOW_ACHAT } from "../../constants/statuts";

const ACCENT = "#378ADD";
const CYAN = "#0EA5E9";

const ACHAT_TAB_STYLES = {
  BROUILLON: {
    Icon: IconPencil,
    activeBg: "var(--achat-wf-brouillon-bg)",
    activeText: "var(--achat-wf-brouillon-text)",
    activeBorder: "var(--achat-wf-brouillon-border)",
  },
  CONFIRME: {
    Icon: IconCheck,
    activeBg: "var(--achat-wf-confirme-bg)",
    activeText: "var(--achat-wf-confirme-text)",
    activeBorder: "var(--achat-wf-confirme-border)",
  },
};

export default function AchatWorkflowBar({ activeStatut, counts = {}, onSelect }) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-[var(--border-default)] p-4"
      style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(ellipse 50% 80% at 0% 50%, ${ACCENT}14, transparent 55%), radial-gradient(ellipse 35% 50% at 100% 100%, ${CYAN}10, transparent 50%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}66, transparent)` }}
        aria-hidden
      />
      <div className="relative z-[1] flex flex-wrap items-center gap-2">
        {WORKFLOW_ACHAT.map((step, idx) => {
          const style = ACHAT_TAB_STYLES[step.key] || ACHAT_TAB_STYLES.BROUILLON;
          const Icon = style.Icon;
          const count = counts[step.key] ?? 0;
          const isActive =
            activeStatut === step.key ||
            (step.match && step.match.includes(activeStatut));

          return (
            <div key={step.key} className="flex items-center gap-2">
              {idx > 0 ? (
                <span className="hidden text-[var(--text-muted)] sm:inline" aria-hidden>
                  →
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onSelect?.(isActive ? "" : step.key)}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 hover:-translate-y-0.5 hover:opacity-95"
                style={
                  isActive
                    ? {
                        background: style.activeBg,
                        borderColor: style.activeBorder,
                        color: style.activeText,
                        boxShadow: `0 6px 14px -8px ${style.activeText}`,
                      }
                    : {
                        background: "var(--bg-input)",
                        borderColor: "var(--border-default)",
                        color: "var(--text-secondary)",
                      }
                }
              >
                <Icon size={14} stroke={2} aria-hidden />
                <span>{step.label}</span>
                <span
                  className="min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                  style={{
                    background: isActive ? `${style.activeText}22` : "var(--bg-hover)",
                    color: isActive ? style.activeText : "var(--text-muted)",
                  }}
                >
                  {count}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
