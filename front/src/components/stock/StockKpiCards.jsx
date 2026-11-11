import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { IconBuildingBank } from "@tabler/icons-react";
import {
  Package,
  LineChart,
  AlertTriangle,
  AlertCircle,
  Clock3,
  CircleCheck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] },
  }),
};

function useAnimatedNumber(target, duration = 1100) {
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

/** Tuile KPI style Ventes — barre latérale, hint, hairline. */
function KpiTile({
  title,
  value,
  hint,
  Icon,
  accentVar,
  index = 0,
  pulse,
  isCurrency,
  onClick,
}) {
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedNumber(value, 1100);
  const display = isCurrency
    ? `${Number(animated).toLocaleString("fr-FR", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })} TND`
    : Math.round(animated).toLocaleString("fr-FR");

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`group relative overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-4 ${
        pulse ? "stock-kpi-pulse" : "border-[var(--border-default)]"
      } ${onClick ? "cursor-pointer" : ""}`}
      style={
        pulse
          ? {
              "--kpi-accent": `var(${accentVar})`,
              borderColor: `color-mix(in srgb, var(${accentVar}) 35%, var(--border-default))`,
            }
          : undefined
      }
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <motion.span
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: `var(${accentVar})` }}
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.1 + index * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, var(${accentVar}) 8%, transparent) 0%, transparent 55%)`,
        }}
        aria-hidden
      />
      <div className="relative pl-2.5">
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, var(${accentVar}) 14%, transparent), transparent)`,
              color: `var(${accentVar})`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(${accentVar}) 22%, transparent)`,
            }}
          >
            <Icon size={20} strokeWidth={1.75} />
          </div>
          {hint ? (
            <span className="rounded-md bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              {hint}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {title}
        </p>
        <p
          className="mt-0.5 font-display text-xl font-bold tabular-nums tracking-tight sm:text-2xl"
          style={{ color: `var(${accentVar})` }}
        >
          {display}
        </p>
        <motion.div
          className="mt-2.5 h-px origin-left"
          style={{
            background: `linear-gradient(90deg, color-mix(in srgb, var(${accentVar}) 40%, transparent), transparent)`,
          }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.16 + index * 0.04, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />
      </div>
    </motion.div>
  );
}

function ConsolidatedValueCard({ index }) {
  const societeScope = useSocieteQueryScope();
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);

  const { data } = useQuery({
    queryKey: ["stock-valeur-consolidee", societeScope],
    queryFn: () => api.get("stock/valeur-consolidee").then((r) => r.data),
  });

  const total = data?.total ?? 0;
  const byDepot = data?.byDepot || [];
  const chartData = useMemo(
    () =>
      byDepot.slice(0, 8).map((d) => ({
        name: d.libelle?.length > 14 ? `${d.libelle.slice(0, 14)}…` : d.libelle,
        valeur: d.valeur,
      })),
    [byDepot]
  );

  useEffect(() => {
    function onDoc(e) {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={popRef}>
      <KpiTile
        title="Valeur consolidée"
        value={total}
        isCurrency
        hint="tous dépôts"
        Icon={IconBuildingBank}
        accentVar="--accent-info"
        index={index}
        onClick={() => setOpen((o) => !o)}
      />
      {open && byDepot.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-0 top-full z-20 mt-2 w-full min-w-[280px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-xl"
        >
          <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Valeur par dépôt</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                />
                <Tooltip
                  formatter={(v) => [
                    `${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND`,
                    "Valeur",
                  ]}
                  contentStyle={{
                    background: "var(--bg-tooltip)",
                    border: "1px solid var(--border-default)",
                  }}
                />
                <Bar
                  dataKey="valeur"
                  fill="var(--accent-info, #378ADD)"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}

export default function StockKpiCards({ stats }) {
  const s = stats || {};
  const enRupture = Number(s.enRupture) || 0;
  const stockCritique = Number(s.stockCritique) || 0;
  const lotsExpirant = Number(s.lotsExpirant) || 0;

  return (
    <>
      <style>{`
        @keyframes stockKpiPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--kpi-accent) 18%, transparent); }
          50% { box-shadow: 0 0 22px 2px color-mix(in srgb, var(--kpi-accent) 28%, transparent); }
        }
        .stock-kpi-pulse { animation: stockKpiPulse 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .stock-kpi-pulse { animation: none !important; }
        }
      `}</style>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          index={0}
          title="Articles en stock"
          value={s.totalArticles ?? 0}
          hint={`${s.totalDepots ?? 0} dép.`}
          Icon={Package}
          accentVar="--accent-primary"
        />
        <KpiTile
          index={1}
          title="Valeur totale (CMP)"
          value={s.valeurTotale ?? 0}
          isCurrency
          hint="CMP"
          Icon={LineChart}
          accentVar="--accent-info"
        />
        <ConsolidatedValueCard index={2} />
        <KpiTile
          index={3}
          title="Ruptures"
          value={enRupture}
          hint="qté = 0"
          Icon={enRupture > 0 ? AlertTriangle : CircleCheck}
          accentVar={enRupture > 0 ? "--accent-danger" : "--accent-success"}
          pulse={enRupture > 0}
        />
        <KpiTile
          index={4}
          title="Stock critique"
          value={stockCritique}
          hint="seuil"
          Icon={stockCritique > 0 ? AlertCircle : CircleCheck}
          accentVar={stockCritique > 0 ? "--accent-warning" : "--accent-success"}
          pulse={stockCritique > 0}
        />
        <KpiTile
          index={5}
          title="Lots expirant"
          value={lotsExpirant}
          hint="< 30 j"
          Icon={lotsExpirant > 0 ? Clock3 : CircleCheck}
          accentVar={lotsExpirant > 0 ? "--accent-danger" : "--accent-success"}
          pulse={lotsExpirant > 0}
        />
      </div>
    </>
  );
}
