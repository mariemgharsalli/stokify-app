import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  Eye,
  FileText,
  Loader2,
  Package,
  Pencil,
  QrCode,
  Timer,
  Warehouse,
  Zap,
} from "lucide-react";
import { getArticleRealImageUrl } from "../../pages/articles/ClientCatalog";
import { downloadLotTraceabilitePdf } from "../../utils/stockReports";
import api, { getAxiosErrorMessage } from "../../services/api";
import {
  computeStatut,
  daysLeft,
  fmtDate,
  freshnessColor,
} from "../../pages/stock/lotsUi";

const LOT_THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  success: "#1D9E75",
  danger: "#E24B4A",
  amber: "#D97706",
  muted: "#94A3B8",
};

const STATUS_STYLE = {
  ACTIF: { label: "Actif", bg: "rgba(29,158,117,0.18)", color: "#6ee7b7" },
  EXPIRE: { label: "Expiré", bg: "rgba(226,75,74,0.18)", color: "#fca5a5" },
  EPUISE: { label: "Épuisé", bg: "rgba(148,163,184,0.18)", color: "#94a3b8" },
  DESACTIVE: { label: "Désactivé", bg: "rgba(100,116,139,0.22)", color: "#cbd5e1" },
};

function ProgressRing({ pct, accent, size = 56, pulse, children }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  const inner = size - stroke * 2 - 4;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {pulse ? (
        <span className="lot-card-pulse pointer-events-none absolute inset-0 rounded-full" aria-hidden />
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
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
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
          background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 60%, #0ea5e9))`,
          boxShadow: `0 2px 8px -2px ${accent}99`,
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

function MiniIconBtn({ icon: Icon, onClick, title, color, disabled, loading, reduceMotion }) {
  return (
    <motion.button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled || loading}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="rounded-lg p-1.5 disabled:opacity-40"
      style={{ color: color || "var(--text-muted)" }}
      whileHover={reduceMotion || disabled ? undefined : { scale: 1.12, y: -1 }}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.94 }}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
    </motion.button>
  );
}

export function LotCardSkeleton({ index = 0 }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="h-[88px] overflow-hidden rounded-2xl border"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: "3px solid rgba(55,138,221,0.35)",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div
        className="h-full w-full"
        style={{
          background:
            "linear-gradient(110deg, var(--bg-card) 30%, color-mix(in srgb, #378ADD 14%, var(--bg-card)) 50%, var(--bg-card) 70%)",
          backgroundSize: "200% 100%",
          animation: reduceMotion ? undefined : "lotSkelShine 1.4s ease-in-out infinite",
          animationDelay: `${index * 70}ms`,
        }}
      />
      <style>{`
        @keyframes lotSkelShine {
          0% { background-position: 120% 0; }
          100% { background-position: -40% 0; }
        }
      `}</style>
    </motion.div>
  );
}

/**
 * Carte lot — layout compact type InventaireCard.
 */
