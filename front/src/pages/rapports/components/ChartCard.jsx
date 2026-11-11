import { motion } from "framer-motion";

export default function ChartCard({
  icon: Icon,
  title,
  subtitle,
  filters,
  children,
  loading,
  loadingHeight = "h-72",
}) {
  if (loading) {
    return (
      <div
        className={`${loadingHeight} animate-pulse rounded-2xl`}
        style={{ background: "var(--bg-card-hover)" }}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border p-5"
      style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-4 w-4" style={{ color: "var(--accent-primary)" }} /> : null}
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {title}
            </h3>
            {subtitle ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
      </div>
      {children}
    </motion.div>
  );
}
