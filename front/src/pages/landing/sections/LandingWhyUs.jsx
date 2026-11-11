import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { Layers, Lock, Server } from "lucide-react";
import { useLandingLang } from "../LandingLangContext";

const TAB_ICONS = {
  fonctionnalites: Layers,
  securite: Lock,
  architecture: Server,
};

const TAB_ACCENTS = {
  fonctionnalites: "#FF5400",
  securite: "#0B3A44",
  architecture: "#0E7490",
};

/** Custom clear scene images created for this section */
const TAB_SCENES = {
  fonctionnalites: {
    scene: "/home-assets/why-features-scene.png?v=2",
    kenBurns: { scale: [1.04, 1.1], x: ["0%", "-2%"], y: ["0%", "-1%"] },
  },
  securite: {
    scene: "/home-assets/why-security-scene.png?v=2",
    kenBurns: { scale: [1.05, 1.11], x: ["1%", "-1%"], y: ["0%", "1%"] },
  },
  architecture: {
    scene: "/home-assets/why-architecture-scene.png?v=2",
    kenBurns: { scale: [1.03, 1.09], x: ["-1%", "1%"], y: ["0%", "-1%"] },
  },
};

const AUTOPLAY_MS = 6200;

const FENWICK_PATH =
  "M 40 360 C 180 250, 280 400, 420 310 C 560 220, 680 390, 820 300 C 900 250, 940 290, 960 310";

function FenwickTrack({ reduceMotion }) {
  return (
    <div className="relative z-20 -mt-16 overflow-visible bg-transparent sm:-mt-20 lg:-mt-24">
      <div className="relative mx-auto h-[340px] w-full max-w-7xl px-2 sm:h-[420px] lg:h-[480px]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1000 480"
          preserveAspectRatio="xMidYMid meet"
          overflow="visible"
          aria-hidden
        >
          <path
            id="fenwick-trajet"
            d={FENWICK_PATH}
            fill="none"
            stroke="#0B3A44"
            strokeOpacity="0.28"
            strokeWidth="2.8"
            strokeDasharray="14 12"
            strokeLinecap="round"
          />

          <circle cx="500" cy="265" r="16" fill="#FF5400" fillOpacity="0.15" />
          <circle
            cx="500"
            cy="265"
            r="9"
            fill="#FF5400"
            stroke="#fff"
            strokeWidth="2.5"
          />
          {!reduceMotion && (
            <circle
              cx="500"
              cy="265"
              r="9"
              fill="none"
              stroke="#FF5400"
              strokeWidth="2"
              opacity="0.7"
            >
              <animate
                attributeName="r"
                values="9;24;9"
                dur="2.2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.7;0;0.7"
                dur="2.2s"
                repeatCount="indefinite"
              />
            </circle>
          )}

          <circle cx="960" cy="310" r="12" fill="#0B3A44" fillOpacity="0.12" />
          <circle
            cx="960"
            cy="310"
            r="7"
            fill="#0B3A44"
            stroke="#fff"
            strokeWidth="2"
          />

          <g>
            {reduceMotion ? (
              <animateMotion
                dur="0.01s"
                repeatCount="1"
                fill="freeze"
                keyPoints="0.45;0.45"
                keyTimes="0;1"
                rotate="0"
                calcMode="linear"
              >
                <mpath href="#fenwick-trajet" />
              </animateMotion>
            ) : (
              <animateMotion
                dur="10s"
                repeatCount="indefinite"
                rotate="0"
                calcMode="linear"
              >
                <mpath href="#fenwick-trajet" />
              </animateMotion>
            )}
            <g transform="scale(-1 1)">
              <image
                href="/cutouts/fenwick-cutout.png"
                x="-190"
                y="-280"
                width="380"
                height="300"
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
          </g>
        </svg>
        <span className="sr-only">Fenwick sur trajet logistique</span>
      </div>
    </div>
  );
}

