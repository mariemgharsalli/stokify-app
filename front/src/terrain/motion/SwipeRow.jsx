import { motion, useReducedMotion } from "framer-motion";
import { shouldCommitSwipe } from "./presets";

export default function SwipeRow({ enabled = true, actionLabel, onAction, children }) {
  const reduce = useReducedMotion();
  const rtl = typeof document !== "undefined" && document.documentElement.getAttribute("dir") === "rtl";
  const canDrag = enabled && !reduce;

  function commit(_event, info) {
    const offset = rtl ? -Number(info?.offset?.x) : Number(info?.offset?.x);
    const velocity = rtl ? -Number(info?.velocity?.x) : Number(info?.velocity?.x);
    if (shouldCommitSwipe(offset, velocity)) onAction?.();
  }

  return (
    <div className="terrain-swipe">
      {enabled ? (
        <button type="button" className="terrain-swipe-action" tabIndex={-1} aria-hidden="true" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
      {canDrag ? (
        <motion.div
          className="terrain-swipe-face"
          drag="x"
          dragConstraints={rtl ? { left: 0, right: 96 } : { left: -96, right: 0 }}
          dragElastic={0.06}
          dragSnapToOrigin
          onDragEnd={commit}
        >
          {children}
        </motion.div>
      ) : (
        <div className="terrain-swipe-face">{children}</div>
      )}
    </div>
  );
}
