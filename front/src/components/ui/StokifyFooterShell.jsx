import { useRef } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowUp, ArrowUpRight } from "lucide-react";

export const LOGO_SRC = "/home-assets/stokify-logo-home.png";
const TRUCK_SRC = "/cutouts/camion-cutout.png";
const TRANSPALETTE_SRC = "/cutouts/transpalette-cutout.png";
const COLIS_SRC = "/cutouts/produit-colis-stack-cutout.png";

export const EASE = [0.16, 1, 0.3, 1];

export const TEAL = "#0B3A44";
export const TEAL_DEEP = "#06262e";
export const TEAL_INK = "#041c22";
export const WHITE = "#FFFFFF";
export const CYAN = "#0E7490";
export const ORANGE = "#FF5400";
export const ORANGE_SOFT = "#FF7A33";

export function FooterLink({ href, to, children }) {
  const className =
    "group inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors duration-200 ease-out hover:text-white";
  const arrow = (
    <ArrowUpRight
      className="h-3.5 w-3.5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-1 group-hover:opacity-100"
      strokeWidth={2.4}
      aria-hidden
    />
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        <span>{children}</span>
        {arrow}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      <span>{children}</span>
      {arrow}
    </a>
  );
}

/** 3D scene — camion, transpalette, colis kraft */
export function Footer3DScene({ reduceMotion }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ perspective: "1100px" }}
      aria-hidden
    >
      <div
        className="absolute inset-x-[-15%] bottom-[-20%] h-[70%] opacity-70"
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 50% 0%, ${CYAN}40, transparent 62%),
            radial-gradient(ellipse 45% 35% at 72% 12%, ${ORANGE}33, transparent 58%),
            radial-gradient(ellipse 40% 30% at 50% 8%, rgba(255,255,255,0.16), transparent 55%)
          `,
          transform: "rotateX(68deg) scale(1.35)",
          transformOrigin: "center top",
        }}
      />
      <svg
        className="absolute inset-x-0 bottom-0 h-[55%] w-full opacity-40"
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
            stroke={x === 400 || x === 540 ? ORANGE_SOFT : CYAN}
            strokeOpacity={x === 400 || x === 540 ? 0.45 : 0.18}
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
            strokeOpacity="0.25"
            strokeWidth="1"
          />
        ))}
      </svg>

      <motion.img
        src={COLIS_SRC}
        alt=""
        draggable={false}
        decoding="async"
        className="absolute bottom-[18%] left-[42%] w-[4.5rem] -translate-x-1/2 object-contain sm:bottom-[20%] sm:w-28 lg:w-36"
        style={{
          filter: `drop-shadow(0 20px 22px rgba(0,0,0,0.55)) drop-shadow(0 0 18px ${ORANGE}44)`,
          transformStyle: "preserve-3d",
        }}
        animate={
          reduceMotion
            ? undefined
            : { y: [0, -14, 0], rotateZ: [-3, 3, -3], rotateY: [-6, 8, -6] }
        }
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.img
        src={COLIS_SRC}
        alt=""
        draggable={false}
        decoding="async"
        className="absolute left-[8%] top-[24%] hidden w-16 object-contain opacity-90 sm:block sm:w-20"
        style={{
          filter: `drop-shadow(0 18px 16px rgba(0,0,0,0.5)) drop-shadow(0 0 12px ${ORANGE}33)`,
          transformStyle: "preserve-3d",
        }}
        animate={
          reduceMotion
            ? undefined
            : { y: [0, -12, 0], rotateY: [-10, 8, -10], rotateX: [8, 14, 8] }
        }
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />

      <motion.img
        src={COLIS_SRC}
        alt=""
        draggable={false}
        decoding="async"
        className="absolute right-[6%] top-[28%] w-14 object-contain opacity-85 sm:w-[4.75rem]"
        style={{
          filter: `drop-shadow(0 16px 14px rgba(0,0,0,0.45)) drop-shadow(0 0 10px ${ORANGE}2a)`,
          transformStyle: "preserve-3d",
        }}
        animate={
          reduceMotion
            ? undefined
            : { y: [0, 12, 0], rotateY: [10, -6, 10], rotateX: [12, 6, 12] }
        }
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />

      <motion.img
        src={TRUCK_SRC}
        alt=""
        draggable={false}
        decoding="async"
        className="absolute bottom-[10%] right-[6%] w-40 object-contain sm:right-[10%] sm:w-56 lg:w-72"
        style={{
          filter:
            "brightness(1.12) contrast(1.06) saturate(1.1) drop-shadow(0 26px 24px rgba(0,0,0,0.55))",
          transformStyle: "preserve-3d",
        }}
        animate={
          reduceMotion
            ? undefined
            : {
                y: [0, -10, 0],
                x: [0, 8, 0],
                rotateY: [-14, -6, -14],
                rotateX: [6, 12, 6],
              }
        }
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.img
        src={TRANSPALETTE_SRC}
        alt=""
        draggable={false}
        decoding="async"
        className="absolute bottom-[8%] left-[2%] w-32 -scale-x-100 object-contain sm:left-[5%] sm:w-48 lg:left-[7%] lg:w-56"
        style={{
          filter:
            "brightness(1.14) contrast(1.08) saturate(1.12) drop-shadow(0 22px 20px rgba(0,0,0,0.55))",
          transformStyle: "preserve-3d",
        }}
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, 40, 0],
                y: [0, -8, 0],
                rotateY: [10, 18, 10],
                rotateX: [4, 10, 4],
                scale: [1, 1.03, 1],
              }
        }
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.span
        className="absolute -left-16 top-20 h-64 w-64 rounded-full blur-3xl"
        style={{ background: "rgba(255,255,255,0.16)" }}
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 28, 0], y: [0, -18, 0], opacity: [0.35, 0.55, 0.35] }
        }
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute -right-20 bottom-0 h-72 w-72 rounded-full blur-3xl"
        style={{ background: `${CYAN}40` }}
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -22, 0], y: [0, 14, 0], opacity: [0.3, 0.5, 0.3] }
        }
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute right-[18%] top-[12%] h-48 w-48 rounded-full blur-3xl"
        style={{ background: `${ORANGE}2e` }}
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -16, 0], y: [0, 12, 0], opacity: [0.35, 0.6, 0.35] }
        }
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />

      {!reduceMotion &&
        [
          { left: "22%", top: "38%", color: WHITE, d: 2.6 },
          { left: "55%", top: "30%", color: ORANGE, d: 3.1 },
          { left: "70%", top: "48%", color: CYAN, d: 2.4 },
          { left: "30%", top: "58%", color: ORANGE_SOFT, d: 3.4 },
        ].map((n, i) => (
          <motion.span
            key={i}
            className="absolute h-2 w-2 rounded-full"
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

export function TiltPanel({ children, reduceMotion, className = "" }) {
  const ref = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), {
    stiffness: 180,
    damping: 22,
  });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), {
    stiffness: 180,
    damping: 22,
  });
  const glareX = useTransform(mx, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(my, [-0.5, 0.5], [0, 100]);
  const glare = useMotionTemplate`radial-gradient(420px circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.12), transparent 55%)`;

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
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ perspective: 1400 }}
    >
      <motion.div
        style={
          reduceMotion
            ? undefined
            : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }
        }
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#06262e]/55 shadow-[0_32px_64px_-28px_rgba(0,0,0,0.65)] backdrop-blur-md"
      >
        <motion.div
          className="pointer-events-none absolute inset-0 z-20"
          style={{ background: reduceMotion ? undefined : glare }}
          aria-hidden
        />
        <div
          className="absolute inset-x-0 top-0 z-30 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${ORANGE}, ${WHITE}, ${CYAN}, transparent)`,
          }}
        />
        <div className="relative z-10">{children}</div>
      </motion.div>
    </div>
  );
}

