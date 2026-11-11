import { motion, useReducedMotion } from "framer-motion";

export default function ClientPageHeader({ eyebrow, title, titleAccent, subtitle, stats }) {
  const reduce = useReducedMotion();
  return (
    <section className="client-pageheader">
      <div className="client-pageheader__bg" aria-hidden="true">
        <div className="client-pageheader__glow client-pageheader__glow--a" />
        <div className="client-pageheader__glow client-pageheader__glow--b" />
        <div className="client-pageheader__grid" />
      </div>
      <div className="client-pageheader__content">
        {eyebrow && (
          <motion.span
            className="client-eyebrow-badge"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {eyebrow}
          </motion.span>
        )}
        <motion.h1
          className="client-pageheader__title"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          {title} {titleAccent && <span className="client-hero__accent">{titleAccent}</span>}
        </motion.h1>
        {subtitle && (
          <motion.p
            className="client-pageheader__subtitle"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {subtitle}
          </motion.p>
        )}
        {stats?.length > 0 && (
          <motion.div
            className="client-pageheader__stats"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
          >
            {stats.map((s) => (
              <span key={s.label} className="stat-pill">
                {s.icon && <s.icon className="w-3.5 h-3.5" />} {s.value} {s.label}
              </span>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
