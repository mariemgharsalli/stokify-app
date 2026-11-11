import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  Calendar,
  ClipboardList,
  FileText,
  Loader2,
  MapPin,
  Package,
  Pencil,
  QrCode,
  Timer,
  Warehouse,
  X,
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

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  success: "#1D9E75",
  danger: "#E24B4A",
  amber: "#D97706",
  muted: "#94A3B8",
};

const STATUS_STYLE = {
  ACTIF: { label: "Actif", bg: "rgba(29,158,117,0.22)", color: "#6ee7b7" },
  EXPIRE: { label: "Expiré", bg: "rgba(226,75,74,0.22)", color: "#fca5a5" },
  EPUISE: { label: "Épuisé", bg: "rgba(148,163,184,0.2)", color: "#94a3b8" },
  DESACTIVE: { label: "Désactivé", bg: "rgba(100,116,139,0.25)", color: "#cbd5e1" },
};

const TYPE_CFG = {
  ENTREE_ACHAT: { label: "Achat", color: THEME.success },
  ENTREE_RETOUR_CLIENT: { label: "Retour client", color: THEME.success },
  ENTREE_AJUSTEMENT: { label: "Ajustement +", color: THEME.cyan },
  SORTIE_VENTE: { label: "Vente", color: THEME.danger },
  SORTIE_PERTE: { label: "Perte", color: THEME.danger },
  SORTIE_CASSE: { label: "Casse", color: THEME.danger },
  SORTIE_AUTRE: { label: "Sortie", color: THEME.danger },
  TRANSFERT: { label: "Transfert", color: THEME.accent },
};

function fmtWhen(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function StockRing({ pct, accent, size = 112, children }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  const inner = size - stroke * 2 - 10;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(148,163,184,0.15)"
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
          transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${accent}66)` }}
        />
      </svg>
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full"
        style={{
          width: inner,
          height: inner,
          background: "rgba(15,23,42,0.65)",
          boxShadow: "inset 0 0 0 1px rgba(125,211,252,0.15)",
        }}
      >
        {children}
      </div>
      <span
        className="absolute -bottom-1 left-1/2 z-[1] -translate-x-1/2 rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums text-white"
        style={{
          background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, #0ea5e9))`,
          boxShadow: `0 4px 12px -4px ${accent}99`,
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

function MetricChip({ label, value, color, delay = 0, reduceMotion }) {
  return (
    <motion.div
      className="rounded-xl border px-3 py-1.5"
      style={{ borderColor: `${color}33`, background: `${color}14` }}
      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.03 }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider text-sky-200/45">{label}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color }}>
        {Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
      </p>
    </motion.div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, color, disabled, loading, reduceMotion }) {
  return (
    <motion.button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
      style={{
        borderColor: `${color}55`,
        background: `linear-gradient(135deg, ${color}dd, ${color}99)`,
        boxShadow: `0 6px 16px -6px ${color}66`,
      }}
      whileHover={reduceMotion || disabled ? undefined : { y: -2, scale: 1.02, filter: "brightness(1.08)" }}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.97 }}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </motion.button>
  );
}

/**
 * Cockpit détail lot — style inventaire (glass navy, ring, motion).
 */
