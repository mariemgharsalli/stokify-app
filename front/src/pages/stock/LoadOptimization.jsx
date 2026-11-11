import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconTruckLoading,
  IconBox,
  IconCheck,
  IconMapPin,
  IconSparkles,
  IconTarget,
  IconTruck,
  IconArrowLeft,
} from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import AiModuleShell from "../../components/ai/AiModuleShell";
import SearchableSelect from "../../components/ui/SearchableSelect";
import TruckGlyph from "../../components/ui/TruckGlyph";
import CapacityBar from "../depots/components/CapacityBar";
import AiInsightCard from "../../components/ai/AiInsightCard";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import { useCountUp } from "../../hooks/useCountUp";
import VehiculesList from "../vehicules/VehiculesList";
import { LoadStudio } from "./components/LoadMlStudio";

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  gold: "#BA7517",
  success: "#1D9E75",
  danger: "#E24B4A",
};

const EASE_OUT = [0.22, 1, 0.36, 1];

const DEFAULT_METHODOLOGY =
  "HAC + HGB OOF + soute 3D + Pareto GPS";

/** Coque carte — même langage stock / slotting */
function LoadShell({
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
          stroke={1}
          aria-hidden
        />
      ) : null}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

function LoadEmpty({ icon: Icon, title, description }) {
  return (
    <LoadShell accent={THEME.accent} className="px-6 py-14 text-center" watermark={Icon} hover>
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white"
        style={{
          background: `linear-gradient(145deg, ${THEME.accent}, ${THEME.cyan})`,
          boxShadow: `0 14px 28px -12px ${THEME.accent}88`,
        }}
      >
        <Icon size={28} stroke={1.75} />
      </div>
      <p className="mt-4 text-base font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--text-muted)]">{description}</p>
    </LoadShell>
  );
}

function paymentDotColor(statut) {
  if (statut === "REGLE") return "#1D9E75";
  if (statut === "PARTIEL") return "#BA7517";
  return "#E24B4A";
}

function estimateVenteLoad(vente) {
  let poids = 0;
  let volume = 0;
  for (const l of vente.lignes || []) {
    const q = Number(l.quantite) || 0;
    poids += q * (Number(l.article?.poids) || 0);
    volume += q * (Number(l.article?.volume) || 0);
  }
  return { poids, volume };
}

function LoadStepper({ activeStep, completedSteps }) {
  const reduceMotion = useReducedMotion();
  const steps = [
    { id: 1, label: "Ventes" },
    { id: 2, label: "Véhicule" },
    { id: 3, label: "Résultat" },
  ];

  return (
    <LoadShell accent={THEME.accent} className="mb-6 px-4 py-4" watermark={IconTruckLoading}>
      <ol className="flex items-center justify-center gap-2 sm:gap-4">
        {steps.map((step, i) => {
          const done = completedSteps.has(step.id);
          const active = activeStep === step.id;
          const tone = done ? THEME.success : active ? THEME.accent : "var(--text-muted)";
          return (
            <li key={step.id} className="flex items-center gap-2 sm:gap-4">
              <div className="flex flex-col items-center gap-1.5">
                <motion.span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold ${
                    active ? "load-opt-step-glow" : ""
                  }`}
                  style={
                    done || active
                      ? {
                          borderColor: tone,
                          color: done || active ? "#fff" : tone,
                          background: done
                            ? `linear-gradient(145deg, ${THEME.success}, #34d399)`
                            : active
                              ? `linear-gradient(145deg, ${THEME.accent}, ${THEME.cyan})`
                              : "var(--bg-card)",
                          boxShadow: active || done ? `0 10px 22px -10px ${tone}` : undefined,
                        }
                      : {
                          borderColor: "var(--border-default)",
                          color: "var(--text-muted)",
                          background: "var(--bg-card)",
                        }
                  }
                  animate={
                    reduceMotion
                      ? undefined
                      : active
                        ? { scale: [1, 1.06, 1] }
                        : { scale: 1 }
                  }
                  transition={
                    active && !reduceMotion
                      ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                      : { type: "spring", stiffness: 380, damping: 22 }
                  }
                >
                  {done ? <IconCheck size={18} stroke={2.5} /> : step.id}
                </motion.span>
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider ${
                    active || done ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="relative hidden h-0.5 w-8 overflow-hidden rounded-full bg-[var(--border-default)] sm:block sm:w-14">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background:
                        done || activeStep > step.id
                          ? `linear-gradient(90deg, ${THEME.success}, ${THEME.cyan})`
                          : `linear-gradient(90deg, ${THEME.accent}, ${THEME.cyan})`,
                    }}
                    initial={false}
                    animate={{
                      width: done || activeStep > step.id ? "100%" : active ? "55%" : "0%",
                    }}
                    transition={{ duration: reduceMotion ? 0 : 0.45, ease: EASE_OUT }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </LoadShell>
  );
}

function VentesSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-hover)]"
          style={{
            animationDelay: `${i * 80}ms`,
            borderLeft: `3px solid ${THEME.accent}44`,
          }}
        />
      ))}
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-[var(--text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: THEME.accent }} />
        Chargement des ventes…
      </div>
    </div>
  );
}

