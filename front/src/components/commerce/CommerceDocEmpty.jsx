import { Package, ShoppingBag } from "lucide-react";
import { COMMERCE_THEME } from "./CommerceDocCardShell";

/** Skeleton liste achats / ventes — silhouette type carte stock */
export function CommerceDocCardSkeleton({ count = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] px-3.5 py-3.5"
          style={{
            background: "var(--bg-card)",
            borderLeft: `3px solid color-mix(in srgb, ${COMMERCE_THEME.accent} 35%, var(--border-default))`,
            animationDelay: `${i * 60}ms`,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background: `radial-gradient(ellipse 50% 60% at 0% 0%, ${COMMERCE_THEME.accent}14, transparent 55%)`,
            }}
            aria-hidden
          />
          <div className="relative flex items-center gap-3">
            <div
              className="h-14 w-14 shrink-0 animate-pulse rounded-full"
              style={{ background: "var(--bg-hover)" }}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="h-3 w-20 animate-pulse rounded-md bg-[var(--bg-hover)]" />
                <div className="h-3 w-14 animate-pulse rounded-md bg-[var(--bg-hover)]" />
              </div>
              <div className="h-4 w-40 max-w-full animate-pulse rounded-md bg-[var(--bg-hover)]" />
              <div className="h-1 w-36 animate-pulse rounded-full bg-[var(--bg-hover)]" />
            </div>
            <div className="hidden shrink-0 space-y-2 sm:block">
              <div className="ml-auto h-5 w-24 animate-pulse rounded-md bg-[var(--bg-hover)]" />
              <div className="ml-auto h-3 w-12 animate-pulse rounded-md bg-[var(--bg-hover)]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Empty state créatif — liste achats / ventes */
export function CommerceDocEmpty({
  variant = "achat",
  title,
  description,
  action = null,
}) {
  const Icon = variant === "vente" ? ShoppingBag : Package;
  const accent = COMMERCE_THEME.accent;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-dashed px-6 py-14 text-center"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 35%, var(--border-default))`,
        background: "var(--bg-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(ellipse 60% 70% at 50% 0%, ${accent}18, transparent 60%), radial-gradient(ellipse 40% 50% at 100% 100%, ${COMMERCE_THEME.cyan}10, transparent 50%)`,
        }}
        aria-hidden
      />
      <Icon
        className="pointer-events-none absolute -bottom-4 -right-4 h-32 w-32 opacity-[0.06] transition-transform duration-500 group-hover:scale-110"
        style={{ color: accent }}
        strokeWidth={1}
        aria-hidden
      />
      <div className="relative z-[1]">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background: `linear-gradient(145deg, ${accent}, ${COMMERCE_THEME.cyan})`,
            boxShadow: `0 14px 28px -12px ${accent}88`,
          }}
        >
          <Icon className="h-7 w-7 text-white" strokeWidth={2} aria-hidden />
        </div>
        <p className="mt-4 text-base font-semibold text-[var(--text-primary)]">{title}</p>
        {description ? (
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">{description}</p>
        ) : null}
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
