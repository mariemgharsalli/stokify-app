import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Filter,
  FolderTree,
  Percent,
  Receipt,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  Truck,
  X,
} from "lucide-react";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import ArticleStatusTabs from "./ArticleStatusTabs";
import {
  filterBarInputClass,
  filterBarLabelClass,
  filterBarSelectClass,
  filterBarShellClass,
} from "./articlesTheme";

const FIELD_TONES = {
  search: { accent: "#60a5fa", glow: "rgba(96,165,250,0.35)", Icon: Search },
  marque: { accent: "#22d3ee", glow: "rgba(34,211,238,0.35)", Icon: Tag },
  famille: { accent: "#34d399", glow: "rgba(52,211,153,0.35)", Icon: FolderTree },
  sousFamille: { accent: "#a78bfa", glow: "rgba(167,139,250,0.3)", Icon: FolderTree },
  fournisseur: { accent: "#fbbf24", glow: "rgba(251,191,36,0.35)", Icon: Truck },
  marge: { accent: "#fb7185", glow: "rgba(251,113,133,0.35)", Icon: Percent },
  tva: { accent: "#38bdf8", glow: "rgba(56,189,248,0.35)", Icon: Receipt },
};

const EMPTY_FILTERS = {
  marque: "",
  familleId: "",
  sousFamilleId: "",
  fournisseur: "",
  marge: "",
  tvaPrix: "",
};

