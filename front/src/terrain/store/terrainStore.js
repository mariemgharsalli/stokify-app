import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAuthStore } from "../../store/authStore";
import { purgerInventaireLocal } from "./inventoryPurge";
import { purgerFile } from "../offline/queue";

export const useTerrainStore = create(
  persist(
    (set, get) => ({
      /** "societeId:userId" — un autre utilisateur de la même société ne reprend pas le dépôt. */
      sessionKey: null,
      depotId: null,
      depotLabel: "",
      soundOn: true,
      hapticsOn: true,
      warehouseMode: false,
      recentScans: [],
      bindSession: (sessionKey) => {
        if (get().sessionKey !== sessionKey) {
          if (get().sessionKey) {
            purgerInventaireLocal();
            void purgerFile(get().sessionKey);
          }
          set({ sessionKey, depotId: null, depotLabel: "", recentScans: [] });
        }
      },
      setDepot: (depot) =>
        set({
          depotId: depot?.id ?? null,
          depotLabel: depot?.libelle || depot?.nom || depot?.code || "",
        }),
      setSound: (soundOn) => set({ soundOn }),
      setHaptics: (hapticsOn) => set({ hapticsOn }),
      setWarehouse: (warehouseMode) => set({ warehouseMode: Boolean(warehouseMode) }),
      pushScan: (entry) => {
        const row = {
          code: String(entry?.code || "").trim(),
          kind: entry?.kind || "unknown",
          label: String(entry?.label || "").trim(),
          at: entry?.at || Date.now(),
        };
        if (!row.code) return;
        set((state) => ({
          recentScans: [
            row,
            ...(state.recentScans || []).filter((item) => !(item.code === row.code && item.kind === row.kind)),
          ].slice(0, 10),
        }));
      },
      reset: () => set({ sessionKey: null, depotId: null, depotLabel: "", recentScans: [] }),
    }),
    {
      name: "stokify-terrain",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        sessionKey: s.sessionKey,
        depotId: s.depotId,
        depotLabel: s.depotLabel,
        soundOn: s.soundOn,
        hapticsOn: s.hapticsOn,
        warehouseMode: s.warehouseMode,
      }),
    }
  )
);

/** Purge le dépôt dès que le jeton disparaît (logout, session expirée). */
export function subscribeTerrainAuthReset(onReset) {
  return useAuthStore.subscribe((state, prev) => {
    if (prev?.token && !state.token) {
      useTerrainStore.getState().reset();
      purgerInventaireLocal();
      void purgerFile();
      onReset?.();
    }
  });
}
