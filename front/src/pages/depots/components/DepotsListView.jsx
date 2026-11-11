import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  MapPin,
  MoreVertical,
  Package,
  Warehouse,
} from "lucide-react";
import { formatMoney } from "../../rapports/rapportUtils";
import EmplacementCard from "./EmplacementCard";
import DepotActionsMenu from "./DepotActionsMenu";
import { highlightMatch } from "./depotUtils";
import {
  DepotStatutBadge,
  canDeleteDepotPermanent,
  parseDepotStatut,
} from "../depotStatusUi";
import { occupationColor } from "../depotsTheme";

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
};

function useAnimatedNumber(target, duration = 900) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setValue(Number(target) || 0);
      return undefined;
    }
    const end = Number(target) || 0;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(end * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduceMotion]);

  return value;
}

function ProgressRing({ pct, accent, size = 58, pulse, children }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  const inner = size - stroke * 2 - 4;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {pulse ? (
        <span className="depot-list-pulse pointer-events-none absolute inset-0 rounded-full" aria-hidden />
      ) : null}
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-subtle, rgba(148,163,184,0.18))"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${accent}66)` }}
        />
      </svg>
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full"
        style={{
          width: inner,
          height: inner,
          background: "var(--bg-input)",
          boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.12)",
        }}
      >
        {children}
      </div>
      <span
        className="absolute -bottom-0.5 left-1/2 z-[1] -translate-x-1/2 rounded-md px-1.5 py-px text-[9px] font-bold tabular-nums text-white"
        style={{
          background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, ${THEME.cyan}))`,
          boxShadow: `0 2px 8px -2px ${accent}99`,
        }}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function DepotListRow({
  depot,
  index,
  search,
  canWrite,
  onOpenDrawer,
  onEditDepot,
  onToggleStatutDepot,
  onDeleteDepot,
  onAddEmplacement,
  onEditEmplacement,
  onToggleStatutEmplacement,
  onDeleteEmplacement,
}) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);

  const emps = depot.emplacements || [];
  const pct = Number(depot.stockSummary?.remplissagePct ?? 0);
  const accent = occupationColor(pct);
  const statut = parseDepotStatut(depot);
  const canDeletePermanent = canDeleteDepotPermanent(depot);
  const nbEmp = emps.length || depot.stockSummary?.nbEmplacements || 0;
  const nbArticles = depot.stockSummary?.nbArticles ?? 0;
  const valeur = depot.stockSummary?.valeurStock ?? depot.valeurStock ?? 0;
  const animatedArticles = useAnimatedNumber(nbArticles, 900);
  const needsPulse = !reduceMotion && (pct > 85 || statut === "INACTIF");

  const status =
    statut === "INACTIF"
      ? { label: "Inactif", bg: "rgba(148,163,184,0.18)", color: "#94a3b8" }
      : pct > 85
        ? { label: "Saturé", bg: "rgba(226,75,74,0.18)", color: "#fca5a5" }
        : pct > 60
          ? { label: "Chargé", bg: "rgba(239,159,39,0.18)", color: "#fcd34d" }
          : { label: "OK", bg: "rgba(29,158,117,0.18)", color: "#6ee7b7" };

  return (
    <motion.article
      className="group relative overflow-hidden rounded-2xl border"
      style={{
        "--depot-list-accent": accent,
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: "var(--shadow-card)",
        opacity: statut === "INACTIF" ? 0.9 : 1,
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: reduceMotion ? 0 : Math.min(index * 0.045, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -4,
              borderColor: `${accent}66`,
              boxShadow: `0 18px 36px -16px ${accent}66`,
            }
      }
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${THEME.cyan}12, transparent 50%)`,
        }}
        aria-hidden
      />

      <Warehouse
        className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 opacity-[0.06] transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.1]"
        style={{ color: accent }}
        strokeWidth={1}
        aria-hidden
      />

      <div className="relative z-[1] flex w-full items-center gap-3 px-3.5 py-3.5">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={expanded}
        >
          <ProgressRing pct={pct} accent={accent} size={58} pulse={needsPulse}>
            <Warehouse className="h-5 w-5" style={{ color: accent }} aria-hidden />
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="relative rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ background: status.bg, color: status.color }}
              >
                {needsPulse ? (
                  <span
                    className="depot-list-live-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                    style={{ background: accent }}
                    aria-hidden
                  />
                ) : null}
                {status.label}
              </span>
              <DepotStatutBadge row={depot} />
              <span className="font-mono text-[11px] font-semibold text-[#378ADD]">
                {highlightMatch(depot.code, search)}
              </span>
              {depot.ville ? (
                <span className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                  {depot.ville}
                </span>
              ) : null}
            </div>

            <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
              {highlightMatch(depot.libelle, search)}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-sky-400/80" aria-hidden />
                {nbEmp} empl.
              </span>
              <span className="text-[var(--border-default)]">·</span>
              <span className="inline-flex items-center gap-1">
                <Package className="h-3 w-3 text-sky-400/80" aria-hidden />
                {Math.round(animatedArticles).toLocaleString("fr-FR")} article
                {nbArticles > 1 ? "s" : ""}
              </span>
              {depot.capacite != null ? (
                <>
                  <span className="text-[var(--border-default)]">·</span>
                  <span>{depot.capacite} m²</span>
                </>
              ) : null}
            </div>

            <div
              className="mt-2 h-1 max-w-[180px] overflow-hidden rounded-full"
              style={{ background: "color-mix(in srgb, var(--border-default) 70%, transparent)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${accent}, ${THEME.cyan})`,
                  boxShadow: `0 0 8px ${accent}55`,
                }}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${Math.min(100, pct)}%` }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              />
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-lg font-bold tabular-nums leading-none" style={{ color: accent }}>
              {pct.toFixed(0)}%
            </p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Remplissage
            </p>
            <p className="mt-1.5 text-[11px] font-semibold tabular-nums text-sky-400/90">
              {formatMoney(valeur)}
            </p>
          </div>

          <motion.span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-[var(--text-muted)]"
            style={{
              borderColor: expanded ? `${accent}55` : "var(--border-default)",
              background: expanded
                ? `color-mix(in srgb, ${accent} 14%, transparent)`
                : "var(--bg-input)",
              color: expanded ? accent : undefined,
            }}
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.25 }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>

        <div className="relative z-[2] shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-2 text-[var(--text-primary)] transition hover:border-[#378ADD]/50 hover:bg-[rgba(55,138,221,0.1)] hover:text-[#378ADD]"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuAnchor(menuAnchor ? null : rect);
            }}
            aria-label="Actions"
            aria-expanded={Boolean(menuAnchor)}
          >
            <MoreVertical size={16} />
          </button>
          <DepotActionsMenu
            anchorRect={menuAnchor}
            close={() => setMenuAnchor(null)}
            canWrite={canWrite}
            canDeletePermanent={canDeletePermanent}
            isActif={statut === "ACTIF"}
            onView={() => onOpenDrawer(depot)}
            onEdit={() => onEditDepot(depot)}
            onAddEmplacement={() => onAddEmplacement(depot)}
            onToggleStatut={() => onToggleStatutDepot(depot)}
            onDelete={() => onDeleteDepot(depot)}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="emps"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="space-y-2 border-t px-3 py-3"
              style={{
                borderColor: "var(--border-default)",
                background:
                  "linear-gradient(180deg, color-mix(in srgb, #378ADD 6%, var(--bg-app)), var(--bg-app))",
              }}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Emplacements du dépôt
                </p>
                <span className="text-[10px] tabular-nums text-sky-400/80">
                  {emps.length} emplacement{emps.length > 1 ? "s" : ""}
                </span>
              </div>
              {emps.length === 0 ? (
                <p className="py-4 text-center text-xs text-[var(--text-muted)]">
                  Aucun emplacement
                </p>
              ) : (
                emps.map((e, ei) => (
                  <EmplacementCard
                    key={e.id}
                    emp={e}
                    index={ei}
                    search={search}
                    canWrite={canWrite}
                    onEdit={(emp) => onEditEmplacement(emp, depot)}
                    onToggleStatut={(emp) => onToggleStatutEmplacement(emp, depot)}
                    onDelete={(emp) => onDeleteEmplacement(emp, depot)}
                  />
                ))
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <style>{`
        .depot-list-pulse {
          animation: depotListPulse 2s ease-out infinite;
        }
        .depot-list-live-dot {
          box-shadow: 0 0 6px var(--depot-list-accent);
          animation: depotListPulse 1.6s ease-out infinite;
        }
        @keyframes depotListPulse {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--depot-list-accent) 55%, transparent); opacity: 1; }
          70% { box-shadow: 0 0 0 10px transparent; opacity: 0.35; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 0; }
        }
      `}</style>
    </motion.article>
  );
}

export default function DepotsListView({
  depots,
  search,
  canWrite,
  onOpenDrawer,
  onEditDepot,
  onToggleStatutDepot,
  onDeleteDepot,
  onAddEmplacement,
  onEditEmplacement,
  onToggleStatutEmplacement,
  onDeleteEmplacement,
}) {
  const sorted = useMemo(
    () =>
      [...depots].sort((a, b) =>
        String(a.libelle || "").localeCompare(String(b.libelle || ""), "fr")
      ),
    [depots]
  );

  return (
    <div className="space-y-2.5">
      {sorted.map((depot, i) => (
        <DepotListRow
          key={depot.id}
          depot={depot}
          index={i}
          search={search}
          canWrite={canWrite}
          onOpenDrawer={onOpenDrawer}
          onEditDepot={onEditDepot}
          onToggleStatutDepot={onToggleStatutDepot}
          onDeleteDepot={onDeleteDepot}
          onAddEmplacement={onAddEmplacement}
          onEditEmplacement={onEditEmplacement}
          onToggleStatutEmplacement={onToggleStatutEmplacement}
          onDeleteEmplacement={onDeleteEmplacement}
        />
      ))}
    </div>
  );
}
