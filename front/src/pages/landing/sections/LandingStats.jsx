import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { useLandingLang } from "../LandingLangContext";

const BG_SRC = "/home-assets/stats-architecture-bg.png?v=2";
const TRANSPALETTE_SRC = "/cutouts/transpalette-cutout.png";
/** Orange vif référence camion / bandeau logistics */
const ORANGE_VIF = "#FF5400";

function useCountUp(target, active, duration = 1400) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    if (reduceMotion) {
      setValue(target);
      return;
    }

    let frame;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(target * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target, duration, reduceMotion]);

  return value;
}

/** Transpalette réelle (cutout) — même sens que le marquee (droite → gauche) */
function SmartTranspalette({ reduceMotion }) {
  return (
    <div
      className="relative z-10 overflow-hidden pb-2 pt-1"
      style={{ backgroundColor: ORANGE_VIF }}
    >
      <div className="relative h-[160px] w-full sm:h-[200px] lg:h-[230px]">
        {/* Ligne de parcours */}
        <div className="absolute inset-x-0 top-[78%] border-t-2 border-dashed border-white/45" />

        {!reduceMotion && (
          <div className="pointer-events-none absolute top-[74%] h-2 w-40 -translate-y-1/2 animate-[transpalette-drive_12s_linear_infinite] rounded-full bg-white/35 blur-md" />
        )}

        <div
          className={
            reduceMotion
              ? "absolute bottom-0 left-[35%]"
              : "absolute bottom-0 animate-[transpalette-drive_12s_linear_infinite] will-change-transform"
          }
        >
          <img
            src={TRANSPALETTE_SRC}
            alt="Transpalette électrique"
            className="h-[150px] w-auto -scale-x-100 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)] sm:h-[190px] lg:h-[220px]"
            draggable={false}
          />
        </div>
      </div>

      <style>{`
        /* Même direction que landing-marquee (vers la gauche) */
        @keyframes transpalette-drive {
          from { transform: translateX(105vw); }
          to { transform: translateX(-45vw); }
        }
      `}</style>
    </div>
  );
}

function StatCard({ stat, index, inView }) {
  const target = Number.parseInt(stat.value, 10) || 0;
  const count = useCountUp(target, inView, 1200 + index * 180);
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.1,
      }}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -8, transition: { type: "spring", stiffness: 320, damping: 20 } }
      }
      className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/15 px-6 py-9 text-center shadow-2xl shadow-black/25 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#F97316]/25 blur-3xl transition-opacity duration-500 opacity-50 group-hover:opacity-90" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#F97316]/80 to-transparent" />

      <motion.p
        className="relative text-5xl font-extrabold tracking-tight text-[#F97316] sm:text-6xl"
        animate={
          reduceMotion || !inView
            ? undefined
            : {
                textShadow: [
                  "0 0 0px rgba(249,115,22,0)",
                  "0 0 24px rgba(249,115,22,0.45)",
                  "0 0 0px rgba(249,115,22,0)",
                ],
              }
        }
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: index * 0.3 }}
      >
        {count}
      </motion.p>

      <h3 className="relative mt-4 text-base font-semibold text-white">{stat.label}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-white/80">{stat.detail}</p>

      <motion.div
        className="absolute inset-x-0 bottom-0 h-1 origin-left bg-gradient-to-r from-[#F97316] via-orange-300 to-transparent"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.25 + index * 0.1, ease: "easeOut" }}
      />
    </motion.article>
  );
}

export default function LandingStats() {
  const { t } = useLandingLang();
  const stats = t.stats || [];
  const marquee = t.marquee || [];
  const loop = [...marquee, ...marquee];
  const reduceMotion = useReducedMotion();
  const gridRef = useRef(null);
  const inView = useInView(gridRef, { once: true, amount: 0.35 });

  return (
    <section id="stats" className="relative scroll-mt-28 overflow-hidden text-white sm:scroll-mt-32">
      {/* Fond plus clair */}
      <div className="absolute inset-0">
        <motion.img
          src={BG_SRC}
          alt=""
          className="h-full w-full object-cover brightness-110 contrast-105 saturate-110"
          draggable={false}
          animate={
            reduceMotion
              ? undefined
              : { scale: [1, 1.05, 1], x: ["0%", "-1%", "0%"] }
          }
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-[#06262e]/45" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B3A44]/35 via-[#0B3A44]/25 to-[#06262e]/70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(249,115,22,0.22),transparent_55%)]" />
      </div>

      {!reduceMotion && (
        <>
          <motion.div
            className="pointer-events-none absolute left-[10%] top-24 h-40 w-40 rounded-full bg-[#F97316]/20 blur-3xl"
            animate={{ y: [0, 24, 0], opacity: [0.35, 0.65, 0.35] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="pointer-events-none absolute bottom-40 right-[12%] h-48 w-48 rounded-full bg-orange-300/15 blur-3xl"
            animate={{ y: [0, -20, 0], opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.p
            className="inline-flex items-center gap-2 rounded-full border border-[#F97316]/40 bg-[#F97316]/15 px-3 py-1 text-sm font-semibold uppercase tracking-[0.18em] text-[#FDBA74]"
            animate={
              reduceMotion
                ? undefined
                : {
                    boxShadow: [
                      "0 0 0 rgba(249,115,22,0)",
                      "0 0 22px rgba(249,115,22,0.4)",
                      "0 0 0 rgba(249,115,22,0)",
                    ],
                  }
            }
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            {t.statsEyebrow}
          </motion.p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight drop-shadow-md sm:text-4xl lg:text-[2.75rem]">
            {t.statsTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/90 drop-shadow-sm">
            {t.statsDesc}
          </p>
        </motion.div>

        <div ref={gridRef} className="mt-12 grid gap-5 sm:grid-cols-3">
          {stats.map((stat, i) => (
            <StatCard key={stat.label} stat={stat} index={i} inView={inView} />
          ))}
        </div>
      </div>

      {/* Bandeau orange vif (réf. logistics / camion) */}
      <div
        className="relative z-10 border-y border-white/20 py-4 shadow-inner"
        style={{ backgroundColor: ORANGE_VIF }}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black/20 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black/20 to-transparent" />
        <div className="relative overflow-hidden py-1">
          <div className="flex w-max animate-[landing-marquee_28s_linear_infinite] gap-12 whitespace-nowrap px-4">
            {loop.map((word, i) => (
              <span
                key={`${word}-${i}`}
                className="text-base font-extrabold uppercase tracking-[0.28em] text-white sm:text-lg md:text-xl"
              >
                {word}
                <span className="ml-12 text-white/85">·</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Transpalette intelligente en parcours */}
      <SmartTranspalette reduceMotion={reduceMotion} />

      <style>{`
        @keyframes landing-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
