import { useEffect, useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  BrainCircuit,
  ClipboardList,
  PackageOpen,
  ShoppingCart,
} from "lucide-react";
import { useLandingLang } from "../LandingLangContext";

const MODULE_ICONS = [PackageOpen, ShoppingCart, ClipboardList, BrainCircuit];
const MODULE_ACCENTS = ["#F97316", "#0B3A44", "#38BDF8", "#A855F7"];

/** 4 visuels créés sur mesure pour chaque pilier */
const MODULE_IMAGES = [
  "/home-assets/module-purchasing.png",
  "/home-assets/module-sales.png",
  "/home-assets/module-inventory.png",
  "/home-assets/module-ai.png",
];

export default function LandingModules() {
  const { t } = useLandingLang();
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const modules = useMemo(
    () =>
      (t.modules || []).map((mod, i) => ({
        ...mod,
        icon: MODULE_ICONS[i] || PackageOpen,
        accent: MODULE_ACCENTS[i] || MODULE_ACCENTS[0],
        image: MODULE_IMAGES[i] || MODULE_IMAGES[0],
      })),
    [t.modules]
  );

  useEffect(() => {
    if (reduceMotion || paused || modules.length < 2) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % modules.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [reduceMotion, paused, modules.length]);

  const current = modules[active] || modules[0];
  if (!current) return null;

  const selectModule = (i) => {
    setActive(i);
    setPaused(true);
  };

  return (
    <section
      id="apropos"
      className="relative scroll-mt-28 overflow-hidden bg-[#F4F7F8] py-20 text-slate-900 sm:scroll-mt-32 sm:py-24"
    >
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#F97316]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-[#0B3A44]/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-14">
          {/* Stage — 4 images sur mesure */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="order-2 lg:order-1"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="relative">
              <div className="absolute -inset-3 rounded-[1.75rem] bg-gradient-to-br from-[#0B3A44]/15 via-transparent to-[#F97316]/20 blur-xl" />

              <div className="relative overflow-hidden rounded-[1.35rem] shadow-2xl shadow-[#0B3A44]/20 ring-1 ring-[#0B3A44]/10">
                <div className="relative aspect-[3/4] w-full">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={current.image}
                      src={current.image}
                      alt={current.title}
                      initial={
                        reduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 1.06, y: 16 }
                      }
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={
                        reduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 1.03, y: -12 }
                      }
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />
                  </AnimatePresence>

                  {!reduceMotion && (
                    <motion.div
                      key={`glow-${active}`}
                      className="pointer-events-none absolute inset-0"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        background: `radial-gradient(circle at 28% 18%, ${current.accent}30, transparent 48%)`,
                      }}
                    />
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06262e]/88 via-[#06262e]/20 to-transparent" />

                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                    <motion.div
                      key={`cap-${active}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-end justify-between gap-3"
                    >
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F97316]">
                          {t.modulesEyebrow}
                        </p>
                        <p className="mt-1 text-lg font-bold text-white sm:text-xl">
                          {current.title}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md ring-1 ring-white/25">
                        0{active + 1} / 0{modules.length}
                      </span>
                    </motion.div>

                    <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/20">
                      <motion.div
                        key={`bar-${active}-${paused}`}
                        className="h-full rounded-full bg-[#F97316]"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={
                          paused || reduceMotion
                            ? { duration: 0.2 }
                            : { duration: 4.5, ease: "linear" }
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 4 miniatures = 4 images créées */}
                <div className="grid grid-cols-4 gap-2 border-t border-white/10 bg-[#0B3A44] p-2.5">
                  {modules.map((mod, i) => (
                    <button
                      key={mod.image}
                      type="button"
                      onClick={() => selectModule(i)}
                      className={`relative aspect-[4/3] overflow-hidden rounded-lg ring-2 transition-all duration-200 ${
                        i === active
                          ? "ring-[#F97316] scale-[1.02]"
                          : "ring-transparent opacity-65 hover:opacity-100"
                      }`}
                      aria-label={mod.title}
                    >
                      <img
                        src={mod.image}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <motion.div
                animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -right-2 top-6 hidden max-w-[160px] rounded-2xl border border-white/60 bg-white/95 px-3 py-2 shadow-xl shadow-[#0B3A44]/15 backdrop-blur sm:block"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F97316]">
                  {t.modulesEyebrow}
                </p>
                <p className="truncate text-xs font-bold text-[#0B3A44]">
                  {current.title}
                </p>
              </motion.div>
            </div>
          </motion.div>

          {/* Cartes interactives */}
          <div className="order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F97316]">
                {t.modulesEyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B3A44] sm:text-4xl">
                {t.modulesTitle}
              </h2>
              <p className="mt-3 max-w-xl text-base text-slate-600">{t.modulesDesc}</p>
            </motion.div>

            <ul className="mt-10 grid gap-3.5 sm:grid-cols-2">
              {modules.map((mod, i) => {
                const Icon = mod.icon;
                const isHot = active === i;
                return (
                  <motion.li
                    key={mod.title}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.35, ease: "easeOut", delay: i * 0.07 }}
                    onMouseEnter={() => selectModule(i)}
                    onFocus={() => selectModule(i)}
                    onMouseLeave={() => setPaused(false)}
                    className="group relative"
                  >
                    <motion.article
                      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.015 }}
                      transition={{ type: "spring", stiffness: 320, damping: 22 }}
                      className={`relative h-full overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${
                        isHot
                          ? "border-transparent bg-white shadow-xl shadow-[#0B3A44]/12 ring-1 ring-[#F97316]/35"
                          : "border-slate-200/80 bg-white/80 shadow-sm hover:shadow-md"
                      }`}
                    >
                      <motion.div
                        className="absolute left-0 top-0 h-full w-1 origin-top"
                        style={{ backgroundColor: mod.accent }}
                        animate={{ scaleY: isHot ? 1 : 0.35, opacity: isHot ? 1 : 0.5 }}
                        transition={{ duration: 0.25 }}
                      />

                      {isHot && !reduceMotion && (
                        <motion.div
                          layoutId="module-glow"
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background: `radial-gradient(circle at 20% 0%, ${mod.accent}18, transparent 55%)`,
                          }}
                        />
                      )}

                      <div className="relative z-10">
                        <div
                          className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-300"
                          style={{
                            backgroundColor: isHot ? `${mod.accent}18` : "#0B3A4414",
                            color: isHot ? mod.accent : "#0B3A44",
                          }}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </div>
                        <h3 className="text-base font-semibold text-[#0B3A44]">
                          {mod.title}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                          {mod.text}
                        </p>
                      </div>
                    </motion.article>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
