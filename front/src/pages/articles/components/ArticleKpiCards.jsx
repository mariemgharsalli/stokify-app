import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Archive, Image as ImageIcon, Package, PackageX, Shield } from "lucide-react";
import { stockIsCritical } from "../../refs/components/refsUtils";

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

function KpiTile({ title, value, subtitle, Icon, accent, pulse, delay = 0 }) {
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedNumber(value, 1100);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div
        className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full opacity-40"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${accent} 30%, transparent), transparent 70%)`,
        }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {title}
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
            {Math.round(animated).toLocaleString("fr-FR")}
          </p>
          {subtitle ? (
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">{subtitle}</p>
          ) : null}
        </div>
        <div className="relative">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: `color-mix(in srgb, ${accent} 14%, transparent)`,
              color: accent,
            }}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
          {pulse ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ background: accent }}
              />
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ background: accent }}
              />
            </span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

export function computeArticleKpis(items = []) {
  let actifs = 0;
  let archives = 0;
  let bloques = 0;
  let ruptures = 0;
  let critiques = 0;
  let withImage = 0;

  for (const a of items) {
    const s = String(a.statut || "ACTIF").toUpperCase();
    if (s === "ARCHIVE") archives += 1;
    else if (s === "BLOQUE") bloques += 1;
    else actifs += 1;

    const stock = Number(a.stock) || 0;
    if (stock === 0) ruptures += 1;
    else if (stockIsCritical(stock, a.stockMin)) critiques += 1;
    if (a.imageUrl) withImage += 1;
  }

  return {
    total: items.length,
    actifs,
    archives,
    bloques,
    ruptures,
    critiques,
    withImage,
  };
}

export default function ArticleKpiCards({ stats }) {
  const s = stats || {};
  const ruptures = Number(s.ruptures) || 0;
  const critiques = Number(s.critiques) || 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <KpiTile
        delay={0}
        title="Total articles"
        value={s.total ?? 0}
        subtitle={`${s.actifs ?? 0} actifs`}
        Icon={Package}
        accent="var(--accent-primary)"
      />
      <KpiTile
        delay={0.05}
        title="Avec image"
        value={s.withImage ?? 0}
        subtitle="Photos catalogue"
        Icon={ImageIcon}
        accent="var(--accent-info, #378ADD)"
      />
      <KpiTile
        delay={0.1}
        title="Ruptures"
        value={ruptures}
        subtitle="Stock = 0"
        Icon={ruptures > 0 ? PackageX : Package}
        accent={ruptures > 0 ? "var(--accent-danger)" : "var(--accent-success)"}
        pulse={ruptures > 0}
      />
      <KpiTile
        delay={0.15}
        title="Stock critique"
        value={critiques}
        subtitle="Sous le seuil"
        Icon={AlertTriangle}
        accent={critiques > 0 ? "var(--accent-warning)" : "var(--accent-success)"}
      />
      <KpiTile
        delay={0.2}
        title="Archivés"
        value={s.archives ?? 0}
        subtitle="Hors catalogue actif"
        Icon={Archive}
        accent="var(--text-muted)"
      />
      <KpiTile
        delay={0.25}
        title="Bloqués"
        value={s.bloques ?? 0}
        subtitle="Accès restreint"
        Icon={Shield}
        accent={Number(s.bloques) > 0 ? "var(--accent-warning)" : "var(--accent-success)"}
      />
    </div>
  );
}
