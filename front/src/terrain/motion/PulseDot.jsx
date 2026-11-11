import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export default function PulseDot({ tone = "live", label }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (reduce || tone !== "alert") return undefined;
    const node = ref.current;
    if (!node || typeof IntersectionObserver !== "function") return undefined;
    const sync = (offScreen) => setHidden(document.hidden || offScreen);
    const observer = new IntersectionObserver(([entry]) => {
      sync(!entry?.isIntersecting);
    });
    observer.observe(node);
    const onVisibility = () => sync(false);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduce, tone]);

  const still = Boolean(reduce) || tone !== "alert" || hidden;
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <span ref={ref} className={still ? "terrain-pulse is-still" : "terrain-pulse"} data-tone={tone} aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}
