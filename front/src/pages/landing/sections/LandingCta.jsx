import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useLandingLang } from "../LandingLangContext";

const CTA_VIDEO_SRC = "/home-assets/homee.mp4";

export default function LandingCta() {
  const { t } = useLandingLang();

  return (
    <section className="relative overflow-hidden py-20 pb-24 sm:py-24 sm:pb-28">
      <video
        src={CTA_VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover object-center brightness-[1.14] contrast-[1.08] saturate-[1.06]"
        aria-hidden
      />
      <div className="absolute inset-0 bg-[#06262e]/42" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#06262e]/55 via-[#0B3A44]/28 to-[#06262e]/40" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F97316]">
            {t.ctaEyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t.ctaTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/80">{t.ctaDesc}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition-all duration-200 ease-out hover:bg-[#ea6a0c]"
            >
              {t.signup}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-lg border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-white/20"
            >
              {t.ctaLogin}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
