import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Film, Sparkles } from "lucide-react";
import { roleLabel } from "../../../security/roleLabels";
import { useLandingLang } from "../../landing/LandingLangContext";

export default function DashboardCinematicIntro({ user, onShowDetails }) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef(null);
  const { t } = useLandingLang();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reduceMotion) {
      video.pause();
      return;
    }
    video.play().catch(() => {});
  }, [reduceMotion]);

  return (
    <div className="relative -mx-6 -mt-6 min-h-[calc(100dvh-4.25rem)] overflow-hidden lg:-mx-8 lg:-mt-8">
      <style>{`
        @keyframes cinematicPulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.85; }
        }
        .cinematic-scanline {
          animation: cinematicPulse 4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cinematic-scanline { animation: none !important; }
        }
      `}</style>

      <video
        ref={videoRef}
        src="/home-assets/dashboard-hero.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover object-center"
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[8%] bg-gradient-to-b from-black/60 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-black/80 via-black/40 to-transparent" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, transparent 40%, rgba(0,0,0,0.22) 100%)",
        }}
        aria-hidden
      />
      <div
        className="cinematic-scanline pointer-events-none absolute inset-x-[12%] top-[5.5%] h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent"
        aria-hidden
      />

      <div className="relative z-[2] flex min-h-[calc(100dvh-4.25rem)] flex-col justify-end px-6 pb-10 pt-16 sm:px-10 sm:pb-14 lg:px-14 lg:pb-16">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl space-y-5"
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100 backdrop-blur-md">
            <Film className="h-3.5 w-3.5" />
            {t.dashCineEyebrow}
          </p>

          <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)] sm:text-5xl lg:text-6xl">
            {t.dashCineTitle}
            <span className="block bg-gradient-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-transparent">
              {t.dashCineAccent}
            </span>
          </h1>

          <p className="max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">
            {user?.prenom} {user?.nom}
            <span className="text-white/45"> · </span>
            <span className="font-medium text-cyan-200">{roleLabel(user?.role)}</span>
          </p>

          <motion.button
            type="button"
            onClick={onShowDetails}
            whileHover={reduceMotion ? undefined : { scale: 1.03, y: -2 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            className="group mt-2 inline-flex items-center gap-3 rounded-2xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-colors hover:border-cyan-300/40 hover:bg-white/15"
          >
            <Sparkles className="h-4 w-4 text-cyan-200" />
            {t.dashCineCta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
