import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  PackageMinus,
  PackagePlus,
  RotateCcw,
  Scale,
} from "lucide-react";
import { formatTnd, INV_THEME, ligneEcart } from "../inventaireUtils";

const LOT_WARNING_MSG = "Aucun lot identifiable pour cette perte";

export function parseLotsAjustes(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasLotWarning(lotsAjustes) {
  const parsed = parseLotsAjustes(lotsAjustes);
  return Boolean(parsed && parsed.warning);
}

export function hasLotIdentified(lotsAjustes) {
  const parsed = parseLotsAjustes(lotsAjustes);
  return Array.isArray(parsed) && parsed.length > 0;
}

function buildReviewStats(lignes) {
  let surplusCount = 0;
  let surplusValeur = 0;
  let perteCount = 0;
  let perteValeur = 0;
  let sansEcart = 0;
  const surplus = [];
  const pertes = [];

  for (const l of lignes || []) {
    if (l.qteReelle == null) continue;
    const ec = ligneEcart(l.qteTheorique, l.qteReelle);
    const val = Number(l.valeurEcart ?? 0);
    if (ec == null || Math.abs(ec) < 1e-9) {
      sansEcart += 1;
      continue;
    }
    if (ec > 0) {
      surplusCount += 1;
      surplusValeur += val;
      surplus.push(l);
    } else {
      perteCount += 1;
      perteValeur += val;
      pertes.push(l);
    }
  }

  return {
    surplusCount,
    surplusValeur,
    perteCount,
    perteValeur,
    sansEcart,
    surplus,
    pertes,
  };
}

function SummaryCard({ icon: Icon, title, count, valeur, color, delay, reduceMotion }) {
  return (
    <motion.div
      className="rounded-xl border px-3 py-3"
      style={{
        borderColor: `${color}44`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: reduceMotion ? 0 : delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${color}22`, color }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            {title}
          </p>
          <p className="text-lg font-bold tabular-nums" style={{ color }}>
            {count}
          </p>
        </div>
      </div>
      {valeur != null ? (
        <p className="mt-2 text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
          Valeur : {formatTnd(valeur)}
        </p>
      ) : null}
    </motion.div>
  );
}

function LotBadge({ line, preview = false }) {
  if (preview) {
    return (
      <span
        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
        style={{
          color: INV_THEME.cyan,
          background: `${INV_THEME.cyan}18`,
          border: `1px solid ${INV_THEME.cyan}44`,
        }}
      >
        lot auto (FIFO/FEFO)
      </span>
    );
  }
  if (hasLotWarning(line.lotsAjustes)) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
        style={{
          color: "#D97706",
          background: "rgba(217,119,6,0.15)",
          border: "1px solid rgba(217,119,6,0.4)",
        }}
      >
        ⚠ lot non identifié
      </span>
    );
  }
  if (hasLotIdentified(line.lotsAjustes)) {
    return (
      <span
        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
        style={{
          color: INV_THEME.success,
          background: `${INV_THEME.success}18`,
          border: `1px solid ${INV_THEME.success}44`,
        }}
      >
        lot identifié ✓
      </span>
    );
  }
  return (
    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
      —
    </span>
  );
}

function EcartLinesList({ title, lines, color, isPerte, preview, reduceMotion }) {
  if (!lines.length) return null;
  const container = {
    hidden: {},
    show: { transition: reduceMotion ? undefined : { staggerChildren: 0.05 } },
  };
  const item = {
    hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, x: 10 },
    show: { opacity: 1, x: 0 },
  };

  return (
    <div>
      <p
        className="mb-2 text-[10px] font-bold uppercase tracking-wider"
        style={{ color }}
      >
        {title}
      </p>
      <motion.ul
        className="max-h-36 space-y-1.5 overflow-y-auto"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {lines.map((l) => {
          const ec = ligneEcart(l.qteTheorique, l.qteReelle);
          return (
            <motion.li
              key={l.id}
              variants={item}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-card)",
              }}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  {l.article?.libelle}
                </p>
                <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {l.article?.code}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs font-bold tabular-nums" style={{ color }}>
                  {ec > 0 ? "+" : ""}
                  {ec}
                </span>
                <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {formatTnd(l.valeurEcart)}
                </span>
                {isPerte ? <LotBadge line={l} preview={preview} /> : (
                  <span
                    className="inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      color: INV_THEME.success,
                      background: `${INV_THEME.success}18`,
                      border: `1px solid ${INV_THEME.success}44`,
                    }}
                  >
                    couverture lot
                  </span>
                )}
              </div>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}

/**
 * Étape review avant confirmation de validation inventaire.
 */
export function InventaireReviewPanel({
  lignes,
  recomptagePending = [],
  onBack,
  onConfirm,
  confirming = false,
  validationAction = "ajuster",
  commentaire,
  onCommentaireChange,
  onActionChange,
  onToggleRecomptage,
  togglingRecomptageId = null,
}) {
  const reduceMotion = useReducedMotion();
  const stats = useMemo(() => buildReviewStats(lignes), [lignes]);
  const hasRecomptageBlock =
    validationAction !== "rejeter" && recomptagePending.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Vérifiez avant de confirmer
        </h3>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Récapitulatif des écarts et impact lots / valorisation.
        </p>
      </div>

      {hasRecomptageBlock ? (
        <div
          className="rounded-xl border px-3 py-3"
          style={{
            borderColor: "rgba(249,115,22,0.45)",
            background: "rgba(249,115,22,0.12)",
          }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-300">
                Recomptage en attente
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Re-saisissez la quantité réelle ou annulez la demande avant de valider l&apos;inventaire.
              </p>
              <ul className="mt-2 space-y-1.5">
                {recomptagePending.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5"
                    style={{
                      borderColor: "rgba(249,115,22,0.35)",
                      background: "rgba(0,0,0,0.15)",
                    }}
                  >
                    <span className="truncate text-xs">
                      <span className="font-mono text-orange-200">{l.article?.code || `#${l.id}`}</span>
                      {" — "}
                      {l.article?.libelle || "Article"}
                    </span>
                    {onToggleRecomptage ? (
                      <button
                        type="button"
                        title="Annuler la demande de recomptage"
                        disabled={togglingRecomptageId === l.id}
                        onClick={() => onToggleRecomptage(l.id)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition hover:bg-white/5 disabled:opacity-50"
                        style={{
                          borderColor: "rgba(249,115,22,0.45)",
                          color: "#fb923c",
                        }}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Annuler
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <SummaryCard
          icon={PackagePlus}
          title="Surplus détectés"
          count={stats.surplusCount}
          valeur={stats.surplusValeur}
          color={INV_THEME.success}
          delay={0.04}
          reduceMotion={reduceMotion}
        />
        <SummaryCard
          icon={PackageMinus}
          title="Pertes détectées"
          count={stats.perteCount}
          valeur={stats.perteValeur}
          color={INV_THEME.danger}
          delay={0.1}
          reduceMotion={reduceMotion}
        />
        <SummaryCard
          icon={Scale}
          title="Sans écart"
          count={stats.sansEcart}
          valeur={null}
          color="#94a3b8"
          delay={0.16}
          reduceMotion={reduceMotion}
        />
      </div>

      <div className="space-y-3">
        <EcartLinesList
          title="Surplus"
          lines={stats.surplus}
          color={INV_THEME.success}
          isPerte={false}
          preview
          reduceMotion={reduceMotion}
        />
        <EcartLinesList
          title="Pertes"
          lines={stats.pertes}
          color={INV_THEME.danger}
          isPerte
          preview
          reduceMotion={reduceMotion}
        />
      </div>

      <fieldset className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        <legend className="text-xs" style={{ color: "var(--text-muted)" }}>
          Action sur les écarts
        </legend>
        {[
          ["ajuster", "Générer les ajustements de stock automatiquement"],
          ["valider_sans_ajustement", "Valider sans ajustement (analyse uniquement)"],
          ["rejeter", "Rejeter et reprendre la saisie"],
        ].map(([v, lbl]) => (
          <label key={v} className="flex gap-2">
            <input
              type="radio"
              name="inv-action"
              checked={validationAction === v}
              onChange={() => onActionChange?.(v)}
            />
            {lbl}
          </label>
        ))}
      </fieldset>

      <label className="block text-xs" style={{ color: "var(--text-muted)" }}>
        Commentaire de validation
        <textarea
          className="mt-1 w-full min-h-[60px] rounded-xl border px-3 py-2 text-sm outline-none"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
          }}
          value={commentaire}
          onChange={(e) => onCommentaireChange?.(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={confirming}
          className="rounded-xl border px-4 py-2.5 text-sm disabled:opacity-50"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-secondary)",
          }}
        >
          Revenir à la saisie
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming || hasRecomptageBlock}
          title={
            hasRecomptageBlock
              ? `Recomptage requis pour : ${recomptagePending.map((l) => l.article?.code || `#${l.id}`).join(", ")}`
              : undefined
          }
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background:
              validationAction === "rejeter"
                ? `linear-gradient(135deg, ${INV_THEME.danger}, #f87171)`
                : `linear-gradient(135deg, ${INV_THEME.success}, #34d399)`,
            boxShadow: "0 8px 18px -8px rgba(29,158,117,0.55)",
          }}
        >
          {confirming
            ? "Validation…"
            : hasRecomptageBlock
              ? "Recomptage requis"
              : validationAction === "rejeter"
                ? "Confirmer le rejet"
                : "Confirmer la validation"}
        </button>
      </div>
    </div>
  );
}

