import { useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useLandingLang } from "../LandingLangContext";

const ACCENT = "#F15A24";

/** Line-art icons: white strokes + orange accents (capture style) */
function IconExportLogistics({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="34" cy="30" r="20" stroke="#fff" strokeWidth="1.75" />
      <ellipse
        cx="34"
        cy="30"
        rx="8.5"
        ry="20"
        stroke="#fff"
        strokeWidth="1.5"
      />
      <path
        d="M14.5 30h39"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16.8 21c5 2.4 11.5 3.7 17.2 3.7s12.2-1.3 17.2-3.7"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M16.8 39c5-2.4 11.5-3.7 17.2-3.7s12.2 1.3 17.2 3.7"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Box */}
      <path
        d="M24 48h20v14H24z"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M24 48l10-5.5L44 48"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M34 42.5V62" stroke="#fff" strokeWidth="1.5" />
      {/* Plane — orange */}
      <g transform="translate(50 8) rotate(32)">
        <path
          d="M1 5h13l5-3.2L21 5l-2 3.2H14"
          stroke={ACCENT}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M6 5L2.5 1.2M6 5L2.5 8.8"
          stroke={ACCENT}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M12.5 5l-1.8-3.2M12.5 5l-1.8 3.2"
          stroke={ACCENT}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function IconFastDelivery({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Speed dots — orange */}
      <circle cx="9" cy="32" r="2.6" fill={ACCENT} />
      <circle cx="18" cy="32" r="2.6" fill={ACCENT} />
      <circle cx="27" cy="32" r="2.6" fill={ACCENT} />
      {/* Cargo */}
      <rect
        x="30"
        y="22"
        width="22"
        height="20"
        rx="1"
        stroke="#fff"
        strokeWidth="1.75"
      />
      {/* Cab */}
      <path
        d="M52 30h9.5l5 7.5V42H52V30z"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M53.5 32.5h5.5v5H53.5z"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Chassis */}
      <path
        d="M30 42h36.5"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Wheels */}
      <circle cx="38" cy="46.5" r="4.5" stroke="#fff" strokeWidth="1.75" />
      <circle cx="38" cy="46.5" r="1.6" fill="#fff" />
      <circle cx="58" cy="46.5" r="4.5" stroke="#fff" strokeWidth="1.75" />
      <circle cx="58" cy="46.5" r="1.6" fill="#fff" />
    </svg>
  );
}

function IconSupport247({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Circular refresh arrow */}
      <path
        d="M54 36a18 18 0 1 1-5.3-12.7"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M54 24v12H42"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Phone handset */}
      <path
        d="M28.5 42.5c1.4 2.8 4.2 5.4 7.2 6.5 1.4.5 2.9.2 3.9-.7l2.3-2.3c.8-.8.8-2.1.1-2.9l-2.5-2.8c-.7-.8-2-.9-2.9-.3l-1.4.8c-.5.3-1.1.2-1.4-.2-1.4-1.3-2.6-2.8-3.4-4.4-.2-.5-.1-1.1.3-1.4l.9-1.3c.6-.8.5-2-.2-2.7l-2.7-2.6c-.8-.8-2.1-.8-2.9.1l-2.1 2.3c-.9 1-1.1 2.5-.6 3.9 1.4 3.2 4 6.2 7.1 8.4z"
        stroke="#fff"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      {/* 24/7 orange */}
      <text
        x="36"
        y="29"
        textAnchor="middle"
        fill={ACCENT}
        fontSize="10"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.5"
      >
        24/7
      </text>
    </svg>
  );
}

const FEATURE_META = [
  { icon: IconExportLogistics, accent: "#FFFFFF" },
  { icon: IconFastDelivery, accent: "#FFFFFF" },
  { icon: IconSupport247, accent: "#FFFFFF" },
];

const MAGASINIER_SRC = "/cutouts/magasinier-cutout.png?v=3";
const CAMION_SRC = "/cutouts/camion-cutout.png";