export default function LotCard({
  lot,
  index = 0,
  isFefoPriority = false,
  canWrite = false,
  deactivatePending = false,
  onViewDetail,
  onQrCode,
  onQr,
  onExportPdf,
  onEdit,
  onDesactiver,
  onDeactivate,
  onReactivate,
}) {
  const reduceMotion = useReducedMotion();
  const [imgErr, setImgErr] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const statut = computeStatut(lot);
  const cfg = STATUS_STYLE[statut] || STATUS_STYLE.ACTIF;
  const isDisabled = statut === "DESACTIVE";
  const isActive = statut === "ACTIF";
  const freshness = daysLeft(lot.dateExpiration);
  const freshColor = freshnessColor(lot.dateExpiration);

  const init = Number(lot.quantiteInitiale) || 0;
  const rest = Number(lot.quantiteRestante) || 0;
  const occupationPct = init > 0 ? Math.min(100, Math.round((rest / init) * 100)) : 0;

  const imgSrc = getArticleRealImageUrl(lot.article);
  const articleLabel = lot.article?.libelle || lot.article?.designation || "—";
  const handleQr = onQrCode || onQr;
  const handleDeactivate = onDesactiver || onDeactivate;
  const showFefo = isFefoPriority && !isDisabled;

  const accent =
    statut === "EXPIRE"
      ? LOT_THEME.danger
      : statut === "EPUISE" || statut === "DESACTIVE"
        ? LOT_THEME.muted
        : showFefo
          ? LOT_THEME.cyan
          : freshness != null && freshness <= 30
            ? freshColor
            : LOT_THEME.accent;

  async function handlePdf() {
    if (onExportPdf) {
      onExportPdf(lot);
      return;
    }
    setPdfLoading(true);
    try {
      await downloadLotTraceabilitePdf(api, lot.id, lot.numero);
    } catch (e) {
      alert(getAxiosErrorMessage(e));
    } finally {
      setPdfLoading(false);
    }
  }

  const dlcLabel =
    freshness == null
      ? "Sans DLC"
      : freshness < 0
        ? `${Math.abs(freshness)}j expirés`
        : freshness === 0
          ? "Expire aujourd'hui"
          : `${freshness}j restants`;

  return (
    <motion.article
      className="group relative overflow-hidden rounded-2xl border"
      style={{
        "--lot-accent": accent,
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: showFefo
          ? `0 0 0 1px ${LOT_THEME.cyan}28, var(--shadow-card)`
          : "var(--shadow-card)",
        opacity: isDisabled ? 0.85 : 1,
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: isDisabled ? 0.85 : 1, y: 0, scale: 1 }}
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
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}22, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${LOT_THEME.cyan}12, transparent 50%)`,
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

      <div className="relative z-[1] flex items-center gap-3 px-3.5 py-3.5">
        <ProgressRing
          pct={occupationPct}
          accent={accent}
          size={58}
          pulse={!reduceMotion && isActive && showFefo}
        >
          {imgSrc && !imgErr ? (
            <img
              src={imgSrc}
              alt={articleLabel}
              onError={() => setImgErr(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className="h-5 w-5" style={{ color: accent }} aria-hidden />
          )}
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="relative rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {isActive && !reduceMotion ? (
                <span
                  className="lot-card-live-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: accent }}
                  aria-hidden
                />
              ) : null}
              {cfg.label}
            </span>
            {showFefo ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                style={{
                  background: `linear-gradient(135deg, ${LOT_THEME.accent}, ${LOT_THEME.cyan})`,
                }}
              >
                <Zap className="h-2.5 w-2.5" />
                FEFO
              </span>
            ) : null}
            <span className="truncate font-mono text-[11px] font-semibold" style={{ color: accent }}>
              {lot.numero}
            </span>
          </div>

          <h3
            className="mt-0.5 truncate text-sm font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {articleLabel}
          </h3>

          <p
            className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px]"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="inline-flex items-center gap-0.5">
              <Warehouse className="h-3 w-3" style={{ color: LOT_THEME.cyan }} />
              {lot.depot?.code || lot.depot?.libelle || "—"}
            </span>
            <span className="inline-flex items-center gap-0.5 tabular-nums" style={{ color: freshColor }}>
              <Timer className="h-3 w-3" />
              {dlcLabel}
            </span>
            <span className="tabular-nums">
              {rest.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}/
              {init.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
            </span>
            <span className="hidden sm:inline">DLC {fmtDate(lot.dateExpiration)}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <motion.button
            type="button"
            onClick={() => onViewDetail?.(lot)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white"
            style={{
              background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, #0ea5e9))`,
              boxShadow: `0 4px 14px -4px ${accent}99`,
            }}
            whileHover={reduceMotion ? undefined : { scale: 1.04, y: -1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          >
            <Eye className="h-3 w-3" />
            Détail
          </motion.button>

          <div
            className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MiniIconBtn
              icon={QrCode}
              onClick={() => handleQr?.(lot)}
              title="QR Code"
              color={LOT_THEME.cyan}
              reduceMotion={reduceMotion}
            />
            <MiniIconBtn
              icon={FileText}
              onClick={handlePdf}
              title="Traçabilité PDF"
              color={LOT_THEME.success}
              loading={pdfLoading}
              reduceMotion={reduceMotion}
            />
            {canWrite && (
              <>
                <MiniIconBtn
                  icon={Pencil}
                  onClick={() => onEdit?.(lot)}
                  title="Modifier"
                  color={LOT_THEME.accent}
                  reduceMotion={reduceMotion}
                />
                {isDisabled ? (
                  <MiniIconBtn
                    icon={Archive}
                    onClick={() => onReactivate?.(lot)}
                    title="Réactiver"
                    color={LOT_THEME.success}
                    disabled={deactivatePending}
                    reduceMotion={reduceMotion}
                  />
                ) : (
                  <MiniIconBtn
                    icon={Archive}
                    onClick={() => handleDeactivate?.(lot)}
                    title="Désactiver"
                    color={LOT_THEME.muted}
                    disabled={deactivatePending}
                    reduceMotion={reduceMotion}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .lot-card-pulse {
          animation: lotCardPulse 2s ease-out infinite;
        }
        .lot-card-live-dot {
          box-shadow: 0 0 6px var(--lot-accent);
          animation: lotCardPulse 1.6s ease-out infinite;
        }
        @keyframes lotCardPulse {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--lot-accent) 55%, transparent); opacity: 1; }
          70% { box-shadow: 0 0 0 10px transparent; opacity: 0.35; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 0; }
        }
      `}</style>
    </motion.article>
  );
}
