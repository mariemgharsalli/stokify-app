import { create } from "zustand";

let badgePulseTimer;

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isPanelOpen: false,
  badgePulse: false,
  setNotifications: (list) => set({ notifications: Array.isArray(list) ? list : [] }),
  setUnreadCount: (n) => {
    const next = Math.max(0, Number(n) || 0);
    const prev = get().unreadCount;
    set({ unreadCount: next });
    if (next > prev) get().pulseBadge();
  },
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  closePanel: () => set({ isPanelOpen: false }),
  markAsResolved: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id);
      const wasUnread = target && !target.resolue;
      return {
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, resolue: true, resolueAt: n.resolueAt || new Date().toISOString() } : n
        ),
        unreadCount: wasUnread ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
      };
    }),
  markAllResolved: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({
        ...n,
        resolue: true,
        resolueAt: n.resolueAt || new Date().toISOString(),
      })),
      unreadCount: 0,
    })),
  pulseBadge: () => {
    if (badgePulseTimer) clearTimeout(badgePulseTimer);
    set({ badgePulse: true });
    badgePulseTimer = setTimeout(() => {
      set({ badgePulse: false });
      badgePulseTimer = null;
    }, 2000);
  },
}));
