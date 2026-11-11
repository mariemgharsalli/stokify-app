import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, Warehouse } from "lucide-react";
import { daysLeft, fmtDate, freshnessColor } from "../../pages/stock/lotsUi";

/**
 * Récap Origine → Destination partagé (review + success).
 */
export function TransferRouteSummary({
  originLabel,
  originSub,
  destLabel,
  destSub,
  accent = "#378ADD",
}) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="min-w-0 flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
          Origine
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <Warehouse className="h-4 w-4 shrink-0 text-[#BA7517]" aria-hidden />
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {originLabel || "—"}
          </p>
        </div>
        {originSub ? (
          <p className="mt-1 truncate font-mono text-[11px] text-[var(--text-muted)]">{originSub}</p>
        ) : null}
      </div>
      <div className="flex items-center">
        <ArrowRight className="h-5 w-5" style={{ color: accent }} aria-hidden />
      </div>
      <div
        className="min-w-0 flex-1 rounded-xl border p-3"
        style={{
          borderColor: `${accent}73`,
          background: `color-mix(in srgb, ${accent} 10%, var(--bg-card))`,
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
          Destination
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <Warehouse className="h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden />
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {destLabel || "—"}
          </p>
        </div>
        {destSub ? (
          <p className="mt-1 truncate font-mono text-[11px] text-[var(--text-muted)]">{destSub}</p>
        ) : null}
      </div>
    </div>
  );
}

function LotExpiryBadge({ dateExpiration }) {
  const days = daysLeft(dateExpiration);
  const color = freshnessColor(dateExpiration);
  let label = "Sans DLC";
  if (days != null) {
    if (days < 0) label = `Expiré`;
    else if (days === 0) label = "J0";
    else if (days <= 7) label = `J${days}`;
    else if (days <= 30) label = `J${days}`;
    else label = fmtDate(dateExpiration);
  }
  const warn = days != null && days <= 30;
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
      style={{
        color,
        background: warn ? `${color}22` : "var(--bg-hover)",
        border: `1px solid ${warn ? `${color}55` : "var(--border-default)"}`,
      }}
    >
      {label}
    </span>
  );
}

/**
 * Liste animée des lots déplacés (écran success).
 */
export function TransferLotsList({ lots = [], reduceMotion: reduceMotionProp }) {
  const reduceMotionHook = useReducedMotion();
  const reduceMotion = reduceMotionProp ?? reduceMotionHook;
  if (!lots?.length) return null;

  const container = {
    hidden: {},
    show: {
      transition: reduceMotion ? undefined : { staggerChildren: 0.06 },
    },
  };
  const item = {
    hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.ul
      className="mt-3 max-h-36 space-y-1.5 overflow-y-auto"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {lots.map((lot, i) => (
        <motion.li
          key={`${lot.lotId || lot.destLotId || lot.lotNumero}-${i}`}
          variants={item}
          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate font-mono text-xs font-semibold text-[var(--text-primary)]">
              {lot.lotNumero || `Lot #${lot.lotId}`}
            </p>
            <p className="text-[10px] tabular-nums text-[var(--text-muted)]">
              {Number(lot.quantite).toLocaleString("fr-FR")} unité(s)
            </p>
          </div>
          <LotExpiryBadge dateExpiration={lot.dateExpiration} />
        </motion.li>
      ))}
    </motion.ul>
  );
}

/**
 * Carte de revue avant confirmation (Stripe/Linear-like).
 */
export default function TransferReviewCard({
  originLabel,
  originSub,
  destLabel,
  destSub,
  articleCode,
  articleLibelle,
  quantite,
  unite,
  accent = "#378ADD",
  onEdit,
  onConfirm,
  confirming = false,
  confirmLabel = "Confirmer",
  editLabel = "Modifier",
}) {
  return (
    <div className="space-y-4">
      <TransferRouteSummary
        originLabel={originLabel}
        originSub={originSub}
        destLabel={destLabel}
        destSub={destSub}
        accent={accent}
      />

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
          À transférer
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
          {articleCode ? (
            <span className="font-mono text-[#378ADD]">{articleCode}</span>
          ) : null}
          {articleCode && articleLibelle ? " — " : null}
          {articleLibelle || null}
        </p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
          {Number(quantite).toLocaleString("fr-FR")}
          {unite ? (
            <span className="ml-1.5 text-sm font-medium text-[var(--text-muted)]">{unite}</span>
          ) : null}
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={confirming}
          className="rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
        >
          {editLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, ${accent}, #0EA5E9)`,
            boxShadow: `0 8px 18px -8px ${accent}88`,
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Écran de succès animé après transfert.
 */
export function TransferSuccessPanel({
  title = "Transfert enregistré",
  originLabel,
  originSub,
  destLabel,
  destSub,
  articleCode,
  quantite,
  unite,
  lots = [],
  accent = "#1D9E75",
  onDone,
  reduceMotion: reduceMotionProp,
}) {
  const reduceMotionHook = useReducedMotion();
  const reduceMotion = reduceMotionProp ?? reduceMotionHook;

  return (
    <div className="flex flex-col items-center px-1 py-2 text-center">
      <motion.div
        initial={reduceMotion ? false : { scale: 0.4, rotate: -40, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 320, damping: 18 }
        }
      >
        <CheckCircle2 className="h-14 w-14" style={{ color: accent }} aria-hidden />
      </motion.div>
      <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        {articleCode ? (
          <span className="font-mono text-[#378ADD]">{articleCode}</span>
        ) : null}
        {articleCode ? " · " : null}
        <span className="tabular-nums font-semibold text-[var(--text-primary)]">
          {Number(quantite).toLocaleString("fr-FR")}
          {unite ? ` ${unite}` : ""}
        </span>
      </p>

      <div className="mt-4 w-full text-left">
        <TransferRouteSummary
          originLabel={originLabel}
          originSub={originSub}
          destLabel={destLabel}
          destSub={destSub}
          accent="#378ADD"
        />
        <TransferLotsList lots={lots} reduceMotion={reduceMotion} />
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
        style={{
          background: `linear-gradient(135deg, ${accent}, #34d399)`,
          boxShadow: "0 8px 18px -8px rgba(29,158,117,0.55)",
        }}
      >
        Terminé
      </button>
    </div>
  );
}

export function parseLotsTransferred(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.lotsTransferred)) return payload.lotsTransferred;
  if (payload.lotsDetail) {
    try {
      const parsed = JSON.parse(payload.lotsDetail);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
