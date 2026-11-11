import { Package, ShoppingCart } from "lucide-react";
import ArticleAddBar from "./ArticleAddBar";
import LigneAchat from "./LigneAchat";
import { LIGNE_ACHAT_GRID_COLS, LIGNE_ACHAT_TABLE_MIN_W } from "./ligneAchatGrid";

export default function LignesAchatPanel({
  lignes = [],
  totaux,
  articles = [],
  readonly,
  canWrite,
  formDisabled,
  onAdd,
  onUpdate,
  onRemove,
}) {
  const showAdd = !readonly && canWrite;

  return (
    <div className="space-y-4">
      {showAdd ? (
        <div
          className="rounded-xl border border-[#7c3aed]/20 p-4"
          style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.06), transparent)" }}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#a78bfa]">
            Ajouter des articles
          </p>
          <ArticleAddBar articles={articles} onAdd={onAdd} disabled={formDisabled} />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-sm">
        {lignes.length > 0 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-default)] px-5 py-4"
            style={{ background: "linear-gradient(90deg, rgba(124,58,237,0.12), rgba(124,58,237,0.02))" }}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#7c3aed]/15 text-[#7c3aed]">
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {lignes.length} article{lignes.length > 1 ? "s" : ""} au bon de commande
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">Montants HT par ligne (TVA incluse au récap)</p>
              </div>
            </div>
            {totaux ? (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Sous-total HT</p>
                <p className="text-lg font-semibold tabular-nums text-[#7c3aed]">{totaux.ht} TND</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {lignes.length > 0 ? (
          <div className="overflow-x-auto">
            <div style={{ minWidth: LIGNE_ACHAT_TABLE_MIN_W }}>
            <div
              className="sticky top-0 z-[1] hidden gap-4 border-b border-[var(--border-default)] bg-[var(--bg-app)]/95 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] backdrop-blur-sm md:grid"
              style={{ gridTemplateColumns: LIGNE_ACHAT_GRID_COLS }}
            >
              <span>#</span>
              <span>Article</span>
              <span className="text-right">Quantité</span>
              <span className="text-right">Prix unit. HT</span>
              <span className="text-right">Remise</span>
              <span>TVA</span>
              <span className="text-right">Total HT</span>
              <span />
            </div>

            <div className="divide-y divide-[var(--border-default)]/60">
              {lignes.map((l, i) => (
                <LigneAchat
                  key={l.id}
                  ligne={l}
                  index={i}
                  readonly={readonly}
                  onUpdate={(field, val) => onUpdate(l.id, field, val)}
                  onRemove={() => onRemove(l.id)}
                />
              ))}
            </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7c3aed]/10">
              <Package className="h-7 w-7 text-[#7c3aed] opacity-70" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Aucun article ajouté</p>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-[var(--text-muted)]">
              {showAdd
                ? "Recherchez un article par code ou libellé dans la barre ci-dessus, puis cliquez pour l'ajouter."
                : "Cette commande ne contient pas encore de lignes."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
