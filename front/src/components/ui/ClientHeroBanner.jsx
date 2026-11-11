import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, Boxes, Package, PackageCheck, ScanLine, Truck, Warehouse } from "lucide-react";
import { useLandingLang } from "../../pages/landing/LandingLangContext";

const CLIENT_HERO_VIDEO_SRC = "/home-assets/catalog-hero.mp4?v=20260908orig";
const SLIDE_MS = 5200;

const DEPOT_CHAPTERS = [
  { id: "flow", Icon: Warehouse, titleKey: "heroChapFlowTitle", captionKey: "heroChapFlowCaption", duration: 6200 },
  { id: "catalog", Icon: ScanLine, titleKey: "heroChapCatalogTitle", captionKey: "heroChapCatalogCaption" },
  { id: "ship", Icon: Truck, titleKey: "heroChapShipTitle", captionKey: "heroChapShipCaption" },
  { id: "prep", Icon: PackageCheck, titleKey: "heroChapPrepTitle", captionKey: "heroChapPrepCaption" },
];

/**
 * Hero catalogue : vidéo dépôt en fond + légende HUD (sans photos).
 */
export default function ClientHeroBanner({
  eyebrow = "Dépôt vivant · Catalogue TND",
  title = "Des rayons remplis,",
  titleAccent = "prêts à commander",
  subtitle = "Ambiance dépôt smart comme la home : catalogue multi-produits, suivi commandes et packing live — vos références restent à portée de clic.",
  stats,
  onExplore,
  ctaLabel = "Découvrir",
  compact = false,
}) {
  const { t, lang } = useLandingLang();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  const chapters = useMemo(
    () =>
      DEPOT_CHAPTERS.map((chapter) => ({
        ...chapter,
        title: t[chapter.titleKey] || chapter.id,
        caption: t[chapter.captionKey] || "",
      })),
    [t]
  );

  const slide = chapters[index] || chapters[0];
  const SlideIcon = slide?.Icon || Warehouse;

  useEffect(() => {
    if (reduceMotion || chapters.length < 2) return undefined;
    const delay = slide?.duration || SLIDE_MS;
    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % chapters.length);
    }, delay);
    return () => window.clearTimeout(id);
  }, [reduceMotion, index, slide?.duration, chapters.length]);

  useEffect(() => {
    setIndex(0);
  }, [lang]);

  if (!slide) return null;

  const stepLabel = `${String(index + 1).padStart(2, "0")} / ${String(chapters.length).padStart(2, "0")}`;

  return (
    <section
      className={`client-hero client-hero--depot${compact ? " client-hero--compact" : ""}`}
      aria-label="Bannière dépôt produits"
    >
      <div className="client-hero__stage" aria-hidden="true">
        <video
          src={CLIENT_HERO_VIDEO_SRC}
          className="client-hero__media"
          autoPlay={!reduceMotion}
          muted
          loop
          playsInline
          preload="auto"
        />
      </div>

      <div className="client-hero__veil client-hero__veil--soft" />

      <div className="client-hero__content client-hero__content--split">
        <div className="client-hero__copy">
          <motion.p
            className="client-hero__eyebrow"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Warehouse className="w-3.5 h-3.5" />
            {eyebrow}
          </motion.p>

          <motion.h1
            className="client-hero__title"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
          >
            {title}{" "}
            <span className="client-hero__accent">{titleAccent}</span>
          </motion.h1>

          <motion.p
            className="client-hero__subtitle"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            {subtitle}
          </motion.p>

          <motion.div
            className="client-hero__actions"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            {onExplore && (
              <button type="button" onClick={onExplore} className="btn-primary-orange inline-flex items-center gap-2 px-5 py-3 text-sm">
                {ctaLabel}
                <ArrowDown className="w-4 h-4" />
              </button>
            )}
            {stats?.total != null && (
              <span className="stat-pill">
                <Boxes className="w-3.5 h-3.5 text-sky-300" />
                {stats.total} références
              </span>
            )}
            {stats?.inStock != null && (
              <span className="stat-pill">
                <Package className="w-3.5 h-3.5 text-sky-300" />
                {stats.inStock} en stock
              </span>
            )}
          </motion.div>
        </div>

        <div className="client-hero__live">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              className="client-hero__live-card"
              initial={reduceMotion ? false : { opacity: 0, x: 18, y: 6 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.4 }}
            >
              <div className="client-hero__live-view" aria-hidden="true">
                <span className="client-hero__live-view-corner" data-pos="tl" />
                <span className="client-hero__live-view-corner" data-pos="tr" />
                <span className="client-hero__live-view-corner" data-pos="bl" />
                <span className="client-hero__live-view-corner" data-pos="br" />
                <span className="client-hero__live-view-scan" />
                <span className="client-hero__live-view-glyph">
                  <SlideIcon strokeWidth={1.7} />
                </span>
              </div>

              <div className="client-hero__live-copy">
                <div className="client-hero__live-meta">
                  <p className="client-hero__live-kicker">
                    <span className="client-hero__live-pulse" />
                    {t.heroLiveKicker || "Flux dépôt"}
                  </p>
                  <span className="client-hero__live-step">{stepLabel}</span>
                </div>
                <p className="client-hero__live-title">{slide.title}</p>
                <p className="client-hero__live-caption">{slide.caption}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="client-hero__dots" role="tablist" aria-label={t.heroChaptersAria || "Chapitres du dépôt"}>
            {chapters.map((chapter, i) => (
              <button
                key={chapter.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={chapter.title}
                className={`client-hero__dot ${i === index ? "is-active" : ""}`}
                onClick={() => setIndex(i)}
              >
                {i === index && !reduceMotion && (
                  <motion.span
                    className="client-hero__dot-progress"
                    layoutId="hero-dot-progress"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: (slide.duration || SLIDE_MS) / 1000, ease: "linear" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
