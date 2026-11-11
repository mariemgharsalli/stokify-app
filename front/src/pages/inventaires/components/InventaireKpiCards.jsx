import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, ClipboardList, Flame, Target } from "lucide-react";
import { useAnimatedNumber } from "../../superadmin/components/SocieteKpiCard";
import { formatTnd, INV_THEME } from "../inventaireUtils";

function CreativeKpi({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
  delay = 0,
  formatValue,
  pulse,
  barPct,
}) {
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedNumber(value, 1100);
  const display = formatValue
    ? formatValue(animated)
    : Math.round(animated).toLocaleString("fr-FR");
  const resolvedBar = Math.min(100, Math.max(6, barPct ?? 100));

  return (
    <motion.div
      className="group relative overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: `${accent}40`,
        background: `
          linear-gradient(145deg, ${accent}18 0%, transparent 48%),
          var(--bg-card)
        `,
        boxShadow: "var(--shadow-card)",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 18, rotateX: 10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.48, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -6, scale: 1.018 }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `linear-gradient(110deg, transparent 30%, ${accent}18 48%, transparent 62%)`,
          backgroundSize: "200% 100%",
          animation: reduceMotion ? undefined : "invKpiShine 2.4s ease-in-out infinite",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-35 blur-2xl transition-opacity group-hover:opacity-80"
        style={{ background: accent }}
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "var(--text-muted)" }}
          >
            {title}
          </p>
          <p
            className="mt-1.5 font-display text-3xl font-bold tabular-nums tracking-tight"
            style={{ color: accent }}
          >
            {display}
          </p>
          {subtitle ? (
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
          style={{
            background: `${accent}22`,
            border: `1px solid ${accent}44`,
            color: accent,
            boxShadow: `0 8px 20px -8px ${accent}66`,
            animation: pulse && !reduceMotion ? "invKpiPulse 2s ease-out infinite" : undefined,
          }}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      </div>

      <div
        className="relative mt-4 h-1.5 overflow-hidden rounded-full"
        style={{ background: "var(--border-subtle, var(--border-default))" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${accent}88, ${accent})` }}
          initial={{ width: 0 }}
          animate={{ width: `${resolvedBar}%` }}
          transition={{ duration: 1, delay: delay + 0.12, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <style>{`
        @keyframes invKpiShine {
          0% { background-position: 120% 0; }
          100% { background-position: -40% 0; }
        }
        @keyframes invKpiPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${accent}55; }
          50% { box-shadow: 0 0 0 8px ${accent}00; }
        }
      `}</style>
    </motion.div>
  );
}

export default function InventaireKpiCards({ global = {} }) {
  const ecartAbs = Math.abs(global.valeurEcartsTnd ?? 0);
  const precision = global.precisionPct ?? 100;
  const enCours = global.enCours ?? 0;
  const total = global.nbInventaires ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <CreativeKpi
        delay={0}
        title="Inventaires"
        value={total}
        icon={ClipboardList}
        accent={INV_THEME.accent}
        subtitle="Historique total"
        barPct={Math.min(100, Math.max(12, total * 8))}
      />
      <CreativeKpi
        delay={0.07}
        title="En feu"
        value={enCours}
        icon={Flame}
        accent={INV_THEME.cyan}
        subtitle="Saisies en cours"
        pulse={enCours > 0}
        barPct={total > 0 ? (enCours / total) * 100 : enCours > 0 ? 40 : 8}
      />
      <CreativeKpi
        delay={0.14}
        title="Précision"
        value={precision}
        icon={Target}
        accent={INV_THEME.success}
        subtitle="Conformité stock"
        formatValue={(n) => `${Number(n).toFixed(1)}%`}
        barPct={precision}
      />
      <CreativeKpi
        delay={0.21}
        title="Écarts TND"
        value={ecartAbs}
        icon={BarChart3}
        accent={INV_THEME.amber}
        subtitle={formatTnd(global.valeurEcartsTnd)}
        formatValue={(n) => Math.round(n).toLocaleString("fr-FR")}
        barPct={ecartAbs > 0 ? Math.min(100, 20 + Math.log10(ecartAbs + 1) * 18) : 8}
      />
    </div>
  );
}
