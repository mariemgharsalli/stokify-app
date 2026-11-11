import { motion, useReducedMotion } from "framer-motion";
import GlassPageHeader from "./GlassPageHeader";

const PAGE_SHELL_TRANSITION = { duration: 0.28, ease: "easeOut" };

/**
 * Page chrome with glass navy hero (style Sociétés).
 * Pass icon / badge / aside to customize; titles map to presets automatically.
 */
export default function PageShell({
  title,
  subtitle,
  children,
  actions,
  icon,
  badge,
  badgeIcon,
  aside,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="relative mx-auto max-w-7xl space-y-6 p-6 lg:p-8"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : PAGE_SHELL_TRANSITION}
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 10% -10%, rgba(55,138,221,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 0%, rgba(6,182,212,0.08), transparent 50%)",
        }}
      />

      {title ? (
        <GlassPageHeader
          title={title}
          subtitle={subtitle}
          icon={icon}
          badge={badge}
          badgeIcon={badgeIcon}
          aside={aside}
          actions={actions}
        />
      ) : (
        actions && (
          <div className="flex flex-wrap justify-end gap-2">{actions}</div>
        )
      )}

      {children}
    </motion.div>
  );
}
