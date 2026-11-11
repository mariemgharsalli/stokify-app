import { motion, useReducedMotion } from "framer-motion";
import { Shield, ShieldOff, UserCheck, Users } from "lucide-react";
import AnimatedMetric from "../../inventaires/components/AnimatedMetric";

const CARDS = [
  {
    key: "total",
    label: "Total utilisateurs",
    accent: "var(--accent-primary)",
    Icon: Users,
    trend: "Vue d'ensemble",
  },
  {
    key: "active",
    label: "Comptes actifs",
    accent: "var(--accent-success)",
    Icon: UserCheck,
    pulse: true,
    trend: "En service",
  },
  {
    key: "inactive",
    label: "Comptes inactifs",
    accent: "var(--accent-danger)",
    Icon: ShieldOff,
    trend: "À surveiller",
  },
  {
    key: "admins",
    label: "Admins",
    accent: "var(--accent-warning)",
    Icon: Shield,
    trend: "Accès élevé",
  },
];

export default function UserMetricCards({ stats }) {
  const reduceMotion = useReducedMotion();
  const values = {
    total: stats.total,
    active: stats.active,
    inactive: stats.inactive,
    admins: stats.admins,
  };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map((card, i) => {
        const Icon = card.Icon;
        return (
          <motion.div
            key={card.key}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            whileHover={reduceMotion ? undefined : { y: -3 }}
            className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4"
            style={{ borderLeft: `3px solid ${card.accent}` }}
          >
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-40"
              style={{
                background: `radial-gradient(circle, color-mix(in srgb, ${card.accent} 28%, transparent), transparent 70%)`,
              }}
              aria-hidden
            />
            <div className="relative flex items-start justify-between">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${card.accent} 14%, transparent)`,
                  color: card.accent,
                }}
              >
                <Icon className="h-4 w-4" />
              </div>
              {card.pulse ? (
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                    style={{ background: "var(--accent-success)" }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ background: "var(--accent-success)" }}
                  />
                </span>
              ) : null}
            </div>
            <p className="relative mt-3 font-display text-3xl font-semibold text-[var(--text-primary)]">
              <AnimatedMetric value={values[card.key]} duration={1200} />
            </p>
            <p className="relative mt-1 text-xs font-medium text-[var(--text-secondary)]">{card.label}</p>
            <p className="relative mt-1 text-[11px] text-[var(--text-muted)]">{card.trend}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
