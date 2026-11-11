import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { ArrowRight, ChevronDown, Play, Sparkles, Warehouse, Zap } from "lucide-react";
import { LandingLangProvider, useLandingLang } from "./LandingLangContext";
import { LanguageSwitcher } from "./sections/LandingNavbar";

const VIDEO_SRC = "/videos/acceuil.mp4";
const POSTER_SRC = "/videos/acceuil-hero.png";
const LOGO_FULL_SRC = "/logos/logo-stokify-full.png";
const ORANGE_RGB = "249,115,22";

const CHIP_LAYOUT = [
  { key: "introChipAi", icon: Sparkles, className: "left-[4%] top-[34%] xl:left-[8%]" },
  { key: "introChipMulti", icon: Warehouse, className: "right-[4%] top-[38%] xl:right-[8%]" },
  { key: "introChipRealtime", icon: Zap, className: "bottom-[30%] left-[8%] xl:left-[12%]" },
];

const PARTICLES = [
  { x: "14%", y: "24%", delay: 0 },
  { x: "82%", y: "30%", delay: 0.6 },
  { x: "72%", y: "66%", delay: 1.2 },
  { x: "22%", y: "70%", delay: 1.8 },
];

const noMotion = { duration: 0 };
const easeOut = [0.22, 1, 0.36, 1];

const heroStagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const heroItem = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOut } },
};

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}

function FloatingChip({ label, icon: Icon, className, reduceMotion, delay = 0 }) {
  return (
    <motion.div
      className={`absolute hidden items-center gap-2 rounded-full border border-[#378ADD]/30 bg-black/30 px-3 py-1.5 text-xs font-medium text-white/90 shadow-lg backdrop-blur-md md:flex sm:text-sm ${className}`}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={
        reduceMotion
          ? { opacity: 1, scale: 1, y: 0 }
          : { opacity: 1, scale: 1, y: [0, -10, 0] }
      }
      transition={
        reduceMotion
          ? noMotion
          : {
              opacity: { duration: 0.45, delay: 1 + delay },
              scale: { duration: 0.45, delay: 1 + delay },
              y: { duration: 3.5 + delay, repeat: Infinity, ease: "easeInOut", delay },
            }
      }
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#378ADD]/20 text-[#378ADD]">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      {label}
    </motion.div>
  );
}

export default function IntroSplash() {
  return (
    <LandingLangProvider>
      <IntroSplashContent />
    </LandingLangProvider>
  );
}

