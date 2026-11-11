import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconBox,
  IconEdit,
  IconPower,
  IconSparkles,
  IconTrash,
  IconTruck,
  IconWeight,
} from "@tabler/icons-react";
import { Plus, Search, Sparkles, Truck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import PageShell from "../../components/ui/PageShell";
import DropdownMenu from "../../components/ui/DropdownMenu";
import TruckGlyph from "../../components/ui/TruckGlyph";
import CapacityBar from "../depots/components/CapacityBar";
import VehiculeFormModal from "./components/VehiculeFormModal";
import { useCountUp } from "../../hooks/useCountUp";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  success: "#1D9E75",
  warning: "#EF9F27",
  danger: "#E24B4A",
  muted: "#94A3B8",
};

const EASE = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: EASE },
  }),
};

const INPUT =
  "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] transition focus:outline-none focus:border-[color-mix(in_srgb,#378ADD_55%,var(--border-default))] focus:shadow-[0_0_0_3px_rgba(55,138,221,0.18)]";

function VehiculeShell({
  children,
  accent = THEME.accent,
  className = "",
  watermark: WatermarkIcon = null,
  hover = false,
  style,
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${className}`}
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: "var(--shadow-card)",
        ...style,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}18, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${THEME.cyan}10, transparent 50%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
        aria-hidden
      />
      {WatermarkIcon ? (
        <WatermarkIcon
          className={`pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 opacity-[0.06] ${
            hover ? "transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.1]" : ""
          }`}
          style={{ color: accent }}
          strokeWidth={1}
          aria-hidden
        />
      ) : null}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

/** KPI style Ventes — barre gauche animée, icône soft, watermark, ligne accent */
function FleetKpiCard({
  label,
  value,
  suffix = "",
  decimals = 0,
  accent = THEME.accent,
  index = 0,
  icon: Icon,
  hint,
  children,
}) {
  const animated = useCountUp(value, 1100, decimals);
  const reduceMotion = useReducedMotion();
  const display =
    decimals > 0
      ? animated.toFixed(decimals)
      : Math.round(animated).toLocaleString("fr-FR");

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -6,
              boxShadow: `0 18px 36px -16px color-mix(in srgb, ${accent} 40%, transparent)`,
            }
      }
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4"
    >
      <motion.span
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: accent }}
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.1 + index * 0.05, duration: 0.45, ease: EASE }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, color-mix(in srgb, ${accent} 18%, transparent), transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, color-mix(in srgb, ${THEME.cyan} 10%, transparent), transparent 50%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${accent} 55%, transparent), transparent)`,
        }}
        aria-hidden
      />
      {Icon ? (
        <Icon
          className="pointer-events-none absolute -bottom-2 -right-2 opacity-[0.08] transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.14]"
          style={{ color: accent }}
          size={80}
          stroke={1}
          aria-hidden
        />
      ) : null}

      <div className="relative pl-2.5">
        <div className="flex items-start justify-between gap-3">
          {Icon ? (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 22%, transparent), color-mix(in srgb, ${accent} 8%, transparent))`,
                color: accent,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 35%, transparent), 0 0 16px -6px ${accent}`,
              }}
            >
              <Icon size={20} stroke={1.75} />
            </div>
          ) : (
            <span />
          )}
          {hint ? (
            <span className="rounded-md bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              {hint}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
        <p
          className="mt-0.5 font-display text-2xl font-bold tabular-nums tracking-tight"
          style={{ color: accent }}
        >
          {display}
          {suffix ? (
            <span className="ml-1 text-sm font-medium text-[var(--text-muted)]">{suffix}</span>
          ) : null}
        </p>
        {children}
        <motion.div
          className="mt-2.5 h-px origin-left"
          style={{
            background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 40%, transparent), transparent)`,
          }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.18 + index * 0.06, duration: 0.5, ease: EASE }}
          aria-hidden
        />
      </div>
    </motion.div>
  );
}

function ActifInactifDonut({ actifs, inactifs }) {
  const total = actifs + inactifs || 1;
  const pctActif = (actifs / total) * 100;
  const r = 14;
  const c = 2 * Math.PI * r;
  const dashActif = (pctActif / 100) * c;

  return (
    <div className="mt-2 flex items-center gap-2">
      <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--bg-hover)" strokeWidth="5" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={THEME.success}
          strokeWidth="5"
          strokeDasharray={`${dashActif} ${c - dashActif}`}
          transform="rotate(-90 18 18)"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${THEME.success}66)` }}
        />
        {inactifs > 0 && (
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke={THEME.muted}
            strokeWidth="5"
            strokeDasharray={`${c - dashActif} ${dashActif}`}
            strokeDashoffset={-dashActif}
            transform="rotate(-90 18 18)"
            opacity="0.45"
          />
        )}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: THEME.success }} />
          {actifs} actif{actifs > 1 ? "s" : ""}
        </span>
        {inactifs > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]" />
            {inactifs} inactif{inactifs > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function FleetEmpty({ canWrite, onCreate }) {
  return (
    <VehiculeShell accent={THEME.accent} className="px-6 py-14 text-center" watermark={Truck} hover>
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white"
        style={{
          background: `linear-gradient(145deg, ${THEME.accent}, ${THEME.cyan})`,
          boxShadow: `0 14px 28px -12px ${THEME.accent}88`,
        }}
      >
        <Truck className="h-7 w-7" strokeWidth={2} />
      </div>
      <p className="mt-4 text-base font-semibold text-[var(--text-primary)]">Flotte vide</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--text-muted)]">
        Ajoutez votre premier véhicule pour commencer à optimiser les tournées.
      </p>
      {canWrite ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style={{
            background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`,
            boxShadow: `0 12px 24px -12px ${THEME.accent}`,
          }}
        >
          <Plus className="h-4 w-4" />
          Créer un véhicule
        </button>
      ) : null}
    </VehiculeShell>
  );
}

function FleetSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-52 animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-hover)]"
          style={{ animationDelay: `${i * 80}ms`, borderLeft: `3px solid ${THEME.accent}44` }}
        />
      ))}
    </div>
  );
}

function VehiculeCard({ vehicule, index, canWrite, onEdit, onActivate, onDeactivate, onDelete, searchQuery }) {
  const reduceMotion = useReducedMotion();
  const matches =
    !searchQuery.trim() ||
    vehicule.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicule.immatriculation?.toLowerCase().includes(searchQuery.toLowerCase());

  const accent = vehicule.actif ? THEME.accent : THEME.muted;

  const menuItems = canWrite
    ? [
        { label: "Modifier", icon: IconEdit, action: () => onEdit(vehicule) },
        vehicule.actif
          ? { label: "Désactiver", icon: IconPower, action: () => onDeactivate(vehicule) }
          : { label: "Activer", icon: IconPower, action: () => onActivate(vehicule) },
        {
          label: "Supprimer",
          icon: IconTrash,
          color: THEME.danger,
          action: () => onDelete(vehicule),
        },
      ]
    : [];

  return (
    <motion.article
      className={`vehicule-card-filter ${matches ? "" : "is-filtered-out"}`}
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index * 0.045, 0.4), duration: 0.4, ease: EASE }}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -6, boxShadow: `0 18px 36px -16px ${accent}66` }
      }
    >
      <VehiculeShell accent={accent} className="p-4" watermark={Truck} hover>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-[var(--text-primary)]">{vehicule.nom}</h3>
            {vehicule.immatriculation ? (
              <p className="font-mono text-xs font-medium" style={{ color: THEME.accent }}>
                {vehicule.immatriculation}
              </p>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">Sans immatriculation</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className="relative rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{
                background: vehicule.actif
                  ? "rgba(29,158,117,0.18)"
                  : "rgba(148,163,184,0.16)",
                color: vehicule.actif ? "#6ee7b7" : THEME.muted,
              }}
            >
              {vehicule.actif ? (
                <span
                  className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                  style={{
                    background: THEME.success,
                    boxShadow: `0 0 6px ${THEME.success}`,
                  }}
                  aria-hidden
                />
              ) : null}
              {vehicule.actif ? "Actif" : "Inactif"}
            </span>
            {menuItems.length > 0 ? <DropdownMenu items={menuItems} align="right" /> : null}
          </div>
        </div>

        <div
          className="relative mx-auto my-3 flex h-[80px] w-full max-w-[200px] items-end justify-center overflow-hidden rounded-2xl"
          style={{
            background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 14%, transparent), transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 22%, transparent)`,
          }}
        >
          <TruckGlyph active={vehicule.actif} width={160} height={78} />
        </div>

        <div className="mb-3 space-y-2">
          <CapacityBar theme label="Poids max" value={0} capacity={vehicule.capacitePoids} suffix="kg" height={6} />
          <CapacityBar theme label="Volume max" value={0} capacity={vehicule.capaciteVolume} suffix="m³" height={6} />
        </div>

        <div className="border-t border-[var(--border-default)] pt-2.5">
          {vehicule.tauxUtilisation != null || vehicule.chargementsSemaine != null ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold"
              style={{
                color: THEME.cyan,
                background: `color-mix(in srgb, ${THEME.cyan} 14%, transparent)`,
              }}
            >
              <Sparkles className="h-3 w-3" />
              {vehicule.chargementsSemaine != null
                ? `${vehicule.chargementsSemaine} charg./sem.`
                : `${Math.round(vehicule.tauxUtilisation)}% utilisation`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              Jamais utilisé
            </span>
          )}
        </div>
      </VehiculeShell>
    </motion.article>
  );
}

