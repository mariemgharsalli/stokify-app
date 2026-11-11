import { ArrowLeft } from "lucide-react";

/** Bouton retour vers /articles — style bleu cohérent référentiels. */
export default function BackToProductsButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-all hover:brightness-110"
      style={{
        background: "linear-gradient(135deg, #378ADD, #2563a8)",
        border: "1px solid rgba(55,138,221,0.45)",
        boxShadow: "0 4px 14px -3px rgba(55,138,221,0.4)",
      }}
    >
      <ArrowLeft size={16} /> Retour aux produits
    </button>
  );
}