function IntroSplashContent() {
  const { t } = useLandingLang();
  const navigate = useNavigate();
  const titleWords = t.introTitle.split(" ");
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [exiting, setExiting] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const videoRef = useRef(null);

  const showVideo = !reduceMotion && (!isMobile || videoPlaying);
  const parallaxEnabled = !reduceMotion && !isMobile;

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const videoX = useTransform(mouseX, [-0.5, 0.5], [-6, 6]);
  const videoY = useTransform(mouseY, [-0.5, 0.5], [-5, 5]);
  const overlayX = useTransform(mouseX, [-0.5, 0.5], [3, -3]);
  const overlayY = useTransform(mouseY, [-0.5, 0.5], [3, -3]);
  const contentX = useTransform(mouseX, [-0.5, 0.5], [5, -5]);
  const contentY = useTransform(mouseY, [-0.5, 0.5], [4, -4]);

  useEffect(() => {
    if (!parallaxEnabled) return undefined;
    const handleMove = (e) => {
      mouseX.set(e.clientX / window.innerWidth - 0.5);
      mouseY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, [parallaxEnabled, mouseX, mouseY]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) return undefined;
    const tryPlay = () => video.play().catch(() => {});
    tryPlay();
    video.addEventListener("canplay", tryPlay);
    return () => video.removeEventListener("canplay", tryPlay);
  }, [showVideo, videoPlaying]);

  const navigateWithExit = useCallback(
    (path) => {
      if (exiting) return;
      if (reduceMotion) {
        navigate(path);
        return;
      }
      setExiting(true);
      window.setTimeout(() => navigate(path), 580);
    },
    [navigate, reduceMotion, exiting]
  );

  const goHome = useCallback(() => navigateWithExit("/home"), [navigateWithExit]);
  const goFeatures = useCallback(() => navigateWithExit("/home#fonctionnalites"), [navigateWithExit]);

  const handleCtaKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

  const startMobileVideo = () => setVideoPlaying(true);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex min-h-screen min-h-[100dvh] w-full flex-col overflow-hidden bg-[#06262e] text-white"
      aria-label="Introduction Stokify"
      animate={exiting ? { y: "-100%" } : { y: 0 }}
      transition={reduceMotion ? noMotion : { duration: 0.58, ease: [0.4, 0, 0.15, 1] }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${POSTER_SRC})` }}
        aria-hidden
      />

      {showVideo ? (
        <motion.div
          className="absolute inset-0 overflow-hidden will-change-transform"
          style={parallaxEnabled ? { x: videoX, y: videoY } : undefined}
          aria-hidden
        >
          <motion.div
            className="absolute inset-0"
            animate={reduceMotion ? undefined : { scale: [1.04, 1.09, 1.04] }}
            transition={reduceMotion ? noMotion : { duration: 18, repeat: Infinity, ease: "easeInOut" }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              loop={!isMobile}
              playsInline
              poster={POSTER_SRC}
              src={VIDEO_SRC}
              className="absolute inset-0 h-full w-full object-cover object-[center_42%] brightness-[1.16] contrast-[1.06] saturate-[1.06] sm:object-center"
            />
          </motion.div>
        </motion.div>
      ) : null}

      <motion.div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/15 to-transparent"
        style={parallaxEnabled ? { x: overlayX, y: overlayY } : undefined}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 60px 20px rgba(0,0,0,0.22)" }}
        aria-hidden
      />

      {!reduceMotion ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {PARTICLES.map((p, i) => (
            <motion.span
              key={i}
              className="absolute h-1 w-1 rounded-full bg-[#378ADD]/80 shadow-[0_0_10px_rgba(55,138,221,0.8)]"
              style={{ left: p.x, top: p.y }}
              animate={{ opacity: [0.2, 0.9, 0.2], y: [0, -18, 0] }}
              transition={{ duration: 4 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: p.delay }}
            />
          ))}
        </div>
      ) : null}

      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[4.5vh] min-h-[24px] max-h-[52px] origin-top bg-black"
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={reduceMotion ? noMotion : { duration: 0.85, delay: 0.1, ease: easeOut }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[4.5vh] min-h-[24px] max-h-[52px] origin-bottom bg-black"
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={reduceMotion ? noMotion : { duration: 0.85, delay: 0.1, ease: easeOut }}
        aria-hidden
      />

      {isMobile && !reduceMotion && !videoPlaying ? (
        <button
          type="button"
          onClick={startMobileVideo}
          className="absolute bottom-28 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/25 bg-black/40 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#378ADD]"
          aria-label={t.introPlayVideo}
        >
          <Play className="h-4 w-4 fill-current" aria-hidden />
          {t.introPlayVideo}
        </button>
      ) : null}

      <motion.header
        className={`absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-3 transition-all duration-300 sm:px-8 sm:py-4 ${
          scrolled ? "border-b border-white/10 bg-black/25 backdrop-blur-md" : "bg-transparent"
        }`}
        style={{ paddingTop: "calc(4.5vh + 0.65rem)" }}
        initial={reduceMotion ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? noMotion : { duration: 0.5, delay: 0.1, ease: easeOut }}
      >
        <Link
          to="/"
          className="inline-flex items-center rounded-lg px-1 py-1 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#378ADD]"
          aria-label="Stokify — accueil"
        >
          <img
            src={LOGO_FULL_SRC}
            alt="Stokify — Where Stock Meets Intelligence"
            className="h-14 w-auto max-w-[min(82vw,420px)] object-contain object-left sm:h-20 md:h-24 lg:h-28 xl:h-32"
            draggable={false}
          />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher variant="dark" />
          <Link
            to="/login"
            className="rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-900/25 transition-colors hover:bg-[#ea6a0c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316] sm:px-5 sm:text-base"
          >
            {t.ctaLogin}
          </Link>
        </div>
      </motion.header>

      <div className="relative z-10 flex min-h-screen min-h-[100dvh] flex-col">
        <motion.div
          className="relative flex flex-1 flex-col items-center justify-center px-6 pb-28 pt-24 text-center sm:px-8 sm:pb-32 sm:pt-28"
          style={parallaxEnabled ? { x: contentX, y: contentY } : undefined}
          variants={reduceMotion ? undefined : heroStagger}
          initial={reduceMotion ? false : "hidden"}
          animate={reduceMotion ? undefined : "show"}
        >
          <div
            className="pointer-events-none absolute inset-x-6 top-[18%] bottom-[18%] rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(6,38,46,0.42)_0%,transparent_68%)] sm:inset-x-12"
            aria-hidden
          />

          {!isMobile
            ? CHIP_LAYOUT.map((chip, i) => (
                <FloatingChip
                  key={chip.key}
                  label={t[chip.key]}
                  icon={chip.icon}
                  className={chip.className}
                  reduceMotion={reduceMotion}
                  delay={i * 0.4}
                />
              ))
            : null}

          {reduceMotion ? (
            <h1 className="relative z-[1] max-w-5xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {t.introTitle}
            </h1>
          ) : (
            <motion.h1
              className="relative z-[1] max-w-5xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              {titleWords.map((word, i) => (
                <motion.span
                  key={`${word}-${i}`}
                  className={`mr-[0.26em] inline-block last:mr-0 ${
                    i >= titleWords.length - 2 ? "text-[#378ADD]" : "text-white"
                  }`}
                  initial={{ opacity: 0, y: 32, rotateX: 35 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ duration: 0.6, delay: 0.55 + i * 0.08, ease: easeOut }}
                  style={{ transformPerspective: 700 }}
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>
          )}

          <motion.div
            className="relative z-[1] mx-auto mt-4 h-px w-28 overflow-hidden rounded-full bg-white/15 sm:mt-5 sm:w-36"
            variants={heroItem}
            aria-hidden
          >
            {!reduceMotion ? (
              <motion.div
                className="h-full w-full bg-[#378ADD]"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.5 }}
              />
            ) : null}
          </motion.div>

          <motion.p
            className="relative z-[1] mt-5 max-w-2xl text-base leading-relaxed tracking-wide text-white/70 sm:mt-6 sm:text-lg md:text-xl"
            variants={heroItem}
          >
            {t.introSubtitle}
          </motion.p>

          <motion.div
            className="relative z-[1] mt-10 flex w-full max-w-lg flex-col items-stretch justify-center gap-3 sm:mt-12 sm:max-w-none sm:flex-row sm:items-center sm:gap-4"
            variants={heroItem}
          >
            <motion.button
              type="button"
              onClick={goHome}
              onKeyDown={(e) => handleCtaKeyDown(e, goHome)}
              whileHover={reduceMotion ? undefined : { scale: 1.05, y: -2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      boxShadow: [
                        `0 8px 28px rgba(${ORANGE_RGB},0.35)`,
                        `0 12px 40px rgba(${ORANGE_RGB},0.55)`,
                        `0 8px 28px rgba(${ORANGE_RGB},0.35)`,
                      ],
                    }
              }
              transition={reduceMotion ? noMotion : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#F97316] px-7 py-3.5 text-base font-semibold text-white shadow-md shadow-orange-900/25 transition-colors hover:bg-[#ea6a0c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316] sm:px-8 sm:py-4"
            >
              {!reduceMotion ? (
                <motion.span
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ["-130%", "130%"] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "linear", repeatDelay: 0.6 }}
                  aria-hidden
                />
              ) : null}
              <span className="relative">{t.introDiscover}</span>
              <motion.span
                className="relative inline-flex"
                animate={reduceMotion ? undefined : { x: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowRight className="h-5 w-5" aria-hidden />
              </motion.span>
            </motion.button>

            <motion.button
              type="button"
              onClick={goFeatures}
              onKeyDown={(e) => handleCtaKeyDown(e, goFeatures)}
              whileHover={reduceMotion ? undefined : { scale: 1.03, y: -1 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              className="inline-flex items-center justify-center rounded-xl border border-[#378ADD]/55 bg-transparent px-7 py-3.5 text-base font-semibold text-[#9ec5f5] transition-colors hover:border-[#378ADD] hover:bg-[#378ADD]/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#378ADD] sm:px-8 sm:py-4"
            >
              {t.introExplore}
            </motion.button>
          </motion.div>

          {isMobile ? (
            <div className="relative z-[1] mt-6 flex flex-wrap justify-center gap-2 md:hidden">
              {CHIP_LAYOUT.map((chip) => (
                <span
                  key={chip.key}
                  className="rounded-full border border-[#378ADD]/30 bg-black/30 px-3 py-1 text-xs text-white/85 backdrop-blur-md"
                >
                  {t[chip.key]}
                </span>
              ))}
            </div>
          ) : null}
        </motion.div>

        {!reduceMotion ? (
          <motion.button
            type="button"
            onClick={goHome}
            disabled={exiting}
            aria-label={t.introScrollHint}
            className="absolute bottom-[6vh] left-1/2 z-30 -translate-x-1/2 rounded-full border border-[#378ADD]/45 bg-black/35 p-3 text-white shadow-[0_0_24px_rgba(55,138,221,0.28)] backdrop-blur-sm hover:border-[#378ADD] hover:bg-black/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#378ADD] disabled:pointer-events-none"
            animate={{ y: [0, 14, 0], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
          >
            <ChevronDown className="h-8 w-8" strokeWidth={2.25} aria-hidden />
          </motion.button>
        ) : (
          <button
            type="button"
            onClick={goHome}
            aria-label={t.introScrollHint}
            className="absolute bottom-[6vh] left-1/2 z-30 -translate-x-1/2 rounded-full border border-[#378ADD]/45 bg-black/35 p-3 text-white/90 shadow-lg backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#378ADD]"
          >
            <ChevronDown className="h-8 w-8" strokeWidth={2.25} aria-hidden />
          </button>
        )}
      </div>
    </motion.div>
  );
}
