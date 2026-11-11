import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useLandingLang } from "../LandingLangContext";

const HERO_VIDEO_SRC = "/home-assets/dashboard-hero.mp4";
const SLIDE_IMAGES = {
  "warehouse-v2": "/home-assets/hero-warehouse-v2.png",
  "dock-truck": "/home-assets/hero-dock-truck.png",
  "smart-ops": "/home-assets/hero-smart-ops.png",
};
const HERO_BACKGROUNDS = [
  { id: "dashboard-video", type: "video", src: HERO_VIDEO_SRC, contentId: "smart-ops" },
  { id: "warehouse-v2", type: "image", src: SLIDE_IMAGES["warehouse-v2"], contentId: "warehouse-v2" },
  { id: "dock-truck", type: "image", src: SLIDE_IMAGES["dock-truck"], contentId: "dock-truck" },
  { id: "smart-ops", type: "image", src: SLIDE_IMAGES["smart-ops"], contentId: "smart-ops" },
];
const CAMION_SRC = "/cutouts/camion-cutout.png";

export default function LandingHero() {
  const { t } = useLandingLang();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const slides = useMemo(() => {
    const contentSlides = t.heroSlides || [];
    const byId = Object.fromEntries(contentSlides.map((s) => [s.id, s]));
    return HERO_BACKGROUNDS.map((bg) => ({
      ...(byId[bg.contentId] || contentSlides[0]),
      ...bg,
      slideKey: bg.id,
    })).filter((s) => s.title);
  }, [t.heroSlides]);

  useEffect(() => {
    if (!slides.length) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    setIndex(0);
  }, [t.heroSlides]);

  const slide = slides[index] || slides[0];
  if (!slide) return null;

  const goRegister = (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    navigate(trimmed ? `/register?email=${encodeURIComponent(trimmed)}` : "/register");
  };

  return (
    <section
      id="accueil"
      className="relative scroll-mt-28 overflow-visible bg-[#0B3A44] text-white sm:scroll-mt-32"
    >
      <div className="relative min-h-[78vh] overflow-hidden sm:min-h-[85vh]">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.slideKey}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute inset-0"
          >
            {slide.type === "video" ? (
              <video
                src={slide.src}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                className="h-full w-full object-cover object-center"
                aria-hidden
              />
            ) : (
              <img
                src={slide.src}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#06262e]/88 via-[#0B3A44]/55 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06262e]/50 via-transparent to-[#06262e]/25" />
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:grid-cols-12 lg:items-center lg:gap-8 lg:px-8 lg:pb-24 lg:pt-36">
          <div className="relative lg:col-span-7">
            <div className="relative mb-3 h-[72px] w-full max-w-lg overflow-visible sm:h-[84px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`camion-trail-${slide.slideKey}`}
                  className="absolute left-0 top-0 h-full w-full"
                  initial="hidden"
                  animate="show"
                  exit="leave"
                  variants={{
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: { staggerChildren: 0.12, delayChildren: 0.05 },
                    },
                    leave: {
                      x: "-140%",
                      opacity: 0,
                      transition: { duration: 0.5, ease: "easeIn" },
                    },
                  }}
                >
                  <svg
                    className="absolute left-0 top-0 h-full w-[min(260px,70%)] -translate-x-[42%] text-white"
                    viewBox="0 0 260 84"
                    fill="none"
                    aria-hidden
                  >
                    <motion.path
                      d="M10 70 C 45 68, 70 62, 88 48 C 108 30, 102 12, 124 16 C 150 22, 148 52, 170 58 C 188 63, 210 60, 248 56"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeDasharray="2 8"
                      variants={{
                        hidden: { pathLength: 0, opacity: 0 },
                        show: {
                          pathLength: 1,
                          opacity: 0.95,
                          transition: { duration: 0.9, ease: "easeOut" },
                        },
                        leave: { opacity: 0, transition: { duration: 0.2 } },
                      }}
                    />
                    <motion.circle
                      cx="248"
                      cy="56"
                      r="3.5"
                      fill="#F97316"
                      variants={{
                        hidden: { scale: 0, opacity: 0 },
                        show: {
                          scale: 1,
                          opacity: 1,
                          transition: { delay: 0.75, duration: 0.25, ease: "easeOut" },
                        },
                        leave: { opacity: 0 },
                      }}
                    />
                  </svg>

                  <motion.img
                    src={CAMION_SRC}
                    alt={t.heroTruckAlt}
                    variants={{
                      hidden: { x: -200, y: 12, opacity: 0, rotate: -6 },
                      show: {
                        x: 0,
                        y: 0,
                        opacity: 1,
                        rotate: 0,
                        transition: {
                          type: "spring",
                          stiffness: 130,
                          damping: 15,
                          delay: 0.65,
                        },
                      },
                      leave: {
                        x: -220,
                        opacity: 0,
                        transition: { duration: 0.45, ease: "easeIn" },
                      },
                    }}
                    className="absolute bottom-0 left-0 h-12 w-auto -scale-x-100 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)] sm:h-14"
                    draggable={false}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <motion.p
              key={`${slide.slideKey}-eyebrow-${t.heroLearnMore}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.75 }}
              className="text-sm font-semibold uppercase tracking-[0.12em] text-white sm:text-base"
            >
              {slide.eyebrow}
            </motion.p>
            <motion.h1
              key={`${slide.slideKey}-title-${t.heroLearnMore}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
              className="mt-2 max-w-xl text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-[3.4rem]"
            >
              {slide.title}
            </motion.h1>
            <motion.p
              key={`${slide.slideKey}-text-${t.heroLearnMore}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
              className="mt-4 max-w-lg text-base text-white/85 sm:text-lg"
            >
              {slide.text}
            </motion.p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-[#F97316] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/25 transition-colors duration-200 ease-out hover:bg-[#ea6a0c]"
              >
                {t.heroLearnMore}
              </Link>
              <Link
                to="/register"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#F97316] text-white transition-colors duration-200 ease-out hover:bg-[#ea6a0c]"
                aria-label={t.heroSignupAria}
              >
                <ArrowUpRight className="h-5 w-5" />
              </Link>
            </div>

            <div className="mt-8 flex items-center gap-2">
              <button
                type="button"
                aria-label={t.heroSlidePrev}
                onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 hover:bg-white/20"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={t.heroSlideNext}
                onClick={() => setIndex((i) => (i + 1) % slides.length)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 hover:bg-white/20"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 lg:justify-self-end">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.12 }}
              className="w-full max-w-md rounded-2xl border border-white/25 bg-white/10 p-6 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-7"
            >
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                {t.heroTrialTitle}
              </h2>
              <form onSubmit={goRegister} className="mt-5 space-y-3.5">
                <input
                  type="text"
                  name="name"
                  placeholder={t.heroNamePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-white/35 bg-transparent px-3.5 py-3 text-sm text-white placeholder:text-white/55 outline-none transition-colors duration-200 ease-out focus:border-white"
                />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder={t.heroEmailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-white/35 bg-transparent px-3.5 py-3 text-sm text-white placeholder:text-white/55 outline-none transition-colors duration-200 ease-out focus:border-white"
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-colors duration-200 ease-out hover:bg-slate-100"
                >
                  {t.signup}
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