/**
 * Écran succès après validation (pattern TransfertModal).
 */
export function InventaireSuccessPanel({
  summary,
  lotWarnings = [],
  onDone,
}) {
  const reduceMotion = useReducedMotion();
  const timerRef = useRef(null);

  const valeurNette = Number(summary?.valeurNette ?? 0);
  const ajustements = Number(summary?.ajustementsAppliques ?? 0);
  const warnings =
    lotWarnings?.length > 0
      ? lotWarnings
      : (summary?.lotWarnings || []);

  useEffect(() => {
    if (warnings.length > 0) return undefined;
    timerRef.current = setTimeout(() => onDone?.(), 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDone, warnings.length]);

  return (
    <div className="flex flex-col items-center px-1 py-2 text-center">
      <motion.div
        initial={reduceMotion ? false : { scale: 0.4, rotate: -40, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={
          reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 18 }
        }
      >
        <CheckCircle2 className="h-14 w-14" style={{ color: INV_THEME.success }} aria-hidden />
      </motion.div>
      <h3 className="mt-3 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        Inventaire validé
      </h3>
      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        {ajustements} ajustement{ajustements > 1 ? "s" : ""} appliqué
        {ajustements > 1 ? "s" : ""}
        {" · valeur nette : "}
        <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {valeurNette > 0 ? "+" : ""}
          {formatTnd(valeurNette)}
        </span>
      </p>

      {warnings.length > 0 ? (
        <div
          className="mt-4 w-full rounded-xl border px-3 py-3 text-left"
          style={{
            borderColor: "rgba(217,119,6,0.45)",
            background: "rgba(217,119,6,0.12)",
          }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                Lots non identifiés — vérification manuelle requise
              </p>
              <ul className="mt-2 space-y-1">
                {warnings.map((w) => (
                  <li
                    key={w.ligneId || w.articleId}
                    className="text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span className="font-mono text-amber-600 dark:text-amber-200">
                      {w.articleCode || "—"}
                    </span>
                    {" — "}
                    {w.articleLibelle || LOT_WARNING_MSG}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onDone}
        className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
        style={{
          background: `linear-gradient(135deg, ${INV_THEME.success}, #34d399)`,
          boxShadow: "0 8px 18px -8px rgba(29,158,117,0.55)",
        }}
      >
        Terminé
      </button>
    </div>
  );
}

export function InventaireValidationFlow({
  phase,
  lignes,
  recomptagePending = [],
  validationAction,
  commentaire,
  confirming,
  validationResult,
  onBackToSaisie,
  onConfirm,
  onActionChange,
  onCommentaireChange,
  onToggleRecomptage,
  togglingRecomptageId = null,
  onDone,
}) {
  const reduceMotion = useReducedMotion();
  const slide = {
    initial: reduceMotion ? false : { opacity: 0, x: 28 },
    animate: { opacity: 1, x: 0 },
    exit: reduceMotion ? undefined : { opacity: 0, x: -28 },
    transition: { duration: 0.22 },
  };

  const lotWarnings = useMemo(() => {
    const fromSummary = validationResult?.validationSummary?.lotWarnings || [];
    if (fromSummary.length) return fromSummary;
    return (validationResult?.lignes || [])
      .filter((l) => hasLotWarning(l.lotsAjustes))
      .map((l) => ({
        ligneId: l.id,
        articleId: l.articleId,
        articleCode: l.article?.code,
        articleLibelle: l.article?.libelle,
        message: LOT_WARNING_MSG,
      }));
  }, [validationResult]);

  return (
    <AnimatePresence mode="wait">
      {phase === "review" ? (
        <motion.div key="review" {...slide}>
          <InventaireReviewPanel
            lignes={lignes}
            recomptagePending={recomptagePending}
            onBack={onBackToSaisie}
            onConfirm={onConfirm}
            confirming={confirming}
            validationAction={validationAction}
            commentaire={commentaire}
            onCommentaireChange={onCommentaireChange}
            onActionChange={onActionChange}
            onToggleRecomptage={onToggleRecomptage}
            togglingRecomptageId={togglingRecomptageId}
          />
        </motion.div>
      ) : null}
      {phase === "success" ? (
        <motion.div key="success" {...slide}>
          <InventaireSuccessPanel
            summary={validationResult?.validationSummary}
            lotWarnings={lotWarnings}
            onDone={onDone}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
