import { motion, useReducedMotion } from "framer-motion";

const GOLD = "#D4A017";
const CYAN = "#0EA5E9";
const VIOLET = "#7F77DD";
const BRAIN_SRC = "/cutouts/ia-brain-cutout.png";
const CORE_SRC = "/cutouts/ia-core-cutout.png";

const LIFT_EASE = [0.16, 1, 0.3, 1];

function DepthHead({ src, height, accent, reduceMotion }) {
  const layers = [0, 7, 14, 22];
  return (
    <div
      className="relative"
      style={{
        height,
        width: height * 0.88,
        transformStyle: "preserve-3d",
      }}
    >
      {layers.map((z, i) => (
        <motion.div
          key={z}
          className="absolute inset-0"
          animate={
            reduceMotion || i === 0
              ? { z }
              : { y: [0, -(3 + i * 2.4), 0], z }
          }
          transition={{
            duration: 5.4 + i * 0.45,
            delay: i * 0.14,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain object-bottom"
            style={{
              opacity: i === 0 ? 1 : Math.max(0.08, 0.22 - i * 0.04),
              filter:
                i === 0
                  ? `drop-shadow(0 18px 28px ${accent}55) drop-shadow(0 0 20px ${GOLD}44)`
                  : "blur(0.35px)",
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

function RisePlane({ width, color, delay, duration, reduceMotion }) {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 bottom-[14%] h-[2px] rounded-full"
      style={{
        width,
        marginLeft: -width / 2,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        boxShadow: `0 0 14px ${color}aa, 0 0 2px ${color}`,
      }}
      animate={
        reduceMotion
          ? undefined
          : { y: [10, -138], opacity: [0, 0.95, 0], scaleX: [0.42, 1.05, 0.62] }
      }
      transition={{ duration, delay, repeat: Infinity, ease: [0.22, 1, 0.28, 1] }}
    />
  );
}

function RiseFilament({ left, color, delay, height, reduceMotion }) {
  return (
    <motion.span
      className="pointer-events-none absolute bottom-[16%] origin-bottom rounded-full"
      style={{
        left,
        width: 1.5,
        height,
        background: `linear-gradient(to top, ${color}, transparent)`,
        boxShadow: `0 0 10px ${color}99`,
      }}
      animate={
        reduceMotion
          ? undefined
          : { scaleY: [0.12, 1, 0.18], opacity: [0, 0.8, 0], y: [4, -22, -10] }
      }
      transition={{
        duration: 2.9,
        delay,
        repeat: Infinity,
        ease: [0.16, 1, 0.3, 1],
      }}
    />
  );
}

function RiseSpark({ left, color, delay, duration, size = 4, reduceMotion }) {
  return (
    <motion.span
      className="pointer-events-none absolute bottom-[16%] block rounded-full"
      style={{
        left,
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 10px ${color}, 0 0 16px ${color}88`,
      }}
      animate={reduceMotion ? undefined : { y: [8, -152], opacity: [0, 1, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: [0.22, 1, 0.28, 1] }}
    />
  );
}

function CoreFigure({ pulse = 50, reduceMotion }) {
  const hot = pulse >= 70;
  const accent = hot ? "#E24B4A" : CYAN;
  const height = 148;

  return (
    <div className="relative z-[4] flex flex-col items-center" style={{ width: height * 0.92 }}>
      <div
        className="relative flex items-end justify-center"
        style={{
          height: height + 28,
          perspective: 1100,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          className="pointer-events-none absolute bottom-[12%] left-1/2 h-6 w-[70%] -translate-x-1/2 rounded-[100%] blur-md"
          style={{ background: `${accent}66` }}
          aria-hidden
        />
        <div className="ia-core-plinth pointer-events-none absolute bottom-[8%] left-1/2 w-[62%] -translate-x-1/2" />
        <div className="ia-core-lift-beam pointer-events-none absolute bottom-[10%] left-1/2 h-[72%] w-8 -translate-x-1/2" />

        <RiseFilament left="34%" color={GOLD} delay={0.15} height={height * 0.72} reduceMotion={reduceMotion} />
        <RiseFilament left="50%" color={accent} delay={0.75} height={height * 0.86} reduceMotion={reduceMotion} />
        <RiseFilament left="64%" color={VIOLET} delay={1.35} height={height * 0.64} reduceMotion={reduceMotion} />
        <RisePlane width={height * 0.92} color={accent} delay={0} duration={3.4} reduceMotion={reduceMotion} />
        <RisePlane width={height * 0.7} color={GOLD} delay={1.1} duration={3.9} reduceMotion={reduceMotion} />
        <RisePlane width={height * 0.48} color={VIOLET} delay={2.05} duration={3.1} reduceMotion={reduceMotion} />
        <RiseSpark left="28%" color={GOLD} delay={0.2} duration={2.7} reduceMotion={reduceMotion} />
        <RiseSpark left="68%" color={CYAN} delay={0.9} duration={3.1} size={3} reduceMotion={reduceMotion} />
        <RiseSpark left="48%" color={VIOLET} delay={1.6} duration={2.4} size={3} reduceMotion={reduceMotion} />

        <motion.div
          className="relative z-[2]"
          style={{ transformStyle: "preserve-3d" }}
          initial={reduceMotion ? false : { y: 52, opacity: 0, filter: "blur(10px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.15, delay: 0.06, ease: LIFT_EASE }}
        >
          <motion.div
            style={{ transformStyle: "preserve-3d" }}
            animate={reduceMotion ? undefined : { y: [0, -16, -6, -18, 0] }}
            transition={{ duration: 7.2, delay: 1.05, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              className="ia-holo-scan relative overflow-hidden"
              initial={reduceMotion ? false : { clipPath: "inset(100% 0 0 0)" }}
              animate={{ clipPath: "inset(0% 0 0 0)" }}
              transition={{ duration: 1.25, delay: 0.1, ease: LIFT_EASE }}
            >
              <DepthHead src={CORE_SRC} height={height} accent={accent} reduceMotion={reduceMotion} />
            </motion.div>
            <img
              src={CORE_SRC}
              alt=""
              draggable={false}
              aria-hidden
              className="pointer-events-none mx-auto mt-[-4px] block origin-top object-contain object-top opacity-[0.28]"
              style={{
                height: height * 0.22,
                transform: "scaleY(-1)",
                maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 80%)",
                WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 80%)",
                filter: "blur(0.5px)",
              }}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function GyroArc({ size, color, tilt, duration, reverse = false, delay = 0, reduceMotion }) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        transform: `rotateX(${tilt}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      <motion.div
        className="h-full w-full rounded-full"
        style={{
          borderTop: `1.5px solid ${color}`,
          borderRight: `1.5px solid ${color}66`,
          borderBottom: "1.5px solid transparent",
          borderLeft: "1.5px solid transparent",
          boxShadow: `0 0 12px ${color}40`,
        }}
        animate={reduceMotion ? undefined : { rotate: reverse ? -360 : 360 }}
        transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

/** Cerveau IA 3D — icône du bandeau, à gauche du titre. */
function BrainMark({ pulse = 50, reduceMotion }) {
  const hot = pulse >= 70;
  const accent = hot ? "#E24B4A" : CYAN;

  return (
    <div
      className="ia-brain-mark relative flex h-full w-full items-center justify-center"
      style={{ perspective: 920, transformStyle: "preserve-3d" }}
    >
      <div
        className="pointer-events-none absolute inset-[6%] rounded-full opacity-80 blur-md"
        style={{ background: `radial-gradient(circle at 50% 42%, ${accent}66, ${GOLD}22 55%, transparent 72%)` }}
        aria-hidden
      />

      <GyroArc size={62} color={accent} tilt={72} duration={7.2} reduceMotion={reduceMotion} />
      <GyroArc size={54} color={GOLD} tilt={-58} duration={9.4} reverse delay={0.2} reduceMotion={reduceMotion} />
      <GyroArc size={46} color={VIOLET} tilt={18} duration={11.5} reverse delay={0.45} reduceMotion={reduceMotion} />

      <motion.div
        className="relative z-[2]"
        style={{ transformStyle: "preserve-3d", width: 58, height: 58 }}
        initial={reduceMotion ? false : { opacity: 0, rotateY: -28, y: 10 }}
        animate={{ opacity: 1, rotateY: 0, y: 0 }}
        transition={{ duration: 0.95, ease: LIFT_EASE }}
      >
        <motion.div
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={
            reduceMotion
              ? undefined
              : {
                  rotateY: [-18, 20, -8, 16, -18],
                  rotateX: [10, 16, 7, 14, 10],
                  rotateZ: [-4, 5, -2, 4, -4],
                  y: [0, -3, 0, -4, 0],
                }
          }
          transition={{ duration: 10.5, delay: 0.7, repeat: Infinity, ease: "easeInOut" }}
        >
          <img
            src={BRAIN_SRC}
            alt=""
            draggable={false}
            className="relative z-[1] h-full w-full object-contain"
            style={{
              filter: `drop-shadow(0 8px 14px ${accent}77) drop-shadow(0 0 12px ${GOLD}55)`,
            }}
          />
          <img
            src={BRAIN_SRC}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-35"
            style={{ transform: "translateZ(10px)", filter: "blur(0.2px)" }}
          />
          <motion.span
            className="pointer-events-none absolute inset-[8%] rounded-full"
            style={{
              background:
                "conic-gradient(from 200deg, transparent 0%, rgba(255,255,255,0.0) 42%, rgba(212,160,23,0.42) 50%, rgba(14,165,233,0.28) 56%, transparent 68%)",
              mixBlendMode: "screen",
            }}
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 5.8, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function ModuleIACore3D({ compact = false, pulse = 50 }) {
  const reduceMotion = useReducedMotion();
  if (compact) {
    return <BrainMark pulse={pulse} reduceMotion={reduceMotion} />;
  }
  return <ModuleIACoreScene pulse={pulse} />;
}

/** Hologramme copilote — ia-core uniquement, projection bas → haut. */
export function ModuleIACoreScene({ pulse = 50 }) {
  const reduceMotion = useReducedMotion();
  const glow = Math.min(100, Math.max(20, Number(pulse) || 50));
  const hot = glow >= 70;
  const accent = hot ? "#E24B4A" : CYAN;

  return (
    <div className="ia-core-scene relative h-full w-full" aria-hidden>
      <div
        className="pointer-events-none absolute inset-0 opacity-55 blur-3xl"
        style={{
          background: `radial-gradient(circle at 48% 62%, ${accent}38, transparent 58%), radial-gradient(circle at 78% 38%, ${GOLD}24, transparent 50%)`,
        }}
      />

      <svg
        className="pointer-events-none absolute inset-x-[10%] bottom-[16%] h-[38%] w-[80%] opacity-60"
        viewBox="0 0 320 120"
        preserveAspectRatio="none"
      >
        {[28, 52, 76, 100].map((y) => (
          <ellipse
            key={y}
            cx="160"
            cy={y}
            rx={38 + y * 1.15}
            ry={7 + y * 0.04}
            fill="none"
            stroke={accent}
            strokeOpacity={y === 76 ? 0.38 : 0.16}
            strokeWidth="1"
          />
        ))}
        {[70, 110, 160, 210, 250].map((x) => (
          <line
            key={x}
            x1="160"
            y1="18"
            x2={x}
            y2="112"
            stroke={x === 160 ? GOLD : accent}
            strokeOpacity={x === 160 ? 0.28 : 0.12}
            strokeWidth="1"
          />
        ))}
      </svg>

      <div className="absolute inset-x-0 bottom-[4%] z-[4] flex justify-center">
        <CoreFigure pulse={glow} reduceMotion={reduceMotion} />
      </div>

      <div className="absolute bottom-0 left-1/2 z-[6] w-[140px] -translate-x-1/2 text-center">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
          Noyau neural
        </p>
        <p className="mt-0.5 font-mono text-[9px] text-[var(--text-muted)]">Copilote 3D · WMS</p>
      </div>
    </div>
  );
}
