import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { FolderTree, Tag } from "lucide-react";

const TABS = [
  {
    to: "/marques",
    label: "Marques",
    Icon: Tag,
    gradient: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 55%, #2563eb 100%)",
    glow: "rgba(59, 130, 246, 0.45)",
    soft: "rgba(6, 182, 212, 0.16)",
    border: "rgba(56, 189, 248, 0.45)",
  },
  {
    to: "/familles",
    label: "Familles",
    Icon: FolderTree,
    gradient: "linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)",
    glow: "rgba(16, 185, 129, 0.45)",
    soft: "rgba(52, 211, 153, 0.16)",
    border: "rgba(52, 211, 153, 0.45)",
  },
];

export default function ArticleRefNavTabs() {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <motion.nav
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2.5"
      aria-label="Raccourcis vers le référentiel (marques, familles)"
    >
      <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Référentiel
      </span>
      {TABS.map(({ to, label, Icon, gradient, glow, soft, border }, i) => {
        const isActive = pathname === to || pathname.startsWith(`${to}/`);
        return (
          <motion.div
            key={to}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 + i * 0.06, duration: 0.3 }}
            whileHover={reduceMotion ? undefined : { y: -2, scale: 1.03 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          >
            <Link
              to={to}
              aria-current={isActive ? "page" : undefined}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-shadow"
              style={{
                background: gradient,
                boxShadow: isActive
                  ? `0 6px 22px ${glow}, 0 0 0 2px ${border}`
                  : `0 4px 14px ${soft}`,
                filter: isActive ? "none" : "saturate(0.95)",
              }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20">
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              {label}
            </Link>
          </motion.div>
        );
      })}
    </motion.nav>
  );
}
