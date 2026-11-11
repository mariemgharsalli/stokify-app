import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellOff, Package } from "lucide-react";
import api from "../../services/api";
import { useNotificationStore } from "../../store/notificationStore";
import { formatRelativeTime } from "../../utils/formatRelativeTime";
import { getArticleRealImageUrl } from "../../pages/articles/ClientCatalog";

function ArticleThumb({ article }) {
  const src = getArticleRealImageUrl(article) || "/placeholder-article.svg";
  return (
    <div className="relative flex-shrink-0">
      <img
        src={src}
        alt={article?.libelle || "Article"}
        className="h-11 w-11 rounded-lg border object-cover"
        style={{ borderColor: "var(--border-default)" }}
        onError={(e) => {
          if (e.currentTarget.src.endsWith("placeholder-article.svg")) return;
          e.currentTarget.src = "/placeholder-article.svg";
        }}
      />
    </div>
  );
}

export default function NotificationPanel({ alertsEnabled, societeScope }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notifications = useNotificationStore((s) => s.notifications);
  const closePanel = useNotificationStore((s) => s.closePanel);
  const markAsResolved = useNotificationStore((s) => s.markAsResolved);
  const markAllResolved = useNotificationStore((s) => s.markAllResolved);

  const unread = notifications.filter((n) => !n.resolue);

  const resolveMutation = useMutation({
    mutationFn: (id) => api.patch(`alertes/${id}/resoudre`).then((r) => r.data),
    onSuccess: (_data, id) => {
      markAsResolved(id);
      queryClient.invalidateQueries({ queryKey: ["alertes-count", societeScope] });
      queryClient.invalidateQueries({ queryKey: ["alertes-list", societeScope] });
    },
  });

  const resolveAllMutation = useMutation({
    mutationFn: () => api.patch("alertes/resoudre-toutes").then((r) => r.data),
    onSuccess: () => {
      markAllResolved();
      queryClient.invalidateQueries({ queryKey: ["alertes-count", societeScope] });
      queryClient.invalidateQueries({ queryKey: ["alertes-list", societeScope] });
    },
  });

  function handleItemClick(alerte) {
    if (!alerte?.resolue) {
      resolveMutation.mutate(alerte.id);
    }
    closePanel();
    const articleId = alerte?.article?.id || alerte?.articleId;
    if (articleId) {
      navigate(`/articles/${articleId}`);
    } else if (alertsEnabled) {
      navigate("/stock");
    }
  }

  return (
    <div
      className="absolute right-0 top-[calc(100%+0.55rem)] z-[1200] flex w-[min(22.5rem,calc(100vw-1.25rem))] max-w-[calc(100vw-1.25rem)] flex-col overflow-hidden rounded-xl border shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
      }}
      role="dialog"
      aria-label="Notifications"
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Notifications
          </span>
          {unread.length > 0 && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                background: "rgba(226,75,74,0.12)",
                color: "#E24B4A",
                border: "1px solid rgba(226,75,74,0.3)",
              }}
            >
              {unread.length}
            </span>
          )}
        </div>
        {unread.length > 0 && (
          <button
            type="button"
            className="text-[11px] font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ color: "var(--text-secondary)" }}
            disabled={resolveAllMutation.isPending}
            onClick={() => resolveAllMutation.mutate()}
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="max-h-[400px] overflow-y-auto overscroll-contain">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "var(--bg-hover, rgba(0,0,0,0.04))", color: "var(--text-muted)" }}
            >
              <BellOff size={22} strokeWidth={1.6} />
            </span>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Aucune alerte pour le moment
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Les ruptures et stocks critiques apparaîtront ici.
            </p>
          </div>
        ) : (
          notifications.map((alerte) => {
            const isRupture = alerte.type === "RUPTURE";
            const accent = isRupture ? "#E24B4A" : "#EF9F27";
            return (
              <div
                key={alerte.id}
                className="flex cursor-pointer items-start gap-3 border-b p-3 transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  borderColor: "var(--border-default)",
                  opacity: alerte.resolue ? 0.55 : 1,
                  borderLeft: `3px solid ${accent}`,
                }}
                onClick={() => handleItemClick(alerte)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleItemClick(alerte);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="relative flex-shrink-0">
                  {alerte.article ? (
                    <ArticleThumb article={alerte.article} />
                  ) : (
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-lg border"
                      style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}
                    >
                      <Package size={18} />
                    </div>
                  )}
                  <span
                    className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2"
                    style={{
                      background: accent,
                      borderColor: "var(--bg-card)",
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {isRupture ? "Rupture de stock" : "Stock critique"}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                    {alerte.article?.libelle || "Article"} — {alerte.depot?.libelle || alerte.depot?.code || "Dépôt"}
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {formatRelativeTime(alerte.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {alertsEnabled && (
        <button
          type="button"
          className="border-t px-3.5 py-2.5 text-center text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)]"
          style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
          onClick={() => {
            closePanel();
            navigate("/stock");
          }}
        >
          Voir le stock
        </button>
      )}
    </div>
  );
}
