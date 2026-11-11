import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";

/** True une fois la persistance Zustand (« stokify-auth ») relue depuis le stockage. */
export function useAuthPersistHydrated() {
  const [ready, setReady] = useState(() =>
    typeof useAuthStore.persist?.hasHydrated === "function" ? useAuthStore.persist.hasHydrated() : true
  );

  useEffect(() => {
    if (typeof useAuthStore.persist?.hasHydrated === "function" && useAuthStore.persist.hasHydrated()) {
      setReady(true);
      return undefined;
    }
    if (typeof useAuthStore.persist?.onFinishHydration !== "function") {
      setReady(true);
      return undefined;
    }
    return useAuthStore.persist.onFinishHydration(() => setReady(true));
  }, []);

  return ready;
}
