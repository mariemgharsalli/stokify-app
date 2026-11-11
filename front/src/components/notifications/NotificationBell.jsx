import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Bell } from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useNotificationStore } from "../../store/notificationStore";
import { useToastStore } from "../../store/toastStore";
import { hasPermission } from "../../security/permissions";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { getArticleRealImageUrl } from "../../pages/articles/ClientCatalog";
import NotificationPanel from "./NotificationPanel";

function formatBadge(count) {
  if (!count || count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}

function useClickOutside(ref, handler) {
  useEffect(() => {
    function onPointerDown(e) {
      if (!ref.current?.contains(e.target)) handler();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [ref, handler]);
}

export default function NotificationBell() {
  const reduceMotion = useReducedMotion();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const societeScope = useSocieteQueryScope();
  const wrapRef = useRef(null);
  const prevCountRef = useRef(null);
  const pushRichToast = useToastStore((s) => s.pushRichToast);

  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const isPanelOpen = useNotificationStore((s) => s.isPanelOpen);
  const badgePulse = useNotificationStore((s) => s.badgePulse);
  const togglePanel = useNotificationStore((s) => s.togglePanel);
  const closePanel = useNotificationStore((s) => s.closePanel);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const setNotifications = useNotificationStore((s) => s.setNotifications);

  useClickOutside(wrapRef, () => closePanel());

  const canAlerts = hasPermission(role, "stock:read");
  const isSuper = role === "SUPER_ADMIN";
  const alertsEnabled = Boolean(canAlerts && (!isSuper || societeScope != null));

  const { data: countData } = useQuery({
    queryKey: ["alertes-count", societeScope],
    queryFn: () => api.get("alertes/count").then((r) => r.data),
    enabled: alertsEnabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: listData } = useQuery({
    queryKey: ["alertes-list", societeScope],
    queryFn: () =>
      api.get("alertes", { params: { nonLues: true, limit: 20 } }).then((r) => r.data),
    enabled: alertsEnabled && isPanelOpen,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (countData?.count == null) return;
    const next = Number(countData.count) || 0;
    const prev = prevCountRef.current;

    if (prev != null && next > prev) {
      const delta = Math.min(next - prev, 10);
      api
        .get("alertes", { params: { nonLues: true, limit: delta } })
        .then((r) => {
          const items = Array.isArray(r.data?.items) ? r.data.items : [];
          // createdAt desc → inverser pour empiler du plus ancien au plus récent
          [...items].reverse().forEach((item) => {
            pushRichToast(
              {
                type: item.type,
                articleLibelle: item.article?.libelle || item.article?.code || "Article",
                articleImageUrl: getArticleRealImageUrl(item.article),
                depotLibelle: item.depot?.libelle || item.depot?.code || "Dépôt",
                articleId: item.article?.id || item.articleId,
              },
              { persistent: false, duration: 8000 }
            );
          });
        })
        .catch(() => {});
    }

    prevCountRef.current = next;
    setUnreadCount(next);
  }, [countData, setUnreadCount, pushRichToast]);

  useEffect(() => {
    if (!listData) return;
    setNotifications(Array.isArray(listData.items) ? listData.items : []);
  }, [listData, setNotifications]);

  useEffect(() => {
    closePanel();
  }, [societeScope, location.pathname, closePanel]);

  if (!canAlerts) return null;

  const badgeLabel = formatBadge(unreadCount);

  return (
    <div className="app-navbar-notif-wrap relative" ref={wrapRef}>
      <motion.button
        type="button"
        onClick={() => togglePanel()}
        aria-label="Notifications"
        title="Notifications"
        aria-expanded={isPanelOpen}
        className={`app-navbar-icon-btn${isPanelOpen ? " is-active" : ""}`}
        whileHover={reduceMotion ? undefined : { y: -2, scale: 1.04 }}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        animate={
          unreadCount > 0 && !reduceMotion
            ? { rotate: [0, -8, 8, -4, 4, 0] }
            : { rotate: 0 }
        }
        transition={
          unreadCount > 0
            ? { duration: 0.55, repeat: Infinity, repeatDelay: 4.5 }
            : { type: "spring", stiffness: 420, damping: 24 }
        }
      >
        <span className="app-navbar-icon-glow" aria-hidden />
        <Bell size={18} strokeWidth={1.85} />
        {badgeLabel && (
          <motion.span
            className={`app-navbar-badge${badgePulse ? " animate-pulse" : ""}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
          >
            {badgeLabel}
          </motion.span>
        )}
      </motion.button>

      {isPanelOpen && (
        <NotificationPanel alertsEnabled={alertsEnabled} societeScope={societeScope} />
      )}
    </div>
  );
}
