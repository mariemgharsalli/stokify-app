let started = false;
let notifyRefresh = null;
let applyUpdate = null;

/**
 * Enregistre le service worker uniquement en production, et uniquement depuis Terrain.
 * La mise à jour est proposée, jamais appliquée toute seule.
 * Un second appel (remontage du layout) ne réenregistre pas : il remplace seulement le callback.
 */
export function registerTerrainSW({ onNeedRefresh } = {}) {
  if (onNeedRefresh) notifyRefresh = onNeedRefresh;
  if (applyUpdate && notifyRefresh) notifyRefresh(applyUpdate);
  if (!import.meta.env.PROD || started) return;
  started = true;
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          applyUpdate = () => updateSW(true);
          notifyRefresh?.(applyUpdate);
        },
      });
    })
    .catch(() => {
      /* service worker indisponible : l'app reste utilisable en ligne */
    });
}
