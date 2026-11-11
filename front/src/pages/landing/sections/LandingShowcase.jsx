import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLandingLang } from "../LandingLangContext";

const SHOWCASE_IMAGES = [
  "/home-assets/showcase-dashboard.png",
  "/home-assets/showcase-ai.png",
  "/home-assets/showcase-lots.png",
];

/** Isometric 3D bar chart — animated rising bars */
function Chart3DBars({ reduceMotion }) {
  const bars = [
    { id: "b1", face: "#0E7490", side: "#06262e", top: "#2DD4BF", h: 50, delay: 0 },
    { id: "b2", face: "#F97316", side: "#9A3412", top: "#FDBA74", h: 90, delay: 0.15 },
    { id: "b3", face: "#38BDF8", side: "#0C4A6E", top: "#7DD3FC", h: 36, delay: 0.3 },
    { id: "b4", face: "#14B8A6", side: "#134E4A", top: "#5EEAD4", h: 68, delay: 0.45 },
  ];

  return (
    <svg viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Floor */}
      <path
        d="M20 130 L110 170 L200 130 L110 90 Z"
        fill="#0B3A44"
        fillOpacity="0.1"
        stroke="#0B3A44"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      <path
        d="M20 130 L110 170 L200 130"
        stroke="#0B3A44"
        strokeOpacity="0.18"
        strokeWidth="1"
        strokeDasharray="5 5"
      />

      {bars.map((bar, i) => {
        const x = 48 + i * 30;
        const baseY = 128;
        const topY = baseY - bar.h;
        return (
          <motion.g
            key={bar.id}
            initial={reduceMotion ? false : { scaleY: 0.25, opacity: 0.6 }}
            animate={
              reduceMotion
                ? undefined
                : { scaleY: [0.4, 1, 0.78, 1], opacity: 1 }
            }
            style={{
              transformBox: "fill-box",
              transformOrigin: "50% 100%",
            }}
            transition={{
              duration: 2.6,
              delay: bar.delay,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 0.35,
            }}
          >
            <path
              d={`M${x} ${baseY} L${x} ${topY} L${x + 20} ${topY - 10} L${x + 20} ${baseY - 10} Z`}
              fill={bar.face}
            />
            <path
              d={`M${x + 20} ${topY - 10} L${x + 40} ${topY} L${x + 40} ${baseY} L${x + 20} ${baseY - 10} Z`}
              fill={bar.side}
              fillOpacity="0.85"
            />
            <path
              d={`M${x} ${topY} L${x + 20} ${topY - 10} L${x + 40} ${topY} L${x + 20} ${topY + 10} Z`}
              fill={bar.top}
            />
          </motion.g>
        );
      })}
    </svg>
  );
}

/** Isometric donut — clearer slices + spin */
function Chart3DPie({ reduceMotion }) {
  return (
    <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Shadow / base */}
      <ellipse cx="90" cy="98" rx="64" ry="30" fill="#0B3A44" fillOpacity="0.14" />
      {/* Extruded rim */}
      <path
        d="M26 86 A64 30 0 0 0 154 86 L154 102 A64 30 0 0 1 26 102 Z"
        fill="#0B3A44"
        fillOpacity="0.35"
      />
      <path
        d="M26 86 A64 30 0 0 0 90 116 L90 132 A64 30 0 0 1 26 102 Z"
        fill="#F97316"
        fillOpacity="0.55"
      />
      <path
        d="M90 116 A64 30 0 0 0 154 86 L154 102 A64 30 0 0 1 90 132 Z"
        fill="#0284C7"
        fillOpacity="0.5"
      />

      <motion.g
        animate={reduceMotion ? undefined : { rotate: 360 }}
        style={{ transformOrigin: "90px 72px" }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      >
        <ellipse cx="90" cy="72" rx="64" ry="30" fill="#0B3A44" />
        <path d="M90 72 L90 42 A64 30 0 0 1 145 85 Z" fill="#F97316" />
        <path d="M90 72 L145 85 A64 30 0 0 1 50 96 Z" fill="#0B3A44" />
        <path d="M90 72 L50 96 A64 30 0 0 1 90 42 Z" fill="#38BDF8" />
        <ellipse
          cx="90"
          cy="72"
          rx="24"
          ry="11"
          fill="#F8FAFB"
          stroke="#0B3A44"
          strokeOpacity="0.2"
          strokeWidth="1.5"
        />
      </motion.g>
    </svg>
  );
}