function FieldShell({ toneKey, label, delay = 0, reduceMotion, children }) {
  const tone = FIELD_TONES[toneKey] || FIELD_TONES.search;
  const Icon = tone.Icon;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="group/field relative min-w-[150px]"
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-[0.9rem] opacity-0 transition-opacity duration-300 group-focus-within/field:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${tone.glow}, transparent 60%)`,
          filter: "blur(8px)",
        }}
        aria-hidden
      />
      <div className="relative">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-md"
            style={{
              background: `${tone.accent}22`,
              color: tone.accent,
            }}
          >
            <Icon className="h-3 w-3" aria-hidden />
          </span>
          <label className={filterBarLabelClass}>{label}</label>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

export default function ArticleFiltersBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  statut,
  onStatutChange,
  filterMarqueOptions,
  filterFamilleOptions,
  filterSousFamilleOptions,
  filterFournisseurOptions,
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);

  const optionLabel = (options, value) =>
    options?.find((o) => String(o.value) === String(value))?.label || value;

  const activeChips = useMemo(() => {
    const chips = [];
    if (String(search || "").trim()) {
      chips.push({
        key: "search",
        label: `Recherche : ${search.trim()}`,
        color: FIELD_TONES.search.accent,
        onRemove: () => onSearchChange(""),
      });
    }
    if (filters.marque) {
      chips.push({
        key: "marque",
        label: `Marque : ${optionLabel(filterMarqueOptions, filters.marque)}`,
        color: FIELD_TONES.marque.accent,
        onRemove: () => onFiltersChange((f) => ({ ...f, marque: "" })),
      });
    }
    if (filters.familleId) {
      chips.push({
        key: "famille",
        label: `Famille : ${optionLabel(filterFamilleOptions, filters.familleId)}`,
        color: FIELD_TONES.famille.accent,
        onRemove: () => onFiltersChange((f) => ({ ...f, familleId: "", sousFamilleId: "" })),
      });
    }
    if (filters.sousFamilleId) {
      chips.push({
        key: "sf",
        label: `Sous-famille : ${optionLabel(filterSousFamilleOptions, filters.sousFamilleId)}`,
        color: FIELD_TONES.sousFamille.accent,
        onRemove: () => onFiltersChange((f) => ({ ...f, sousFamilleId: "" })),
      });
    }
    if (filters.fournisseur) {
      chips.push({
        key: "fourn",
        label: `Fournisseur : ${optionLabel(filterFournisseurOptions, filters.fournisseur)}`,
        color: FIELD_TONES.fournisseur.accent,
        onRemove: () => onFiltersChange((f) => ({ ...f, fournisseur: "" })),
      });
    }
    if (filters.marge) {
      const margeLabels = {
        positive: "Positive",
        faible: "Faible",
        forte: "Forte",
      };
      chips.push({
        key: "marge",
        label: `Marge : ${margeLabels[filters.marge] || filters.marge}`,
        color: FIELD_TONES.marge.accent,
        onRemove: () => onFiltersChange((f) => ({ ...f, marge: "" })),
      });
    }
    if (filters.tvaPrix) {
      chips.push({
        key: "tva",
        label: `TVA : ${filters.tvaPrix}`,
        color: FIELD_TONES.tva.accent,
        onRemove: () => onFiltersChange((f) => ({ ...f, tvaPrix: "" })),
      });
    }
    if (statut) {
      const statutLabels = { ACTIF: "Actif", ARCHIVE: "Archivé", BLOQUE: "Bloqué" };
      chips.push({
        key: "statut",
        label: `Statut : ${statutLabels[statut] || statut}`,
        color: statut === "ACTIF" ? "#34d399" : statut === "BLOQUE" ? "#fbbf24" : "#94a3b8",
        onRemove: () => onStatutChange(""),
      });
    }
    return chips;
  }, [
    search,
    filters,
    statut,
    filterMarqueOptions,
    filterFamilleOptions,
    filterSousFamilleOptions,
    filterFournisseurOptions,
    onSearchChange,
    onFiltersChange,
    onStatutChange,
  ]);

  const resetAll = () => {
    onSearchChange("");
    onFiltersChange({ ...EMPTY_FILTERS });
    onStatutChange("");
  };

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={filterBarShellClass}
    >
      <style>{`
        @keyframes artFilterShimmer {
          0% { transform: translateX(-120%); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        .art-filter-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(96,165,250,0.18) 50%, transparent 60%);
          animation: artFilterShimmer 4.5s ease-in-out infinite;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .art-filter-shimmer::after { animation: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2.5 text-left"
        >
          <span
            className="art-filter-shimmer relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl"
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(14,165,233,0.2))",
              color: "#93c5fd",
              boxShadow: "0 0 20px rgba(59,130,246,0.25)",
            }}
          >
            <Filter className="h-4.5 w-4.5 h-5 w-5" />
          </span>
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              Recherche & filtres
              <Sparkles className="h-3.5 w-3.5 text-sky-300" aria-hidden />
              {activeChips.length > 0 ? (
                <motion.span
                  key={activeChips.length}
                  initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                    boxShadow: "0 2px 10px rgba(59,130,246,0.45)",
                  }}
                >
                  {activeChips.length}
                </motion.span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-[11px] text-sky-200/60">
              Affinez le catalogue par code, famille, marge ou statut
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          {activeChips.length > 0 ? (
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
            aria-label={open ? "Replier les filtres" : "Déplier les filtres"}
          >
            ▼
          </motion.button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="filters-body"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-1">
              {/* Search hero */}
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05, duration: 0.35 }}
                className="relative"
              >
                <div
                  className="absolute -inset-1 rounded-2xl opacity-60 transition-opacity duration-300"
                  style={{
                    background: searchFocused
                      ? "linear-gradient(90deg, rgba(59,130,246,0.45), rgba(6,182,212,0.35), rgba(52,211,153,0.3))"
                      : "linear-gradient(90deg, rgba(59,130,246,0.2), rgba(6,182,212,0.12))",
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
                    className={`${filterBarInputClass} py-3 pl-11 text-sm`}
                    placeholder="Rechercher un code, une désignation…"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    aria-label="Rechercher un code ou une désignation"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => onSearchChange("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-sky-200/70 hover:bg-white/10 hover:text-white"
                      aria-label="Effacer la recherche"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </motion.div>

              {/* Filter grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <FieldShell
                  toneKey="marque"
                  label="Marque"
                  delay={0.06}
                  reduceMotion={reduceMotion}
                >
                  <SearchableSelect
                    aria-label="Filtrer par marque"
                    value={filters.marque}
                    onChange={(v) => onFiltersChange((f) => ({ ...f, marque: v }))}
                    options={filterMarqueOptions}
                    placeholder="Toutes"
                    className="article-filter-select w-full"
                  />
                </FieldShell>

                <FieldShell
                  toneKey="famille"
                  label="Famille"
                  delay={0.1}
                  reduceMotion={reduceMotion}
                >
                  <SearchableSelect
                    aria-label="Filtrer par famille"
                    value={filters.familleId}
                    onChange={(v) =>
                      onFiltersChange((f) => ({ ...f, familleId: v, sousFamilleId: "" }))
                    }
                    options={filterFamilleOptions}
                    placeholder="Toutes"
                    className="article-filter-select w-full"
                  />
                </FieldShell>

                <FieldShell
                  toneKey="sousFamille"
                  label="Sous-famille"
                  delay={0.14}
                  reduceMotion={reduceMotion}
                >
                  <SearchableSelect
                    aria-label="Filtrer par sous-famille"
                    value={filters.sousFamilleId}
                    onChange={(v) => onFiltersChange((f) => ({ ...f, sousFamilleId: v }))}
                    options={filterSousFamilleOptions}
                    placeholder="Toutes"
                    disabled={!filters.familleId}
                    className="article-filter-select w-full"
                  />
                </FieldShell>

                <FieldShell
                  toneKey="fournisseur"
                  label="Fournisseur"
                  delay={0.18}
                  reduceMotion={reduceMotion}
                >
                  <SearchableSelect
                    aria-label="Filtrer par fournisseur"
                    value={filters.fournisseur}
                    onChange={(v) => onFiltersChange((f) => ({ ...f, fournisseur: v }))}
                    options={filterFournisseurOptions}
                    placeholder="Tous"
                    className="article-filter-select w-full"
                  />
                </FieldShell>

                <FieldShell toneKey="marge" label="Marge" delay={0.22} reduceMotion={reduceMotion}>
                  <select
                    className={filterBarSelectClass}
                    value={filters.marge}
                    onChange={(e) => onFiltersChange((f) => ({ ...f, marge: e.target.value }))}
                  >
                    <option value="">Toutes</option>
                    <option value="positive">Positive</option>
                    <option value="faible">Faible (&lt;15%)</option>
                    <option value="forte">Forte (&gt;=15%)</option>
                  </select>
                </FieldShell>

                <FieldShell toneKey="tva" label="TVA prix" delay={0.26} reduceMotion={reduceMotion}>
                  <select
                    className={filterBarSelectClass}
                    value={filters.tvaPrix}
                    onChange={(e) => onFiltersChange((f) => ({ ...f, tvaPrix: e.target.value }))}
                  >
                    <option value="">Tous</option>
                    <option value="choisir">Choisir</option>
                    <option value="filtrer">Filtrer</option>
                  </select>
                </FieldShell>
              </div>

              <div className="art-filter-divider border-t pt-4">
                <ArticleStatusTabs value={statut} onChange={onStatutChange} />
              </div>

              {/* Active chips */}
              <AnimatePresence initial={false}>
                {activeChips.length > 0 ? (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                    className="flex flex-wrap gap-2"
                  >
                    {activeChips.map((chip, i) => (
                      <motion.button
                        key={chip.key}
                        type="button"
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={chip.onRemove}
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-white transition hover:brightness-110"
                        style={{
                          borderColor: `${chip.color}55`,
                          background: `${chip.color}22`,
                          boxShadow: `0 0 12px ${chip.color}33`,
                        }}
                        title="Retirer ce filtre"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: chip.color }}
                        />
                        {chip.label}
                        <X className="h-3 w-3 opacity-70" />
                      </motion.button>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