function PaymentStatusDot({ statut }) {
  if (!statut) return null;
  const color = paymentDotColor(statut);
  const labels = { REGLE: "Réglé", PARTIEL: "Partiel", NON_REGLE: "Non réglé" };
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
      title={labels[statut] || statut}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {labels[statut] || statut}
    </span>
  );
}

function VilleGroupCard({ ville, list, selectedVentes, onToggle, index = 0 }) {
  const reduceMotion = useReducedMotion();
  const selectedInGroup = list.filter((v) => selectedVentes.includes(v.id)).length;
  const pct = list.length ? (selectedInGroup / list.length) * 100 : 0;
  const accent = selectedInGroup > 0 ? THEME.accent : THEME.cyan;

  return (
    <motion.article
      className={`load-opt-zone-card group relative overflow-hidden rounded-2xl border bg-[var(--bg-card)] ${
        selectedInGroup > 0 ? "load-opt-zone-selected" : ""
      }`}
      style={{
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: selectedInGroup > 0 ? `0 14px 32px -16px ${THEME.accent}55` : "var(--shadow-card)",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: EASE_OUT }}
      whileHover={
        reduceMotion ? undefined : { y: -4, boxShadow: `0 18px 36px -16px ${accent}55` }
      }
      layout={!reduceMotion}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}16, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${THEME.cyan}10, transparent 50%)`,
        }}
        aria-hidden
      />
      <IconMapPin
        className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 opacity-[0.06]"
        style={{ color: accent }}
        stroke={1}
        aria-hidden
      />

      <header className="relative z-[1] flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{
              background: `linear-gradient(145deg, ${THEME.accent}, ${THEME.cyan})`,
              boxShadow: `0 8px 16px -10px ${THEME.accent}`,
            }}
          >
            <IconMapPin size={16} />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{ville}</h4>
            <p className="text-[11px] text-[var(--text-muted)]">
              {list.length} vente{list.length > 1 ? "s" : ""} · Zone de livraison
            </p>
          </div>
        </div>
        <span
          className="rounded-md px-2.5 py-0.5 text-[11px] font-semibold"
          style={{
            color: accent,
            background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          }}
        >
          {selectedInGroup}/{list.length} sélectionnée{selectedInGroup > 1 ? "s" : ""}
        </span>
      </header>
      <div className="relative z-[1] px-4 pt-2 pb-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-hover)]">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${THEME.accent}, ${THEME.cyan})`,
              boxShadow: `0 0 8px ${THEME.accent}55`,
            }}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.5, ease: EASE_OUT }}
          />
        </div>
      </div>
      <div className="relative z-[1] space-y-2 p-3 pt-2">
        {list.map((v) => {
          const checked = selectedVentes.includes(v.id);
          return (
            <motion.label
              key={v.id}
              layout={!reduceMotion}
              className={`selection-row-hover flex cursor-pointer flex-col gap-2 rounded-xl border border-[var(--border-default)] px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 ${
                checked ? "is-selected load-opt-row-selected" : ""
              }`}
              style={
                checked
                  ? {
                      borderColor: `color-mix(in srgb, ${THEME.accent} 40%, var(--border-default))`,
                      background: `color-mix(in srgb, ${THEME.accent} 8%, transparent)`,
                    }
                  : undefined
              }
              whileHover={reduceMotion ? undefined : { y: -1 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(v.id)}
                  className="accent-[#378ADD]"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold text-[#378ADD]">{v.reference}</p>
                  <p className="text-xs text-[var(--text-muted)]">{v.client?.nom}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-7 sm:ml-auto sm:pl-0">
                {v.statutPaiement ? <PaymentStatusDot statut={v.statutPaiement} /> : null}
                <span className="text-sm font-semibold tabular-nums text-[var(--text-secondary)]">
                  {Number(v.totalTTC || 0).toLocaleString("fr-FR")} TND
                </span>
              </div>
            </motion.label>
          );
        })}
      </div>
    </motion.article>
  );
}

