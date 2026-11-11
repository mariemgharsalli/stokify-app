import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  Eye,
  EyeOff,
  Filter,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { FILTER_PILLS } from "./societesTheme";

const FILTER_ICONS = {
  ALL: Building2,
  VISIBLE: Eye,
  HIDDEN: EyeOff,
  LOCATED: MapPin,
};

export default function SocieteToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  filterCounts,
  viewMode,
  onViewModeChange,
  onCreate,
  totalCount,
  filteredCount,
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const tabsRef = useRef(null);
  const btnRefs = useRef([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const activeIndex = Math.max(
    0,
    FILTER_PILLS.findIndex((p) => p.id === filter)
  );
  const activePill = FILTER_PILLS[activeIndex] || FILTER_PILLS[0];

  const activeCount =
    (String(search || "").trim() ? 1 : 0) + (filter && filter !== "ALL" ? 1 : 0);

  const resetAll = () => {
    onSearchChange?.("");
    onFilterChange?.("ALL");
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
  }, [activeIndex, filter, open]);

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="article-filter-panel sticky top-2 z-20 space-y-4 p-4 sm:p-5"
    >
      <style>{`
        @keyframes societeFilterShimmer {
          0% { transform: translateX(-120%); opacity: 0; }
          35% { opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        .societe-filter-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.14) 50%, transparent 60%);
          animation: societeFilterShimmer 4.8s ease-in-out infinite;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .societe-filter-shimmer::after { animation: none !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2.5 text-left"
        >
          <span
            className="societe-filter-shimmer relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl"
            style={{
              background: "linear-gradient(135deg, rgba(55,138,221,0.5), rgba(6,182,212,0.28))",
              color: "#7dd3fc",
              boxShadow: "0 0 18px rgba(56,189,248,0.35)",
            }}
          >
            <Filter className="h-5 w-5" />
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
              Affinez les tenants par nom, code ou statut
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

          <div
            className="flex rounded-xl border p-0.5"
            style={{
              borderColor: "rgba(96,165,250,0.22)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            {[
              { id: "table", Icon: List, label: "Tableau" },
              { id: "grid", Icon: LayoutGrid, label: "Grille" },
            ].map(({ id, Icon, label }) => {
              const active = viewMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onViewModeChange(id)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: active
                      ? "linear-gradient(135deg, rgba(55,138,221,0.55), rgba(6,182,212,0.35))"
                      : "transparent",
                    color: active ? "#fff" : "rgba(186,230,253,0.55)",
                    boxShadow: active ? "0 2px 10px rgba(55,138,221,0.35)" : "none",
                  }}
                  title={label}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>

          <motion.button
            type="button"
            onClick={onCreate}
            whileHover={reduceMotion ? undefined : { scale: 1.03, y: -1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #378ADD 0%, #0EA5E9 100%)",
              boxShadow: "0 4px 18px rgba(55,138,221,0.4)",
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouvelle société</span>
            <span className="sm:hidden">Créer</span>
          </motion.button>

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
                    onChange={(e) => onSearchChange(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    placeholder="Rechercher par nom ou code…"
                    className="art-filter-field w-full py-3 pl-11 pr-10 text-sm shadow-none"
                    aria-label="Rechercher une société"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => onSearchChange("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-sky-200/70 hover:bg-white/10 hover:text-white"
                      aria-label="Effacer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div>
                <span className="art-status-tabs-label mb-2 block text-[11px] font-semibold uppercase tracking-wide">
                  Statut
                </span>
                <div
                  ref={tabsRef}
                  className="art-status-tabs-track relative inline-flex flex-wrap gap-1 rounded-xl p-1"
                  role="radiogroup"
                  aria-label="Filtrer par statut société"
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
                      background: activePill.gradient,
                      boxShadow: `0 2px 14px ${activePill.glow}`,
                    }}
                    aria-hidden
                  />
                  {FILTER_PILLS.map((pill, i) => {
                    const isActive = filter === pill.id;
                    const Icon = FILTER_ICONS[pill.id] || Building2;
                    const count = filterCounts?.[pill.id] ?? 0;
                    return (
                      <button
                        key={pill.id}
                        ref={(el) => {
                          btnRefs.current[i] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => onFilterChange(pill.id)}
                        className={`relative z-10 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                          isActive ? "text-white" : "art-status-tab-idle"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {pill.label}
                        <span
                          className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
                          style={{
                            background: isActive
                              ? "rgba(255,255,255,0.22)"
                              : "rgba(255,255,255,0.06)",
                          }}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-400/10 pt-3">
                <p className="text-xs text-sky-200/50">
                  {filteredCount === totalCount ? (
                    <>
                      <span className="font-semibold tabular-nums text-sky-100/90">
                        {totalCount}
                      </span>{" "}
                      société{totalCount !== 1 ? "s" : ""} au total
                    </>
                  ) : (
                    <>
                      <span className="font-semibold tabular-nums text-sky-100/90">
                        {filteredCount}
                      </span>{" "}
                      sur {totalCount} société{totalCount !== 1 ? "s" : ""}
                    </>
                  )}
                </p>

                {activeCount > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {String(search || "").trim() ? (
                      <button
                        type="button"
                        onClick={() => onSearchChange("")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-medium text-sky-100"
                      >
                        Recherche : {search.trim()}
                        <X className="h-3 w-3 opacity-70" />
                      </button>
                    ) : null}
                    {filter && filter !== "ALL" ? (
                      <button
                        type="button"
                        onClick={() => onFilterChange("ALL")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-medium text-cyan-100"
                      >
                        Filtre : {FILTER_PILLS.find((p) => p.id === filter)?.label || filter}
                        <X className="h-3 w-3 opacity-70" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
