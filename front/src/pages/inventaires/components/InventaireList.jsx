import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LayoutGrid, ListTree } from "lucide-react";
import InventaireCard from "./InventaireCard";
import { formatDate } from "../inventaireUtils";

/**
 * Creative inventaires list — timeline mission board or grid.
 */
export default function InventaireList({ items, canWrite, onContinue }) {
  const reduceMotion = useReducedMotion();
  const [layout, setLayout] = useState("timeline");

  const groups = useMemo(() => {
    const map = new Map();
    for (const inv of items) {
      const key = formatDate(inv.date) || "Sans date";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(inv);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            className="font-display text-base font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Missions d&apos;inventaire
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {items.length} contrôle{items.length !== 1 ? "s" : ""} affiché
            {items.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div
          className="relative inline-flex rounded-xl border p-0.5"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-input)",
          }}
          role="group"
          aria-label="Mode d'affichage"
        >
          {[
            { id: "timeline", Icon: ListTree, label: "Timeline" },
            { id: "grid", Icon: LayoutGrid, label: "Grille" },
          ].map(({ id, Icon, label }) => {
            const active = layout === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setLayout(id)}
                className="relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ color: active ? "#fff" : "var(--text-muted)" }}
              >
                {active ? (
                  <motion.span
                    layoutId="inv-layout-pill"
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: "linear-gradient(135deg, #378ADD, #0EA5E9)",
                      boxShadow: "0 4px 14px rgba(55,138,221,0.35)",
                    }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 30 }
                    }
                  />
                ) : null}
                <Icon className="relative z-[1] h-3.5 w-3.5" />
                <span className="relative z-[1]">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {layout === "grid" ? (
          <motion.div
            key="grid"
            className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {items.map((inv, i) => (
              <InventaireCard
                key={inv.id}
                inv={inv}
                index={i}
                layout="grid"
                canWrite={canWrite}
                onContinue={onContinue}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="timeline"
            className="relative space-y-8"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="pointer-events-none absolute bottom-4 left-[15px] top-4 w-px sm:left-[19px]"
              style={{
                background:
                  "linear-gradient(180deg, #378ADD 0%, rgba(14,165,233,0.45) 40%, transparent 100%)",
              }}
              aria-hidden
            />

            {groups.map(([dateLabel, groupItems], gIdx) => (
              <div key={dateLabel} className="relative space-y-3">
                <div className="relative flex items-center gap-3 pl-0">
                  <motion.div
                    className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10"
                    style={{
                      background: "linear-gradient(145deg, #378ADD, #0EA5E9)",
                      boxShadow:
                        "0 0 0 4px var(--bg-app, #0b1220), 0 8px 20px -6px rgba(55,138,221,0.55)",
                    }}
                    initial={reduceMotion ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 22,
                      delay: reduceMotion ? 0 : gIdx * 0.05,
                    }}
                  >
                    <span className="text-[10px] font-bold text-white tabular-nums">
                      {String(dateLabel).slice(0, 5)}
                    </span>
                  </motion.div>
                  <div>
                    <p
                      className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: "#7dd3fc" }}
                    >
                      Session
                    </p>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {dateLabel}
                      <span className="ml-2 font-normal" style={{ color: "var(--text-muted)" }}>
                        · {groupItems.length} inventaire{groupItems.length !== 1 ? "s" : ""}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="ml-4 space-y-2 border-l border-transparent pl-6 sm:ml-5 sm:pl-8">
                  {groupItems.map((inv, i) => (
                    <InventaireCard
                      key={inv.id}
                      inv={inv}
                      index={i}
                      layout="timeline"
                      canWrite={canWrite}
                      onContinue={onContinue}
                    />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
