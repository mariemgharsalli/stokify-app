/** Skeleton shimmer unifié — pulse 1.4s (coutShimmerSweep) partout dans le module. */

export function CoutKpiSkeleton({ delayIndex = 0 }) {
  return (
    <div
      className="cout-skeleton-card overflow-hidden rounded-xl border border-[var(--border-default)] p-5"
      style={{
        background: "var(--bg-card)",
        animationDelay: `${delayIndex * 70}ms`,
        borderLeftWidth: "4px",
        borderLeftColor: "var(--border-default)",
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2.5">
          <div className="cout-shimmer h-2.5 w-24 rounded-md" />
          <div className="cout-shimmer h-8 w-36 rounded-md" />
          <div className="cout-shimmer h-2 w-28 rounded-md" />
        </div>
        <div className="cout-shimmer h-10 w-10 shrink-0 rounded-lg" />
      </div>
      <div className="cout-shimmer mt-4 h-1.5 w-full rounded-full" />
    </div>
  );
}

export function CoutTableRowSkeleton({ columns = 6, delayIndex = 0 }) {
  return (
    <div
      className="cout-row-enter flex items-center gap-3 border-b border-[var(--border-default)] px-4 py-4"
      style={{ animationDelay: `${delayIndex * 60}ms` }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="cout-shimmer h-4 flex-1 rounded-md"
          style={{ maxWidth: i === 0 ? "28%" : undefined, opacity: 1 - i * 0.07 }}
        />
      ))}
    </div>
  );
}

export function CoutCardSkeleton({ delayIndex = 0 }) {
  return (
    <div
      className="cout-skeleton-card overflow-hidden rounded-xl border border-[var(--border-default)] p-5"
      style={{ animationDelay: `${delayIndex * 70}ms` }}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="cout-shimmer h-12 w-12 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="cout-shimmer h-3 w-32 rounded-md" />
          <div className="cout-shimmer h-2 w-20 rounded-md" />
        </div>
      </div>
      <div className="cout-shimmer h-6 w-24 rounded-md" />
    </div>
  );
}

/** État vide actionnable — icône + message + CTA optionnel */
export function CoutEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  accentColor = "#378ADD",
  className = "",
}) {
  return (
    <div className={`cout-empty-state ${className}`}>
      <div
        className="cout-empty-state__icon cout-empty-float"
        style={{
          borderColor: `${accentColor}40`,
          background: `${accentColor}12`,
          color: accentColor,
        }}
      >
        {Icon ? <Icon size={28} stroke={1.4} /> : null}
      </div>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--text-secondary)]">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5"
          style={{ background: accentColor }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
