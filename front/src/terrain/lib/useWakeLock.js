import { useEffect } from "react";

/** Maintient l'écran allumé pendant le scan. No-op si l'API est absente (iOS Safari). */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    if (typeof navigator === "undefined" || !navigator.wakeLock?.request) return undefined;

    let sentinel = null;
    let cancelled = false;

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock?.release?.();
          return;
        }
        sentinel = lock;
      } catch {
        /* refus ou API indisponible */
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const current = sentinel;
      sentinel = null;
      current?.release?.()?.catch?.(() => {});
    };
  }, [active]);
}
