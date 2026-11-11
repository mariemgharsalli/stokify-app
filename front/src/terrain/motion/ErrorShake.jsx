import { motion, useReducedMotion } from "framer-motion";
import { shakeAnimate, shakeTransition } from "./presets";

export default function ErrorShake({ active = false, children }) {
  const reduce = useReducedMotion();
  return (
    <motion.div animate={shakeAnimate(Boolean(reduce), active)} transition={shakeTransition(Boolean(reduce))}>
      {children}
    </motion.div>
  );
}
