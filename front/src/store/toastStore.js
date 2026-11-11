import { create } from "zustand";

let pulseTimer;

export const useToastStore = create((set, get) => ({
  toasts: [],
  societePulse: false,
  pushToast: (message, variant = "error", options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const persistent = options.persistent ?? variant === "error";
    set((s) => ({
      toasts: [...s.toasts, { id, message: String(message || "").trim() || "Erreur", variant, persistent }],
    }));
    if (!persistent) {
      const ms = variant === "success" ? 3000 : 6500;
      setTimeout(() => get().dismissToast(id), ms);
    }
  },
  pushRichToast: (data, options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const persistent = options.persistent ?? true;
    set((s) => ({
      toasts: [...s.toasts, { id, kind: "rich", data, persistent }],
    }));
    if (!persistent) {
      setTimeout(() => get().dismissToast(id), options.duration || 8000);
    }
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  pulseSocieteSelector: () => {
    if (pulseTimer) clearTimeout(pulseTimer);
    set({ societePulse: true });
    pulseTimer = setTimeout(() => {
      set({ societePulse: false });
      pulseTimer = null;
    }, 2200);
  },
}));
