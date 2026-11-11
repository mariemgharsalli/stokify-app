import { motion, useReducedMotion } from "framer-motion";
import { LayoutGrid, List, Search } from "lucide-react";
import { TIERS_FILTER_PILLS, TIERS_TABLE_CSS } from "./tiersTheme";

export default function TierViewToolbar({
  search,
  onSearchChange,
  statutFilter,
  onStatutFilterChange,
  viewMode,
  onViewModeChange,
  searchPlaceholder = "Rechercher par nom, code, email…",
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="tier-toolbar-pro relative z-0 mb-5"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <style>{TIERS_TABLE_CSS}</style>
      <div className="relative z-[1] space-y-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-white/15 bg-white/10 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/40 transition focus:border-sky-400/50 focus:bg-white/15"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-black/20 p-1">
            {TIERS_FILTER_PILLS.map((f) => {
              const active = statutFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onStatutFilterChange(f.id)}
                  className="relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)" }}
                >
                  {active && (
                    <motion.span
                      layoutId="tier-statut-pill"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: f.gradient,
                        boxShadow: `0 8px 18px -10px ${f.glow}`,
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-[1]">{f.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
            {[
              { id: "table", label: "Tableau", Icon: List },
              { id: "grid", label: "Grille", Icon: LayoutGrid },
            ].map((m) => {
              const active = viewMode === m.id;
              const Icon = m.Icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onViewModeChange(m.id)}
                  className="relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                  style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)" }}
                >
                  {active && (
                    <motion.span
                      layoutId="tier-view-pill"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: "linear-gradient(135deg, #378ADD, #0EA5E9)",
                        boxShadow: "0 8px 18px -10px rgba(55,138,221,0.55)",
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-[1] flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function filterTiersByStatut(items, statutFilter) {
  if (statutFilter === "tous") return items;
  if (statutFilter === "inactifs") return items.filter((t) => t.actif === false);
  return items.filter((t) => t.actif !== false);
}

export function sortTiers(items, sortKey, sortDir) {
  const dir = sortDir === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    let av = a[sortKey];
    let bv = b[sortKey];
    if (sortKey === "actif") {
      av = a.actif !== false ? 1 : 0;
      bv = b.actif !== false ? 1 : 0;
    }
    if (sortKey === "contact") {
      av = a.email || a.telephone || a.contact || "";
      bv = b.email || b.telephone || b.contact || "";
    }
    if (av == null) av = "";
    if (bv == null) bv = "";
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), "fr") * dir;
  });
}
