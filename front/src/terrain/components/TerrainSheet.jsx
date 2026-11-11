import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { fr } from "../strings/fr";

function focusable(root) {
  if (!root) return [];
  return [...root.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
    (node) => !node.disabled && node.getAttribute("aria-hidden") !== "true"
  );
}

export default function TerrainSheet({ title, onClose, children }) {
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const previous = document.activeElement;
    const panel = panelRef.current;
    focusable(panel)[0]?.focus();
    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable(panel);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  function onPointerDown(event) {
    dragRef.current = event.clientY;
  }

  function onPointerUp(event) {
    const start = dragRef.current;
    dragRef.current = null;
    if (start == null) return;
    if (event.clientY - start > 72) onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label={fr.close} onClick={onClose} />
      <motion.div
        className="relative z-10 flex max-h-[88dvh] w-full flex-col"
        initial={reduceMotion ? false : { y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.22 }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="flex max-h-[88dvh] flex-col overflow-hidden rounded-t-3xl border border-border bg-card-bg text-text-main"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            type="button"
            aria-label={fr.sheetHandle}
            className="flex min-h-12 w-full items-center justify-center touch-manipulation"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onClick={onClose}
          >
            <span className="h-1.5 w-12 rounded-full bg-border" />
          </button>
          <div className="overflow-y-auto px-4 pb-4">{children}</div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