export default function VehiculesList({ embedded = false }) {
  const user = useAuthStore((s) => s.user);
  const canWrite = hasPermission(user?.role, "stock:write");
  const societeScope = useSocieteQueryScope();
  const qc = useQueryClient();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | actifs | inactifs
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vehicules", societeScope],
    queryFn: () => api.get("vehicules", { params: { limit: 100, actifOnly: false } }).then((r) => r.data),
  });

  const items = data?.items || data || [];

  const fleetStats = useMemo(() => {
    const actifs = items.filter((v) => v.actif).length;
    const poidsCumule = items.reduce((s, v) => s + (Number(v.capacitePoids) || 0), 0);
    const volumeCumule = items.reduce((s, v) => s + (Number(v.capaciteVolume) || 0), 0);
    return { total: items.length, actifs, inactifs: items.length - actifs, poidsCumule, volumeCumule };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((v) => {
      if (statusFilter === "actifs" && !v.actif) return false;
      if (statusFilter === "inactifs" && v.actif) return false;
      return true;
    });
  }, [items, statusFilter]);

  const STATUS_TABS = [
    { id: "all", label: "Tous", count: fleetStats.total, accent: THEME.accent },
    { id: "actifs", label: "Actifs", count: fleetStats.actifs, accent: THEME.success },
    { id: "inactifs", label: "Inactifs", count: fleetStats.inactifs, accent: THEME.muted },
  ];

  const deactivateMut = useMutation({
    mutationFn: (id) => api.patch(`vehicules/${id}`, { actif: false }),
    onSuccess: () => {
      toast.success("Véhicule désactivé");
      qc.invalidateQueries({ queryKey: ["vehicules"] });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const activateMut = useMutation({
    mutationFn: (id) => api.patch(`vehicules/${id}`, { actif: true }),
    onSuccess: () => {
      toast.success("Véhicule activé");
      qc.invalidateQueries({ queryKey: ["vehicules"] });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`vehicules/${id}`),
    onSuccess: () => {
      toast.success("Véhicule supprimé");
      qc.invalidateQueries({ queryKey: ["vehicules"] });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(v) {
    setEditing(v);
    setShowForm(true);
  }

  function handleDeactivate(v) {
    if (window.confirm(`Désactiver le véhicule « ${v.nom} » ?`)) {
      deactivateMut.mutate(v.id);
    }
  }

  function handleActivate(v) {
    if (window.confirm(`Activer le véhicule « ${v.nom} » ?`)) {
      activateMut.mutate(v.id);
    }
  }

  function handleDelete(v) {
    if (window.confirm(`Supprimer le véhicule « ${v.nom} » ?`)) {
      deleteMut.mutate(v.id);
    }
  }

  const createAction = canWrite ? (
    <button
      type="button"
      onClick={openCreate}
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
      style={{
        background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`,
        boxShadow: `0 12px 24px -12px ${THEME.accent}`,
      }}
    >
      <Plus className="h-4 w-4" />
      Nouveau véhicule
    </button>
  ) : null;

  const fleetBody = (
    <>
      {!isLoading && items.length > 0 ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <FleetKpiCard label="Véhicules" value={fleetStats.total} accent={THEME.accent} index={0} icon={IconTruck}>
              <ActifInactifDonut actifs={fleetStats.actifs} inactifs={fleetStats.inactifs} />
            </FleetKpiCard>
            <FleetKpiCard label="Actifs" value={fleetStats.actifs} accent={THEME.success} index={1} icon={IconSparkles} />
            <FleetKpiCard
              label="Capacité poids"
              value={fleetStats.poidsCumule}
              suffix="kg"
              accent={THEME.cyan}
              index={2}
              icon={IconWeight}
            />
            <FleetKpiCard
              label="Capacité volume"
              value={fleetStats.volumeCumule}
              suffix="m³"
              decimals={1}
              accent={THEME.accent}
              index={3}
              icon={IconBox}
            />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition"
                  style={{
                    borderColor: active
                      ? `color-mix(in srgb, ${tab.accent} 45%, var(--border-default))`
                      : "var(--border-default)",
                    background: active
                      ? `color-mix(in srgb, ${tab.accent} 14%, var(--bg-card))`
                      : "var(--bg-card)",
                    color: active ? tab.accent : "var(--text-muted)",
                    boxShadow: active ? `0 0 0 1px color-mix(in srgb, ${tab.accent} 20%, transparent)` : undefined,
                  }}
                >
                  {tab.label}
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] tabular-nums"
                    style={{
                      background: active
                        ? `color-mix(in srgb, ${tab.accent} 18%, transparent)`
                        : "var(--bg-hover)",
                      color: active ? tab.accent : "var(--text-muted)",
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom ou immatriculation…"
              className={`${INPUT} pl-10`}
            />
          </div>
        </>
      ) : null}

      {isLoading ? (
        <FleetSkeleton />
      ) : items.length === 0 ? (
        <FleetEmpty canWrite={canWrite} onCreate={openCreate} />
      ) : filteredItems.length === 0 ? (
        <VehiculeShell accent={THEME.muted} className="px-6 py-10 text-center" watermark={Truck}>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Aucun véhicule dans ce filtre</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {statusFilter === "inactifs"
              ? "Aucun véhicule inactif pour le moment."
              : "Essayez un autre filtre ou la recherche."}
          </p>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className="mt-4 text-xs font-semibold text-sky-400 hover:underline"
          >
            Voir tous les véhicules
          </button>
        </VehiculeShell>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((v, i) => (
            <VehiculeCard
              key={v.id}
              vehicule={v}
              index={i}
              canWrite={canWrite}
              onEdit={openEdit}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
              onDelete={handleDelete}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}

      <VehiculeFormModal open={showForm} onClose={closeForm} editing={editing} />
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              className="text-lg font-bold text-[var(--text-primary)]"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Flotte véhicules
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Capacités poids et volume pour l&apos;optimisation des tournées
            </p>
          </div>
          {createAction}
        </div>
        {fleetBody}
      </div>
    );
  }

  return (
    <PageShell
      title="Flotte véhicules"
      subtitle="Capacités poids et volume pour l'optimisation des tournées"
      actions={createAction}
    >
      {fleetBody}
    </PageShell>
  );
}