function VehiclePreviewPanel({ vehicule }) {
  const reduceMotion = useReducedMotion();

  if (!vehicule) {
    return (
      <LoadEmpty
        icon={IconTruckLoading}
        title="Aperçu véhicule"
        description="Sélectionnez un véhicule pour visualiser ses capacités poids et volume."
      />
    );
  }

  return (
    <motion.div
      key={vehicule.id}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      <LoadShell accent={THEME.accent} className="p-4" watermark={IconTruckLoading} hover>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{vehicule.nom}</p>
            {vehicule.immatriculation ? (
              <p className="text-xs text-[var(--text-muted)]">{vehicule.immatriculation}</p>
            ) : null}
          </div>
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
            style={{
              background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`,
            }}
          >
            Aperçu
          </span>
        </div>
        <TruckGlyph active={vehicule.actif !== false} className="mx-auto mb-4" width={160} height={78} />
        <div className="space-y-3">
          <CapacityBar theme label="Capacité poids" value={0} capacity={vehicule.capacitePoids} suffix="kg" height={7} />
          <CapacityBar theme label="Capacité volume" value={0} capacity={vehicule.capaciteVolume} suffix="m³" height={7} />
        </div>
        <p className="mt-3 text-[11px] text-[var(--text-muted)]">
          Les barres se rempliront après le calcul du plan de chargement.
        </p>
      </LoadShell>
    </motion.div>
  );
}

function SelectionSummary({ count, poids, volume }) {
  const animatedCount = useCountUp(count, 700);
  const animatedPoids = useCountUp(poids, 700);
  const animatedVolume = useCountUp(volume, 700, 1);
  const reduceMotion = useReducedMotion();

  return (
    <LoadShell accent={THEME.success} className="p-4" watermark={IconBox} hover>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Récapitulatif sélection
      </p>
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Ventes</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: THEME.accent }}>
            {Math.round(animatedCount)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Poids est.</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: THEME.success }}>
            {Math.round(animatedPoids).toLocaleString("fr-FR")}
            <span className="ml-0.5 text-xs font-medium text-[var(--text-muted)]">kg</span>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Volume est.</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: THEME.cyan }}>
            {animatedVolume.toFixed(1)}
            <span className="ml-0.5 text-xs font-medium text-[var(--text-muted)]">m³</span>
          </dd>
        </div>
      </dl>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full"
        style={{ background: "color-mix(in srgb, var(--border-default) 70%, transparent)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${THEME.accent}, ${THEME.cyan})` }}
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: count ? "100%" : "8%" }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        />
      </div>
    </LoadShell>
  );
}

