import { useToastStore } from "../store/toastStore";

export function useToast() {
  const pushToast = useToastStore((s) => s.pushToast);
  return {
    success: (msg) => pushToast(msg, "success"),
    error: (msg) => pushToast(msg, "error", { persistent: true }),
    warning: (msg) => pushToast(msg, "warning"),
  };
}
