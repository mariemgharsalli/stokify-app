import { useReducedMotion } from "framer-motion";

export default function Skeleton({ className = "" }) {
  const reduce = useReducedMotion();
  return <span className={`terrain-skeleton${reduce ? " is-still" : ""} ${className}`.trim()} aria-hidden="true" />;
}