function MagasinierFigure({ reduceMotion, alt }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const x = useTransform(scrollYProgress, [0, 0.5, 1], ["-18%", "8%", "22%"]);
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [18, 0, -10]);

  return (
    <div ref={ref} className="relative z-30 flex w-full items-end justify-center">
      <motion.div
        className="absolute bottom-2 left-1/2 h-4 w-[55%] -translate-x-1/2 rounded-[100%] bg-black/25 blur-md"
        animate={
          reduceMotion
            ? undefined
            : { scaleX: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }
        }
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        style={reduceMotion ? undefined : { x, y }}
        className="relative will-change-transform"
      >
        <motion.div
          animate={
            reduceMotion
              ? undefined
              : { y: [0, -4, 0], rotate: [0, -0.6, 0, 0.4, 0] }
          }
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          {!reduceMotion && (
            <motion.div
              className="absolute bottom-[20%] left-[6%] h-14 w-12 rounded-full bg-[#F97316]/20 blur-xl"
              animate={{ opacity: [0.2, 0.45, 0.2], x: [-8, 6, -8] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          <img
            src={MAGASINIER_SRC}
            alt={alt}
            className="relative z-30 -mt-28 hidden h-[380px] w-auto max-w-[95%] object-contain object-bottom drop-shadow-2xl sm:block md:-mt-32 md:h-[420px] lg:-mt-36 lg:h-[460px]"
            draggable={false}
          />
          <img
            src={MAGASINIER_SRC}
            alt={alt}
            className="-mt-16 h-56 w-auto object-contain sm:hidden"
            draggable={false}
          />

          {!reduceMotion && (
            <motion.span
              className="absolute bottom-[11%] right-[28%] hidden h-2.5 w-2.5 rounded-full bg-[#FACC15]/85 shadow-[0_0_12px_rgba(250,204,21,0.75)] sm:block"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

function FeatureCard({ feature, index, reduceMotion, statusDefault, statusHover }) {
  const Icon = feature.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.1,
      }}
      whileHover={reduceMotion ? undefined : { y: -6 }}
      className={`group relative flex min-h-[280px] flex-col justify-between overflow-hidden border-white/5 px-6 py-12 sm:min-h-[320px] sm:border-l sm:px-7 sm:py-14 first:sm:border-l-0 ${
        hovered ? "ring-1 ring-inset ring-white/20" : ""
      }`}
      style={{
        background:
          index % 2 === 0
            ? "linear-gradient(165deg, rgba(11,58,68,0.96) 0%, rgba(8,40,48,0.94) 100%)"
            : "linear-gradient(165deg, rgba(18,74,86,0.96) 0%, rgba(11,58,68,0.94) 100%)",
      }}
    >
      {/* Camion visible uniquement au survol — traverse la carte */}
      <AnimatePresence>
        {hovered && (
          <motion.img
            key="camion"
            src={CAMION_SRC}
            alt=""
            aria-hidden
            className="pointer-events-none absolute bottom-6 h-24 w-auto -scale-x-100 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)] sm:h-28"
            initial={{ x: "120%", opacity: 0 }}
            animate={
              reduceMotion
                ? { x: "28%", opacity: 0.55 }
                : {
                    x: ["120%", "-55%"],
                    opacity: [0, 0.7, 0.7, 0],
                  }
            }
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={
              reduceMotion
                ? { duration: 0.35 }
                : {
                    duration: 4.5,
                    repeat: Infinity,
                    ease: "linear",
                    times: [0, 0.12, 0.85, 1],
                  }
            }
            draggable={false}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="absolute left-0 top-0 h-full w-[3px] origin-top"
        style={{ backgroundColor: feature.accent }}
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, delay: 0.15 + index * 0.1 }}
        animate={{ opacity: hovered ? 1 : 0.7, scaleX: hovered ? 1.6 : 1 }}
      />

      <div className="relative z-10">
        <motion.div
          className="mb-6 inline-flex items-center justify-center"
          whileHover={
            reduceMotion ? undefined : { scale: 1.06, y: -2 }
          }
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
        >
          <Icon className="h-14 w-14 sm:h-16 sm:w-16" />
        </motion.div>

        <h3 className="text-xl font-bold tracking-tight text-white">
          {feature.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-white/75">
          {feature.text}
        </p>
      </div>

      <div className="relative z-10 mt-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45 transition-colors duration-300 group-hover:text-white/85">
        <span>{hovered ? statusHover : statusDefault}</span>
        <ArrowUpRight
          className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          style={{ color: feature.accent }}
        />
      </div>

      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
          hovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{
          background: `radial-gradient(circle at 28% 18%, ${feature.accent}26, transparent 55%)`,
        }}
      />
    </motion.article>
  );
}

export default function LandingFeatures() {
  const reduceMotion = useReducedMotion();
  const { t } = useLandingLang();
  const features = useMemo(
    () =>
      (t.features || []).map((item, i) => ({
        ...item,
        ...FEATURE_META[i],
      })),
    [t.features]
  );

  return (
    <section
      id="fonctionnalites"
      className="relative z-20 scroll-mt-28 overflow-visible bg-[#0B3A44] text-white sm:scroll-mt-32"
    >
      <div className="grid items-stretch lg:grid-cols-12">
        <div className="relative z-30 flex min-h-[280px] items-end justify-center overflow-visible bg-white lg:col-span-4 xl:col-span-3">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-200/55 to-transparent" />
          <MagasinierFigure
            reduceMotion={reduceMotion}
            alt={t.featuresMagasinierAlt}
          />
        </div>

        <div className="relative overflow-hidden lg:col-span-8 xl:col-span-9">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_55%,rgba(255,255,255,0.08),transparent_55%)]" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />
          </div>

          <div className="relative z-10 grid h-full sm:grid-cols-3">
            {features.map((feature, i) => (
              <FeatureCard
                key={feature.title}
                feature={feature}
                index={i}
                reduceMotion={reduceMotion}
                statusDefault={t.featuresStatus}
                statusHover={t.featuresStatusHover}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