function MethodologyBanner({ methodology, modele, mode }) {
  const isMl = Boolean(modele) && !String(modele).includes("local") && mode !== "local";
  return (
    <LoadShell accent={isMl ? THEME.accent : THEME.gold} className="px-4 py-3.5" watermark={IconTarget} hover>
      <div className="flex flex-wrap items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{
            background: `linear-gradient(145deg, ${isMl ? THEME.accent : THEME.gold}, ${isMl ? THEME.cyan : "#EF9F27"})`,
            boxShadow: `0 8px 18px -10px ${isMl ? THEME.accent : THEME.gold}`,
          }}
        >
          <IconTarget size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              {methodology || DEFAULT_METHODOLOGY}
            </p>
            {modele ? (
              <span
                className="rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide"
                style={{
                  color: isMl ? THEME.accent : THEME.gold,
                  background: `color-mix(in srgb, ${isMl ? THEME.accent : THEME.gold} 16%, transparent)`,
                }}
              >
                {mode === "local" ? "local" : modele}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {isMl
              ? "Soute 3D (CoG) + HAC silhouette + HGB hors-fold. Cinq politiques, Pareto, lookahead, tournée GPS 2-opt/3-opt + LIFO. Distinct du slotting GMM."
              : "Le moteur FastAPI est hors-ligne : couches par densité + LIFO. Relancez ai-service pour le HAC silhouette et le classement HGB."}
          </p>
        </div>
      </div>
    </LoadShell>
  );
}

function buildInsightText(result) {
  if (!result) return "";
  const fill = Math.round(((Number(result.pctPoids) || 0) + (Number(result.pctVolume) || 0)) / 2);
  const left = (result.articlesNonCharges || []).length;
  const policy = result.policyLabel ? ` Politique ${result.policyLabel}.` : "";
  if (result.chargementComplet) {
    return `Plan ML complet pour ${result.vehicule || "le véhicule"} — remplissage moyen ${fill}% (poids ${result.pctPoids}%, volume ${result.pctVolume}%).${policy} Prêt pour départ.`;
  }
  return `Chargement partiel : ${left} ligne(s) reportée(s). Remplissage ${fill}%.${policy} Prévoir une 2e tournée ou un véhicule plus capacitaire.`;
}

