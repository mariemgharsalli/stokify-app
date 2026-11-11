import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Archive, CheckCircle2, Layers, Lock } from "lucide-react";

const OPTIONS = [
  {
    value: "",
    label: "Tous",
    Icon: Layers,
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    glow: "rgba(59, 130, 246, 0.45)",
  },
  {
    value: "ACTIF",
    label: "Actif",
    Icon: CheckCircle2,
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    glow: "rgba(16, 185, 129, 0.45)",
  },
  {
    value: "ARCHIVE",
    label: "Archivé",
    Icon: Archive,
    gradient: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
    glow: "rgba(100, 116, 139, 0.4)",
  },
  {
    value: "BLOQUE",
    label: "Bloqué",
    Icon: Lock,
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    glow: "rgba(245, 158, 11, 0.45)",
  },
];

export default function ArticleStatusTabs({ value, onChange }) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef(null);
  const btnRefs = useRef([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const activeIndex = Math.max(
    0,
    OPTIONS.findIndex((o) => o.value === value)
  );
  const active = OPTIONS[activeIndex];

  useEffect(() => {
    const btn = btnRefs.current[activeIndex];
    const container = containerRef.current;
    if (!btn || !container) return undefined;

    const update = () => {
      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      setIndicator({ left: bRect.left - cRect.left, width: bRect.width });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeIndex, value]);

  return (
    <div>
      <span className="art-status-tabs-label mb-2 block text-[11px] font-semibold uppercase tracking-wide">
        Statut
      </span>
      <div
        ref={containerRef}
        className="art-status-tabs-track relative inline-flex flex-wrap gap-1 rounded-xl p-1"
        role="radiogroup"
        aria-label="Filtrer par statut article"
      >
        <motion.div
          className="pointer-events-none absolute top-1 bottom-1 rounded-lg"
          animate={{
            left: indicator.left,
            width: indicator.width,
          }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 32 }
          }
          style={{
            background: active.gradient,
            boxShadow: `0 2px 14px ${active.glow}`,
          }}
          aria-hidden
        />
        {OPTIONS.map((opt, i) => {
          const isActive = value === opt.value;
          const Icon = opt.Icon;
          return (
            <button
              key={opt.label}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(opt.value)}
              className={`relative z-10 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 ${
                isActive ? "text-white" : "art-status-tab-idle"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
