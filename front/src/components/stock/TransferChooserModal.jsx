import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  MapPin,
  Warehouse,
  X,
} from "lucide-react";

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  warning: "#BA7517",
};

/**
 * Étape 1 — choisir le type de transfert (dépôt vs emplacement).
 * Pattern UX type ERP / WMS : un seul bouton « Transférer », puis choix clair.
 */
export default function TransferChooserModal({ ligne, open, onClose, onChooseDepot, onChooseEmplacement }) {
  const reduceMotion = useReducedMotion();
  if (!open || !ligne) return null;

  const maxQty = Number(ligne.quantite) || 0;
  const code = ligne.article?.code || "—";
  const libelle = ligne.article?.libelle || "";
  const depotLabel = ligne.depot?.libelle || ligne.depot?.code || "—";
  const emplLabel = ligne.emplacement?.code || ligne.emplacement?.libelle;
  const hasEmplacement = Boolean(ligne.emplacementId);

  const options = [
    {
      key: "depot",
      title: "Vers un autre dépôt",
      subtitle: "Transfert inter-dépôts",
      description:
        "Déplacez le stock vers un autre entrepôt. Idéal pour réapprovisionner une agence ou un site distant.",
      Icon: Warehouse,
      accent: THEME.warning,
      badge: "Inter-dépôts",
      enabled: true,
      hint: `Depuis : ${depotLabel}`,
      onClick: () => onChooseDepot?.(ligne),
    },
    {
      key: "emplacement",
      title: "Changer d’emplacement",
      subtitle: "Déplacement interne",
      description:
        "Réorganisez le stock dans le même dépôt (ou vers un autre emplacement). Idéal pour le picking, le rangement ou l’optimisation.",
      Icon: MapPin,
      accent: THEME.accent,
      badge: "Intra-dépôt",
      enabled: hasEmplacement,
      hint: hasEmplacement
        ? `Depuis : ${emplLabel || "emplacement"} · ${depotLabel}`
        : "Cette ligne n’a pas d’emplacement source",
      onClick: () => onChooseEmplacement?.(ligne),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-modal)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-chooser-title"
        initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="relative border-b border-[var(--border-default)] px-5 py-4">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 70% 100% at 0% 0%, rgba(55,138,221,0.14), transparent 55%)",
            }}
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#378ADD]">
                Étape 1 sur 2
              </p>
              <h2
                id="transfer-chooser-title"
                className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]"
              >
                Quel type de transfert ?
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                <span className="font-mono font-semibold text-[#378ADD]">{code}</span>
                {libelle ? ` — ${libelle}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Disponible :{" "}
                <strong className="tabular-nums text-[var(--text-primary)]">
                  {maxQty.toLocaleString("fr-FR")}
                </strong>
                {" · "}
                {depotLabel}
                {emplLabel ? ` · ${emplLabel}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Choices */}
        <div className="space-y-3 p-5">
          {options.map((opt, i) => {
            const Icon = opt.Icon;
            return (
              <motion.button
                key={opt.key}
                type="button"
                disabled={!opt.enabled}
                onClick={() => {
                  if (!opt.enabled) return;
                  opt.onClick();
                }}
                className="group relative flex w-full gap-4 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-55"
                style={{
                  borderColor: "var(--border-default)",
                  background: "var(--bg-card)",
                }}
                initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={
                  reduceMotion || !opt.enabled
                    ? undefined
                    : {
                        y: -3,
                        borderColor: `${opt.accent}77`,
                        boxShadow: `0 14px 28px -16px ${opt.accent}66`,
                      }
                }
                whileTap={reduceMotion || !opt.enabled ? undefined : { scale: 0.99 }}
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105"
                  style={{
                    background: `linear-gradient(145deg, ${opt.accent}28, ${THEME.cyan}14)`,
                    color: opt.accent,
                    border: `1px solid ${opt.accent}40`,
                  }}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{opt.title}</p>
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{
                        background: `${opt.accent}18`,
                        color: opt.accent,
                      }}
                    >
                      {opt.badge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium" style={{ color: opt.accent }}>
                    {opt.subtitle}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
                    {opt.description}
                  </p>
                  <p className="mt-2 text-[11px] text-[var(--text-secondary)]">{opt.hint}</p>
                </div>

                <ArrowRight
                  className="mt-1 h-5 w-5 shrink-0 text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[#378ADD]"
                  aria-hidden
                />
              </motion.button>
            );
          })}
        </div>

        <div className="border-t border-[var(--border-default)] px-5 py-3">
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            Astuce : le transfert dépôt change d’entrepôt · l’emplacement réorganise dans le dépôt
          </p>
        </div>
      </motion.div>
    </div>
  );
}