/** Line chart with animated stroke draw + pulsing points */
function Chart3DLine({ reduceMotion }) {
  const points = [
    [40, 118],
    [70, 95],
    [100, 105],
    [135, 72],
    [170, 88],
    [200, 58],
  ];
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join(" ");
  const areaPath = `${linePath} L200 100 L40 130 Z`;

  return (
    <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="areaFillDyn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F97316" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#F97316" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="lineStrokeDyn" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0B3A44" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>

      <path
        d="M16 110 L120 150 L224 90 L120 50 Z"
        fill="#0B3A44"
        fillOpacity="0.08"
        stroke="#0B3A44"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
      {[0, 1, 2, 3].map((i) => (
        <line
          key={`h-${i}`}
          x1={16 + i * 26}
          y1={110 - i * 15}
          x2={120 + i * 26}
          y2={150 - i * 15}
          stroke="#0B3A44"
          strokeOpacity="0.12"
        />
      ))}

      <motion.path
        d={areaPath}
        fill="url(#areaFillDyn)"
        initial={reduceMotion ? false : { opacity: 0.35 }}
        animate={reduceMotion ? undefined : { opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.path
        d={linePath}
        stroke="url(#lineStrokeDyn)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={reduceMotion ? undefined : { pathLength: [0, 1, 1, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", times: [0, 0.45, 0.7, 1] }}
      />
      {points.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r="5"
          fill="#fff"
          stroke={i % 2 === 0 ? "#0B3A44" : "#F97316"}
          strokeWidth="2.5"
          animate={
            reduceMotion
              ? undefined
              : { scale: [1, 1.35, 1], opacity: [0.85, 1, 0.85] }
          }
          transition={{
            duration: 1.8,
            delay: i * 0.25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </svg>
  );
}

/** Animated KPI pillars */
function Chart3DPillars({ reduceMotion }) {
  return (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <motion.g
        animate={
          reduceMotion
            ? undefined
            : { scaleY: [0.7, 1, 0.85, 1], y: [8, 0, 4, 0] }
        }
        style={{ transformOrigin: "40px 110px" }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M20 110 L20 55 L40 45 L40 100 Z" fill="#0B3A44" />
        <path d="M40 45 L60 55 L60 110 L40 100 Z" fill="#06262e" fillOpacity="0.85" />
        <path d="M20 55 L40 45 L60 55 L40 65 Z" fill="#2DD4BF" />
      </motion.g>
      <motion.g
        animate={
          reduceMotion
            ? undefined
            : { scaleY: [0.55, 1, 0.75, 1], y: [14, 0, 8, 0] }
        }
        style={{ transformOrigin: "70px 110px" }}
        transition={{ duration: 2.6, delay: 0.35, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M50 110 L50 35 L70 25 L70 100 Z" fill="#F97316" />
        <path d="M70 25 L90 35 L90 110 L70 100 Z" fill="#9A3412" fillOpacity="0.85" />
        <path d="M50 35 L70 25 L90 35 L70 45 Z" fill="#FDBA74" />
      </motion.g>
    </svg>
  );
}

function FloatingCharts({ reduceMotion }) {
  const float = (duration, delay = 0, y = 18, rot = 4) =>
    reduceMotion
      ? undefined
      : {
          y: [0, -y, 0],
          x: [0, 6, 0],
          rotate: [-rot, rot, -rot],
          scale: [1, 1.04, 1],
          transition: {
            duration,
            delay,
            repeat: Infinity,
            ease: "easeInOut",
          },
        };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <style>{`
        @keyframes showcase-grid-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes showcase-scan {
          0% { transform: translateY(-30%) translateX(-10%); opacity: 0; }
          40% { opacity: 0.55; }
          100% { transform: translateY(120%) translateX(10%); opacity: 0; }
        }
      `}</style>

      {/* Atmospheric washes — slightly stronger */}
      <div className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-[#0B3A44]/[0.1] blur-3xl" />
      <div className="absolute -right-24 top-24 h-[26rem] w-[26rem] rounded-full bg-[#F97316]/[0.14] blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-[32rem] rounded-full bg-sky-400/[0.1] blur-3xl" />

      {/* Perspective grid */}
      <div
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(11,58,68,0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(11,58,68,0.09) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage:
            "linear-gradient(to top, rgba(0,0,0,0.65), transparent 85%), linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to top, rgba(0,0,0,0.65), transparent 85%), linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
          transform: "perspective(700px) rotateX(58deg) scale(1.35)",
          transformOrigin: "center bottom",
          animation: reduceMotion ? undefined : "showcase-grid-pulse 4s ease-in-out infinite",
        }}
      />

      {/* Light scan sweep */}
      {!reduceMotion && (
        <div
          className="absolute inset-x-[10%] top-0 h-40 w-[80%] bg-gradient-to-b from-[#F97316]/15 via-transparent to-transparent blur-2xl"
          style={{ animation: "showcase-scan 7s ease-in-out infinite" }}
        />
      )}

      {/* Charts — higher opacity + stronger shadow for clarity */}
      <motion.div
        className="absolute -left-2 top-20 w-[220px] opacity-[0.72] sm:left-4 sm:top-24 sm:w-[270px] sm:opacity-[0.82] lg:left-8 lg:w-[310px]"
        animate={float(7, 0, 20, 3)}
        style={{ filter: "drop-shadow(0 22px 28px rgba(11,58,68,0.28))" }}
      >
        <Chart3DBars reduceMotion={reduceMotion} />
      </motion.div>

      <motion.div
        className="absolute -right-1 top-12 w-[180px] opacity-[0.7] sm:right-6 sm:w-[220px] sm:opacity-[0.8] lg:right-12 lg:w-[250px]"
        animate={float(8.5, 0.4, 16, 5)}
        style={{ filter: "drop-shadow(0 20px 26px rgba(249,115,22,0.28))" }}
      >
        <Chart3DPie reduceMotion={reduceMotion} />
      </motion.div>

      <motion.div
        className="absolute bottom-14 left-[6%] hidden w-[230px] opacity-[0.68] sm:block lg:left-[10%] lg:w-[290px] lg:opacity-[0.78]"
        animate={float(7.5, 0.8, 14, 3)}
        style={{ filter: "drop-shadow(0 18px 24px rgba(11,58,68,0.24))" }}
      >
        <Chart3DLine reduceMotion={reduceMotion} />
      </motion.div>

      <motion.div
        className="absolute bottom-20 right-[4%] hidden w-[130px] opacity-[0.72] md:block lg:right-[12%] lg:w-[155px] lg:opacity-[0.82]"
        animate={float(6.5, 0.2, 22, 4)}
        style={{ filter: "drop-shadow(0 16px 22px rgba(249,115,22,0.26))" }}
      >
        <Chart3DPillars reduceMotion={reduceMotion} />
      </motion.div>

      {/* Data nodes */}
      {!reduceMotion && (
        <>
          {[
            { left: "42%", top: "18%", color: "bg-[#F97316]", size: "h-2.5 w-2.5", d: 2.4 },
            { left: "58%", top: "38%", color: "bg-[#0B3A44]", size: "h-2 w-2", d: 3.1 },
            { left: "28%", top: "62%", color: "bg-sky-400", size: "h-2 w-2", d: 2.8 },
            { left: "72%", top: "58%", color: "bg-[#14B8A6]", size: "h-2 w-2", d: 3.4 },
            { left: "48%", top: "72%", color: "bg-[#F97316]", size: "h-1.5 w-1.5", d: 2.2 },
          ].map((n, i) => (
            <motion.span
              key={i}
              className={`absolute ${n.size} ${n.color} rounded-full shadow-sm`}
              style={{ left: n.left, top: n.top }}
              animate={{
                opacity: [0.35, 1, 0.35],
                scale: [1, 1.7, 1],
                y: [0, -8, 0],
              }}
              transition={{
                duration: n.d,
                delay: i * 0.35,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default function LandingShowcase() {
  const { t } = useLandingLang();
  const reduceMotion = useReducedMotion();
  const items = useMemo(
    () =>
      (t.showcases || []).map((item, i) => ({
        ...item,
        image: SHOWCASE_IMAGES[i] || SHOWCASE_IMAGES[0],
      })),
    [t.showcases]
  );

  return (
    <section
      id="apercu"
      className="relative scroll-mt-28 overflow-hidden bg-[#EEF3F5] py-20 text-slate-900 sm:scroll-mt-32 sm:py-24"
    >
      <FloatingCharts reduceMotion={reduceMotion} />

      {/* Lighter vignette — charts stay readable behind cards */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,transparent_0%,transparent_42%,rgba(238,243,245,0.55)_78%,#EEF3F5_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#EEF3F5] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#EEF3F5] to-transparent" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F97316]">
            {t.showcaseEyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B3A44] sm:text-4xl">
            {t.showcaseTitle}
          </h2>
          <p className="mt-3 text-base text-slate-600">{t.showcaseDesc}</p>
        </motion.div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {items.map((item, i) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
              whileHover={
                reduceMotion
                  ? undefined
                  : { y: -6, transition: { type: "spring", stiffness: 320, damping: 22 } }
              }
              className="group relative overflow-hidden rounded-2xl border border-white/90 bg-white/95 shadow-[0_20px_50px_-24px_rgba(11,58,68,0.4)] backdrop-blur-sm ring-1 ring-[#0B3A44]/10 transition-shadow duration-300 hover:shadow-[0_28px_60px_-20px_rgba(11,58,68,0.45)]"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F97316]/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="aspect-video overflow-hidden bg-[#0B1220]">
                <img
                  src={item.image}
                  alt={item.alt}
                  className="h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  draggable={false}
                />
              </div>
              <div className="p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-[#0B3A44]">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
