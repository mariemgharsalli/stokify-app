import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  PackageCheck,
  Warehouse,
  ArrowLeftRight,
  LineChart,
} from "lucide-react";
import { useLandingLang } from "../LandingLangContext";
import LandingFlowBackdrop3D from "./LandingFlowBackdrop3D";

const STEP_ICONS = [PackageCheck, Warehouse, ArrowLeftRight, LineChart];
const STEP_ACCENTS = ["#F97316", "#0B3A44", "#0E7490", "#EA580C"];
const MAGASINIER_SRC = "/cutouts/magasinier-tablette-ia-cutout.png?v=5";

export default function LandingFlow() {
  const { t, lang } = useLandingLang();
  const reduceMotion = useReducedMotion();
  const isRtl = lang === "ar";

  const steps = useMemo(
    () =>
      (t.flowSteps || []).map((step, i) => ({
        ...step,
        icon: STEP_ICONS[i] || PackageCheck,
        accent: STEP_ACCENTS[i] || STEP_ACCENTS[0],
      })),
    [t.flowSteps]
  );

  return (
    <section
      id="parcours"
      className="relative scroll-mt-28 overflow-x-hidden bg-white text-slate-900 sm:scroll-mt-32"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Wave transition from dark CTA — below the tablet so it never crops the cutout */}
      <div className="pointer-events-none absolute inset-x-0 -top-px z-[1] leading-[0]">
        <svg
          viewBox="0 0 1440 96"
          preserveAspectRatio="none"
          className="block h-14 w-full sm:h-20 lg:h-24"
          aria-hidden
        >
          <path
            d="M0,64 C240,112 480,0 720,32 C960,64 1200,112 1440,40 L1440,96 L0,96 Z"
            fill="#ffffff"
          />
          <path
            d="M0,72 C280,120 520,16 760,48 C1000,80 1240,108 1440,52"
            fill="none"
            stroke="#F97316"
            strokeOpacity="0.35"
            strokeWidth="2"
          />
        </svg>
      </div>

      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #0B3A44 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-32 top-16 z-0 h-[28rem] w-[28rem] rounded-full bg-[#F97316]/[0.12] blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-32 z-0 h-[22rem] w-[22rem] rounded-full bg-[#0E7490]/[0.10] blur-3xl" />
      <div className="pointer-events-none absolute bottom-24 left-1/3 z-0 h-64 w-64 rounded-full bg-[#0B3A44]/[0.06] blur-3xl" />

      {/* Decorative isometric 3D warehouse models */}
      <LandingFlowBackdrop3D reduceMotion={!!reduceMotion} />

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28 lg:px-8 lg:pb-24 lg:pt-32">
        <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-6 xl:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative lg:col-span-6 xl:col-span-7"
          >
            <div
              className={`mb-5 flex items-center gap-3 ${isRtl ? "flex-row-reverse" : ""}`}
            >
              <span
                className="h-px w-8 shrink-0 bg-gradient-to-r from-[#F97316] to-transparent sm:w-10"
                aria-hidden
              />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#F97316] sm:text-xs">
                {t.flowEyebrow}
              </p>
            </div>

            <h2 className="max-w-xl text-[1.85rem] font-bold tracking-tight text-[#0B3A44] sm:text-4xl lg:text-[2.55rem] lg:leading-[1.15]">
              {t.flowTitle}
            </h2>

            <p className="mt-5 max-w-lg text-[0.95rem] leading-relaxed text-slate-600 sm:text-base">
              {t.flowDesc}
            </p>

            {/* Micro flow strip under copy — creative cue without cards */}
            <div
              className="mt-8 flex max-w-md items-center gap-2 sm:mt-10"
              aria-hidden
            >
              {steps.map((step, i) => (
                <div key={step.title} className="flex flex-1 items-center gap-2">
                  <motion.span
                    className={`h-1.5 flex-1 rounded-full ${isRtl ? "origin-right" : "origin-left"}`}
                    style={{ backgroundColor: step.accent }}
                    initial={{ scaleX: 0, opacity: 0 }}
                    whileInView={{ scaleX: 1, opacity: i === 0 ? 1 : 0.35 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.5,
                      delay: 0.15 + i * 0.1,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                  {i < steps.length - 1 && (
                    <span className="h-1 w-1 shrink-0 rounded-full bg-[#0B3A44]/25" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Visual anchor — magasinier + tablette IA cutout */}
          <motion.div
            initial={{ opacity: 0, x: isRtl ? -28 : 28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex justify-center overflow-visible lg:col-span-6 xl:col-span-5 lg:justify-end"
          >
            <div className="relative flex h-[22rem] w-full max-w-[22rem] items-end justify-center sm:h-[26rem] sm:max-w-[24rem] lg:h-[30rem] lg:max-w-[26rem]">
              {/* Soft luminous stage behind hologram */}
              <div
                className="pointer-events-none absolute left-1/2 top-[38%] h-[70%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(14,116,144,0.22)_0%,rgba(249,115,22,0.08)_42%,transparent_70%)]"
                aria-hidden
              />

              {/* Orbit ring — subtle tech cue */}
              <motion.div
                className="pointer-events-none absolute left-1/2 top-[42%] h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#0E7490]/20"
                style={{
                  borderStyle: "dashed",
                  borderWidth: 1.5,
                }}
                animate={reduceMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
                aria-hidden
              />
              <div
                className="pointer-events-none absolute left-1/2 top-[42%] h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#F97316]/15"
                aria-hidden
              />

              {/* Floor shadow */}
              <motion.div
                className="absolute bottom-1 left-1/2 h-4 w-[52%] -translate-x-1/2 rounded-[100%] bg-[#0B3A44]/18 blur-md"
                animate={
                  reduceMotion
                    ? undefined
                    : { scaleX: [1, 1.06, 1], opacity: [0.32, 0.5, 0.32] }
                }
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              />

              <motion.img
                src={MAGASINIER_SRC}
                alt={t.flowTruckAlt}
                className="relative z-10 h-full w-auto max-w-full object-contain object-bottom drop-shadow-[0_24px_40px_rgba(11,58,68,0.22)]"
                draggable={false}
                animate={
                  reduceMotion
                    ? undefined
                    : { y: [0, -5, 0], x: isRtl ? [0, -3, 0] : [0, 3, 0] }
                }
                transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </div>

        {/* Flow track */}
        <div className="relative mt-12 sm:mt-14 lg:mt-16">
          <div
            className="pointer-events-none absolute left-[8%] right-[8%] top-[1.65rem] hidden h-px bg-gradient-to-r from-transparent via-[#0B3A44]/22 to-transparent lg:block"
            aria-hidden
          />
          {!reduceMotion && (
            <motion.div
              className="pointer-events-none absolute top-[1.55rem] hidden h-0.5 w-14 rounded-full bg-gradient-to-r from-[#F97316] to-[#EA580C] lg:block"
              initial={{ left: "8%" }}
              animate={{ left: ["8%", "78%", "8%"] }}
              transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            />
          )}

          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.li
                  key={step.title}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{
                    duration: 0.4,
                    delay: i * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="relative"
                >
                  <div className="flex items-start gap-4 lg:flex-col lg:items-start lg:gap-0">
                    <div className="relative z-10 flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-2xl bg-white/90 shadow-[0_12px_28px_-14px_rgba(11,58,68,0.45)] ring-1 ring-[#0B3A44]/10 backdrop-blur-sm">
                      <Icon
                        className="h-5 w-5"
                        style={{ color: step.accent }}
                        aria-hidden
                      />
                      <span
                        className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                        style={{ backgroundColor: step.accent }}
                      >
                        {i + 1}
                      </span>
                    </div>

                    <div className="min-w-0 lg:mt-5">
                      <h3 className="text-base font-semibold tracking-tight text-[#0B3A44] sm:text-lg">
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                        {step.text}
                      </p>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
