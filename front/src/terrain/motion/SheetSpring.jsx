import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { fr } from "../strings/fr";
import { sheetMotion, shouldDismissSheet } from "./presets";

function focusable(root) {
  if (!root) return [];
  return [...root.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
    (node) => !node.disabled && node.getAttribute("aria-hidden") !== "true"
  );
}

export default function SheetSpring({ title, onClose, children, rootClass = "" }) {
  const reduce = useReducedMotion();
  const motionProps = sheetMotion(Boolean(reduce));
  const frameRef = useRef(null);

  useEffect(() => {
    const frame = frameRef.current;
    const previous = document.activeElement;
    focusable(frame)[0]?.focus();
    function onKey(event) {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable(frame);
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

  const ui = (
    <div className={`terrain-sheet-root${rootClass ? ` ${rootClass}` : ""}`}>
      <button type="button" className="terrain-sheet-backdrop" aria-label={fr.close} onClick={onClose} />
      <div ref={frameRef} role="dialog" aria-modal="true" aria-label={title} className="terrain-sheet-frame">
        <motion.div
          className="terrain-sheet-panel"
          drag={reduce ? false : "y"}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={(_, info) => {
            if (shouldDismissSheet(info?.offset?.y, info?.velocity?.y)) onClose?.();
          }}
          {...motionProps}
        >
          <button type="button" className="terrain-sheet-handle" aria-label={fr.sheetHandle} onClick={onClose} />
          <div className="terrain-sheet-body">{children}</div>
        </motion.div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return ui;
  return createPortal(ui, document.body);
}
