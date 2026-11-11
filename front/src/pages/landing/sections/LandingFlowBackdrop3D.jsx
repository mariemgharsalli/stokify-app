import { useId, useMemo } from "react";
import { motion } from "framer-motion";
import { projectBox, toSvgPoints } from "../../../utils/isometricEngine";

const ROT_Z = -38;
const TILT_X = 52;

function IsoBox({
  col,
  row,
  size = 1,
  height = 1,
  scale = 28,
  top,
  front,
  side,
  stroke = "rgba(11,58,68,0.18)",
  strokeWidth = 1,
  wire = false,
  opacity = 1,
}) {
  const faces = useMemo(() => {
    const projected = projectBox(col, row, size, height, ROT_Z, TILT_X, scale);
    return projected
      .map((f) => ({
        ...f,
        pts: toSvgPoints(f.points, 0, 0),
        fill: f.face === "top" ? top : f.face === "front" ? front : side,
      }))
      .sort((a, b) => a.depth - b.depth);
  }, [col, row, size, height, scale, top, front, side]);

  return (
    <g opacity={opacity}>
      {faces.map((f) => (
        <polygon
          key={f.face}
          points={f.pts}
          fill={wire ? "none" : f.fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

function FloatingModel({
  children,
  className,
  delay = 0,
  duration = 5.5,
  reduceMotion,
  x = 4,
  amp = 8,
}) {
  return (
    <motion.div
      className={`pointer-events-none absolute ${className}`}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : { y: [0, -amp, 0], x: [0, x, 0] }
        }
        transition={{
          duration,
          delay,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function SoftShadow({ className }) {
  return (
    <div
      className={`absolute rounded-[100%] bg-[#0B3A44]/12 blur-md ${className}`}
      aria-hidden
    />
  );
}

function CubeOrbit({
  className,
  reduceMotion,
  size = 22,
  count = 6,
  radius = 40,
  color = "#0E7490",
  duration = 26,
}) {
  return (
    <div
      className={`absolute [perspective:700px] ${className}`}
      style={{ width: size * 4, height: size * 4 }}
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={
          reduceMotion
            ? undefined
            : { rotateY: 360, rotateX: [10, 16, 10] }
        }
        transition={{
          rotateY: { duration, repeat: Infinity, ease: "linear" },
          rotateX: { duration: 7, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[3px] border"
            style={{
              width: size,
              height: size,
              borderColor: `${color}66`,
              background: `${color}18`,
              boxShadow: `0 0 12px ${color}22`,
              transform: `rotateY(${(360 / count) * i}deg) translateZ(${radius}px)`,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}

/**
 * Dense decorative isometric 3D warehouse scene for LandingFlow.
 */
export default function LandingFlowBackdrop3D({ reduceMotion = false }) {
  const uid = useId().replace(/:/g, "");

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      aria-hidden
    >
      {/* ── Left: pallet + crate tower ── */}
      <FloatingModel
        className="left-[-3%] top-[14%] hidden sm:block md:left-[1%] lg:left-[3%]"
        delay={0.05}
        duration={6.2}
        reduceMotion={reduceMotion}
        x={-3}
        amp={9}
      >
        <div className="relative opacity-70 lg:opacity-85">
          <SoftShadow className="-bottom-1 left-1/2 h-3 w-32 -translate-x-1/2" />
          <svg viewBox="-90 -130 210 210" className="h-40 w-44 drop-shadow-sm lg:h-52 lg:w-56">
            <IsoBox col={0} row={0} size={2.4} height={0.28} scale={26} top="#E8EEF0" front="#C5D0D4" side="#A8B6BB" />
            <IsoBox col={0.1} row={0.1} size={1} height={0.8} scale={26} top="#FFB07A" front="#F97316" side="#EA580C" />
            <IsoBox col={1.2} row={0.15} size={1} height={0.65} scale={26} top="#7DD3C8" front="#0E7490" side="#0B3A44" />
            <IsoBox col={0.45} row={0.35} size={0.95} height={0.9} scale={26} top="#FFE4D1" front="#FB923C" side="#F97316" />
            <IsoBox col={0.35} row={0.2} size={0.7} height={0.55} scale={26} top="#FEF3C7" front="#F59E0B" side="#D97706" opacity={0.95} />
          </svg>
        </div>
      </FloatingModel>

      {/* ── Far left: tall wireframe rack aisle ── */}
      <FloatingModel
        className="left-[-6%] bottom-[16%] hidden lg:block lg:left-0"
        delay={0.2}
        duration={7.4}
        reduceMotion={reduceMotion}
        x={2}
        amp={7}
      >
        <div className="opacity-55 lg:opacity-70">
          <svg viewBox="-80 -160 200 240" className="h-56 w-48 xl:h-64 xl:w-56">
            <IsoBox col={0} row={0} size={2.6} height={0.12} scale={20} top="none" front="none" side="none" wire stroke="rgba(11,58,68,0.4)" strokeWidth={1.4} />
            <IsoBox col={0} row={0} size={2.6} height={1.0} scale={20} top="rgba(14,116,144,0.07)" front="rgba(11,58,68,0.05)" side="rgba(11,58,68,0.08)" stroke="rgba(14,116,144,0.45)" strokeWidth={1.1} />
            <IsoBox col={0} row={0} size={2.6} height={2.0} scale={20} top="rgba(14,116,144,0.05)" front="rgba(11,58,68,0.04)" side="rgba(11,58,68,0.06)" stroke="rgba(14,116,144,0.35)" strokeWidth={1} />
            <IsoBox col={0.15} row={0.2} size={0.7} height={0.5} scale={20} top="#E0F2FE" front="#0E7490" side="#0B3A44" />
            <IsoBox col={1.1} row={0.25} size={0.7} height={0.4} scale={20} top="#FFEDD5" front="#F97316" side="#C2410C" />
            <IsoBox col={0.2} row={0.2} size={0.65} height={0.45} scale={20} top="#CCFBF1" front="#14B8A6" side="#0F766E" opacity={0.9} />
            <IsoBox col={1.15} row={0.3} size={0.6} height={0.55} scale={20} top="#FFE4D1" front="#FB923C" side="#EA580C" opacity={0.9} />
            <IsoBox col={0.7} row={0.15} size={0.55} height={0.35} scale={20} top="#F1F5F9" front="#64748B" side="#475569" />
            <IsoBox col={0} row={0} size={2.6} height={2.9} scale={20} top="none" front="none" side="none" wire stroke="rgba(11,58,68,0.32)" strokeWidth={1.25} />
          </svg>
        </div>
      </FloatingModel>

      {/* ── Mid-left: conveyor / chain of packages ── */}
      <FloatingModel
        className="left-[18%] top-[38%] hidden md:block lg:left-[16%] lg:top-[42%]"
        delay={0.18}
        duration={5.6}
        reduceMotion={reduceMotion}
        x={6}
        amp={6}
      >
        <div className="relative opacity-50 lg:opacity-65">
          <SoftShadow className="-bottom-0 left-1/2 h-2 w-36 -translate-x-1/2" />
          <svg viewBox="-40 -50 220 100" className="h-20 w-48 lg:h-24 lg:w-56">
            <IsoBox col={0} row={0} size={5.2} height={0.18} scale={18} top="#E2E8F0" front="#94A3B8" side="#64748B" stroke="rgba(11,58,68,0.2)" />
            <IsoBox col={0.2} row={0.15} size={0.7} height={0.55} scale={18} top="#FFEDD5" front="#F97316" side="#C2410C" />
            <IsoBox col={1.3} row={0.1} size={0.65} height={0.7} scale={18} top="#E0F2FE" front="#0E7490" side="#0B3A44" />
            <IsoBox col={2.4} row={0.2} size={0.7} height={0.5} scale={18} top="#F1F5F9" front="#334155" side="#1E293B" />
            <IsoBox col={3.5} row={0.12} size={0.6} height={0.65} scale={18} top="#FEF3C7" front="#F59E0B" side="#B45309" />
          </svg>
        </div>
      </FloatingModel>

      {/* ── Left-center: shipping container ── */}
      <FloatingModel
        className="left-[8%] bottom-[8%] hidden xl:block"
        delay={0.35}
        duration={8.2}
        reduceMotion={reduceMotion}
        x={-2}
        amp={5}
      >
        <div className="relative opacity-45 xl:opacity-55">
          <SoftShadow className="-bottom-1 left-1/2 h-2.5 w-40 -translate-x-1/2" />
          <svg viewBox="-70 -70 200 120" className="h-28 w-48">
            <IsoBox col={0} row={0} size={3.2} height={1.15} scale={22} top="#5EEAD4" front="#0F766E" side="#115E59" stroke="rgba(11,58,68,0.25)" strokeWidth={1.2} />
            <IsoBox col={0.15} row={0.15} size={2.9} height={0.12} scale={22} top="rgba(255,255,255,0.25)" front="none" side="none" wire stroke="rgba(255,255,255,0.35)" />
          </svg>
        </div>
      </FloatingModel>

      {/* ── Right: holographic data cube + satellites ── */}
      <FloatingModel
        className="right-[-2%] top-[8%] hidden sm:block md:right-[2%] lg:right-[5%] lg:top-[6%]"
        delay={0.1}
        duration={5.8}
        reduceMotion={reduceMotion}
        x={5}
        amp={10}
      >
        <div className="relative opacity-65 lg:opacity-80">
          <SoftShadow className="-bottom-0 left-1/2 h-2.5 w-24 -translate-x-1/2" />
          <svg viewBox="-90 -120 190 200" className="h-40 w-40 lg:h-52 lg:w-52">
            <defs>
              <linearGradient id={`${uid}-holo-t`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#A5F3FC" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0E7490" stopOpacity="0.35" />
              </linearGradient>
              <linearGradient id={`${uid}-holo-f`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#0B3A44" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <IsoBox
              col={0}
              row={0}
              size={1.7}
              height={1.7}
              scale={30}
              top={`url(#${uid}-holo-t)`}
              front={`url(#${uid}-holo-f)`}
              side="rgba(14,116,144,0.42)"
              stroke="rgba(34,211,238,0.6)"
              strokeWidth={1.5}
            />
            <IsoBox col={0.28} row={0.28} size={1.15} height={1.15} scale={30} top="none" front="none" side="none" wire stroke="rgba(165,243,252,0.75)" strokeWidth={1} />
            {/* satellite cubes */}
            <IsoBox col={2.1} row={0.4} size={0.45} height={0.45} scale={30} top="#A5F3FC" front="#22D3EE" side="#0E7490" stroke="rgba(34,211,238,0.5)" opacity={0.75} />
            <IsoBox col={-0.7} row={1.2} size={0.4} height={0.4} scale={30} top="#FED7AA" front="#F97316" side="#C2410C" stroke="rgba(249,115,22,0.45)" opacity={0.7} />
            <IsoBox col={1.6} row={-0.55} size={0.35} height={0.35} scale={30} top="#CCFBF1" front="#14B8A6" side="#0F766E" stroke="rgba(45,212,191,0.45)" opacity={0.6} />
          </svg>
        </div>
      </FloatingModel>

      {/* ── Far right: KPI 3D bars ── */}
      <FloatingModel
        className="right-[2%] top-[42%] hidden lg:block xl:right-[4%]"
        delay={0.28}
        duration={6.5}
        reduceMotion={reduceMotion}
        x={-3}
        amp={7}
      >
        <div className="relative opacity-55 lg:opacity-70">
          <SoftShadow className="-bottom-0 left-1/2 h-2 w-28 -translate-x-1/2" />
          <svg viewBox="-30 -90 140 140" className="h-32 w-36 xl:h-40 xl:w-44">
            <IsoBox col={0} row={0} size={0.55} height={0.9} scale={26} top="#FFEDD5" front="#F97316" side="#C2410C" />
            <IsoBox col={0.75} row={0} size={0.55} height={1.45} scale={26} top="#E0F2FE" front="#0E7490" side="#0B3A44" />
            <IsoBox col={1.5} row={0} size={0.55} height={1.15} scale={26} top="#FEF3C7" front="#F59E0B" side="#B45309" />
            <IsoBox col={2.25} row={0} size={0.55} height={1.75} scale={26} top="#CCFBF1" front="#14B8A6" side="#0F766E" />
            <IsoBox col={0} row={0} size={2.9} height={0.12} scale={26} top="#F1F5F9" front="#CBD5E1" side="#94A3B8" />
          </svg>
        </div>
      </FloatingModel>

      {/* ── Mid-right: crate cluster ── */}
      <FloatingModel
        className="right-[10%] bottom-[14%] hidden md:block lg:right-[16%] lg:bottom-[16%]"
        delay={0.22}
        duration={6.8}
        reduceMotion={reduceMotion}
        x={-4}
        amp={8}
      >
        <div className="relative opacity-60 lg:opacity-75">
          <SoftShadow className="-bottom-1 left-1/2 h-2.5 w-28 -translate-x-1/2" />
          <svg viewBox="-70 -100 170 160" className="h-32 w-36 lg:h-40 lg:w-44">
            <IsoBox col={0} row={0} size={1.15} height={0.8} scale={28} top="#F1F5F9" front="#0B3A44" side="#134E5A" />
            <IsoBox col={1.25} row={0.1} size={0.9} height={1.1} scale={28} top="#FED7AA" front="#F97316" side="#C2410C" />
            <IsoBox col={0.35} row={0.9} size={0.75} height={0.55} scale={28} top="#A5F3FC" front="#06B6D4" side="#0E7490" />
            <IsoBox col={1.4} row={0.95} size={0.65} height={0.4} scale={28} top="#FEF3C7" front="#EAB308" side="#A16207" />
          </svg>
        </div>
      </FloatingModel>

      {/* ── Right-lower: tablet / dashboard slab ── */}
      <FloatingModel
        className="right-[28%] bottom-[6%] hidden xl:block"
        delay={0.4}
        duration={7.1}
        reduceMotion={reduceMotion}
        x={3}
        amp={6}
      >
        <div className="relative opacity-50">
          <SoftShadow className="-bottom-0 left-1/2 h-2 w-24 -translate-x-1/2" />
          <svg viewBox="-50 -40 140 100" className="h-24 w-32">
            <IsoBox col={0} row={0} size={2.4} height={0.18} scale={24} top="#1E293B" front="#0F172A" side="#020617" stroke="rgba(14,116,144,0.35)" />
            <IsoBox col={0.15} row={0.12} size={2.1} height={0.08} scale={24} top="#22D3EE" front="#0E7490" side="#155E75" opacity={0.55} />
            <IsoBox col={0.4} row={0.25} size={0.35} height={0.55} scale={24} top="#F97316" front="#EA580C" side="#C2410C" opacity={0.8} />
            <IsoBox col={0.9} row={0.25} size={0.35} height={0.75} scale={24} top="#67E8F9" front="#06B6D4" side="#0E7490" opacity={0.8} />
            <IsoBox col={1.4} row={0.25} size={0.35} height={0.45} scale={24} top="#FDE68A" front="#F59E0B" side="#B45309" opacity={0.8} />
          </svg>
        </div>
      </FloatingModel>

      {/* ── Top-center: accent cubes constellation ── */}
      <FloatingModel
        className="left-[38%] top-[4%] hidden lg:block"
        delay={0.3}
        duration={7.8}
        reduceMotion={reduceMotion}
        x={5}
        amp={9}
      >
        <div className="opacity-45 lg:opacity-55">
          <svg viewBox="-80 -70 180 120" className="h-20 w-36 xl:h-24 xl:w-44">
            <IsoBox col={0} row={0} size={0.85} height={0.85} scale={22} top="rgba(249,115,22,0.3)" front="rgba(249,115,22,0.5)" side="rgba(194,65,12,0.55)" stroke="rgba(249,115,22,0.55)" strokeWidth={1.2} />
            <IsoBox col={1.4} row={0.3} size={0.55} height={0.55} scale={22} top="rgba(14,116,144,0.3)" front="rgba(14,116,144,0.5)" side="rgba(11,58,68,0.55)" stroke="rgba(34,211,238,0.45)" />
            <IsoBox col={2.4} row={-0.1} size={0.4} height={0.4} scale={22} top="rgba(20,184,166,0.3)" front="rgba(20,184,166,0.5)" side="rgba(15,118,110,0.55)" stroke="rgba(45,212,191,0.4)" />
            <IsoBox col={0.9} row={1.1} size={0.35} height={0.35} scale={22} top="rgba(251,146,60,0.35)" front="rgba(251,146,60,0.55)" side="rgba(234,88,12,0.5)" stroke="rgba(251,146,60,0.45)" />
          </svg>
        </div>
      </FloatingModel>

      {/* ── Center-back: pyramid stack ── */}
      <FloatingModel
        className="left-[46%] bottom-[28%] hidden xl:block"
        delay={0.45}
        duration={8.5}
        reduceMotion={reduceMotion}
        x={-5}
        amp={7}
      >
        <div className="relative opacity-40 xl:opacity-50">
          <SoftShadow className="-bottom-1 left-1/2 h-2 w-20 -translate-x-1/2" />
          <svg viewBox="-60 -90 140 140" className="h-28 w-28">
            <IsoBox col={0} row={0} size={0.8} height={0.55} scale={24} top="#FFEDD5" front="#F97316" side="#C2410C" />
            <IsoBox col={0.9} row={0} size={0.8} height={0.55} scale={24} top="#E0F2FE" front="#0E7490" side="#0B3A44" />
            <IsoBox col={0.45} row={0.35} size={0.75} height={0.7} scale={24} top="#F1F5F9" front="#475569" side="#334155" />
          </svg>
        </div>
      </FloatingModel>

      {/* ── CSS 3D orbits ── */}
      <CubeOrbit
        className="left-[10%] top-[52%] hidden opacity-40 lg:block"
        reduceMotion={reduceMotion}
        size={18}
        count={6}
        radius={38}
        color="#0E7490"
        duration={28}
      />
      <CubeOrbit
        className="right-[22%] top-[22%] hidden opacity-35 xl:block"
        reduceMotion={reduceMotion}
        size={14}
        count={5}
        radius={32}
        color="#F97316"
        duration={22}
      />
      <CubeOrbit
        className="left-[30%] bottom-[10%] hidden opacity-30 2xl:block"
        reduceMotion={reduceMotion}
        size={12}
        count={8}
        radius={28}
        color="#14B8A6"
        duration={32}
      />

      {/* Soft vignette — lighter so more models stay visible */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(255,255,255,0.35)_82%,rgba(255,255,255,0.7)_100%)]" />
    </div>
  );
}
