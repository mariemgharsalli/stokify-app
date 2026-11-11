import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Filter, RotateCcw, Search, Sparkles, X } from "lucide-react";

const THEMES = {
  marque: {
    iconGrad: "linear-gradient(135deg, rgba(6,182,212,0.45), rgba(59,130,246,0.3))",
    iconColor: "#7dd3fc",
    badgeGrad: "linear-gradient(135deg, #06b6d4, #3b82f6)",
    searchGlow: "linear-gradient(90deg, rgba(6,182,212,0.45), rgba(59,130,246,0.35))",
    searchIdle: "linear-gradient(90deg, rgba(6,182,212,0.2), rgba(59,130,246,0.12))",
    chip: "#38bdf8",
  },
  famille: {
    iconGrad: "linear-gradient(135deg, rgba(52,211,153,0.45), rgba(16,185,129,0.28))",
    iconColor: "#6ee7b7",
    badgeGrad: "linear-gradient(135deg, #34d399, #059669)",
    searchGlow: "linear-gradient(90deg, rgba(52,211,153,0.4), rgba(16,185,129,0.3))",
    searchIdle: "linear-gradient(90deg, rgba(52,211,153,0.18), rgba(16,185,129,0.1))",
    chip: "#34d399",
  },
};

/**
 * Colorful animated filter board for Marques / Familles (reuses .article-filter-panel).
 */
export default function RefsFilterBoard({
  theme = "marque",
  title = "Recherche & filtres",
  subtitle = "Affinez le référentiel",
  search,
  onSearchChange,
  searchPlaceholder = "Rechercher…",
  statutFilter = "",
  onStatutChange,
  statutOptions = [],
  actions = null,
  defaultOpen = true,
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const [searchFocused, setSearchFocused] = useState(false);
  const t = THEMES[theme] || THEMES.marque;

  const activeCount =
    (String(search || "").trim() ? 1 : 0) + (statutFilter ? 1 : 0);

  const resetAll = () => {
    onSearchChange?.("");
    onStatutChange?.("");
  };

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="article-filter-panel sticky top-2 z-20 space-y-4 p-4 sm:p-5"
    >
      <style>{`
        @keyframes refsFilterShimmer {
          0% { transform: translateX(-120%); opacity: 0; }
          35% { opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        .refs-filter-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.14) 50%, transparent 60%);
          animation: refsFilterShimmer 4.8s ease-in-out infinite;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .refs-filter-shimmer::after { animation: none !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2.5 text-left"
        >
          <span
            className="refs-filter-shimmer relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl"
            style={{
              background: t.iconGrad,
              color: t.iconColor,
              boxShadow: `0 0 18px ${t.chip}40`,
            }}
          >
            <Filter className="h-5 w-5" />
          </span>
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              {title}
              <Sparkles className="h-3.5 w-3.5 text-sky-200/80" aria-hidden />
              {activeCount > 0 ? (
                <motion.span
                  key={activeCount}
                  initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: t.badgeGrad, boxShadow: `0 2px 10px ${t.chip}55` }}
                >
                  {activeCount}
                </motion.span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-[11px] text-sky-200/55">{subtitle}</span>
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
          {actions}
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
                    background: searchFocused ? t.searchGlow : t.searchIdle,
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
                    placeholder={searchPlaceholder}
                    className="art-filter-field w-full py-3 pl-11 pr-10 text-sm shadow-none"
                    aria-label={searchPlaceholder}
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

              {statutOptions?.length ? (
                <div>
                  <span className="art-status-tabs-label mb-2 block text-[11px] font-semibold uppercase tracking-wide">
                    Statut
                  </span>
                  <div
                    className="art-status-tabs-track inline-flex flex-wrap gap-1 rounded-xl p-1"
                    role="radiogroup"
                    aria-label="Filtrer par statut"
                  >
                    {statutOptions.map((opt) => {
                      const active = statutFilter === opt.value;
                      return (
                        <button
                          key={opt.value || "all"}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => onStatutChange?.(opt.value)}
                          className={`relative z-10 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                            active ? "text-white shadow-md" : "art-status-tab-idle"
                          }`}
                          style={
                            active
                              ? {
                                  background: `linear-gradient(135deg, ${opt.color}, color-mix(in srgb, ${opt.color} 70%, #0f172a))`,
                                  boxShadow: `0 2px 12px ${opt.color}55`,
                                }
                              : undefined
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {activeCount > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {String(search || "").trim() ? (
                    <button
                      type="button"
                      onClick={() => onSearchChange?.("")}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-white"
                      style={{
                        borderColor: `${t.chip}55`,
                        background: `${t.chip}22`,
                        boxShadow: `0 0 12px ${t.chip}33`,
                      }}
                    >
                      Recherche : {search.trim()}
                      <X className="h-3 w-3 opacity-70" />
                    </button>
                  ) : null}
                  {statutFilter ? (
                    <button
                      type="button"
                      onClick={() => onStatutChange?.("")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-100"
                    >
                      Statut :{" "}
                      {statutOptions.find((o) => o.value === statutFilter)?.label || statutFilter}
                      <X className="h-3 w-3 opacity-70" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
