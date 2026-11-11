import { Package, PlusCircle } from "lucide-react";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../../utils/brandStyles";

export default function ArticleEmptyState({ canWrite, onCreate, hasFilters }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border-default)]"
        style={{
          background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)",
          color: "var(--accent-primary)",
        }}
        aria-hidden
      >
        <Package className="h-10 w-10" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">
        {hasFilters ? "Aucun produit trouvé" : "Aucun article"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">
        {hasFilters
          ? "Essayez d'ajuster vos filtres ou votre recherche."
          : canWrite
            ? "Commencez par créer votre premier article dans le référentiel."
            : "Le référentiel produits est vide."}
      </p>
      {canWrite && !hasFilters ? (
        <button
          type="button"
          onClick={onCreate}
          className={`mt-6 ${PRIMARY_BTN_CLASSES}`}
          style={primaryButtonStyle}
        >
          <PlusCircle className="h-[18px] w-[18px]" aria-hidden />
          Nouvel article
        </button>
      ) : null}
    </div>
  );
}
