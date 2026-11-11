export function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

export function pageEnter(reduce) {
  if (reduce) return { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } };
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.24, ease: "easeOut" },
  };
}

export function ringMotion(reduce, progress) {
  const pathLength = clamp01(progress);
  if (reduce) return { initial: false, animate: { pathLength }, transition: { duration: 0 } };
  return {
    initial: { pathLength: 0 },
    animate: { pathLength },
    transition: { duration: 0.32, ease: "easeOut" },
  };
}

export function checkDraw(reduce) {
  if (reduce) return { initial: false, animate: { pathLength: 1, opacity: 1 }, transition: { duration: 0 } };
  return {
    initial: { pathLength: 0, opacity: 0, scale: 0.96 },
    animate: { pathLength: 1, opacity: 1, scale: 1 },
    transition: { type: "spring", stiffness: 380, damping: 32 },
  };
}

export function shakeAnimate(reduce, active) {
  if (reduce || !active) return { opacity: 1 };
  return { x: [0, -8, 8, -5, 0] };
}

export function shakeTransition(reduce) {
  if (reduce) return { duration: 0 };
  return { duration: 0.28, ease: "easeOut" };
}

export function sheetMotion(reduce) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.08 },
    };
  }
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 16 },
    transition: { type: "spring", stiffness: 380, damping: 32 },
  };
}

export function shouldDismissSheet(offsetY, velocityY) {
  return Number(offsetY) > 120 || Number(velocityY) > 800;
}

export function shouldCommitSwipe(offsetX, velocityX) {
  return Number(offsetX) < -72 || Number(velocityX) < -800;
}

export function stepMotion(reduce, active) {
  if (reduce || !active) return { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } };
  return {
    initial: { opacity: 0, scale: 0.94 },
    animate: { opacity: 1, scale: 1 },
    transition: { type: "spring", stiffness: 380, damping: 32 },
  };
}

export function staggerItem(reduce, index) {
  if (reduce || index >= 8) return { initial: false, animate: { opacity: 1 }, transition: { duration: 0, delay: 0 } };
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, ease: "easeOut", delay: index * 0.04 },
  };
}

function hasShift(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return ["x", "y", "scale"].some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

export function motionShifts(preset) {
  return hasShift(preset.initial) || hasShift(preset.animate) || hasShift(preset.exit);
}
