import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  MapPin,
  Package,
  Sparkles,
  Warehouse,
} from "lucide-react";
import { stockLevelColor } from "../../hooks/useStockGroupes";
import { getArticleRealImageUrl } from "../../pages/articles/ClientCatalog";
import { fmtMoney } from "./stockUi";
import StockLineCard from "./StockLineCard";

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  success: "#1D9E75",
  warning: "#EF9F27",
  danger: "#E24B4A",
  muted: "#94A3B8",
};

function useAnimatedNumber(target, duration = 900) {
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

function stockHealthPct(qty, stockMin, stockMax) {
  const q = Number(qty) || 0;
  const max = stockMax != null ? Number(stockMax) : null;
  const min = stockMin != null ? Number(stockMin) : null;
  if (q <= 0) return 0;
  if (max != null && max > 0) return Math.min(100, Math.round((q / max) * 100));
  if (min != null && min > 0) return Math.min(100, Math.round((q / (min * 2)) * 100));
  return 72;
}

function stockStatus(qty, stockMin) {
  const q = Number(qty) || 0;
  const min = stockMin != null ? Number(stockMin) : null;
  if (q === 0) {
    return { label: "Rupture", bg: "rgba(226,75,74,0.18)", color: "#fca5a5", key: "rupture" };
  }
  if (min != null && q <= min) {
    return { label: "Alerte", bg: "rgba(239,159,39,0.18)", color: "#fcd34d", key: "alerte" };
  }
  return { label: "OK", bg: "rgba(29,158,117,0.18)", color: "#6ee7b7", key: "ok" };
}

function ProgressRing({ pct, accent, size = 58, pulse, children }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  const inner = size - stroke * 2 - 4;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {pulse ? (
        <span className="art-stock-pulse pointer-events-none absolute inset-0 rounded-full" aria-hidden />
      ) : null}
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-subtle, rgba(148,163,184,0.18))"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${accent}66)` }}
        />
      </svg>
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full"
        style={{
          width: inner,
          height: inner,
          background: "var(--bg-input)",
          boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.12)",
        }}
      >
        {children}
      </div>
      <span
        className="absolute -bottom-0.5 left-1/2 z-[1] -translate-x-1/2 rounded-md px-1.5 py-px text-[9px] font-bold tabular-nums text-white"
        style={{
          background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, ${THEME.cyan}))`,
          boxShadow: `0 2px 8px -2px ${accent}99`,
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

/**
 * Carte stock regroupée par article — layout compact type Lot / Inventaire.
 */
export default function ArticleStockCard({
  groupe,
  index,
  onTransfer,
  onEmplacementTransfer,
  onQrClick,
  actionsPending,
  rotationMap,
}) {
  const [expanded, setExpanded] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const reduceMotion = useReducedMotion();

  const qty = Number(groupe.quantiteTotale) || 0;
  const accent = stockLevelColor(qty, groupe.stockMinimum);
  const healthPct = stockHealthPct(qty, groupe.stockMinimum, groupe.stockMaximum);
  const status = stockStatus(qty, groupe.stockMinimum);
  const rotationLabel = rotationMap?.get?.(groupe.articleId);
  const valeur = qty * (Number(groupe.cmp) || 0);
  const animatedQty = useAnimatedNumber(qty, 900);
  const imgSrc = getArticleRealImageUrl({
    imageUrl: groupe.imageUrl || groupe.lignes?.[0]?.article?.imageUrl,
    id: groupe.articleId,
  });
  const needsPulse = !reduceMotion && (status.key === "rupture" || status.key === "alerte");
  const lineCount = groupe.lignes?.length || 0;

  return (
    <motion.article
      className="group relative overflow-hidden rounded-2xl border"
      style={{
        "--art-accent": accent,
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: "var(--shadow-card)",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: reduceMotion ? 0 : Math.min(index * 0.045, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -6,
              borderColor: `${accent}66`,
              boxShadow: `0 18px 36px -16px ${accent}66`,
            }
      }
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${THEME.cyan}12, transparent 50%)`,
        }}
        aria-hidden
      />

      <Package
        className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 opacity-[0.06] transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.1]"
        style={{ color: accent }}
        strokeWidth={1}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}88, transparent)`,
        }}
        aria-hidden
      />

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="relative z-[1] flex w-full items-center gap-3 px-3.5 py-3.5 text-left"
        aria-expanded={expanded}
      >
        <ProgressRing pct={healthPct} accent={accent} size={58} pulse={needsPulse}>
          {imgSrc && !imgErr ? (
            <img
              src={imgSrc}
              alt={groupe.libelle}
              onError={() => setImgErr(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <Package className="h-5 w-5" style={{ color: accent }} aria-hidden />
          )}
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="relative rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ background: status.bg, color: status.color }}
            >
              {needsPulse ? (
                <span
                  className="art-stock-live-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: accent }}
                  aria-hidden
                />
              ) : null}
              {status.label}
            </span>
            <span className="font-mono text-[11px] font-semibold text-[#378ADD]">{groupe.code}</span>
            {groupe.famille ? (
              <span className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                {groupe.famille}
              </span>
            ) : null}
            {rotationLabel ? (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-[color-mix(in_srgb,#0EA5E9_16%,transparent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-300">
                <Sparkles className="h-2.5 w-2.5" aria-hidden />
                {rotationLabel}
              </span>
            ) : null}
            {groupe.modeGestion && groupe.modeGestion !== "STANDARD" ? (
              <span className="rounded-md bg-[rgba(239,159,39,0.16)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
                {groupe.modeGestion}
              </span>
            ) : null}
          </div>

          <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
            {groupe.libelle}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <Warehouse className="h-3 w-3 text-sky-400/80" aria-hidden />
              {groupe.nbDepots} dépôt{groupe.nbDepots > 1 ? "s" : ""}
            </span>
            <span className="text-[var(--border-default)]">·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-sky-400/80" aria-hidden />
              {groupe.nbEmplacements} empl.
            </span>
            <span className="text-[var(--border-default)]">·</span>
            <span>
              {lineCount} ligne{lineCount > 1 ? "s" : ""}
            </span>
          </div>

          {/* Mini jauge stock */}
          <div
            className="mt-2 h-1 max-w-[180px] overflow-hidden rounded-full"
            style={{ background: "color-mix(in srgb, var(--border-default) 70%, transparent)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${accent}, ${THEME.cyan})`,
                boxShadow: `0 0 8px ${accent}55`,
              }}
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${healthPct}%` }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            />
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tabular-nums leading-none" style={{ color: accent }}>
            {Math.round(animatedQty).toLocaleString("fr-FR")}
          </p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {groupe.unite || "u"}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold tabular-nums text-sky-400/90">
            {fmtMoney(valeur)} TND
          </p>
          {groupe.stockMinimum != null ? (
            <p className="mt-0.5 text-[9px] text-[var(--text-muted)]">
              Min {Number(groupe.stockMinimum).toLocaleString("fr-FR")}
            </p>
          ) : null}
        </div>

        <motion.span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-[var(--text-muted)]"
          style={{
            borderColor: expanded ? `${accent}55` : "var(--border-default)",
            background: expanded
              ? `color-mix(in srgb, ${accent} 14%, transparent)`
              : "var(--bg-input)",
            color: expanded ? accent : undefined,
          }}
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="lines"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="space-y-2 border-t px-3 py-3"
              style={{
                borderColor: "var(--border-default)",
                background:
                  "linear-gradient(180deg, color-mix(in srgb, #378ADD 6%, var(--bg-app)), var(--bg-app))",
              }}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Répartition par dépôt
                </p>
                <span className="text-[10px] tabular-nums text-sky-400/80">
                  {lineCount} emplacement{lineCount > 1 ? "s" : ""}
                </span>
              </div>
              {groupe.lignes.map((ligne, j) => (
                <StockLineCard
                  key={ligne.id}
                  ligne={ligne}
                  index={j}
                  nested
                  onTransfer={onTransfer}
                  onEmplacementTransfer={onEmplacementTransfer}
                  onQrClick={onQrClick}
                  actionsPending={actionsPending}
                  rotationLabel={rotationMap?.get?.(groupe.articleId)}
                />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <style>{`
        .art-stock-pulse {
          animation: artStockPulse 2s ease-out infinite;
        }
        .art-stock-live-dot {
          box-shadow: 0 0 6px var(--art-accent);
          animation: artStockPulse 1.6s ease-out infinite;
        }
        @keyframes artStockPulse {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--art-accent) 55%, transparent); opacity: 1; }
          70% { box-shadow: 0 0 0 10px transparent; opacity: 0.35; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 0; }
        }
      `}</style>
    </motion.article>
  );
}
