import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ClipboardList,
  Filter,
  RotateCcw,
  Search,
  Sparkles,
  Warehouse,
  X,
} from "lucide-react";
import { INV_STATUT_OPTIONS } from "../inventaireUtils";

/**
 * Sticky navy glass filter board for Inventaires.
 */
export default function InventaireFilterBoard({
  search,
  onSearchChange,
  depotFilter,
  onDepotChange,
  depots = [],
  statutFilter,
  onStatutChange,
  filteredCount,
  totalCount,
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const tabsRef = useRef(null);
  const btnRefs = useRef([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const activeIndex = Math.max(
    0,
    INV_STATUT_OPTIONS.findIndex((o) => o.value === (statutFilter || ""))
  );
  const activeOpt = INV_STATUT_OPTIONS[activeIndex] || INV_STATUT_OPTIONS[0];

  const activeCount =
    (String(search || "").trim() ? 1 : 0) +
    (depotFilter ? 1 : 0) +
    (statutFilter ? 1 : 0);

  const resetAll = () => {
    onSearchChange?.("");
    onDepotChange?.("");
    onStatutChange?.("");
  };

  useEffect(() => {
    const btn = btnRefs.current[activeIndex];
    const container = tabsRef.current;
    if (!btn || !container) return undefined;
    const update = () => {
      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      setIndicator({ left: bRect.left - cRect.left, width: bRect.width });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeIndex, statutFilter, open, depotFilter]);

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="article-filter-panel sticky top-2 z-20 space-y-4 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2.5 text-left"
        >
          <span
            className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl"
            style={{
              background: "linear-gradient(135deg, rgba(55,138,221,0.5), rgba(6,182,212,0.28))",
              color: "#7dd3fc",
              boxShadow: "0 0 18px rgba(56,189,248,0.35)",
            }}
          >
            <span
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 48%, transparent 62%)",
                backgroundSize: "200% 100%",
                animation: reduceMotion ? undefined : "invFilterShimmer 2.2s ease-in-out infinite",
              }}
              aria-hidden
            />
            <Filter className="relative h-5 w-5" />
          </span>
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              Recherche & filtres
              <Sparkles className="h-3.5 w-3.5 text-sky-200/80" aria-hidden />
              {activeCount > 0 ? (
                <motion.span
                  key={activeCount}
                  initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg, #378ADD, #06b6d4)",
                    boxShadow: "0 2px 10px rgba(56,189,248,0.45)",
                  }}
                >
                  {activeCount}
                </motion.span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-[11px] text-sky-200/55">
              Affinez par référence, dépôt ou statut
            </span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Réinitialiser
            </button>
          ) : null}
          <motion.button
            type="button"
            onClick={() => setOpen((o) => !o)}
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-400/20 text-sky-200/70 hover:bg-white/5"
            aria-expanded={open}
            aria-label={open ? "Replier" : "Déplier"}
          >
            ▼
          </motion.button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-1">
              <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                <div className="relative">
                  <div
                    className="absolute -inset-1 rounded-2xl opacity-70 transition-opacity duration-300"
                    style={{
                      background: searchFocused
                        ? "linear-gradient(90deg, rgba(55,138,221,0.5), rgba(6,182,212,0.35))"
                        : "linear-gradient(90deg, rgba(55,138,221,0.2), rgba(6,182,212,0.12))",
                      filter: "blur(10px)",
                    }}
                    aria-hidden
                  />
                  <div className="art-filter-search-wrap relative">
                    <Search
                      className="art-filter-search-icon pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => onSearchChange?.(e.target.value)}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setSearchFocused(false)}
                      placeholder="Rechercher un inventaire…"
                      className="art-filter-field w-full py-3 pl-11 pr-10 text-sm shadow-none"
                      aria-label="Rechercher un inventaire"
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => onSearchChange?.("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-sky-200/70 hover:bg-white/10 hover:text-white"
                        aria-label="Effacer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div>
                  <span className="art-status-tabs-label mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                    <Warehouse className="h-3.5 w-3.5" />
                    Dépôt
                  </span>
                  <select
                    value={depotFilter || ""}
                    onChange={(e) => onDepotChange?.(e.target.value)}
                    className="art-filter-field w-full py-3 px-3 text-sm shadow-none"
                    aria-label="Filtrer par dépôt"
                  >
                    <option value="">Tous les dépôts</option>
                    {depots.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.libelle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span className="art-status-tabs-label mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Statut
                </span>
                <div
                  ref={tabsRef}
                  className="art-status-tabs-track relative inline-flex flex-wrap gap-1 rounded-xl p-1"
                  role="radiogroup"
                  aria-label="Filtrer par statut inventaire"
                >
                  <motion.div
                    className="pointer-events-none absolute top-1 bottom-1 rounded-lg"
                    animate={{ left: indicator.left, width: indicator.width }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 32 }
                    }
                    style={{
                      background: `linear-gradient(135deg, ${activeOpt.color}, color-mix(in srgb, ${activeOpt.color} 70%, #0f172a))`,
                      boxShadow: `0 2px 14px ${activeOpt.color}55`,
                    }}
                    aria-hidden
                  />
                  {INV_STATUT_OPTIONS.map((opt, i) => {
                    const isActive = (statutFilter || "") === opt.value;
                    return (
                      <button
                        key={opt.value || "all"}
                        ref={(el) => {
                          btnRefs.current[i] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => onStatutChange?.(opt.value)}
                        className={`relative z-10 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                          isActive ? "text-white" : "art-status-tab-idle"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <AnimatePresence>
                {activeCount > 0 ? (
                  <motion.div
                    key="chips"
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                    className="flex flex-wrap gap-1.5"
                  >
                    {String(search || "").trim() ? (
                      <FilterChip
                        label={`« ${String(search).trim().slice(0, 24)} »`}
                        onRemove={() => onSearchChange?.("")}
                        reduceMotion={reduceMotion}
                      />
                    ) : null}
                    {depotFilter ? (
                      <FilterChip
                        label={
                          depots.find((d) => String(d.id) === String(depotFilter))?.libelle ||
                          "Dépôt"
                        }
                        onRemove={() => onDepotChange?.("")}
                        reduceMotion={reduceMotion}
                      />
                    ) : null}
                    {statutFilter ? (
                      <FilterChip
                        label={
                          INV_STATUT_OPTIONS.find((o) => o.value === statutFilter)?.label ||
                          statutFilter
                        }
                        onRemove={() => onStatutChange?.("")}
                        reduceMotion={reduceMotion}
                      />
                    ) : null}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <p className="border-t border-sky-400/10 pt-3 text-xs text-sky-200/50">
                <span className="font-semibold tabular-nums text-sky-100/90">
                  {filteredCount}
                </span>
                {filteredCount !== totalCount ? ` sur ${totalCount}` : ""} inventaire
                {filteredCount !== 1 ? "s" : ""}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <style>{`
        @keyframes invFilterShimmer {
          0% { background-position: 120% 0; }
          100% { background-position: -40% 0; }
        }
      `}</style>
    </motion.section>
  );
}

function FilterChip({ label, onRemove, reduceMotion }) {
  return (
    <motion.button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-500/15 px-2.5 py-1 text-[11px] font-medium text-sky-100"
      initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={reduceMotion ? undefined : { scale: 1.03 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
    >
      {label}
      <X className="h-3 w-3 opacity-70" />
    </motion.button>
  );
}