export default function LotDetailModal({
  lot: lotProp,
  isFefoPriority = false,
  canWrite = false,
  onClose,
  onQrCode,
  onTrace,
  onEdit,
  onDesactiver,
  onReactivate,
}) {
  const reduceMotion = useReducedMotion();
  const [imgErr, setImgErr] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { data: lotFresh } = useQuery({
    queryKey: ["lot-detail", lotProp?.id],
    queryFn: () => api.get(`lots/${lotProp.id}`).then((r) => r.data),
    enabled: !!lotProp?.id,
  });

  const { data: mvtsData, isLoading: mvtsLoading } = useQuery({
    queryKey: ["lot-mouvements", lotProp?.id],
    queryFn: () => api.get(`lots/${lotProp.id}/mouvements`).then((r) => r.data),
    enabled: !!lotProp?.id,
  });

  const lot = lotFresh || lotProp;
  const mvts = mvtsData?.items || [];
  const statut = computeStatut(lot);
  const cfg = STATUS_STYLE[statut] || STATUS_STYLE.ACTIF;
  const isDisabled = statut === "DESACTIVE";
  const freshness = daysLeft(lot?.dateExpiration);
  const freshColor = freshnessColor(lot?.dateExpiration);
  const init = Number(lot?.quantiteInitiale) || 0;
  const rest = Number(lot?.quantiteRestante) || 0;
  const consumed = Math.max(0, init - rest);
  const pct = init > 0 ? Math.min(100, Math.round((rest / init) * 100)) : 0;
  const imgSrc = getArticleRealImageUrl(lot?.article);
  const articleLabel = lot?.article?.libelle || lot?.article?.designation || "—";
  const showFefo = isFefoPriority && !isDisabled;

  const accent =
    statut === "EXPIRE"
      ? THEME.danger
      : statut === "EPUISE" || statut === "DESACTIVE"
        ? THEME.muted
        : showFefo
          ? THEME.cyan
          : freshness != null && freshness <= 30
            ? freshColor
            : THEME.accent;

  const dlcLabel =
    freshness == null
      ? "Sans DLC"
      : freshness < 0
        ? `Expiré il y a ${Math.abs(freshness)}j`
        : freshness === 0
          ? "Expire aujourd'hui"
          : `${freshness}j restants`;

  async function handlePdf() {
    setPdfLoading(true);
    try {
      await downloadLotTraceabilitePdf(api, lot.id, lot.numero);
    } catch (e) {
      alert(getAxiosErrorMessage(e));
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="lot-detail-root"
        className="pointer-events-auto fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.22 }}
      >
        <motion.div
          className="absolute inset-0"
          style={{ background: "rgba(6,10,20,0.72)", backdropFilter: "blur(8px)" }}
          aria-hidden
          onClick={onClose}
          initial={false}
        />

        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lot-detail-title"
          className="relative z-[1] flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            background:
              "linear-gradient(165deg, rgba(17,34,66,0.98) 0%, rgba(12,22,40,0.98) 55%, rgba(10,18,32,0.99) 100%)",
            borderColor: "rgba(56,189,248,0.22)",
            boxShadow:
              "0 24px 64px -16px rgba(0,0,0,0.65), inset 0 1px 0 rgba(125,211,252,0.12)",
          }}
          onClick={(e) => e.stopPropagation()}
          initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(125,211,252,0.5), transparent)",
            }}
            aria-hidden
          />

          {/* Cockpit header */}
          <div className="relative shrink-0 border-b px-5 pb-5 pt-5" style={{ borderColor: "rgba(56,189,248,0.14)" }}>
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 50% 80% at 0% 50%, rgba(55,138,221,0.22), transparent 55%), radial-gradient(ellipse 40% 50% at 100% 0%, rgba(6,182,212,0.12), transparent 50%)",
              }}
              aria-hidden
            />

            <div className="relative flex items-start justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300/60">
                Cockpit lot · traçabilité
              </p>
              <motion.button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/20 text-sky-200/70"
                aria-label="Fermer"
                whileHover={reduceMotion ? undefined : { scale: 1.05, backgroundColor: "rgba(255,255,255,0.06)" }}
                whileTap={reduceMotion ? undefined : { scale: 0.95 }}
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>

            <div className="relative mt-4 grid gap-5 sm:grid-cols-[120px_1fr] sm:items-center">
              <StockRing pct={pct} accent={accent} size={112}>
                {imgSrc && !imgErr ? (
                  <img
                    src={imgSrc}
                    alt={articleLabel}
                    onError={() => setImgErr(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Package className="h-8 w-8" style={{ color: accent }} aria-hidden />
                )}
              </StockRing>

              <div className="min-w-0 space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                  {showFefo ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`,
                        boxShadow: `0 4px 14px -4px ${THEME.cyan}99`,
                      }}
                    >
                      <Zap className="h-3 w-3" />
                      Priorité FEFO
                    </span>
                  ) : null}
                </div>

                <div>
                  <h2
                    id="lot-detail-title"
                    className="truncate font-mono text-xl font-bold tracking-tight text-white sm:text-2xl"
                    style={{ color: accent }}
                  >
                    {lot?.numero}
                  </h2>
                  <p className="mt-0.5 truncate text-sm font-medium text-sky-50/90">{articleLabel}</p>
                  <p className="font-mono text-[11px] text-sky-200/45">{lot?.article?.code || "—"}</p>
                </div>

                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sky-100/55">
                  <span className="inline-flex items-center gap-1">
                    <Warehouse className="h-3.5 w-3.5 text-cyan-300" />
                    {lot?.depot?.libelle || lot?.depot?.code || "—"}
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 font-semibold" style={{ color: freshColor }}>
                    <Timer className="h-3.5 w-3.5" />
                    {dlcLabel}
                  </span>
                </p>

                <div className="flex flex-wrap gap-2">
                  <MetricChip label="Initiale" value={init} color="#7dd3fc" delay={0.05} reduceMotion={reduceMotion} />
                  <MetricChip label="Restante" value={rest} color="#6ee7b7" delay={0.1} reduceMotion={reduceMotion} />
                  <MetricChip label="Consommé" value={consumed} color="#fbbf24" delay={0.15} reduceMotion={reduceMotion} />
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <motion.div
              className="grid grid-cols-2 gap-2.5"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              {[
                {
                  icon: MapPin,
                  label: "Dépôt",
                  value: lot?.depot?.libelle || lot?.depot?.code || "—",
                  sub: lot?.depot?.code && lot?.depot?.libelle ? lot.depot.code : null,
                },
                {
                  icon: Timer,
                  label: "Fraîcheur",
                  value: dlcLabel,
                  color: freshColor,
                },
                {
                  icon: Calendar,
                  label: "Fabrication",
                  value: fmtDate(lot?.dateFabrication),
                },
                {
                  icon: Calendar,
                  label: "Expiration",
                  value: fmtDate(lot?.dateExpiration),
                  color: freshColor,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border px-3 py-2.5"
                  style={{
                    borderColor: "rgba(56,189,248,0.14)",
                    background: "rgba(15,23,42,0.45)",
                  }}
                >
                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-200/45">
                    <item.icon className="h-3 w-3" style={{ color: item.color || THEME.cyan }} />
                    {item.label}
                  </p>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: item.color || "rgba(241,245,249,0.95)" }}
                  >
                    {item.value}
                  </p>
                  {item.sub ? (
                    <p className="font-mono text-[10px] text-sky-200/40">{item.sub}</p>
                  ) : null}
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200/50">
                  Derniers mouvements
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                  style={{ background: `${THEME.accent}22`, color: "#7dd3fc" }}
                >
                  {mvts.length}
                </span>
              </div>

              {mvtsLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-12 animate-pulse rounded-xl bg-white/5"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                  ))}
                </div>
              ) : mvts.length === 0 ? (
                <div
                  className="rounded-xl border border-dashed py-8 text-center"
                  style={{ borderColor: "rgba(56,189,248,0.18)" }}
                >
                  <ClipboardList className="mx-auto mb-2 h-7 w-7 text-sky-200/30" />
                  <p className="text-xs text-sky-200/45">Aucun mouvement pour ce lot</p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {mvts.slice(0, 6).map((m, i) => {
                    const tcfg = TYPE_CFG[m.type] || { label: m.type, color: THEME.muted };
                    return (
                      <motion.li
                        key={m.id}
                        className="flex items-center gap-2.5 rounded-xl border px-3 py-2"
                        style={{
                          borderColor: "rgba(56,189,248,0.12)",
                          background: "rgba(15,23,42,0.4)",
                        }}
                        initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i, duration: 0.28 }}
                        whileHover={
                          reduceMotion
                            ? undefined
                            : { backgroundColor: "rgba(55,138,221,0.1)", x: 2 }
                        }
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: tcfg.color, boxShadow: `0 0 8px ${tcfg.color}` }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-sky-50">{tcfg.label}</p>
                          <p className="text-[10px] text-sky-200/40">{fmtWhen(m.createdAt)}</p>
                        </div>
                        <span className="font-mono text-xs tabular-nums text-sky-100/80">
                          {Number(m.quantite || 0).toLocaleString("fr-FR", {
                            maximumFractionDigits: 3,
                          })}
                        </span>
                      </motion.li>
                    );
                  })}
                </ul>
              )}

              {mvts.length > 6 && (
                <motion.button
                  type="button"
                  onClick={() => onTrace?.(lot)}
                  className="mt-2 w-full text-center text-[11px] font-semibold text-sky-300"
                  whileHover={reduceMotion ? undefined : { x: 2 }}
                >
                  Voir toute la traçabilité →
                </motion.button>
              )}
            </motion.div>
          </div>

          {/* Actions */}
          <div
            className="shrink-0 space-y-2 border-t px-5 py-4"
            style={{ borderColor: "rgba(56,189,248,0.14)", background: "rgba(8,15,28,0.55)" }}
          >
            <div className="flex flex-wrap gap-2">
              <ActionBtn
                icon={QrCode}
                label="QR Code"
                color={THEME.accent}
                onClick={() => onQrCode?.(lot)}
                reduceMotion={reduceMotion}
              />
              <ActionBtn
                icon={FileText}
                label="PDF"
                color={THEME.success}
                onClick={handlePdf}
                loading={pdfLoading}
                reduceMotion={reduceMotion}
              />
              <ActionBtn
                icon={ClipboardList}
                label="Traçabilité"
                color={THEME.cyan}
                onClick={() => onTrace?.(lot)}
                reduceMotion={reduceMotion}
              />
            </div>
            {canWrite && (
              <div className="flex flex-wrap gap-2">
                <ActionBtn
                  icon={Pencil}
                  label="Modifier"
                  color={THEME.accent}
                  onClick={() => onEdit?.(lot)}
                  reduceMotion={reduceMotion}
                />
                {isDisabled ? (
                  <ActionBtn
                    icon={Archive}
                    label="Réactiver"
                    color={THEME.success}
                    onClick={() => onReactivate?.(lot)}
                    reduceMotion={reduceMotion}
                  />
                ) : (
                  <ActionBtn
                    icon={Archive}
                    label="Désactiver"
                    color={THEME.muted}
                    onClick={() => onDesactiver?.(lot)}
                    reduceMotion={reduceMotion}
                  />
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
