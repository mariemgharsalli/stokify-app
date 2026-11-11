import { useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

const EASE = [0.16, 1, 0.3, 1];
const TEAL = "#0b1f3a";
const CYAN = "#38bdf8";
const ORANGE = "#F97316";
const WHITE = "#FFFFFF";
const TRANSPALETTE_SRC = "/cutouts/transpalette-cutout.png";
const COLIS_SRC = "/cutouts/produit-colis-stack-cutout.png";
const MAGASINIER_SRC = "/cutouts/magasinier-cutout.png";

const CATALOG_PRODUCTS = [
  {
    src: "/cutouts/produit-pc-cutout.png",
    className: "client-page-intro__product client-page-intro__product--a",
    duration: 9,
    delay: 0,
    animate: { y: [0, -12, 0], rotate: [-3, 4, -3] },
  },
  {
    src: "/cutouts/produit-cosmetique-cutout.png",
    className: "client-page-intro__product client-page-intro__product--b",
    duration: 11,
    delay: 0.35,
    animate: { y: [0, 10, 0], rotate: [4, -3, 4] },
  },
  {
    src: "/cutouts/produit-jeux-cutout.png",
    className: "client-page-intro__product client-page-intro__product--c",
    duration: 8,
    delay: 0.7,
    animate: { y: [0, -9, 0], rotate: [-2, 3, -2] },
  },
];

function Intro3DScene({
  reduceMotion,
  showPackages = false,
  showCatalogProducts = false,
  showMagasinier = false,
}) {
  return (
    <div
      className="client-page-intro__scene"
      style={{ perspective: "1100px" }}
      aria-hidden
    >
      <div
        className="client-page-intro__floor"
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 50% 0%, ${CYAN}45, transparent 62%),
            radial-gradient(ellipse 40% 30% at 50% 8%, rgba(255,255,255,0.14), transparent 55%)
          `,
          transform: "rotateX(68deg) scale(1.35)",
          transformOrigin: "center top",
        }}
      />

      <svg
        className="client-page-intro__vanish"
        viewBox="0 0 1000 400"
        preserveAspectRatio="none"
        aria-hidden
      >
        {[120, 260, 400, 540, 680, 820].map((x) => (
          <line
            key={x}
            x1="500"
            y1="20"
            x2={x}
            y2="400"
            stroke={x === 400 || x === 540 ? WHITE : CYAN}
            strokeOpacity={x === 400 || x === 540 ? 0.35 : 0.16}
            strokeWidth="1.5"
          />
        ))}
        {[80, 140, 210, 290].map((y) => (
          <ellipse
            key={y}
            cx="500"
            cy={y}
            rx={80 + y * 1.1}
            ry={10 + y * 0.04}
            fill="none"
            stroke={TEAL}
            strokeOpacity="0.22"
            strokeWidth="1"
          />
        ))}
      </svg>

      {showPackages ? (
        <motion.img
          src={COLIS_SRC}
          alt=""
          draggable={false}
          decoding="async"
          className="client-page-intro__product client-page-intro__product--colis"
          style={{ transformStyle: "preserve-3d" }}
          animate={
            reduceMotion
              ? undefined
              : { y: [0, -10, 0], rotate: [-2, 3, -2] }
          }
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      {showCatalogProducts
        ? CATALOG_PRODUCTS.map((item) => (
            <motion.img
              key={item.src}
              src={item.src}
              alt=""
              draggable={false}
              decoding="async"
              className={item.className}
              style={{ transformStyle: "preserve-3d" }}
              animate={reduceMotion ? undefined : item.animate}
              transition={{
                duration: item.duration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: item.delay,
              }}
            />
          ))
        : null}

      {showMagasinier ? (
        <motion.div
          className="client-page-intro__magasinier-wrap"
          initial={reduceMotion ? { opacity: 0.9, x: 0 } : { opacity: 0, x: 140 }}
          animate={
            reduceMotion
              ? { opacity: 0.9, x: 0 }
              : { opacity: 1, x: 0, y: [0, -3, 0] }
          }
          transition={
            reduceMotion
              ? { duration: 0.35 }
              : {
                  opacity: { duration: 0.65, ease: EASE },
                  x: { duration: 1.05, ease: EASE },
                  y: {
                    duration: 3.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1.1,
                  },
                }
          }
        >
          <img
            src={MAGASINIER_SRC}
            alt=""
            draggable={false}
            decoding="async"
            className="client-page-intro__product client-page-intro__product--magasinier"
          />
        </motion.div>
      ) : null}

      <motion.span
        className="client-page-intro__glow client-page-intro__glow--a"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 22, 0], y: [0, -14, 0], opacity: [0.35, 0.55, 0.35] }
        }
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="client-page-intro__glow client-page-intro__glow--b"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -18, 0], y: [0, 12, 0], opacity: [0.3, 0.5, 0.3] }
        }
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      {!reduceMotion &&
        [
          { left: "58%", top: "22%", color: WHITE, d: 2.6 },
          { left: "78%", top: "38%", color: CYAN, d: 3.1 },
          { left: "88%", top: "58%", color: ORANGE, d: 2.4 },
          { left: "66%", top: "68%", color: "#378add", d: 3.4 },
        ].map((n, i) => (
          <motion.span
            key={i}
            className="client-page-intro__node"
            style={{
              left: n.left,
              top: n.top,
              background: n.color,
              boxShadow: `0 0 12px ${n.color}`,
            }}
            animate={{ opacity: [0.25, 0.9, 0.25], scale: [1, 1.35, 1] }}
            transition={{ duration: n.d, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
    </div>
  );
}

/**
 * En-tête de section 3D / dynamique — style LandingFooter.
 * Catalogue / panier / commandes / favoris / profil.
 */
export default function ClientPageIntro({
  icon: Icon,
  kicker = "Espace client",
  title,
  subtitle,
  delay = 0,
  children,
  showPackages = false,
  showCatalogProducts = false,
  showMagasinier = false,
  showRunway = true,
}) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), {
    stiffness: 180,
    damping: 22,
  });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-7, 7]), {
    stiffness: 180,
    damping: 22,
  });
  const glareX = useTransform(mx, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(my, [-0.5, 0.5], [0, 100]);
  const glare = useMotionTemplate`radial-gradient(480px circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.14), transparent 55%)`;

  const onMove = (e) => {
    if (reduce || !ref.current) return;
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
      className="client-page-intro mb-8"
      initial={reduce ? false : { opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: EASE }}
      style={{ perspective: 1400 }}
    >
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="client-page-intro__tilt"
      >
        <motion.div
          className="client-page-intro__panel"
          style={
            reduce
              ? undefined
              : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }
          }
        >
          <Intro3DScene
            reduceMotion={reduce}
            showPackages={showPackages}
            showCatalogProducts={showCatalogProducts}
            showMagasinier={showMagasinier}
          />

          <motion.div
            className="client-page-intro__glare"
            style={{ background: reduce ? undefined : glare }}
            aria-hidden
          />

          <div className="client-page-intro__edge" aria-hidden />

          <div className="client-page-intro__inner">
            {Icon ? (
              <div className="client-page-intro__icon-wrap">
                {!reduce ? (
                  <>
                    <motion.span
                      className="client-page-intro__ring client-page-intro__ring--1"
                      aria-hidden
                      animate={{ rotate: 360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.span
                      className="client-page-intro__ring client-page-intro__ring--2"
                      aria-hidden
                      animate={{ rotate: -360 }}
                      transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                    />
                  </>
                ) : null}

                <motion.div
                  className="client-page-intro__icon"
                  style={{ transformStyle: "preserve-3d" }}
                  animate={
                    reduce
                      ? undefined
                      : {
                          y: [0, -6, 0],
                          rotateY: [-6, 6, -6],
                          boxShadow: [
                            "0 14px 32px -10px rgba(249,115,22,0.5)",
                            "0 22px 40px -8px rgba(249,115,22,0.65)",
                            "0 14px 32px -10px rgba(249,115,22,0.5)",
                          ],
                        }
                  }
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  whileHover={reduce ? undefined : { scale: 1.08, rotate: -4 }}
                >
                  <motion.span
                    className="client-page-intro__icon-glow"
                    aria-hidden
                    animate={
                      reduce
                        ? undefined
                        : { opacity: [0.35, 0.75, 0.35], scale: [0.9, 1.15, 0.9] }
                    }
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <Icon className="client-page-intro__icon-svg" strokeWidth={2} />
                </motion.div>
              </div>
            ) : null}

            <div className="client-page-intro__copy min-w-0 flex-1">
              <motion.p
                className="client-page-intro__kicker"
                initial={reduce ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: delay + 0.08, duration: 0.4, ease: EASE }}
              >
                <span className="client-page-intro__live" aria-hidden>
                  <motion.span
                    className="client-page-intro__live-core"
                    animate={
                      reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.55, 1] }
                    }
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.span
                    className="client-page-intro__live-ping"
                    animate={
                      reduce ? undefined : { scale: [1, 2.2], opacity: [0.5, 0] }
                    }
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                  />
                </span>
                <span className="client-page-intro__kicker-text">{kicker}</span>
                <motion.span
                  className="client-page-intro__kicker-shine"
                  aria-hidden
                  animate={reduce ? undefined : { x: ["-120%", "220%"] }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    repeatDelay: 2.2,
                    ease: "easeInOut",
                  }}
                />
              </motion.p>

              <motion.h1
                className="client-page-intro__title"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: delay + 0.14, duration: 0.45, ease: EASE }}
              >
                <span className="client-page-intro__title-text">{title}</span>
                <motion.span
                  className="client-page-intro__underline"
                  aria-hidden
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: delay + 0.32, duration: 0.55, ease: EASE }}
                />
              </motion.h1>

              {subtitle ? (
                <motion.p
                  className="client-page-intro__subtitle"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: delay + 0.22, duration: 0.4, ease: EASE }}
                >
                  {subtitle}
                </motion.p>
              ) : null}

              {children ? (
                <motion.div
                  className="client-page-intro__actions mt-3"
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: delay + 0.28, duration: 0.35, ease: EASE }}
                >
                  {children}
                </motion.div>
              ) : null}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Piste + transpalette — masquée sur le profil */}
      {showRunway ? (
      <div className="client-page-intro__runway" aria-hidden>
        <div className="client-page-intro__dock">
          <span className="client-page-intro__dock-shine" />
        </div>

        <svg
          className="client-page-intro__path"
          viewBox="0 0 1000 24"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="intro-path-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F97316" stopOpacity="0" />
              <stop offset="20%" stopColor="#F97316" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="80%" stopColor="#38bdf8" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#378add" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M 16 12 L 984 12"
            fill="none"
            stroke="url(#intro-path-grad)"
            strokeWidth="2.5"
            strokeDasharray="11 9"
            strokeLinecap="round"
          />
        </svg>

        {!reduce ? (
          <>
            <motion.span
              className="client-page-intro__trail"
              initial={{ left: "-10%", opacity: 0 }}
              animate={{
                left: ["-10%", "108%"],
                opacity: [0, 0.8, 0.85, 0.8, 0],
              }}
              transition={{
                duration: 9,
                delay: delay + 0.45,
                ease: "linear",
                repeat: Infinity,
                repeatDelay: 1.5,
                times: [0, 0.1, 0.5, 0.9, 1],
              }}
            />
            <motion.div
              className="client-page-intro__transpalette-wrap"
              initial={{ left: "-16%", opacity: 0 }}
              animate={{
                left: ["-16%", "110%"],
                opacity: [0, 1, 1, 1, 0],
              }}
              transition={{
                duration: 9,
                delay: delay + 0.45,
                ease: "linear",
                repeat: Infinity,
                repeatDelay: 1.5,
                times: [0, 0.07, 0.5, 0.93, 1],
              }}
            >
              <img
                src={TRANSPALETTE_SRC}
                alt=""
                draggable={false}
                decoding="async"
                className="client-page-intro__transpalette"
              />
            </motion.div>
          </>
        ) : (
          <div className="client-page-intro__transpalette-wrap client-page-intro__transpalette-wrap--static">
            <img
              src={TRANSPALETTE_SRC}
              alt=""
              draggable={false}
              decoding="async"
              className="client-page-intro__transpalette"
            />
          </div>
        )}
      </div>
      ) : null}
    </motion.div>
  );
}