/**
 * Shell visuel partagé — landing + espace client.
 * waveFill : couleur de la vague haute (fond de la section précédente).
 */
export default function StokifyFooterShell({
  children,
  waveFill = "#ffffff",
  dir,
  bottomLeft,
  backToTopLabel = "Haut de page",
}) {
  const reduceMotion = useReducedMotion();

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <footer
      className="relative mt-auto overflow-hidden text-white"
      style={{ background: `linear-gradient(180deg, ${TEAL_DEEP} 0%, ${TEAL_INK} 100%)` }}
      dir={dir}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 leading-[0]">
        <svg
          viewBox="0 0 1440 72"
          preserveAspectRatio="none"
          className="block h-10 w-full sm:h-14"
          aria-hidden
        >
          <path
            d="M0,0 L1440,0 L1440,28 C1200,64 960,8 720,36 C480,64 240,20 0,48 Z"
            fill={waveFill}
          />
        </svg>
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 55% at 12% 18%, rgba(255,255,255,0.12), transparent 55%),
            radial-gradient(ellipse 55% 40% at 78% 22%, ${ORANGE}22, transparent 55%),
            radial-gradient(ellipse 70% 50% at 88% 78%, ${CYAN}33, transparent 52%),
            radial-gradient(ellipse 50% 40% at 50% 100%, ${TEAL}66, transparent 70%)
          `,
        }}
        aria-hidden
      />
      <Footer3DScene reduceMotion={reduceMotion} />

      <motion.div
        className="relative z-10 mx-auto max-w-7xl px-4 pb-8 pt-16 sm:px-6 sm:pt-20 lg:px-8"
        initial={reduceMotion ? false : { opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <TiltPanel reduceMotion={reduceMotion}>{children}</TiltPanel>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-white/45">{bottomLeft}</div>
          <motion.button
            type="button"
            onClick={scrollTop}
            className="group inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/70 sm:self-auto"
            style={{
              boxShadow: "0 10px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
            whileHover={
              reduceMotion
                ? undefined
                : {
                    y: -4,
                    rotateX: 10,
                    scale: 1.04,
                    borderColor: `${ORANGE}99`,
                    color: WHITE,
                    backgroundColor: `${ORANGE}22`,
                  }
            }
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          >
            {backToTopLabel}
            <ArrowUp
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5"
              aria-hidden
            />
          </motion.button>
        </div>
      </motion.div>
    </footer>
  );
}
