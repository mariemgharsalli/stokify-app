import { motion, useReducedMotion } from "framer-motion";
import { pageEnter } from "./presets";

export default function PageTransition({ pageKey, children }) {
  const reduce = useReducedMotion();
  return (
    <motion.div key={pageKey} {...pageEnter(Boolean(reduce))}>
      {children}
    </motion.div>
  );
}