function TiltVisual({ active, imageAlt, reduceMotion }) {
  const ref = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), {
    stiffness: 160,
    damping: 24,
  });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), {
    stiffness: 160,
    damping: 24,
  });

  const accent = active.accent || TAB_ACCENTS.fonctionnalites;
  const scene = active.scene;
  const kenBurns = active.kenBurns;

  const onMove = (e) => {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
      style={{ perspective: 1400 }}
    >
      <motion.div
        className="pointer-events-none absolute -inset-6 rounded-[2rem] blur-3xl"
        animate={{
          background: `radial-gradient(circle at 35% 40%, ${accent}28, transparent 62%)`,
        }}
        transition={{ duration: 0.65 }}
      />

      <motion.div
        style={
          reduceMotion
            ? undefined
            : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }
        }
        className="relative overflow-hidden rounded-[1.5rem] bg-white shadow-[0_28px_56px_-24px_rgba(11,58,68,0.35)] ring-1 ring-[#0B3A44]/10"
      >
        <motion.div
          className="absolute inset-x-0 top-0 z-30 h-[3px] origin-left"
          style={{ backgroundColor: accent }}
          key={`line-${active.id}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />

        <div className="relative aspect-[16/11] w-full overflow-hidden sm:aspect-[16/10]">
          <AnimatePresence mode="wait">
            <motion.div
              key={scene}
              className="absolute inset-0"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 1.06, x: 16 }
              }
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 1.03, x: -12 }
              }
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.img
                src={scene}
                alt={imageAlt}
                className="absolute inset-0 h-full w-full object-cover brightness-[1.06] contrast-[1.02] saturate-[1.05]"
                draggable={false}
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        scale: kenBurns.scale,
                        x: kenBurns.x,
                        y: kenBurns.y,
                      }
                }
                transition={
                  reduceMotion
                    ? undefined
                    : {
                        duration: AUTOPLAY_MS / 1000,
                        ease: "linear",
                        repeat: Infinity,
                        repeatType: "mirror",
                      }
                }
              />
            </motion.div>
          </AnimatePresence>

          {/* Light caption gradient only — keeps image clear */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0B3A44]/55 to-transparent" />

          {!reduceMotion && (
            <motion.div
              className="pointer-events-none absolute inset-y-0 z-10 w-1/4 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              animate={{ x: ["-40%", "140%"] }}
              transition={{
                duration: 4.5,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 2.8,
              }}
            />
          )}

          <div className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0B3A44] shadow-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              {!reduceMotion && (
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
                  style={{ backgroundColor: accent }}
                />
              )}
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: accent }}
              />
            </span>
            Live
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="absolute bottom-0 left-0 right-0 z-30 p-4 sm:p-5"
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: accent === "#0B3A44" ? "#FFB080" : accent }}
              >
                {active.label}
              </p>
              <p className="mt-0.5 text-base font-bold text-white drop-shadow-sm sm:text-lg">
                {active.title}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LandingWhyUs() {
  const { t } = useLandingLang();
  const reduceMotion = useReducedMotion();
  const tabs = useMemo(
    () =>
      (t.whyTabs || []).map((tab) => {
        const scene = TAB_SCENES[tab.id] || TAB_SCENES.fonctionnalites;
        return {
          ...tab,
          icon: TAB_ICONS[tab.id] || Layers,
          accent: TAB_ACCENTS[tab.id] || TAB_ACCENTS.fonctionnalites,
          scene: scene.scene,
          kenBurns: scene.kenBurns,
        };
      }),
    [t.whyTabs]
  );
  const [activeId, setActiveId] = useState(tabs[0]?.id || "fonctionnalites");
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeId) && tabs[0]) {
      setActiveId(tabs[0].id);
    }
  }, [tabs, activeId]);

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const ActiveIcon = active?.icon || Layers;
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeId)
  );

  const goNext = useCallback(() => {
    if (!tabs.length) return;
    setActiveId(tabs[(activeIndex + 1) % tabs.length].id);
    setProgress(0);
  }, [tabs, activeIndex]);

  const selectTab = (id) => {
    setActiveId(id);
    setProgress(0);
  };

  // Autoplay with progress
  useEffect(() => {
    if (reduceMotion || paused || tabs.length < 2) {
      setProgress(0);
      return;
    }

    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / AUTOPLAY_MS);
      setProgress(p);
      if (p >= 1) {
        goNext();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeId, paused, reduceMotion, tabs.length, goNext]);

  if (!active) return null;

  return (
    <section id="pourquoi" className="relative scroll-mt-28 overflow-visible bg-white text-slate-900 sm:scroll-mt-32">
      {/* Atmospheric layers */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #0B3A44 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-24 top-0 h-96 w-96 rounded-full bg-[#FF5400]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-32 h-[28rem] w-[28rem] rounded-full bg-[#0B3A44]/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 pb-8 sm:px-6 sm:py-24 sm:pb-10 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.p
            className="inline-flex items-center gap-2 rounded-full border border-[#FF5400]/25 bg-[#FF5400]/10 px-3.5 py-1 text-sm font-semibold uppercase tracking-[0.18em] text-[#EA580C]"
            animate={
              reduceMotion
                ? undefined
                : {
                    boxShadow: [
                      "0 0 0 rgba(255,84,0,0)",
                      "0 0 18px rgba(255,84,0,0.22)",
                      "0 0 0 rgba(255,84,0,0)",
                    ],
                  }
            }
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF5400]" />
            {t.whyEyebrow}
          </motion.p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0B3A44] sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            {t.whyTitle}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            {t.whyDesc}
          </p>
        </motion.div>

        <div
          className="mt-14 grid items-start gap-10 lg:grid-cols-12 lg:gap-12"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
          }}
        >
          {/* Visual stage */}
          <div className="lg:col-span-6 xl:col-span-7">
            <TiltVisual
              active={active}
              imageAlt={t.whyImageAlt}
              reduceMotion={reduceMotion}
            />

            {/* Tab index dots — mobile/desktop complement */}
            <div className="mt-5 flex items-center justify-center gap-2 lg:justify-start">
              {tabs.map((tab, i) => {
                const selected = tab.id === activeId;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-label={tab.label}
                    onClick={() => selectTab(tab.id)}
                    className="group relative h-1.5 overflow-hidden rounded-full transition-all duration-300"
                    style={{
                      width: selected ? 40 : 16,
                      backgroundColor: selected
                        ? "rgba(11,58,68,0.15)"
                        : "rgba(11,58,68,0.12)",
                    }}
                  >
                    {selected && (
                      <motion.span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          backgroundColor: tab.accent,
                          width: `${progress * 100}%`,
                        }}
                      />
                    )}
                    {!selected && i < activeIndex && (
                      <span
                        className="absolute inset-0 rounded-full opacity-40"
                        style={{ backgroundColor: tab.accent }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive content */}
          <div className="lg:col-span-6 xl:col-span-5">
            {/* Vertical tab rail */}
            <div
              role="tablist"
              aria-label={t.whyEyebrow}
              className="flex flex-col gap-2"
            >
              {tabs.map((tab, i) => {
                const selected = tab.id === activeId;
                const Icon = tab.icon;
                return (
                  <motion.button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => selectTab(tab.id)}
                    whileHover={reduceMotion ? undefined : { x: 4 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                    className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 text-left transition-colors duration-300 ${
                      selected
                        ? "text-white"
                        : "bg-[#F4F7F8] text-slate-600 hover:bg-[#E8EEF0] hover:text-[#0B3A44]"
                    }`}
                  >
                    {selected && (
                      <motion.span
                        layoutId="why-tab-bg"
                        className="absolute inset-0 bg-[#0B3A44]"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 32,
                        }}
                      />
                    )}

                    {/* Progress fill on active tab */}
                    {selected && !reduceMotion && (
                      <motion.span
                        className="absolute inset-y-0 left-0 bg-white/10"
                        style={{ width: `${progress * 100}%` }}
                      />
                    )}

                    <span
                      className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        selected
                          ? "bg-white/15 text-white"
                          : "bg-white text-[#0B3A44] ring-1 ring-slate-200/80"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>

                    <span className="relative z-10 min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                        0{i + 1}
                      </span>
                      <span className="block truncate text-sm font-semibold sm:text-[15px]">
                        {tab.label}
                      </span>
                    </span>

                    {selected && (
                      <motion.span
                        layoutId="why-tab-accent"
                        className="relative z-10 h-8 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: tab.accent }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Detail panel */}
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                role="tabpanel"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="relative mt-5 overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-[#F8FAFB] p-5 sm:p-6"
              >
                {/* Corner accent */}
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl"
                  style={{ backgroundColor: active.accent }}
                />

                <div className="mb-5 flex items-start gap-3">
                  <motion.div
                    key={`${active.id}-icon`}
                    initial={
                      reduceMotion
                        ? { opacity: 0 }
                        : { scale: 0.7, rotate: -12, opacity: 0 }
                    }
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 18 }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: `${active.accent}18`,
                      color: active.accent,
                    }}
                  >
                    <ActiveIcon className="h-5 w-5" aria-hidden />
                  </motion.div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-[#0B3A44]">
                      {active.title}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                      {active.label}
                    </p>
                  </div>
                </div>

                {/* Numbered timeline points */}
                <ul className="relative space-y-0">
                  {/* Connecting line */}
                  <motion.div
                    className="absolute bottom-3 left-[15px] top-3 w-px origin-top bg-gradient-to-b from-[#FF5400]/50 via-slate-200 to-transparent"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    aria-hidden
                  />

                  {active.points.map((point, i) => (
                    <motion.li
                      key={point}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.08 + i * 0.09,
                        duration: 0.35,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="relative flex gap-4 py-3"
                    >
                      <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#0B3A44] shadow-sm ring-1 ring-slate-200">
                        <motion.span
                          initial={
                            reduceMotion ? undefined : { scale: 0 }
                          }
                          animate={{ scale: 1 }}
                          transition={{
                            delay: 0.15 + i * 0.09,
                            type: "spring",
                            stiffness: 400,
                            damping: 16,
                          }}
                        >
                          {i + 1}
                        </motion.span>
                      </span>
                      <span className="pt-1 text-sm leading-relaxed text-slate-600">
                        {point}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <FenwickTrack reduceMotion={reduceMotion} />
    </section>
  );
}
