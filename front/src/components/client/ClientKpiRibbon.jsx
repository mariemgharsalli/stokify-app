import { useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

const EASE = [0.16, 1, 0.3, 1];

function KpiTile({ item, index, reduce }) {
  const Icon = item.icon;
  const accent = item.accent || "#0E7490";
  const ref = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), {
    stiffness: 200,
    damping: 20,
  });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), {
    stiffness: 200,
    damping: 20,
  });
  const glareX = useTransform(mx, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(my, [-0.5, 0.5], [0, 100]);
  const glare = useMotionTemplate`radial-gradient(280px circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.55), transparent 55%)`;

  const onMove = (e) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="client-kpi-ribbon__perspective"
      style={{ perspective: 1200 }}
    >
      <motion.div
        className="client-kpi-ribbon__tile"
        initial={reduce ? false : { opacity: 0, y: 22, rotateX: 12 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ delay: 0.08 + index * 0.07, duration: 0.5, ease: EASE }}
        style={
          reduce
            ? undefined
            : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }
        }
        whileHover={reduce ? undefined : { y: -6, scale: 1.02 }}
      >
        <motion.div
          className="client-kpi-ribbon__glare"
          style={{ background: reduce ? undefined : glare }}
          aria-hidden
        />

        <span
          className="client-kpi-ribbon__accent"
          style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }}
          aria-hidden
        />

        <div
          className="client-kpi-ribbon__edge"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          }}
          aria-hidden
        />

        <motion.div
          className="client-kpi-ribbon__icon"
          style={{
            color: accent,
            background: `color-mix(in srgb, ${accent} 18%, transparent)`,
            boxShadow: `0 10px 22px -12px ${accent}`,
            transformStyle: "preserve-3d",
          }}
          animate={
            reduce
              ? undefined
              : { y: [0, -4, 0], rotateY: [-8, 8, -8] }
          }
          transition={{
            duration: 3.6 + index * 0.3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.2,
          }}
        >
          {Icon ? <Icon className="h-4 w-4" /> : null}
        </motion.div>

        <div className="min-w-0 relative z-[1]">
          <motion.p
            className="client-kpi-ribbon__value"
            key={item.value}
            initial={reduce ? false : { opacity: 0.4, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {item.value}
          </motion.p>
          <p className="client-kpi-ribbon__label">{item.label}</p>
        </div>

        <span
          className="client-kpi-ribbon__orb"
          style={{
            background: `radial-gradient(circle, ${accent}33, transparent 70%)`,
          }}
          aria-hidden
        />
      </motion.div>
    </div>
  );
}

/**
 * Bandeau KPI 3D / glass tilt — catalogue / panier / commandes / favoris.
 */
export default function ClientKpiRibbon({ items = [], className = "" }) {
  const reduce = useReducedMotion();
  if (!items.length) return null;

  return (
    <div className={`client-kpi-ribbon ${className}`.trim()}>
      {items.map((item, i) => (
        <KpiTile key={item.label} item={item} index={i} reduce={reduce} />
      ))}
    </div>
  );
}
