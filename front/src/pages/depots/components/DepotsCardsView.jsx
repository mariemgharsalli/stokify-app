import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  Eye,
  LayoutGrid,
  MapPin,
  MoreVertical,
} from "lucide-react";
import { formatMoney } from "../../rapports/rapportUtils";
import EmplacementCard from "./EmplacementCard";
import DepotMiniMap from "./DepotMiniMap";
import DepotActionsMenu from "./DepotActionsMenu";
import { highlightMatch } from "./depotUtils";
import { hasCoords as depotHasCoords } from "./depotLeaflet";
import {
  DepotStatutBadge,
  canDeleteDepotPermanent,
  parseDepotStatut,
} from "../depotStatusUi";
import { occupationColor } from "../depotsTheme";

function formatDepotLocation(depot) {
  const parts = [depot.adresse, depot.ville, depot.region].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  if (depotHasCoords(depot)) return "Position GPS enregistrée";
  return "Localisation non renseignée";
}

function DepotCard({
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
  expandDepotCode,
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const emps = depot.emplacements || [];
  const nbEmp = emps.length;
  const nbFromSummary = depot.stockSummary?.nbEmplacements ?? 0;
  const forceExpand = expandDepotCode && depot.code === expandDepotCode;
  const [isExpanded, setIsExpanded] = useState(() => Boolean(forceExpand));
  const [menuAnchor, setMenuAnchor] = useState(null);
  const pctOccupe = depot.stockSummary?.remplissagePct ?? 0;
  const capacityColor = occupationColor(pctOccupe);
  const prevNbEmp = useRef(nbEmp);
  const located = depotHasCoords(depot);
  const locationLabel = formatDepotLocation(depot);
  const depotStatut = parseDepotStatut(depot);
  const canDeletePermanent = canDeleteDepotPermanent(depot);
  const emplacementCount = nbEmp || nbFromSummary;
  const articleCount = depot.stockSummary?.nbArticles ?? 0;
  const valeurStock = depot.stockSummary?.valeurStock ?? depot.valeurStock ?? 0;

  useEffect(() => {
    if (forceExpand) setIsExpanded(true);
  }, [forceExpand]);

  useEffect(() => {
    if (nbEmp > prevNbEmp.current) setIsExpanded(true);
    prevNbEmp.current = nbEmp;
  }, [nbEmp]);

  useEffect(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return;
    const matchEmp = emps.some(
      (e) => e.code?.toLowerCase().includes(q) || e.libelle?.toLowerCase().includes(q)
    );
    if (matchEmp) setIsExpanded(true);
  }, [search, emps]);

  return (
    <motion.article
      id={`depot-card-${depot.id}`}
      className="depot-card-pro group relative p-5"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
    >
      <div className="depot-card-pro__mesh" aria-hidden />

      <div className="relative z-[1] flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(145deg, rgba(55,138,221,0.2), rgba(14,165,233,0.1))",
              boxShadow: "inset 0 0 0 1px rgba(55,138,221,0.28)",
            }}
          >
            <Building2 className="h-5 w-5 text-[#378ADD]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {highlightMatch(depot.libelle, search)}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              {depot.code} · {depot.region || depot.ville || "—"}
            </p>
          </div>
        </div>
        <div className="relative z-20 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <DepotStatutBadge row={depot} />
          {depotStatut === "ACTIF" && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "rgba(29,158,117,0.12)", color: "#1D9E75" }}
            >
              Actif
            </span>
          )}
          <button
            type="button"
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] p-1.5 text-[var(--text-primary)] transition hover:border-[#378ADD]/50 hover:bg-[rgba(55,138,221,0.1)] hover:text-[#378ADD]"
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
            isActif={depotStatut === "ACTIF"}
            onView={() => onOpenDrawer(depot)}
            onEdit={() => onEditDepot(depot)}
            onAddEmplacement={() => onAddEmplacement(depot)}
            onToggleStatut={() => onToggleStatutDepot(depot)}
            onDelete={() => onDeleteDepot(depot)}
          />
        </div>
      </div>

      {depot.capacite != null && (
        <div className="relative z-[1] mt-4" onClick={(e) => e.stopPropagation()}>
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Capacité
            </span>
            <span className="font-bold" style={{ color: capacityColor }}>
              {pctOccupe.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-hover)]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${capacityColor}, ${capacityColor}cc)` }}
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${Math.min(100, pctOccupe)}%` }}
              transition={{ duration: 0.8, delay: 0.15 + index * 0.04, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      )}

      <div className="relative z-[1] mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Empl.", value: emplacementCount },
          { label: "Articles", value: articleCount },
          { label: "Valeur", value: formatMoney(valeurStock) },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hover)]/60 px-2 py-2 text-center"
          >
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {s.label}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-[var(--text-primary)]">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="relative z-[1] mt-3 flex items-start gap-1.5 text-[11px] text-[var(--text-muted)]">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-[#378ADD]" />
        <span className="line-clamp-2">{locationLabel}</span>
        {located ? (
          <span className="ml-auto shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">
            GPS
          </span>
        ) : null}
      </div>

      {located && (
        <div className="relative z-[1] mt-3 overflow-hidden rounded-xl border border-[var(--border-subtle)]">
          <DepotMiniMap depot={depot} height={96} />
        </div>
      )}

      <div className="relative z-[1] mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpenDrawer(depot)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-[#378ADD] transition hover:bg-sky-500/15"
        >
          <Eye size={14} /> Détail
        </button>
        <button
          type="button"
          onClick={() => navigate(`/depots/${depot.id}/plan`)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white"
          style={{
            background: "linear-gradient(135deg, #378ADD, #0EA5E9)",
            boxShadow: "0 8px 16px -8px rgba(55,138,221,0.5)",
          }}
        >
          <LayoutGrid size={14} /> Plan 2D
        </button>
      </div>

      <button
        type="button"
        className="relative z-[1] mt-3 flex w-full items-center justify-between rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <span>
          {emplacementCount} emplacement{emplacementCount !== 1 ? "s" : ""}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      <div className={`depot-emplacements-collapse ${isExpanded ? "is-open" : ""}`}>
        <div className="mt-3 space-y-2">
          {emps.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-muted)]">Aucun emplacement</p>
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
      </div>
    </motion.article>
  );
}

export default function DepotsCardsView({
  depots,
  search,
  canWrite,
  expandDepotCode,
  onOpenDrawer,
  onEditDepot,
  onToggleStatutDepot,
  onDeleteDepot,
  onAddEmplacement,
  onEditEmplacement,
  onToggleStatutEmplacement,
  onDeleteEmplacement,
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {depots.map((depot, index) => (
        <DepotCard
          key={depot.id}
          depot={depot}
          index={index}
          search={search}
          canWrite={canWrite}
          expandDepotCode={expandDepotCode}
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
