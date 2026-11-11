import { useNavigate } from "react-router-dom";
import { AlertTriangle, PackageX, ArrowRight, X } from "lucide-react";

export function RichStockToast({ toast, onDismiss }) {
  const navigate = useNavigate();
  const { type, articleLibelle, articleImageUrl, depotLibelle, articleId } = toast.data || {};
  const isRupture = type === "RUPTURE";
  const color = isRupture ? "#E24B4A" : "#EF9F27";

  return (
    <div
      className="toast-slide-in pointer-events-auto w-[340px] overflow-hidden rounded-2xl border shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
      style={{ background: "var(--bg-card)", borderColor: `${color}40` }}
    >
      <div className="h-1 w-full" style={{ background: color }} />
      <div className="flex gap-3 p-3.5">
        <div className="relative flex-shrink-0">
          <img
            src={articleImageUrl || "/placeholder-article.svg"}
            alt={articleLibelle || "Article"}
            className="h-14 w-14 rounded-xl border object-cover"
            style={{ borderColor: "var(--border-default)" }}
            onError={(e) => {
              if (e.currentTarget.src.endsWith("placeholder-article.svg")) return;
              e.currentTarget.src = "/placeholder-article.svg";
            }}
          />
          <div
            className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2"
            style={{ background: color, borderColor: "var(--bg-card)" }}
          >
            {isRupture ? <PackageX size={12} color="#fff" /> : <AlertTriangle size={12} color="#fff" />}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {isRupture ? "Rupture de stock" : "Stock critique"}
            </p>
            <button
              type="button"
              onClick={onDismiss}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>
          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
            {articleLibelle}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {depotLibelle}
          </p>
          <button
            type="button"
            onClick={() => {
              if (articleId) navigate(`/articles/${articleId}`);
              onDismiss();
            }}
            className="mt-2 flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color }}
          >
            Voir l&apos;article <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