export default function LoadOptimization({ embedded = false }) {
  const societeScope = useSocieteQueryScope();
  const queryClient = useQueryClient();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const [selectedVentes, setSelectedVentes] = useState([]);
  const [fleetView, setFleetView] = useState(false);
  const [vehiculeId, setVehiculeId] = useState("");
  const [result, setResult] = useState(null);
  const [secondTour, setSecondTour] = useState(false);
  const [remainingArticles, setRemainingArticles] = useState(null);

  const { data: ventesData, isLoading: loadingVentes } = useQuery({
    queryKey: ["ventes-livraison", societeScope],
    queryFn: () => api.get("stock/ventes-a-livrer").then((r) => r.data),
  });

  const { data: vehiculesData } = useQuery({
    queryKey: ["vehicules", societeScope],
    queryFn: () => api.get("vehicules", { params: { limit: 100 } }).then((r) => r.data),
  });

  const ventes = ventesData?.items || [];

  const groupedVentes = useMemo(() => {
    const map = new Map();
    for (const v of ventes) {
      const key = v.client?.ville || v.client?.nom || "Sans destination";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(v);
    }
    return [...map.entries()];
  }, [ventes]);

  const vehiculeOptions = useMemo(
    () =>
      (vehiculesData?.items || vehiculesData || []).map((v) => ({
        value: String(v.id),
        label: `${v.nom} — ${v.capacitePoids} kg / ${v.capaciteVolume} m³`,
      })),
    [vehiculesData]
  );

  const vehiculesList = vehiculesData?.items || vehiculesData || [];

  const selectedVehicle = useMemo(
    () => vehiculesList.find((v) => String(v.id) === vehiculeId) || null,
    [vehiculesList, vehiculeId]
  );

  const selectionTotals = useMemo(() => {
    const selected = ventes.filter((v) => selectedVentes.includes(v.id));
    return selected.reduce(
      (acc, v) => {
        const { poids, volume } = estimateVenteLoad(v);
        acc.count += 1;
        acc.poids += poids;
        acc.volume += volume;
        return acc;
      },
      { count: 0, poids: 0, volume: 0 }
    );
  }, [ventes, selectedVentes]);

  const completedSteps = useMemo(() => {
    const s = new Set();
    if (selectedVentes.length > 0) s.add(1);
    if (vehiculeId) s.add(2);
    if (result) s.add(3);
    return s;
  }, [selectedVentes.length, vehiculeId, result]);

  const activeStep = result ? 3 : selectedVentes.length > 0 && vehiculeId ? 2 : selectedVentes.length > 0 ? 2 : 1;

  const optimizeMut = useMutation({
    mutationFn: (payload) => api.post("stock/load-optimization", payload).then((r) => r.data),
    onSuccess: (data) => {
      setResult(data);
      setSelectedVentes([]);
      queryClient.invalidateQueries({ queryKey: ["ventes-livraison", societeScope] });
      if (!data.chargementComplet) {
        setRemainingArticles(data.articlesNonCharges);
      }
      toast.success(data.chargementComplet ? "Chargement complet" : "Optimisation terminée (chargement partiel)");
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  function toggleVente(id) {
    setSelectedVentes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function runOptimization(venteIds = selectedVentes) {
    if (!venteIds.length) {
      toast.warning("Sélectionnez au moins une vente");
      return;
    }
    if (!vehiculeId) {
      toast.warning("Sélectionnez un véhicule");
      return;
    }
    optimizeMut.mutate({ ventes: venteIds, vehiculeId: Number(vehiculeId) });
  }

  function planSecondTour() {
    setSecondTour(true);
    setResult(null);
    toast.warning("Sélectionnez un second véhicule pour la tournée complémentaire");
  }

  const methodologyLabel = result?.methodologyLabel || result?.methodology || DEFAULT_METHODOLOGY;

  return (
    <AiModuleShell
      embedded={embedded}
      title="Optimisation chargement"
      subtitle="Studio quai : soute 3D, dendrogramme HAC, Pareto, tournée GPS — un seul plan, cabine → porte."
    >
      {fleetView ? (
        <>
          <div className="mb-4">
            <motion.button
              type="button"
              onClick={() => setFleetView(false)}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]"
              style={{ borderColor: "var(--border-default)" }}
              whileHover={reduceMotion ? undefined : { x: -2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              <IconArrowLeft size={17} stroke={1.75} />
              Retour à l&apos;optimisation
            </motion.button>
          </div>
          <VehiculesList embedded />
        </>
      ) : (
        <>
      <LoadStepper activeStep={activeStep} completedSteps={completedSteps} />

      <div className="mb-6 flex justify-end">
        <motion.button
          type="button"
          onClick={() => setFleetView(true)}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style={{
            background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`,
            boxShadow: `0 10px 22px -12px ${THEME.accent}`,
          }}
          whileHover={reduceMotion ? undefined : { scale: 1.02 }}
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        >
          <IconTruck size={17} stroke={1.75} />
          Véhicule
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div
            key="planner"
            className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <section className="space-y-4 lg:col-span-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  Ventes à livrer
                  <IconSparkles size={14} style={{ color: THEME.cyan }} className="load-opt-sparkle" />
                </h3>
                {!loadingVentes && groupedVentes.length > 0 && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {ventes.length} vente{ventes.length > 1 ? "s" : ""} · {groupedVentes.length} zone
                    {groupedVentes.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {loadingVentes ? (
                <VentesSkeleton />
              ) : groupedVentes.length === 0 ? (
                <LoadEmpty
                  icon={IconBox}
                  title="Aucune vente à livrer"
                  description="Aucune vente confirmée en attente de livraison pour le moment."
                />
              ) : (
                <div className="space-y-4">
                  {groupedVentes.map(([ville, list], i) => (
                    <VilleGroupCard
                      key={ville}
                      ville={ville}
                      list={list}
                      selectedVentes={selectedVentes}
                      onToggle={toggleVente}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-4 lg:col-span-2">
              <MethodologyBanner methodology={DEFAULT_METHODOLOGY} modele="hac_hgb_rank_tsp" />

              <LoadShell accent={THEME.cyan} className="p-5" watermark={IconTruckLoading}>
                <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Véhicule</label>
                <SearchableSelect
                  value={vehiculeId}
                  onChange={setVehiculeId}
                  options={vehiculeOptions}
                  placeholder="Choisir un véhicule…"
                  className="w-full"
                />
              </LoadShell>

              <VehiclePreviewPanel vehicule={selectedVehicle} />
              <SelectionSummary
                count={selectionTotals.count}
                poids={selectionTotals.poids}
                volume={selectionTotals.volume}
              />

              <motion.button
                type="button"
                disabled={optimizeMut.isPending}
                onClick={() => runOptimization()}
                className="relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-70"
                style={{
                  background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`,
                  boxShadow: `0 14px 28px -12px ${THEME.accent}`,
                }}
                whileHover={reduceMotion || optimizeMut.isPending ? undefined : { scale: 1.015 }}
                whileTap={reduceMotion || optimizeMut.isPending ? undefined : { scale: 0.985 }}
              >
                {optimizeMut.isPending && (
                  <span
                    className="absolute inset-0 -z-0"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, color-mix(in srgb, #fff 25%, transparent), transparent)",
                      backgroundSize: "200% 100%",
                      animation: reduceMotion ? undefined : "shimmer-slide 1.1s linear infinite",
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {optimizeMut.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Calcul ML du plan…
                    </>
                  ) : (
                    <>
                      <IconTruckLoading size={18} />
                      Optimiser le chargement ML
                    </>
                  )}
                </span>
              </motion.button>
            </aside>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            className="space-y-4"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            <MethodologyBanner
              methodology={methodologyLabel}
              modele={result.modele}
              mode={result.mode}
            />
            <LoadStudio result={result} />

            <AiInsightCard
              title="Analyse du plan"
              icon={<IconSparkles size={16} />}
              text={buildInsightText(result)}
            />

            {(result.articlesNonCharges || []).length > 0 && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <LoadShell accent={THEME.danger} className="overflow-hidden">
                <div className="border-b border-[var(--border-default)] px-4 py-3">
                  <h3 className="text-sm font-semibold" style={{ color: THEME.danger }}>
                    Articles non chargés — capacité insuffisante
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--text-muted)]">
                      <th className="px-4 py-2">Article</th>
                      <th className="px-4 py-2">Qté non chargée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.articlesNonCharges.map((a) => (
                      <tr key={a.articleId} className="border-t border-[var(--border-default)]/50">
                        <td className="px-4 py-2">
                          {a.code} — {a.libelle}
                        </td>
                        <td className="px-4 py-2 font-mono" style={{ color: THEME.danger }}>
                          {a.quantiteNonChargee}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-4 py-3 text-xs text-[var(--text-muted)]">
                  Prévoir un second véhicule ou une livraison différée pour ces articles
                </p>
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onClick={planSecondTour}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`,
                      boxShadow: `0 10px 22px -12px ${THEME.accent}`,
                    }}
                  >
                    Planifier 2e tournée
                  </button>
                </div>
                </LoadShell>
              </motion.div>
            )}

            <button
              type="button"
              onClick={() => {
                setResult(null);
                setSecondTour(false);
              }}
              className="text-sm text-[var(--text-link)]"
            >
              ← Nouvelle optimisation
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {secondTour && remainingArticles?.length > 0 && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(11, 31, 58, 0.45)", backdropFilter: "blur(5px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5"
              style={{ borderLeft: `3px solid ${THEME.accent}`, boxShadow: "var(--shadow-card)" }}
              initial={reduceMotion ? false : { scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduceMotion ? undefined : { scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
            >
              <h3 className="mb-2 font-semibold">2e tournée</h3>
              <p className="mb-4 text-sm text-[var(--text-muted)]">
                Sélectionnez un autre véhicule puis relancez l&apos;optimisation avec les articles restants.
              </p>
              <SearchableSelect
                value={vehiculeId}
                onChange={setVehiculeId}
                options={vehiculeOptions}
                placeholder="Véhicule 2…"
                className="mb-4 w-full"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSecondTour(false)}
                  className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSecondTour(false);
                    setResult(null);
                  }}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`,
                    boxShadow: `0 10px 22px -12px ${THEME.accent}`,
                  }}
                >
                  Continuer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        </>
      )}
    </AiModuleShell>
  );
}
