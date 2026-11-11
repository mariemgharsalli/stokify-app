import { AlertTriangle, Package, ShoppingCart } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ArticleAddBar from "./ArticleAddBar";
import LigneVente from "./LigneVente";
import { inputClass } from "./formStyles";
import { LIGNE_VENTE_GRID_COLS, LIGNE_VENTE_TABLE_MIN_W } from "./ligneVenteGrid";

const rowMotion = {
  initial: { opacity: 0, height: 0, y: -6 },
  animate: { opacity: 1, height: "auto", y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, height: 0, y: -4, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } },
};

export default function LignesVentePanel({
  lignes = [],
  totaux,
  margeGlobale,
  articles = [],
  readonly,
  canWrite,
  formDisabled,
  remiseGlobale = 0,
  onRemiseGlobaleChange,
  stockInsuffisant,
  stockByArticleId = {},
  lotsByArticleId = {},
  onAdd,
  onUpdate,
  onRemove,
  onLotSelect,
}) {
  const showAdd = !readonly && canWrite;
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-4">
      {showAdd ? (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "color-mix(in srgb, var(--accent-primary) 25%, var(--border-default))",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent), transparent)",
          }}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-primary)]">
            Ajouter des articles
          </p>
          <ArticleAddBar articles={articles} stockByArticle={{}} onAdd={onAdd} disabled={formDisabled} />
        </div>
      ) : null}

      {stockInsuffisant ? (
        <div
          className="flex items-start gap-2 rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--accent-warning) 40%, var(--border-default))",
            background: "color-mix(in srgb, var(--accent-warning) 10%, transparent)",
            color: "var(--accent-warning)",
          }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Stock insuffisant sur une ou plusieurs lignes pour le dépôt sélectionné.</span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-sm">
        {lignes.length > 0 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-default)] px-5 py-4"
            style={{
              background:
                "linear-gradient(90deg, color-mix(in srgb, var(--accent-primary) 12%, transparent), color-mix(in srgb, var(--accent-primary) 2%, transparent))",
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{
                  background: "color-mix(in srgb, var(--accent-primary) 15%, transparent)",
                  color: "var(--accent-primary)",
                }}
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {lignes.length} article{lignes.length > 1 ? "s" : ""} · Marge globale{" "}
                  <span
                    style={{
                      color:
                        margeGlobale < 0
                          ? "var(--accent-danger)"
                          : margeGlobale < 10
                            ? "var(--accent-warning)"
                            : "var(--accent-success)",
                    }}
                  >
                    {margeGlobale.toFixed(1)}%
                  </span>
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">Prix, stock et lots par ligne</p>
              </div>
            </div>
            {totaux ? (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Sous-total HT</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--accent-primary)]">
                  {totaux.ht} TND
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {lignes.length > 0 ? (
          <div className="overflow-x-auto">
            <div style={{ minWidth: LIGNE_VENTE_TABLE_MIN_W }}>
              <div
                className="sticky top-0 z-[1] hidden gap-4 border-b border-[var(--border-default)] bg-[var(--bg-app)]/95 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] backdrop-blur-sm md:grid"
                style={{ gridTemplateColumns: LIGNE_VENTE_GRID_COLS }}
              >
                <span>#</span>
                <span>Article · stock</span>
                <span className="text-right">Quantité</span>
                <span className="text-right">Prix vente HT</span>
                <span className="text-right">Remise</span>
                <span>TVA</span>
                <span className="text-right">Total HT</span>
                <span />
              </div>

              <div className="divide-y divide-[var(--border-default)]/60">
                <AnimatePresence initial={false} mode="popLayout">
                  {lignes.map((l, i) => (
                    <motion.div
                      key={l.id}
                      layout={!reduceMotion}
                      {...(reduceMotion
                        ? {}
                        : {
                            initial: rowMotion.initial,
                            animate: rowMotion.animate,
                            exit: rowMotion.exit,
                          })}
                    >
                      <LigneVente
                        ligne={l}
                        index={i}
                        readonly={readonly}
                        stockInfo={stockByArticleId[l.article?.id]}
                        lots={lotsByArticleId[l.article?.id] || []}
                        onUpdate={(field, val) => onUpdate(l.id, field, val)}
                        onRemove={() => onRemove(l.id)}
                        onLotSelect={(lotId) => onLotSelect(l.id, lotId)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)" }}
            >
              <Package
                className="h-7 w-7 opacity-70"
                style={{ color: "var(--accent-primary)" }}
                aria-hidden="true"
              />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Aucun article ajouté</p>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-[var(--text-muted)]">
              {showAdd
                ? "Recherchez un article par code ou libellé, puis vérifiez le stock disponible sur le dépôt choisi."
                : "Cette vente ne contient pas encore de lignes."}
            </p>
          </div>
        )}

        {lignes.length > 0 && !readonly ? (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border-default)] bg-[var(--bg-app)]/50 px-5 py-3">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Remise globale</label>
            <div className="relative w-28">
              <input
                type="number"
                min="0"
                max="100"
                className={`${inputClass} !py-2.5 pr-8 text-right text-[15px]`}
                value={remiseGlobale}
                onChange={(e) => onRemiseGlobaleChange(parseFloat(e.target.value) || 0)}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
                %
              </span>
            </div>
            {remiseGlobale > 0 && totaux?.remiseGlobale ? (
              <span className="text-sm tabular-nums text-[var(--accent-success)]">
                − {totaux.remiseGlobale} TND
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
